/**
 * Clothes cut from the body itself: the styles the MakeHuman packs don't have
 * (hoodies, tracksuits, jackets, joggers, jeans...) are made by taking the part
 * of the morphed body a garment covers, pushing it out from the skin, and
 * colouring it per vertex (body colour, ribbed cuffs and hems, zips, stripes,
 * quilting). They always fit, whatever the body shape, and bend with the same
 * skin weights. Pure data, no Three.js.
 */
import type { BodyData } from './body';

export type GarmentKind =
  | 'hoodie'
  | 'tracksuit_top'
  | 'sweatshirt'
  | 'football'
  | 'bomber'
  | 'puffer'
  | 'leather'
  | 'denim_jacket'
  | 'coat'
  | 'hivis'
  | 'vest'
  | 'trackies'
  | 'joggers'
  | 'jeans'
  | 'work_trousers'
  | 'fight_shorts'
  | 'shorts';

export type Fabric = 'fleece' | 'knit' | 'nylon' | 'denim' | 'leather' | 'cotton' | 'canvas';

interface Style {
  /** How much the cloth hangs off the body's detail (smoothing passes). */
  drape?: number;
  /** Extra looseness towards the cuffs / ankles, m. */
  flare?: number;
  part: 'top' | 'bottoms';
  /** How far out from the skin, m. */
  gap: number;
  fabric: Fabric;
  /** Sleeve length along the arm, 0 (none) .. 1 (to the wrist). */
  sleeve?: number;
  /** Top: hem height between the hip joints (0) and the waist (1); below 0 runs down the thigh. */
  hem?: number;
  /** Bottoms: leg length, 0 (crotch) .. 1 (ankle). */
  leg?: number;
  rib?: boolean;
  zip?: boolean;
  hood?: boolean;
  stripe?: boolean;
  quilt?: boolean;
  pocket?: boolean;
  /** Reflective bands (hi-vis). */
  bands?: boolean;
  /** Knee patches, side pockets. */
  work?: boolean;
  /** Leave the arms and shoulder caps bare. */
  vest?: boolean;
  /** Collar at the neck. */
  collar?: boolean;
}

export const GARMENTS: Record<GarmentKind, Style> = {
  hoodie: { drape: 10, flare: 0.012, part: 'top', gap: 0.024, fabric: 'fleece', sleeve: 1, hem: 0.05, rib: true, hood: true, pocket: true },
  tracksuit_top: { drape: 7, flare: 0.006, part: 'top', gap: 0.014, fabric: 'nylon', sleeve: 1, hem: 0.15, rib: true, zip: true, stripe: true, collar: true },
  sweatshirt: { drape: 8, flare: 0.008, part: 'top', gap: 0.018, fabric: 'fleece', sleeve: 1, hem: 0.1, rib: true },
  football: { drape: 6, part: 'top', gap: 0.01, fabric: 'cotton', sleeve: 0.42, hem: 0.0, collar: true, stripe: true },
  bomber: { drape: 9, flare: 0.01, part: 'top', gap: 0.024, fabric: 'nylon', sleeve: 1, hem: 0.3, rib: true, zip: true, collar: true },
  puffer: { drape: 12, part: 'top', gap: 0.04, fabric: 'nylon', sleeve: 1, hem: 0.0, zip: true, quilt: true, collar: true },
  leather: { drape: 7, part: 'top', gap: 0.016, fabric: 'leather', sleeve: 1, hem: 0.2, zip: true, collar: true },
  denim_jacket: { drape: 8, flare: 0.006, part: 'top', gap: 0.018, fabric: 'denim', sleeve: 1, hem: 0.25, zip: true, collar: true },
  coat: { drape: 10, flare: 0.02, part: 'top', gap: 0.028, fabric: 'canvas', sleeve: 1, hem: -0.14, zip: true, collar: true },
  hivis: { drape: 9, flare: 0.01, part: 'top', gap: 0.02, fabric: 'nylon', sleeve: 1, hem: 0.05, zip: true, bands: true, collar: true },
  vest: { drape: 3, part: 'top', gap: 0.006, fabric: 'cotton', sleeve: 0, hem: 0.1, vest: true },
  trackies: { drape: 10, flare: 0.018, part: 'bottoms', gap: 0.016, fabric: 'nylon', leg: 1, rib: true, stripe: true },
  joggers: { drape: 9, flare: 0.012, part: 'bottoms', gap: 0.014, fabric: 'fleece', leg: 0.95, rib: true },
  jeans: { drape: 6, flare: 0.008, part: 'bottoms', gap: 0.009, fabric: 'denim', leg: 1 },
  work_trousers: { drape: 9, flare: 0.016, part: 'bottoms', gap: 0.015, fabric: 'canvas', leg: 1, work: true },
  fight_shorts: { drape: 8, flare: 0.02, part: 'bottoms', gap: 0.014, fabric: 'nylon', leg: 0.42, stripe: true, rib: true },
  shorts: { drape: 6, flare: 0.012, part: 'bottoms', gap: 0.011, fabric: 'cotton', leg: 0.35 },
};

