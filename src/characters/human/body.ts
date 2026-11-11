/**
 * The human body: MakeHuman's CC0 base mesh and shape targets, packed by
 * tools/makehuman/convert_body.py. Pure data and maths (no Three.js), shared by
 * the renderer, the character creator and tests.
 *
 * A body is a base mesh plus a weighted sum of sparse targets. The weights come
 * from a BodyShape: the macro lattice (gender x age x muscle x weight), height,
 * ethnicity, and the creator's detail sliders.
 */

export interface BodyShape {
  /** 0 female .. 1 male. */
  gender: number;
  /** 0 young adult (about 25) .. 1 old (about 90). */
  age: number;
  /** 0 slight .. 0.5 average .. 1 very muscular. */
  muscle: number;
  /** 0 thin .. 0.5 average .. 1 heavy. */
  weight: number;
  /** 0 short .. 0.5 average .. 1 tall. */
  height: number;
  /** Ancestry mix; normalised when used. */
  african: number;
  asian: number;
  caucasian: number;
  /** Detail sliders, -1 .. 1 (one-sided sliders use 0 .. 1). */
  sliders: Record<string, number>;
}

export const DEFAULT_SHAPE: BodyShape = { gender: 1, age: 0.1, muscle: 0.5, weight: 0.5, height: 0.5, african: 0, asian: 0, caucasian: 1, sliders: {} };

interface TargetMeta {
  count: number;
  idx: number;
  d: number;
}
export interface BoneMeta {
  name: string;
  parent: number;
  head: number[];
  tail: number[];
}
export interface BodyMeta {
  scale: number;
  quantum: number;
  baseCount: number;
  renderCount: number;
  indexCount: number;
  layout: Record<'base' | 'renderBase' | 'uv' | 'index' | 'skinIndex' | 'skinWeight', number>;
  targets: Record<string, TargetMeta>;
  sliders: Record<string, { neg?: string; pos: string }>;
  bones: BoneMeta[];
  boneNames: string[];
  lattice: { gender: string[]; age: string[]; muscle: string[]; weight: string[]; ethnic: string[] };
}

/** The body pack, decoded once. */
export class BodyData {
  readonly base: Float32Array;
  readonly renderBase: Uint32Array;
  readonly uv: Float32Array;
  readonly index: Uint32Array;
  readonly skinIndex: Uint8Array;
  readonly skinWeight: Uint8Array;
  private readonly targetCache = new Map<string, { idx: Uint16Array; d: Int16Array }>();

  constructor(
    readonly meta: BodyMeta,
    private readonly bin: ArrayBuffer,
  ) {
    const L = meta.layout;
    this.base = new Float32Array(bin, L.base, meta.baseCount * 3);
    this.renderBase = new Uint32Array(bin, L.renderBase, meta.renderCount);
    this.uv = new Float32Array(bin, L.uv, meta.renderCount * 2);
    this.index = new Uint32Array(bin, L.index, meta.indexCount);
    this.skinIndex = new Uint8Array(bin, L.skinIndex, meta.baseCount * 4);
    this.skinWeight = new Uint8Array(bin, L.skinWeight, meta.baseCount * 4);
  }

