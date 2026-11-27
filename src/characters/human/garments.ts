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
  | 'shorts'
  // ---- added in the clothing overhaul ----
  | 'tee'
  | 'polo'
  | 'shirt'
  | 'jumper'
  | 'quarter_zip'
  | 'gilet'
  | 'windbreaker'
  | 'harrington'
  | 'chinos'
  | 'cargo_shorts'
  | 'denim_shorts'
  // Hats, cut from the scalp
  | 'beanie'
  | 'cap'
  | 'bucket_hat'
  // Hair built like a hat: the afro, a rounded mass over the scalp (fromAppearance)
  | 'afro'
  // Shoes, cut from the feet
  | 'trainers'
  | 'runners'
  | 'hitops';

export type Fabric = 'fleece' | 'knit' | 'nylon' | 'denim' | 'leather' | 'cotton' | 'canvas';

interface Style {
  /** How much the cloth hangs off the body's detail (smoothing passes). */
  drape?: number;
  /** Extra looseness towards the cuffs / ankles, m. */
  flare?: number;
  part: 'top' | 'bottoms' | 'head' | 'feet';
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
  /** A buttoned placket down the front (whole length, or just the top for a polo). */
  placket?: 'full' | 'short';
  /** A zip from the collar to the chest only. */
  halfZip?: boolean;
  /** A band of the trim colour across the chest (a colour-blocked cagoule). */
  panel?: boolean;
  /** A ribbed crew neckband. */
  neckband?: boolean;
  /** Contrast topstitching (denim): thread colour. */
  thread?: [number, number, number];
  /** Cloth gathering in rings above the ankle (joggers and trackies). */
  stack?: boolean;
  /** Shoes: how far up the leg the upper comes, 0 at the ankle bone .. (hi-tops). */
  collarT?: number;
  /** Shoes: sole colour (default off-white) and its height, m. */
  sole?: [number, number, number];
  soleH?: number;
  /** Shoes: a panel of the trim colour along the side. */
  sidePanel?: boolean;
  /** Hats: a peak (cap) or a brim all round (bucket hat). */
  brim?: 'peak' | 'round';
  /** Hats: how far down the head the hat comes (0 = the crown .. 1 = the chin). */
  depth?: number;
  /** Hair as a mass (the afro): full `gap` out over the crown and sides, tapering to the hairline. */
  puff?: boolean;
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
  jeans: { drape: 7, flare: 0.014, part: 'bottoms', gap: 0.011, fabric: 'denim', leg: 1 },
  work_trousers: { drape: 9, flare: 0.016, part: 'bottoms', gap: 0.015, fabric: 'canvas', leg: 1, work: true },
  fight_shorts: { drape: 8, flare: 0.02, part: 'bottoms', gap: 0.014, fabric: 'nylon', leg: 0.42, stripe: true, rib: true },
  shorts: { drape: 6, flare: 0.012, part: 'bottoms', gap: 0.011, fabric: 'cotton', leg: 0.35 },
  tee: { drape: 5, part: 'top', gap: 0.009, fabric: 'cotton', sleeve: 0.36, hem: 0.04, neckband: true },
  polo: { drape: 5, part: 'top', gap: 0.01, fabric: 'cotton', sleeve: 0.38, hem: 0.02, collar: true, placket: 'short', rib: true },
  shirt: { drape: 6, flare: 0.004, part: 'top', gap: 0.012, fabric: 'cotton', sleeve: 1, hem: 0.02, collar: true, placket: 'full' },
  jumper: { drape: 9, flare: 0.008, part: 'top', gap: 0.02, fabric: 'knit', sleeve: 1, hem: 0.08, rib: true, neckband: true },
  quarter_zip: { drape: 8, flare: 0.008, part: 'top', gap: 0.017, fabric: 'fleece', sleeve: 1, hem: 0.1, rib: true, collar: true, halfZip: true },
  gilet: { drape: 12, part: 'top', gap: 0.036, fabric: 'nylon', sleeve: 0, hem: 0.02, zip: true, quilt: true, collar: true },
  windbreaker: { drape: 10, flare: 0.012, part: 'top', gap: 0.026, fabric: 'nylon', sleeve: 1, hem: 0.0, rib: true, zip: true, hood: true, panel: true },
  harrington: { drape: 8, flare: 0.006, part: 'top', gap: 0.02, fabric: 'cotton', sleeve: 1, hem: 0.25, rib: true, zip: true, collar: true },
  chinos: { drape: 8, flare: 0.012, part: 'bottoms', gap: 0.015, fabric: 'cotton', leg: 0.98 },
  cargo_shorts: { drape: 7, flare: 0.016, part: 'bottoms', gap: 0.015, fabric: 'canvas', leg: 0.44, work: true },
  denim_shorts: { drape: 6, flare: 0.01, part: 'bottoms', gap: 0.011, fabric: 'denim', leg: 0.3, thread: [0.55, 0.38, 0.12] },
  beanie: { drape: 6, part: 'head', gap: 0.03, fabric: 'knit', rib: true, depth: 0.36 },
  cap: { drape: 5, part: 'head', gap: 0.022, fabric: 'cotton', brim: 'peak', depth: 0.3 },
  bucket_hat: { drape: 6, part: 'head', gap: 0.026, fabric: 'canvas', brim: 'round', depth: 0.3 },
  // About 7 cm of hair at its fullest, rounded off by the drape, down to a hairline over the forehead, the ears
  // and the nape.
  afro: { drape: 9, part: 'head', gap: 0.065, fabric: 'fleece', depth: 0.3, puff: true },
  trainers: { drape: 10, part: 'feet', gap: 0.012, fabric: 'leather', collarT: 0.0, sole: [0.9, 0.89, 0.86], soleH: 0.03, sidePanel: true },
  runners: { drape: 10, part: 'feet', gap: 0.011, fabric: 'nylon', collarT: 0.0, sole: [0.92, 0.92, 0.9], soleH: 0.036, sidePanel: true },
  hitops: { drape: 10, part: 'feet', gap: 0.013, fabric: 'leather', collarT: 0.14, sole: [0.9, 0.89, 0.86], soleH: 0.03, sidePanel: true },
};