export interface GarmentColours {
  main: [number, number, number];
  /** Cuffs, collar, stripes (defaults from the main colour). */
  trim?: [number, number, number];
}

export interface GarmentMesh {
  kind: GarmentKind;
  fabric: Fabric;
  /** Render vertices of the body this garment uses (for UVs and skinning). */
  render: Uint32Array;
  /** Positions (m), pushed out from the skin. */
  position: Float32Array;
  normal: Float32Array;
  colour: Float32Array;
  index: Uint32Array;
  /** Body base vertices the garment covers (hide skin triangles made only of these). */
  covers: Uint8Array;
  part: 'top' | 'bottoms';
}

type Group = 'torso' | 'hip' | 'neck' | 'head' | 'armL' | 'armR' | 'handL' | 'handR' | 'legL' | 'legR' | 'footL' | 'footR';

function groupOf(name: string): Group {
  const s = name.endsWith('.L') ? 'L' : 'R';
  if (name.startsWith('upperarm') || name.startsWith('lowerarm')) return `arm${s}` as Group;
  if (name.startsWith('wrist') || name.startsWith('finger')) return `hand${s}` as Group;
  if (name.startsWith('upperleg') || name.startsWith('lowerleg')) return `leg${s}` as Group;
  if (name.startsWith('foot')) return `foot${s}` as Group;
  if (name.startsWith('pelvis')) return 'hip';
  if (name === 'neck02' || name === 'neck03') return 'neck';
  if (name === 'head' || name === 'jaw') return 'head';
  return 'torso';
}

interface Frame {
  group: Group[];
  /** Arm: 0 at the shoulder .. 1 at the wrist. Leg: 0 at the hip joint .. 1 at the ankle. */
  t: Float32Array;
  /** Angle round a limb from its top/outer side (radians, 0 = outer). */
  around: Float32Array;
  hipY: number;
  waistY: number;
  neckY: number;
  neckZ: number;
  shoulderX: number;
}

const memo = new WeakMap<Float32Array, Frame>();
const adjacency = new WeakMap<BodyData, { start: Uint32Array; list: Uint32Array }>();

/** Neighbouring base vertices (CSR), from the body's triangles. */
function neighbours(data: BodyData): { start: Uint32Array; list: Uint32Array } {
  const hit = adjacency.get(data);
  if (hit) return hit;
  const n = data.meta.baseCount;
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  const idx = data.index;
  const rb = data.renderBase;
  for (let i = 0; i < idx.length; i += 3) {
    const a = rb[idx[i]];
    const b = rb[idx[i + 1]];
    const c = rb[idx[i + 2]];
    sets[a].add(b).add(c);
    sets[b].add(a).add(c);
    sets[c].add(a).add(b);
  }
  const start = new Uint32Array(n + 1);
  for (let v = 0; v < n; v++) start[v + 1] = start[v] + sets[v].size;
  const list = new Uint32Array(start[n]);
  for (let v = 0; v < n; v++) {
    let k = start[v];
    for (const u of sets[v]) list[k++] = u;
  }
  const out = { start, list };
  adjacency.set(data, out);
  return out;
}