  target(name: string): { idx: Uint16Array; d: Int16Array } | null {
    let t = this.targetCache.get(name);
    if (t) return t;
    const m = this.meta.targets[name];
    if (!m) return null;
    t = { idx: new Uint16Array(this.bin, m.idx, m.count), d: new Int16Array(this.bin, m.d, m.count * 3) };
    this.targetCache.set(name, t);
    return t;
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** min / average / max weights for a 0..1 value with 0.5 as average. */
function three(v: number): [number, number, number] {
  v = clamp01(v);
  return v < 0.5 ? [1 - 2 * v, 2 * v, 0] : [0, 2 - 2 * v, 2 * v - 1];
}

/**
 * How much of each target a shape uses. Our own reading of how MakeHuman's
 * macro data is laid out: each lattice target is weighted by the product of
 * its corner weights.
 */
export function targetWeights(meta: BodyMeta, s: BodyShape): Map<string, number> {
  const out = new Map<string, number>();
  const add = (name: string, w: number) => {
    if (w > 1e-4 && meta.targets[name]) out.set(name, (out.get(name) ?? 0) + w);
  };
  const g = clamp01(s.gender);
  const a = clamp01(s.age);
  const G: [string, number][] = [['female', 1 - g], ['male', g]];
  const A: [string, number][] = [['young', 1 - a], ['old', a]];
  const M = three(s.muscle);
  const W = three(s.weight);
  // MakeHuman's height runs from dwarf to giant; people on a British street span the middle quarter of it.
  const h = 0.5 + (clamp01(s.height) - 0.5) * 0.24;
  const hMin = Math.max(0, 1 - 2 * h);
  const hMax = Math.max(0, 2 * h - 1);
  const eth = [Math.max(0, s.african), Math.max(0, s.asian), Math.max(0, s.caucasian)];
  const et = eth[0] + eth[1] + eth[2] || 1;
  for (const [gn, gw] of G)
    for (const [an, aw] of A) {
      const ga = gw * aw;
      if (ga <= 0) continue;
      meta.lattice.muscle.forEach((mn, mi) =>
        meta.lattice.weight.forEach((wn, wi) => add(`universal-${gn}-${an}-${mn}-${wn}`, ga * M[mi] * W[wi])),
      );
      add(`height-${gn}-${an}-averagemuscle-averageweight-minheight`, ga * hMin);
      add(`height-${gn}-${an}-averagemuscle-averageweight-maxheight`, ga * hMax);
      meta.lattice.ethnic.forEach((e, i) => add(`${e}-${gn}-${an}`, ga * (eth[i] / et)));
    }
  for (const [id, v] of Object.entries(s.sliders)) {
    const sl = meta.sliders[id];
    if (!sl || !v) continue;
    if (v > 0) add(sl.pos, Math.min(1, v));
    else if (sl.neg) add(sl.neg, Math.min(1, -v));
  }
  return out;
}

/** Morphed positions of every base vertex (metres). */
export function morph(data: BodyData, s: BodyShape, out = new Float32Array(data.base.length)): Float32Array {
  out.set(data.base);
  const q = data.meta.quantum;
  for (const [name, w] of targetWeights(data.meta, s)) {
    const t = data.target(name);
    if (!t) continue;
    const k = w * q;
    for (let i = 0; i < t.idx.length; i++) {
      const v = t.idx[i] * 3;
      out[v] += t.d[i * 3] * k;
      out[v + 1] += t.d[i * 3 + 1] * k;
      out[v + 2] += t.d[i * 3 + 2] * k;
    }
  }
  return out;
}

function mean(pos: Float32Array, verts: number[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const v of verts) {
    x += pos[v * 3];
    y += pos[v * 3 + 1];
    z += pos[v * 3 + 2];
  }
  const n = verts.length || 1;
  return [x / n, y / n, z / n];
}

export interface BonePlacement {
  name: string;
  parent: number;
  head: [number, number, number];
  tail: [number, number, number];
}

/** Where each bone sits on this body: joints are the average of their vertices, so bones follow the shape. */
export function placeBones(data: BodyData, pos: Float32Array): BonePlacement[] {
  return data.meta.bones.map((b) => ({ name: b.name, parent: b.parent, head: mean(pos, b.head), tail: mean(pos, b.tail) }));
}

/** Lowest point of the body (the soles), to stand it on the ground. */
export function footY(data: BodyData, pos: Float32Array): number {
  let lo = Infinity;
  for (let i = 0; i < data.renderBase.length; i++) lo = Math.min(lo, pos[data.renderBase[i] * 3 + 1]);
  return lo;
}

/** Standing height (m), soles to crown. */
export function standingHeight(data: BodyData, pos: Float32Array): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < data.renderBase.length; i++) {
    const y = pos[data.renderBase[i] * 3 + 1];
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return hi - lo;
}