// Denim and work trousers get topstitching too.
GARMENTS.jeans.thread = [0.55, 0.38, 0.12];
GARMENTS.denim_jacket.thread = [0.55, 0.38, 0.12];
GARMENTS.joggers.stack = true;
GARMENTS.trackies.stack = true;

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
  part: 'top' | 'bottoms' | 'head' | 'feet';
  /** A rigid piece on one bone (a cap's peak, a hat's brim), in the body's rest pose. */
  /** Rigid parts on one bone each: a cap's peak, a hat's brim, a trainer's soles. */
  extra?: Extra[];
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
  hipZ: number;
  shoulderX: number;
}

const memo = new WeakMap<Float32Array, Frame>();
const adjacency = new WeakMap<BodyData, { start: Uint32Array; list: Uint32Array }>();

/** Neighbouring base vertices (CSR), from the body's triangles. */
/**
 * Trainers cut from the foot would show every toe. Each foot's shell is laid onto a shoe last
 * instead: measured from the foot (length, width, instep height along it), then given a flat sole,
 * a rounded toe box a little past the toes and a heel counter behind the heel. The ankle opening
 * keeps the foot's own shape, so it still meets the leg (or the hi-top's collar).
 */
function shoeLast(f: Frame, pos: Float32Array, list: number[], sp: Float32Array, st: Style, adj: { start: Uint32Array; list: Uint32Array }, soleC: [number, number, number]): Extra[] {
  const BINS = 12;
  const soles: Extra[] = [];
  for (const side of ['footL', 'footR'] as const) {
    const vs = list.filter((v) => f.group[v] === side);
    if (vs.length < 20) continue;
    // The foot's axis on the ground: heel to toe.
    let z0 = Infinity, z1 = -Infinity;
    for (const v of vs) {
      z0 = Math.min(z0, pos[v * 3 + 2]);
      z1 = Math.max(z1, pos[v * 3 + 2]);
    }
    const mean = (pick: (z: number) => boolean): [number, number] => {
      let x = 0, z = 0, c = 0;
      for (const v of vs) if (pick(pos[v * 3 + 2])) { x += pos[v * 3]; z += pos[v * 3 + 2]; c++; }
      return [x / Math.max(1, c), z / Math.max(1, c)];
    };
    const heel = mean((z) => z < z0 + 0.03);
    const toe = mean((z) => z > z1 - 0.03);
    let ax = toe[0] - heel[0], az = toe[1] - heel[1];
    const len = Math.hypot(ax, az) || 1;
    ax /= len;
    az /= len;
    // Local coordinates: u along the foot (0 at the back of the heel, 1 at the tips of the toes), s across.
    const loc = (x: number, z: number): [number, number] => {
      const dx = x - heel[0], dz = z - heel[1];
      return [dx * ax + dz * az, dz * ax * -1 + dx * az];
    };
    let u0 = Infinity, u1 = -Infinity;
    for (const v of vs) {
      const [u] = loc(pos[v * 3], pos[v * 3 + 2]);
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
    const L = u1 - u0;
    // Width either side of the axis, and the height of the top of the foot, in bins along it.
    const wL = new Float32Array(BINS), wR = new Float32Array(BINS), top = new Float32Array(BINS);
    for (const v of vs) {
      const [u, sx] = loc(pos[v * 3], pos[v * 3 + 2]);
      const b = Math.min(BINS - 1, Math.max(0, Math.floor(((u - u0) / L) * BINS)));
      if (sx > 0) wL[b] = Math.max(wL[b], sx);
      else wR[b] = Math.max(wR[b], -sx);
      if (pos[v * 3 + 1] < 0.12) top[b] = Math.max(top[b], pos[v * 3 + 1]);
    }
    const smooth = (a: Float32Array) => {
      const o = a.slice();
      for (let r = 0; r < 3; r++) for (let i = 0; i < BINS; i++) o[i] = (o[Math.max(0, i - 1)] + o[i] * 2 + o[Math.min(BINS - 1, i + 1)]) / 4;
      // Never narrower than the foot itself.
      for (let i = 0; i < BINS; i++) o[i] = Math.max(o[i], a[i]);
      return o;
    };
    const WL = smooth(wL), WR = smooth(wR), TOP = smooth(top);
    const at = (a: Float32Array, k: number) => {
      const p = Math.max(0, Math.min(BINS - 1, k * BINS - 0.5));
      const i = Math.floor(p);
      const j = Math.min(BINS - 1, i + 1);
      return a[i] + (a[j] - a[i]) * (p - i);
    };
    const gap = st.gap + 0.004;
    const toeRoom = 0.018;
    const heelRoom = 0.006;
    for (const v of vs) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const [u, sx] = loc(x, z);
      const k = (u - u0) / L;
      // The ankle opening keeps the foot's shape; everything below it goes onto the last.
      const blend = k > 0.4 ? 1 : Math.max(0, Math.min(1, (0.085 - y) / 0.03));
      if (blend <= 0) continue;
      const w = (sx > 0 ? at(WL, k) : at(WR, k)) + gap;
      // A toe box: low and round, rather than the toes' own rise and fall.
      const h = Math.max(0.045, Math.min(at(TOP, k) + gap, k > 0.7 ? 0.05 + (0.075 - 0.05) * (1 - (k - 0.7) / 0.3) : 1));
      const half = h / 2;
      // Where this point sits in the cross-section, on a squarish (superellipse) outline with a flat sole.
      const cy = half;
      const ang = Math.atan2((y - cy) / half, Math.abs(sx) / Math.max(0.01, w));
      const c = Math.cos(ang), sn = Math.sin(ang);
      const e = 0.6;
      const rx = Math.sign(c) * Math.pow(Math.abs(c), e) * w;
      const ry = cy + Math.sign(sn) * Math.pow(Math.abs(sn), sn < 0 ? 0.25 : e) * half;
      // Lengthen: room past the toes, a heel counter behind; the toe end rounds off in plan.
      let nu = u0 - heelRoom + (k * (L + toeRoom + heelRoom));
      let ns = Math.sign(sx || 1) * rx;
      if (k > 0.82) {
        const r = (k - 0.82) / 0.18;
        ns *= Math.sqrt(Math.max(0.15, 1 - r * r));
      }
      if (k < 0.12) {
        const r = (0.12 - k) / 0.12;
        ns *= Math.sqrt(Math.max(0.3, 1 - r * r));
        nu -= 0.004 * r;
      }
      const nx = heel[0] + nu * ax + ns * az;
      const nz = heel[1] + nu * az - ns * ax;
      const ny = Math.max(-0.002, ry);
      sp[v * 3] += (nx - sp[v * 3]) * blend;
      sp[v * 3 + 1] += (ny - sp[v * 3 + 1]) * blend;
      sp[v * 3 + 2] += (nz - sp[v * 3 + 2]) * blend;
    }
    // The cupsole: its own clean band round the last's outline (vertex colour on the foot's coarse
    // mesh can't draw a crisp sole line), with the tread closing it underneath.
    const soleH = st.soleH ?? 0.03;
    const ring: [number, number][] = [];
    const STEPS = 14;
    const plan = (k: number, sgn: number): [number, number] => {
      let ns = sgn * ((sgn > 0 ? at(WL, k) : at(WR, k)) + gap + 0.004);
      if (k > 0.82) ns *= Math.sqrt(Math.max(0.12, 1 - ((k - 0.82) / 0.18) ** 2));
      if (k < 0.12) ns *= Math.sqrt(Math.max(0.3, 1 - ((0.12 - k) / 0.12) ** 2));
      const nu = u0 - heelRoom - 0.003 + k * (L + toeRoom + heelRoom + 0.006);
      return [heel[0] + nu * ax + ns * az, heel[1] + nu * az - ns * ax];
    };
    for (let i = 0; i <= STEPS; i++) ring.push(plan(i / STEPS, 1));
    for (let i = STEPS; i >= 0; i--) ring.push(plan(i / STEPS, -1));
    const R = ring.length;
    const P: number[] = [];
    const C: number[] = [];
    const I: number[] = [];
    const tread = shade(soleC, 0.55);
    const edge = shade(soleC, 0.8);
    // Rows: underside, tread line, side, a lip at the top.
    const rows: [number, number, [number, number, number]][] = [[-0.002, 0.996, tread], [0.005, 1, edge], [0.008, 1, soleC], [soleH, 1, soleC], [soleH + 0.002, 0.985, edge]];
    let cx = 0, cz = 0;
    for (const [x, z] of ring) { cx += x; cz += z; }
    cx /= R;
    cz /= R;
    for (const [y, s, col] of rows)
      for (const [x, z] of ring) {
        P.push(cx + (x - cx) * s, y, cz + (z - cz) * s);
        C.push(...col);
      }
    for (let r = 0; r < rows.length - 1; r++)
      for (let i = 0; i < R; i++) {
        const a = r * R + i;
        const b = r * R + ((i + 1) % R);
        I.push(a, a + R, b, b, a + R, b + R);
      }
    // The underside, fanned from the middle.
    const mid = P.length / 3;
    P.push(cx, -0.002, cz);
    C.push(...tread);
    for (let i = 0; i < R; i++) I.push(mid, i, (i + 1) % R);
    soles.push({ position: new Float32Array(P), normal: new Float32Array(P.length), colour: new Float32Array(C), index: new Uint32Array(I), bone: side === 'footL' ? 'foot.L' : 'foot.R' });
  }
  // Toe creases land almost on top of each other on the last: relax the upper (not the sole's
  // bottom or the cut edge) so its triangles lie flat.
  const set = new Set(list.filter((v) => f.group[v] === 'footL' || f.group[v] === 'footR'));
  const tmp = new Float32Array(sp.length);
  for (let r = 0; r < 14; r++) {
    for (const v of set) {
      let ax = 0, ay = 0, az = 0, c = 0;
      for (let k = adj.start[v]; k < adj.start[v + 1]; k++) {
        const u = adj.list[k];
        if (!set.has(u)) { c = 0; break; }
        ax += sp[u * 3]; ay += sp[u * 3 + 1]; az += sp[u * 3 + 2]; c++;
      }
      if (!c || sp[v * 3 + 1] < 0.004) { tmp[v * 3] = sp[v * 3]; tmp[v * 3 + 1] = sp[v * 3 + 1]; tmp[v * 3 + 2] = sp[v * 3 + 2]; continue; }
      tmp[v * 3] = sp[v * 3] * 0.5 + (ax / c) * 0.5;
      tmp[v * 3 + 1] = Math.max(-0.002, sp[v * 3 + 1] * 0.5 + (ay / c) * 0.5);
      tmp[v * 3 + 2] = sp[v * 3 + 2] * 0.5 + (az / c) * 0.5;
    }
    for (const v of set) { sp[v * 3] = tmp[v * 3]; sp[v * 3 + 1] = tmp[v * 3 + 1]; sp[v * 3 + 2] = tmp[v * 3 + 2]; }
  }
  return soles;
}