function headOf(data: BodyData, pos: Float32Array, bone: string): [number, number, number] {
  const b = data.meta.bones.find((x) => x.name === bone);
  if (!b) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const v of b.head) {
    x += pos[v * 3];
    y += pos[v * 3 + 1];
    z += pos[v * 3 + 2];
  }
  const n = b.head.length || 1;
  return [x / n, y / n, z / n];
}

/** Where every vertex sits on the body (which part, how far down its limb). */
export function bodyFrame(data: BodyData, pos: Float32Array): Frame {
  const hit = memo.get(pos);
  if (hit) return hit;
  const n = data.meta.baseCount;
  const names = data.meta.boneNames;
  const groupByBone = names.map(groupOf);
  const group: Group[] = new Array(n);
  const t = new Float32Array(n);
  const around = new Float32Array(n);
  const sh = { L: headOf(data, pos, 'upperarm01.L'), R: headOf(data, pos, 'upperarm01.R') };
  const wr = { L: headOf(data, pos, 'wrist.L'), R: headOf(data, pos, 'wrist.R') };
  const hp = { L: headOf(data, pos, 'upperleg01.L'), R: headOf(data, pos, 'upperleg01.R') };
  const an = { L: headOf(data, pos, 'foot.L'), R: headOf(data, pos, 'foot.R') };
  const hipY = (hp.L[1] + hp.R[1]) / 2;
  const waistY = headOf(data, pos, 'spine04')[1];
  const neckY = headOf(data, pos, 'neck01')[1];
  const neckZ = headOf(data, pos, 'neck01')[2];
  for (let v = 0; v < n; v++) {
    let best = 0;
    let bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = data.skinWeight[v * 4 + k];
      if (w > bw) {
        bw = w;
        best = data.skinIndex[v * 4 + k];
      }
    }
    const g = groupByBone[best];
    group[v] = g;
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    if (g === 'armL' || g === 'armR' || g === 'handL' || g === 'handR') {
      const s = g.endsWith('L') ? 'L' : 'R';
      const a = sh[s];
      const b = wr[s];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
      const q = ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / l2;
      t[v] = q;
      // Offset from the axis; 'outer' is straight up from the arm in the rest A-pose.
      const px = x - (a[0] + d[0] * q);
      const py = y - (a[1] + d[1] * q);
      const pz = z - (a[2] + d[2] * q);
      const l = Math.sqrt(l2);
      // Up, made square to the arm.
      const ux = -d[1] * d[0] / (l * l);
      const uy = 1 - (d[1] * d[1]) / (l * l);
      const uz = -d[1] * d[2] / (l * l);
      const ul = Math.hypot(ux, uy, uz) || 1;
      const pl = Math.hypot(px, py, pz) || 1;
      around[v] = Math.acos(Math.max(-1, Math.min(1, (px * ux + py * uy + pz * uz) / (ul * pl))));
    } else if (g === 'legL' || g === 'legR' || g === 'footL' || g === 'footR') {
      const s = g.endsWith('L') ? 'L' : 'R';
      t[v] = (hp[s][1] - y) / Math.max(0.1, hp[s][1] - an[s][1]);
      // Outer side of the leg faces away from the middle (x).
      const cx = (hp[s][0] + an[s][0]) / 2;
      const dx = x - cx;
      const out = s === 'L' ? 1 : -1;
      around[v] = Math.atan2(Math.abs(z - (hp[s][2] + an[s][2]) / 2), dx * out);
    } else {
      t[v] = 0;
      around[v] = 0;
    }
  }
  const f: Frame = { group, t, around, hipY, waistY, neckY, neckZ, shoulderX: Math.abs(sh.L[0]) };
  memo.set(pos, f);
  return f;
}

/**
 * Cloth falls from the widest point above it instead of following every curve: going down a sleeve (or
 * the torso from the chest), each vertex is kept at least as far from the axis as the cloth above it
 * on the same side, narrowing only slowly. Gives hoodies a straight drop over the waist.
 */
function hang(data: BodyData, pos: Float32Array, f: Frame, st: Style, list: number[], sp: Float32Array): void {
  const BINS = 24;
  type Axis = { o: [number, number, number]; d: [number, number, number]; from: number; taper: number };
  const axes: Record<string, Axis> = {};
  const top = (b: string) => headOf(data, pos, b);
  const mk = (a: [number, number, number], b: [number, number, number], from: number, taper: number): Axis => {
    const d: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return { o: a, d: [d[0] / l, d[1] / l, d[2] / l], from, taper };
  };
  const chest = top('spine02');
  const torsoTaper = st.part === 'top' ? 0.12 : 0.6;
  axes.torso = mk([0, chest[1], chest[2]], [0, chest[1] - 1, chest[2]], 0, torsoTaper);
  axes.hip = axes.torso;
  for (const s of ['L', 'R']) {
    axes[`arm${s}`] = mk(top(`upperarm01.${s}`), top(`wrist.${s}`), 0.04, 0.25);
    // (Legs are left to the smoothing: hanging them from the thigh flares the trousers.)
  }
  // Order each axis's vertices from the top down.
  const by = new Map<Axis, { v: number; s: number; bin: number; r: number; ux: number; uy: number; uz: number; px: number; py: number; pz: number }[]>();
  for (const v of list) {
    const ax = axes[f.group[v]];
    if (!ax) continue;
    const x = sp[v * 3] - ax.o[0];
    const y = sp[v * 3 + 1] - ax.o[1];
    const z = sp[v * 3 + 2] - ax.o[2];
    const sAlong = x * ax.d[0] + y * ax.d[1] + z * ax.d[2];
    if (sAlong < ax.from) continue;
    const px = ax.o[0] + ax.d[0] * sAlong;
    const py = ax.o[1] + ax.d[1] * sAlong;
    const pz = ax.o[2] + ax.d[2] * sAlong;
    const rx = sp[v * 3] - px;
    const ry = sp[v * 3 + 1] - py;
    const rz = sp[v * 3 + 2] - pz;
    const r = Math.hypot(rx, ry, rz);
    if (r < 1e-4) continue;
    // A stable angle round the axis: measured from a reference square to it.
    const ref: [number, number, number] = Math.abs(ax.d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    const k = ref[0] * ax.d[0] + ref[1] * ax.d[1] + ref[2] * ax.d[2];
    const e1 = [ref[0] - ax.d[0] * k, ref[1] - ax.d[1] * k, ref[2] - ax.d[2] * k];
    const l1 = Math.hypot(e1[0], e1[1], e1[2]);
    const e2 = [ax.d[1] * e1[2] - ax.d[2] * e1[1], ax.d[2] * e1[0] - ax.d[0] * e1[2], ax.d[0] * e1[1] - ax.d[1] * e1[0]];
    const a = Math.atan2((rx * e2[0] + ry * e2[1] + rz * e2[2]) / l1, (rx * e1[0] + ry * e1[1] + rz * e1[2]) / l1);
    const bin = Math.floor(((a + Math.PI) / (Math.PI * 2)) * BINS) % BINS;
    let arr = by.get(ax);
    if (!arr) by.set(ax, (arr = []));
    arr.push({ v, s: sAlong, bin, r, ux: rx / r, uy: ry / r, uz: rz / r, px, py, pz });
  }
  for (const [ax, arr] of by) {
    arr.sort((p, q) => p.s - q.s);
    const run = new Float32Array(BINS).fill(-1);
    const at = new Float32Array(BINS);
    for (const p of arr) {
      const prev = run[p.bin];
      let want = p.r;
      if (prev > 0) want = Math.max(p.r, prev - ax.taper * (p.s - at[p.bin]));
      run[p.bin] = want;
      at[p.bin] = p.s;
      if (want > p.r) {
        sp[p.v * 3] = p.px + p.ux * want;
        sp[p.v * 3 + 1] = p.py + p.uy * want;
        sp[p.v * 3 + 2] = p.pz + p.uz * want;
      }
    }
  }
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const shade = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Cut a garment from the morphed body. `normals` are the body's smooth normals (per base vertex). */
export function cutGarment(data: BodyData, pos: Float32Array, normals: Float32Array, kind: GarmentKind, colours: GarmentColours): GarmentMesh {
  const st = GARMENTS[kind];
  const f = bodyFrame(data, pos);
  const n = data.meta.baseCount;
  const inside = new Uint8Array(n);
  /** 0..1 how deep into a rib band / trim the vertex is. */
  const trim = new Float32Array(n);
  const hemY = f.hipY + (f.waistY - f.hipY) * (st.hem ?? 0);
  const waistTop = f.waistY + 0.02;
  for (let v = 0; v < n; v++) {
    const g = f.group[v];
    const y = pos[v * 3 + 1];
    const x = pos[v * 3];
    const t = f.t[v];
    let inn = false;
    let edge = 1;
    if (st.part === 'top') {
      const neckCut = f.neckY + (st.vest ? 0.01 : st.collar || st.hood ? 0.015 : 0.0);
      if (st.hood && g === 'neck' && pos[v * 3 + 2] < f.neckZ - 0.01 && y < f.neckY + 0.07) {
        // A hood bunched round the back of the neck.
        inn = true;
        edge = 1;
      } else if (g === 'torso' || g === 'hip') {
        inn = y >= hemY && (y <= neckCut || (!!st.hood && pos[v * 3 + 2] < f.neckZ));
        if (st.vest && y > f.neckY - 0.19) {
          // Above the armpits a vest is just its two straps.
          const ax = Math.abs(x) / f.shoulderX;
          inn = y <= f.neckY + 0.01 && (y < f.neckY - 0.12 ? ax < 0.78 : ax > 0.36 && ax < 0.62);
        }
        edge = Math.min((y - hemY) / 0.05, (neckCut - y) / 0.03);
        // A long coat carries on down the thighs.
      } else if ((g === 'armL' || g === 'armR') && !st.vest) {
        inn = t <= (st.sleeve ?? 0) * 0.97;
        edge = ((st.sleeve ?? 0) * 0.97 - t) / 0.08;
      } else if ((g === 'legL' || g === 'legR') && (st.hem ?? 0) < 0) {
        const down = -(st.hem ?? 0);
        inn = t <= down;
        edge = (down - t) / 0.06;
      }
      if (inn && (g === 'torso' || g === 'hip') && (st.hem ?? 0) < 0) edge = (neckCut - y) / 0.03;
    } else {
      if (g === 'torso' || g === 'hip') {
        inn = y <= waistTop;
        edge = (waistTop - y) / 0.045;
      } else if (g === 'legL' || g === 'legR') {
        const leg = (st.leg ?? 1) * 0.97;
        inn = t <= leg;
        edge = Math.min(1, (leg - t) / 0.06);
      }
    }
    if (inn) {
      inside[v] = 1;
      trim[v] = 1 - clamp01(edge);
    }
  }
  // Triangles whose corners are all inside.
  const keep: number[] = [];
  const idx = data.index;
  const rb = data.renderBase;
  for (let i = 0; i < idx.length; i += 3) {
    if (inside[rb[idx[i]]] && inside[rb[idx[i + 1]]] && inside[rb[idx[i + 2]]]) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const used = new Map<number, number>();
  const render: number[] = [];
  const local = new Uint32Array(keep.length);
  keep.forEach((r, i) => {
    let l = used.get(r);
    if (l === undefined) {
      l = render.length;
      used.set(r, l);
      render.push(r);
    }
    local[i] = l;
  });
  // Let the cloth hang: smooth the covered surface (losing the anatomy under it), then make sure every
  // point still sits at least `gap` (plus flare towards the cuffs) outside the skin.
  const sp = new Float32Array(n * 3);
  const list: number[] = [];
  // Start from the skin pushed out by the gap (more towards the cuffs), then smooth that shell.
  const gapAt = (v: number): number => {
    const g = f.group[v];
    let gp = st.gap;
    if (st.rib) gp *= 1 - 0.35 * trim[v];
    if (st.flare && (g.startsWith('arm') || g.startsWith('leg'))) gp += st.flare * clamp01(f.t[v]) * (st.rib ? 1 - trim[v] : 1);
    if (st.quilt) gp += 0.012 * (0.5 + 0.5 * Math.cos((pos[v * 3 + 1] * Math.PI * 2) / 0.085));
    if (st.hood && (g === 'neck' || pos[v * 3 + 1] > f.neckY - 0.02) && pos[v * 3 + 2] < f.neckZ) gp += 0.022;
    return gp;
  };
  for (let v = 0; v < n; v++)
    if (inside[v]) {
      list.push(v);
      const gp = gapAt(v);
      sp[v * 3] = pos[v * 3] + normals[v * 3] * gp;
      sp[v * 3 + 1] = pos[v * 3 + 1] + normals[v * 3 + 1] * gp;
      sp[v * 3 + 2] = pos[v * 3 + 2] + normals[v * 3 + 2] * gp;
    }
  const adj = neighbours(data);
  const tmp = new Float32Array(n * 3);
  // The cut edges stay where they are, so cuffs, hems and necklines don't creep back over the skin.
  const pinned = new Uint8Array(n);
  for (const v of list)
    for (let k = adj.start[v]; k < adj.start[v + 1]; k++)
      if (!inside[adj.list[k]]) {
        pinned[v] = 1;
        break;
      }
  for (let it = 0; it < (st.drape ?? 0) * 5; it++) {
    for (const v of list) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      let c = 0;
      for (let k = adj.start[v]; k < adj.start[v + 1]; k++) {
        const u = adj.list[k];
        if (!inside[u]) continue;
        ax += sp[u * 3];
        ay += sp[u * 3 + 1];
        az += sp[u * 3 + 2];
        c++;
      }
      if (!c || pinned[v]) {
        tmp[v * 3] = sp[v * 3];
        tmp[v * 3 + 1] = sp[v * 3 + 1];
        tmp[v * 3 + 2] = sp[v * 3 + 2];
        continue;
      }
      // Taubin smoothing: shrink, then grow back, so the shell loses detail but not volume.
      const k = it % 2 === 0 ? 0.5 : -0.53;
      tmp[v * 3] = sp[v * 3] + (ax / c - sp[v * 3]) * k;
      tmp[v * 3 + 1] = sp[v * 3 + 1] + (ay / c - sp[v * 3 + 1]) * k;
      tmp[v * 3 + 2] = sp[v * 3 + 2] + (az / c - sp[v * 3 + 2]) * k;
    }
    for (const v of list) {
      sp[v * 3] = tmp[v * 3];
      sp[v * 3 + 1] = tmp[v * 3 + 1];
      sp[v * 3 + 2] = tmp[v * 3 + 2];
    }
  }
  hang(data, pos, f, st, list, sp);
  const m = render.length;
  const P = new Float32Array(m * 3);
  const N = new Float32Array(m * 3);
  const C = new Float32Array(m * 3);
  const main = colours.main;
  const lum = 0.2126 * main[0] + 0.7152 * main[1] + 0.0722 * main[2];
  const trimC = colours.trim ?? (st.stripe ? (lum > 0.45 ? [0.05, 0.05, 0.06] : [0.92, 0.92, 0.9]) : shade(main, 0.72));
  const zipC: [number, number, number] = shade(main, 0.55);
  const bandC: [number, number, number] = [0.78, 0.8, 0.8];
  for (let l = 0; l < m; l++) {
    const v = rb[render[l]];
    const g = f.group[v];
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    let gap = st.gap;
    let c: [number, number, number] = main;
    const tr = trim[v];
    // Ribbed cuffs, hems and collars: a shade darker and pulled in a little.
    if (st.rib && tr > 0) {
      c = mix(c, shade(main, 0.8), tr);
      gap *= 1 - 0.35 * tr;
    }
    if (st.collar && (g === 'torso') && y > f.neckY - 0.06) c = mix(c, trimC, clamp01((y - (f.neckY - 0.06)) / 0.03));
    // Stripes down the outside of the sleeves and legs.
    if (st.stripe && (g.startsWith('arm') || g.startsWith('leg')) && f.around[v] < 0.32) c = trimC;
    if (st.zip && g === 'torso' && z > 0 && Math.abs(x) < 0.006) c = zipC;
    if (st.pocket && g === 'torso' && z > 0.05 && y < f.waistY + 0.02 && y > f.hipY + 0.06 && Math.abs(x) < 0.11) c = shade(c, 0.88);
    if (st.quilt) {
      const ring = 0.5 + 0.5 * Math.cos((y * Math.PI * 2) / 0.085);
      gap += 0.012 * ring;
      c = shade(c, 0.86 + 0.14 * ring);
    }
    if (st.bands) {
      const torsoBand = g === 'torso' && (Math.abs(y - (f.waistY + 0.02)) < 0.022 || Math.abs(y - (f.waistY + 0.16)) < 0.022);
      const armBand = g.startsWith('arm') && Math.abs(f.t[v] - 0.55) < 0.05;
      if (torsoBand || armBand) c = bandC;
    }
    if (st.work && g.startsWith('leg') && f.t[v] > 0.42 && f.t[v] < 0.58 && z > 0) c = shade(c, 0.78);
    // Never closer to the skin than a few millimetres.
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];
    let qx = sp[v * 3];
    let qy = sp[v * 3 + 1];
    let qz = sp[v * 3 + 2];
    const d = (qx - x) * nx + (qy - y) * ny + (qz - z) * nz;
    const least = Math.min(gap, 0.005);
    if (d < least) {
      qx += nx * (least - d);
      qy += ny * (least - d);
      qz += nz * (least - d);
    }
    P[l * 3] = qx;
    P[l * 3 + 1] = qy;
    P[l * 3 + 2] = qz;
    N[l * 3] = normals[v * 3];
    N[l * 3 + 1] = normals[v * 3 + 1];
    N[l * 3 + 2] = normals[v * 3 + 2];
    C[l * 3] = c[0];
    C[l * 3 + 1] = c[1];
    C[l * 3 + 2] = c[2];
  }
  return { kind, fabric: st.fabric, render: Uint32Array.from(render), position: P, normal: N, colour: C, index: local, covers: inside, part: st.part };
}

/** Points for a hood lying round the back of the neck: a part-torus, all on the upper spine. */
export function hoodShell(data: BodyData, pos: Float32Array, gap: number): { position: Float32Array; normal: Float32Array; index: Uint32Array; bone: string } {
  const neck = headOf(data, pos, 'neck01');
  const shL = headOf(data, pos, 'upperarm01.L');
  const width = Math.abs(shL[0]) * 0.62;
  const R = width;
  const r = 0.05 + gap;
  const cx = neck[0];
  const cy = neck[1] - 0.012;
  const cz = neck[2] - 0.075;
  const seg = 18;
  const ring = 10;
  const P: number[] = [];
  const N: number[] = [];
  const I: number[] = [];
  const a0 = -0.15 * Math.PI;
  const a1 = 1.15 * Math.PI;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg; // round the neck, from the left front past the back to the right front
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Taper towards the front ends.
    const k = Math.sin(((i / seg) * Math.PI)) * 0.6 + 0.4;
    for (let j = 0; j <= ring; j++) {
      const b = (j / ring) * Math.PI * 2;
      const tube = r * k;
      const ox = ca * (R + Math.cos(b) * tube);
      const oz = -sa * (R * 0.75 + Math.cos(b) * tube);
      const oy = Math.sin(b) * tube * 0.7 - (1 - k) * 0.03;
      P.push(cx + ox, cy + oy, cz + oz);
      const nx = ca * Math.cos(b);
      const nz = -sa * Math.cos(b);
      const ny = Math.sin(b);
      const l = Math.hypot(nx, ny, nz) || 1;
      N.push(nx / l, ny / l, nz / l);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < ring; j++) {
      const a = i * (ring + 1) + j;
      const b = a + ring + 1;
      I.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return { position: new Float32Array(P), normal: new Float32Array(N), index: new Uint32Array(I), bone: 'spine01' };
}