/**
 * The cut runs along the body's triangles, so every hem, cuff, neckline, hat band and shoe collar
 * zig-zags between two rings of vertices. Walk each open edge of the garment and slide its vertices
 * towards their neighbours along that edge: the teeth fold onto one clean line.
 */
export function smoothCutEdge(keep: ArrayLike<number>, rb: ArrayLike<number>, n: number, sp: Float32Array, rounds = 10): number {
  // Edges used by exactly one kept triangle are the garment's open edges.
  const count = new Map<number, number>();
  const key = (a: number, b: number) => (a < b ? a * n + b : b * n + a);
  for (let i = 0; i < keep.length; i += 3) {
    const t = [rb[keep[i]], rb[keep[i + 1]], rb[keep[i + 2]]];
    for (let e = 0; e < 3; e++) {
      const a = t[e];
      const b = t[(e + 1) % 3];
      if (a === b) continue;
      const k = key(a, b);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  const nb = new Map<number, number[]>();
  for (const [k, c] of count) {
    if (c !== 1) continue;
    const a = Math.floor(k / n);
    const b = k % n;
    (nb.get(a) ?? nb.set(a, []).get(a)!).push(b);
    (nb.get(b) ?? nb.set(b, []).get(b)!).push(a);
  }
  // Only plain links in a loop move: a vertex where open edges meet (a junction) stays put.
  const loop = [...nb].filter(([, l]) => l.length === 2);
  const next = new Float32Array(loop.length * 3);
  // Taubin steps: a shrink then a slightly larger grow, so the teeth go but the loop keeps its size
  // (plain averaging would pull a cuff or an ankle hem into the limb).
  for (let r = 0; r < rounds * 2; r++) {
    const k = r % 2 === 0 ? 0.5 : -0.53;
    loop.forEach(([v, [a, b]], i) => {
      for (let c = 0; c < 3; c++) next[i * 3 + c] = sp[v * 3 + c] + ((sp[a * 3 + c] + sp[b * 3 + c]) * 0.5 - sp[v * 3 + c]) * k;
    });
    loop.forEach(([v], i) => {
      for (let c = 0; c < 3; c++) sp[v * 3 + c] = next[i * 3 + c];
    });
  }
  return loop.length;
}

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
  const f: Frame = { group, t, around, hipY, hipZ: (hp.L[2] + hp.R[2]) / 2, waistY, neckY, neckZ, shoulderX: Math.abs(sh.L[0]) };
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

/** Sleeves and tops fall from their widest point (see hang). */
const HANG = true;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const shade = (c: [number, number, number], k: number): [number, number, number] => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Cut a garment from the morphed body. `normals` are the body's smooth normals (per base vertex). */
export interface Extra {
  position: Float32Array;
  normal: Float32Array;
  colour: Float32Array;
  index: Uint32Array;
  bone: string;
}

export function cutGarment(data: BodyData, pos: Float32Array, normals: Float32Array, kind: GarmentKind, colours: GarmentColours): GarmentMesh {
  const st = GARMENTS[kind];
  const f = bodyFrame(data, pos);
  const n = data.meta.baseCount;
  const inside = new Uint8Array(n);
  /** 0..1 how deep into a rib band / trim the vertex is. */
  const trim = new Float32Array(n);
  const hemY = f.hipY + (f.waistY - f.hipY) * (st.hem ?? 0);
  const waistTop = f.waistY + 0.02;
  const hd = st.part === 'head' ? headFrame(f, pos) : null;
  const ankle = { L: headOf(data, pos, 'foot.L'), R: headOf(data, pos, 'foot.R') };
  for (let v = 0; v < n; v++) {
    const g = f.group[v];
    const y = pos[v * 3 + 1];
    const x = pos[v * 3];
    const t = f.t[v];
    let inn = false;
    let edge = 1;
    if (hd) {
      // A hat: the scalp above a line that runs lower at the back than over the forehead.
      if (g === 'head') {
        const rel = (hd.top - y) / hd.height;
        const limit = hatLimit(st, hd, x, pos[v * 3 + 2]);
        inn = rel <= limit;
        edge = (limit - rel) / 0.05;
      }
    } else if (st.part === 'feet') {
      // A shoe: the foot, and up the leg to its collar.
      if (g === 'footL' || g === 'footR') inn = true;
      else if (g === 'legL' || g === 'legR') {
        const from = 0.985 - (st.collarT ?? 0);
        inn = t >= from;
        edge = (t - from) / 0.03;
      }
    } else if (st.part === 'top') {
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
        // Sleeveless (a gilet): none of the arm, so the armhole is a clean loop.
        inn = (st.sleeve ?? 0) > 0 && t <= (st.sleeve ?? 0) * 0.97;
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
  // The afro: a rounded mass, not the scalp pushed out (that's a mushroom). Every point goes out to an
  // egg-shaped surface centred over the forehead (wider and taller than the head by `gap`, curving back in
  // below its middle so it meets the skin round the ears), easing in to the skin over the last stretch
  // before the hairline.
  if (st.puff && hd) puffOut(f, st, hd, pos, normals, inside, sp);
  // Fall from the widest point first, then let the smoothing blend the result.
  if (st.part === 'top' && HANG) hang(data, pos, f, st, list, sp);
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
      const k = it % 2 === 0 ? 0.33 : -0.34;
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
  // Straight necklines and hems: the cut follows the mesh's triangles, which leaves teeth; line the
  // edge vertices up on the cut height instead.
  if (st.part === 'top') {
    const neckLine = f.neckY + (st.vest ? 0.01 : st.collar || st.hood ? 0.015 : 0.0);
    for (const v of list) {
      if (!pinned[v]) continue;
      const g = f.group[v];
      if (g !== 'torso' && g !== 'hip' && g !== 'neck') continue;
      const y = pos[v * 3 + 1];
      if (!st.vest && Math.abs(y - neckLine) < 0.035 && !(st.hood && pos[v * 3 + 2] < f.neckZ)) sp[v * 3 + 1] = Math.max(sp[v * 3 + 1], neckLine - 0.004);
      else if (Math.abs(y - hemY) < 0.035) sp[v * 3 + 1] = Math.min(sp[v * 3 + 1], hemY + 0.004);
    }
  }
  // Trousers don't show what's under them: the front of the crotch is flattened. The skin there is
  // hidden (it's covered), so the cloth may sit inside where the body was.
  if (st.part === 'bottoms') {
    const front = f.hipZ + 0.075 + st.gap;
    for (const v of list) {
      const x = sp[v * 3];
      const y = sp[v * 3 + 1];
      // Only the crotch: fading out above it, so the plane never cuts into the lower belly.
      if (Math.abs(x) < 0.1 && y < f.hipY + 0.06 && y > f.hipY - 0.16 && sp[v * 3 + 2] > front) {
        const k = (1 - Math.max(0, (Math.abs(x) - 0.06) / 0.04)) * clamp01((f.hipY + 0.06 - y) / 0.04);
        sp[v * 3 + 2] = sp[v * 3 + 2] + (front - sp[v * 3 + 2]) * Math.min(1, k);
      }
    }
  }
  // A shoe goes onto its last first, so the collar is straightened where it finally sits.
  const soles = st.part === 'feet' ? shoeLast(f, pos, list, sp, st, adj, st.sole ?? [0.9, 0.89, 0.86]) : null;
  smoothCutEdge(keep, rb, n, sp);
  const m = render.length;
  const P = new Float32Array(m * 3);
  const N = new Float32Array(m * 3);
  const C = new Float32Array(m * 3);
  const main = colours.main;
  const lum = 0.2126 * main[0] + 0.7152 * main[1] + 0.0722 * main[2];
  const trimC = colours.trim ?? (st.stripe ? (lum > 0.45 ? [0.05, 0.05, 0.06] : [0.8, 0.8, 0.78]) : shade(main, 0.72));
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
    // ---- seams, stitching and folds: what makes cloth read as made, not painted ----
    if (st.part === 'top' || st.part === 'bottoms') {
      // Side seams down the torso, outseams and inseams down the legs, a seam round the shoulder.
      const sideA = Math.atan2(Math.abs(x), z - f.hipZ);
      const seamTorso = (g === 'torso' || g === 'hip') && Math.abs(sideA - Math.PI / 2) < 0.07 && y < f.neckY - 0.08;
      const seamLeg = g.startsWith('leg') && (f.around[v] < 0.07 || f.around[v] > Math.PI - 0.09);
      const seamShoulder = g.startsWith('arm') && f.t[v] < 0.035 && f.t[v] > 0.0;
      if ((seamTorso || seamLeg || seamShoulder) && !(st.stripe && seamLeg)) c = st.thread ? mix(c, st.thread, 0.45) : shade(c, 0.86);
      // Topstitched hems and waistband on denim.
      if (st.thread && ((g.startsWith('leg') && f.t[v] > (st.leg ?? 1) * 0.97 - 0.03) || ((g === 'torso' || g === 'hip') && st.part === 'bottoms' && y > waistTop - 0.035))) c = mix(c, st.thread, 0.35);
      // Creases inside the elbows and behind the knees, where cloth bunches when the joint bends.
      const elbow = g.startsWith('arm') && Math.abs(f.t[v] - 0.5) < 0.07 && f.around[v] > 2.1;
      const knee = g.startsWith('leg') && Math.abs(f.t[v] - 0.52) < 0.06 && z < 0 && st.part === 'bottoms';
      if (elbow || knee) {
        const w = 0.5 + 0.5 * Math.cos(((f.t[v] - 0.5) / 0.035) * Math.PI);
        c = shade(c, 0.9 + 0.1 * w);
        gap += 0.003 * w;
      }
      // Joggers and trackies gather above the cuff.
      if (st.stack && g.startsWith('leg') && f.t[v] > 0.8) {
        const ring = 0.5 + 0.5 * Math.cos(((f.t[v] - 0.8) / 0.045) * Math.PI * 2);
        gap += 0.006 * ring;
        c = shade(c, 0.9 + 0.1 * ring);
      }
    }
    if (st.neckband && g === 'torso' && y > f.neckY - 0.03) c = shade(main, 0.82);
    if (st.placket && g === 'torso' && z > 0 && Math.abs(x) < 0.013 && y > (st.placket === 'short' ? f.neckY - 0.14 : hemY)) {
      c = shade(main, 0.9);
      // Buttons every 8 cm (4 cm on a polo).
      const step = st.placket === 'short' ? 0.04 : 0.08;
      if (Math.abs(x) < 0.006 && ((f.neckY - y) % step) / step < 0.18) c = lum > 0.5 ? [0.2, 0.19, 0.18] : [0.85, 0.83, 0.78];
    }
    if (st.halfZip && g === 'torso' && z > 0 && Math.abs(x) < 0.006 && y > f.neckY - 0.16) c = zipC;
    if (st.panel && g === 'torso' && y < f.neckY - 0.08 && y > f.neckY - 0.2) c = trimC;
    if (st.part === 'feet') {
      // Zones from the shoe's own shell (shoeLast), not the foot under it.
      const a = ankle[g.endsWith('L') ? 'L' : 'R'];
      const sx = sp[v * 3], sy = sp[v * 3 + 1], sz = sp[v * 3 + 2];
      const soleH = st.soleH ?? 0.03;
      // The sole is its own mesh (shoeLast); the upper inside it is just shaded darker.
      if (sy < soleH && !g.startsWith('leg')) c = shade(main, 0.7);
      else if (sy > 0.045 && sz > a[2] + 0.02 && sz < a[2] + 0.115 && Math.abs(sx - a[0]) < 0.017) {
        // Laces up the top of the foot, crossing in pairs.
        c = ((sz * 1000) % 16) / 16 < 0.5 ? shade(main, lum > 0.5 ? 0.7 : 1.5) : shade(main, 0.82);
      } else if (sz < a[2] - 0.03 && sy < 0.085) c = shade(main, 0.82); // heel counter
      else if (sz > a[2] + 0.13 && sy < soleH + 0.035) c = shade(main, 0.9); // toe cap
      if (g.startsWith('leg') && tr > 0.4) c = shade(main, 0.7); // the padded collar
    }
    if (hd) {
      const ang = Math.atan2(x, z - hd.cz);
      // A cap's six panels meet at the button on top.
      if (st.brim === 'peak' && ((ang + Math.PI) % (Math.PI / 3)) / (Math.PI / 3) < 0.06 && (hd.top - y) / hd.height > 0.03) c = shade(c, 0.82);
      if ((hd.top - y) / hd.height < 0.025) c = shade(c, 0.75);
      // Rings of topstitching round a bucket hat's crown.
      if (st.brim === 'round') {
        const fromHem = hatLimit(st, hd, x, z) - (hd.top - y) / hd.height;
        if (fromHem < 0.1 && ((fromHem / 0.1) * 4) % 1 < 0.2) c = shade(c, 0.86);
      }
    }
    // Never closer to the skin than a few millimetres.
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];
    let qx = sp[v * 3];
    let qy = sp[v * 3 + 1];
    let qz = sp[v * 3 + 2];
    const d = (qx - x) * nx + (qy - y) * ny + (qz - z) * nz;
    // A top's lower edge rides over any trousers' waistband, never inside it.
    const overBand = st.part === 'top' && (g === 'torso' || g === 'hip') && y < f.waistY + 0.05 ? 0.024 : 0;
    const least = st.part === 'bottoms' && Math.abs(x) < 0.1 && y < f.hipY + 0.03 && y > f.hipY - 0.16 && z > f.hipZ ? -1 : Math.max(overBand, Math.min(gap, 0.005));
    if (d < least) {
      qx += nx * (least - d);
      qy += ny * (least - d);
      qz += nz * (least - d);
    }
    // Shoes stand on the floor, not in it.
    if (st.part === 'feet' && qy < -0.002) qy = -0.002;
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
  // Shade the cloth by its own shape, not the body's: normals from the garment's triangles, shared
  // across UV seams (same body vertex) so there are no creases.
  const acc = new Float32Array(n * 3);
  for (let i = 0; i < local.length; i += 3) {
    const a = local[i] * 3;
    const b = local[i + 1] * 3;
    const c = local[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const l of [local[i], local[i + 1], local[i + 2]]) {
      const v = rb[render[l]];
      acc[v * 3] += nx;
      acc[v * 3 + 1] += ny;
      acc[v * 3 + 2] += nz;
    }
  }
  for (let l = 0; l < m; l++) {
    const v = rb[render[l]];
    const x = acc[v * 3], y = acc[v * 3 + 1], z = acc[v * 3 + 2];
    const len = Math.hypot(x, y, z);
    if (len > 1e-12) {
      // Keep it pointing out, like the body's.
      const sgn = x * normals[v * 3] + y * normals[v * 3 + 1] + z * normals[v * 3 + 2] < 0 ? -1 : 1;
      N[l * 3] = (sgn * x) / len;
      N[l * 3 + 1] = (sgn * y) / len;
      N[l * 3 + 2] = (sgn * z) / len;
    }
  }
  // A hat's hem as a ring of points round the head (from the cut edge of the shell), for the brim.
  if (hd && st.brim) {
    const BINS = 40;
    const acc2 = Array.from({ length: BINS }, () => [0, 0, 0, 0]);
    for (let l = 0; l < m; l++) {
      const v = rb[render[l]];
      if (!pinned[v]) continue;
      const a = Math.atan2(P[l * 3], P[l * 3 + 2] - hd.cz);
      const b = Math.min(BINS - 1, Math.floor(((a + Math.PI) / (Math.PI * 2)) * BINS));
      acc2[b][0] += P[l * 3];
      acc2[b][1] += P[l * 3 + 1];
      acc2[b][2] += P[l * 3 + 2];
      acc2[b][3]++;
    }
    (hd as HeadFrame & { ring?: [number, number, number][] }).ring = acc2.filter((q) => q[3]).map((q) => [q[0] / q[3], q[1] / q[3], q[2] / q[3]] as [number, number, number]);
  }
  const extra: Extra[] = [];
  if (hd && st.brim) extra.push(brimShell(st, hd, colours.main));
  if (soles) extra.push(...soles);
  // The skin under the cut edge stays: the edge has been straightened (smoothCutEdge), and hiding the
  // old zig-zag would open holes through to the inside of the cloth.
  const covers = inside.slice();
  for (const v of list) if (pinned[v]) covers[v] = 0;
  return { kind, fabric: st.fabric, render: Uint32Array.from(render), position: P, normal: N, colour: C, index: local, covers, part: st.part, extra };
}

interface HeadFrame {
  top: number;
  height: number;
  cz: number;
  /** Half-width and front and back of the head at the brim line. */
  rx: number;
  front: number;
  back: number;
  /** Height of the hem over the forehead. */
  hemY: number;
}

/** The head's extent: crown, chin, centre front-to-back, and its outline where a hat's brim sits. */
function headFrame(f: Frame, pos: Float32Array): HeadFrame {
  let top = -Infinity, chin = Infinity, zs = 0, c = 0;
  for (let v = 0; v < f.group.length; v++) {
    if (f.group[v] !== 'head') continue;
    const y = pos[v * 3 + 1];
    top = Math.max(top, y);
    chin = Math.min(chin, y);
    zs += pos[v * 3 + 2];
    c++;
  }
  const height = top - chin;
  const cz = zs / Math.max(1, c);
  return { top, height, cz, rx: 0, front: cz, back: cz, hemY: top };
}

/** The afro's shape (see where it's called in the garment build). */
function puffOut(f: Frame, st: Style, hd: HeadFrame, pos: Float32Array, normals: Float32Array, inside: Uint8Array, sp: Float32Array): void {
  // The head's half-width and front and back, above the jaw.
  let hw = 0, zf = -Infinity, zb = Infinity;
  for (let v = 0; v < f.group.length; v++) {
    if (f.group[v] !== 'head' || (hd.top - pos[v * 3 + 1]) / hd.height > 0.55) continue;
    hw = Math.max(hw, Math.abs(pos[v * 3]));
    zf = Math.max(zf, pos[v * 3 + 2]);
    zb = Math.min(zb, pos[v * 3 + 2]);
  }
  const g = st.gap;
  const cy = hd.top - hd.height * 0.32;
  // Set back a little and taller than wide, so it rises off the forehead rather than hanging over it.
  const cz = (zf + zb) / 2 - g * 0.45;
  const rx = hw + g * 0.9;
  const rz = (zf - zb) / 2 + g * 0.75;
  const up = hd.top - cy + g * 1.6;
  // Below its middle it curves in to meet the head about where the hair stops at the sides.
  const down = hd.height * 0.21;
  for (let v = 0; v < inside.length; v++) {
    if (!inside[v]) continue;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const dx = x, dy = y - cy, dz = z - cz;
    const e = Math.hypot(dx / rx, dy / (dy > 0 ? up : down), dz / rz);
    const skin = 0.005;
    let ox = x + normals[v * 3] * skin, oy = y + normals[v * 3 + 1] * skin, oz = z + normals[v * 3 + 2] * skin;
    if (e > 0 && e < 1) {
      ox = dx / e;
      oy = cy + dy / e;
      oz = cz + dz / e;
    }
    const rel = (hd.top - y) / hd.height;
    const s = clamp01((hatLimit(st, hd, x, z) - rel) / 0.2);
    const k = s * s * (3 - 2 * s);
    sp[v * 3] = x + normals[v * 3] * skin + (ox - x - normals[v * 3] * skin) * k;
    sp[v * 3 + 1] = y + normals[v * 3 + 1] * skin + (oy - y - normals[v * 3 + 1] * skin) * k;
    sp[v * 3 + 2] = z + normals[v * 3 + 2] * skin + (oz - z - normals[v * 3 + 2] * skin) * k;
  }
}

/** How far down the head (0 crown .. 1 chin) the hat comes at this point: lowest at the back, clear of the ears. */
function hatLimit(st: Style, hd: HeadFrame, x: number, z: number): number {
  const fz = Math.max(-1, Math.min(1, (z - hd.cz) / 0.08));
  const d = st.depth ?? 0.3;
  // The afro's hairline: over the forehead at the front, down past the tops of the ears at the sides, to the
  // nape at the back.
  if (st.puff) {
    const side = 1 - Math.abs(fz);
    return d + 0.2 * side + 0.28 * Math.max(0, -fz);
  }
  // A round-brimmed hat sits level; a beanie or cap dips at the back.
  if (st.brim === 'round') return d + 0.05;
  const side = 1 - Math.abs(fz);
  return d + 0.16 * Math.max(0, -fz) + 0.03 * side - (Math.abs(x) > 0.065 ? 0.02 * side : 0);
}

/** A cap's peak or a hat's brim, sized to the head, as a single sheet on the head bone (drawn both sides). */
function brimShell(st: Style, hd0: HeadFrame, main: [number, number, number]): Extra {
  const hd = hd0 as HeadFrame & { ring?: [number, number, number][] };
  const ring = hd.ring!;
  const P: number[] = [];
  const I: number[] = [];
  const C: number[] = [];
  const under = shade(main, 0.7);
  if (st.brim === 'peak') {
    // Across the front of the head, out 7 cm, curving down at the sides.
    const front = ring.filter((p) => p[2] > hd.cz + 0.005).sort((a, b) => a[0] - b[0]);
    const across = 9;
    const out = 5;
    for (let i = 0; i <= across; i++) {
      const u = i / across;
      const p = front[Math.min(front.length - 1, Math.round(u * (front.length - 1)))];
      const k = Math.sin(u * Math.PI);
      for (let j = 0; j <= out; j++) {
        const w = j / out;
        const len = 0.075 * Math.sqrt(Math.max(0.05, k));
        const dirx = (p[0] / (Math.abs(p[0]) + 0.05)) * 0.35;
        // Starts just under the crown's edge so there's no gap between peak and cap.
        P.push(p[0] + dirx * len * w, p[1] - 0.002 - 0.012 * w - 0.018 * (1 - k) * w, p[2] - 0.006 + (len + 0.006) * w);
        C.push(...(j === 0 ? under : main));
      }
    }
    for (let i = 0; i < across; i++)
      for (let j = 0; j < out; j++) {
        const a = i * (out + 1) + j;
        const b = a + out + 1;
        I.push(a, b, a + 1, b, b + 1, a + 1);
      }
  } else {
    // All the way round, 5 cm out, sloping down.
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const p = ring[i];
      const dx = p[0];
      const dz = p[2] - hd.cz;
      const l = Math.hypot(dx, dz) || 1;
      P.push(p[0], p[1], p[2]);
      P.push(p[0] + (dx / l) * 0.05, p[1] - 0.025, p[2] + (dz / l) * 0.05);
      C.push(...main, ...main);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = ((i + 1) % n) * 2;
      I.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { position: new Float32Array(P), normal: new Float32Array(P.length), colour: new Float32Array(C), index: new Uint32Array(I), bone: 'head' };
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
