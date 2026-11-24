/**
 * The low-poly kits the long street is built from (public/models/polyfork,
 * Polyfork, CC BY 4.0, credits in CREDITS.txt beside the pack).
 *
 * The pack is one binary file. A district's models are baked into a few meshes
 * per 12 m chunk (solid, glass, lit, plus sign boards), so a street of two
 * hundred pieces costs a few dozen draw calls, and the chunks off screen (or
 * outside the shadow camera) are culled.
 */
import { fetchBinary } from '../../core/fetchBinary';
import { streetDetail } from '../materials/streetDetail';
import * as THREE from 'three';
import type { Block, Placement, Sign, StreetPlan } from '../../city/street';
import { signTexture } from '../levelTextures';

const BASE = '/models/polyfork/';

interface PartInfo {
  verts: number;
  count: number;
  wide: boolean;
  pos: number;
  nrm: number;
  col: number;
  idx: number;
  alpha?: number;
}

interface ModelInfo {
  min: [number, number, number];
  max: [number, number, number];
  parts: Partial<Record<PartName, PartInfo>>;
  paint?: string;
  /** A building (its walls may be brick), and the z of its façade wall: the front is the side `wall` lies on. */
  building?: boolean;
  wall?: number;
}

type PartName = 'solid' | 'paint' | 'glass' | 'lit';

/** One part of a model, decoded: positions in metres, unit normals, linear colours. */
interface Part {
  pos: Float32Array;
  nrm: Float32Array;
  col: Float32Array;
  idx: Uint16Array | Uint32Array;
}

let index: Record<string, ModelInfo> | null = null;
let blob: ArrayBuffer | null = null;
let loading: Promise<boolean> | null = null;
const decoded = new Map<string, Partial<Record<PartName, Part>>>();

/**
 * A few kit models carry vertex normals pointing the opposite way to their faces (a stoop top that
 * shades black under the street lights). Where a vertex's normal disagrees with every face using it,
 * take the faces' own direction instead.
 */
function fixNormals(pos: Float32Array, nrm: Float32Array, idx: ArrayLike<number>): void {
  const n = pos.length / 3;
  const acc = new Float32Array(n * 3);
  const agree = new Uint8Array(n);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      acc[k] += fx;
      acc[k + 1] += fy;
      acc[k + 2] += fz;
      if (nrm[k] * fx + nrm[k + 1] * fy + nrm[k + 2] * fz > 0) agree[k / 3] = 1;
    }
  }
  for (let v = 0; v < n; v++) {
    if (agree[v]) continue;
    const x = acc[v * 3], y = acc[v * 3 + 1], z = acc[v * 3 + 2];
    const l = Math.hypot(x, y, z);
    if (l < 1e-12) continue;
    nrm[v * 3] = x / l;
    nrm[v * 3 + 1] = y / l;
    nrm[v * 3 + 2] = z / l;
  }
}

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Fetch the pack. Resolves false (and the game keeps its built-in streets) if it isn't there. */
export function loadPolyKit(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const [j, b] = await Promise.all([fetch(`${BASE}kit.json`), fetchBinary(`${BASE}kit.bin`)]);
      if (!j.ok) return false;
      index = ((await j.json()) as { models: Record<string, ModelInfo> }).models;
      blob = b;
      return true;
    } catch {
      return false;
    }
  })();
  return loading;
}

export function polyKitReady(): boolean {
  return !!index && !!blob;
}

function model(id: string): Partial<Record<PartName, Part>> | null {
  const hit = decoded.get(id);
  if (hit) return hit;
  const info = index?.[id];
  if (!info || !blob) return null;
  const out: Partial<Record<PartName, Part>> = {};
  const span = [info.max[0] - info.min[0], info.max[1] - info.min[1], info.max[2] - info.min[2]];
  for (const name of Object.keys(info.parts) as PartName[]) {
    const p = info.parts[name]!;
    const q = new Uint16Array(blob, p.pos, p.verts * 3);
    const n8 = new Int8Array(blob, p.nrm, p.verts * 3);
    const c8 = new Uint8Array(blob, p.col, p.verts * 3);
    const pos = new Float32Array(p.verts * 3);
    const nrm = new Float32Array(p.verts * 3);
    const col = new Float32Array(p.verts * 3);
    for (let i = 0; i < p.verts * 3; i++) {
      const a = i % 3;
      pos[i] = info.min[a] + (q[i] / 65535) * span[a];
      nrm[i] = n8[i] / 127;
      col[i] = SRGB_TO_LINEAR[c8[i]];
    }
    const idx = p.wide ? new Uint32Array(blob, p.idx, p.count) : new Uint16Array(blob, p.idx, p.count);
    fixNormals(pos, nrm, idx);
    out[name] = { pos, nrm, col, idx };
  }
  decoded.set(id, out);
  return out;
}

/**
 * Each lit pane's own coordinates, worked out once per model part: the triangles are grouped into the separate
 * panes they make up, and every corner gets (u across, v up) within its pane, the pane's width in model metres,
 * and the pane's number. The window shader (roomLight) draws a frame, glass and a room from these.
 */
const paneCache = new WeakMap<Part, Float32Array>();
function panes(part: Part): Float32Array {
  const hit = paneCache.get(part);
  if (hit) return hit;
  const n = part.pos.length / 3;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let t = 0; t < part.idx.length; t += 3) {
    join(part.idx[t], part.idx[t + 1]);
    join(part.idx[t], part.idx[t + 2]);
  }
  // Corners in exactly the same place join too (a pane split into separate triangles).
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(part.pos[i * 3] * 500)},${Math.round(part.pos[i * 3 + 1] * 500)},${Math.round(part.pos[i * 3 + 2] * 500)}`;
    const j = seen.get(key);
    if (j === undefined) seen.set(key, i);
    else join(i, j);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(i);
  }
  const out = new Float32Array(n * 4);
  let k = 0;
  for (const g of groups.values()) {
    // The pane's facing: across is horizontal and square to it; up is up.
    let nx = 0;
    let nz = 0;
    for (const i of g) {
      nx += part.nrm[i * 3];
      nz += part.nrm[i * 3 + 2];
    }
    const len = Math.hypot(nx, nz);
    const tx = len > 1e-3 ? -nz / len : 1;
    const tz = len > 1e-3 ? nx / len : 0;
    let s0 = Infinity, s1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const i of g) {
      const sv = part.pos[i * 3] * tx + part.pos[i * 3 + 2] * tz;
      const y = part.pos[i * 3 + 1];
      s0 = Math.min(s0, sv); s1 = Math.max(s1, sv); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const w = Math.max(1e-3, s1 - s0);
    const h = Math.max(1e-3, y1 - y0);
    for (const i of g) {
      const sv = part.pos[i * 3] * tx + part.pos[i * 3 + 2] * tz;
      out[i * 4] = (sv - s0) / w;
      out[i * 4 + 1] = (part.pos[i * 3 + 1] - y0) / h;
      out[i * 4 + 2] = w;
      out[i * 4 + 3] = k;
    }
    k++;
  }
  paneCache.set(part, out);
  return out;
}

/**
 * A building's flat-coloured window panes as windows. The house kits (and some of the city's) model their glass as
 * plain blue or slate faces in the solid part, which read as painted boards (and, dark enough, took brick). Those
 * faces (blue-leaning, saturated, upright) are moved into the lit part, where the window shader draws them with a
 * frame, glazing bars, sky-reflecting glass and a room behind. Cached per model.
 */
const splitCache = new Map<string, { rest: Part; panes: Part | null }>();
function splitWindows(id: string, solid: Part): { rest: Part; panes: Part | null } {
  const hit = splitCache.get(id);
  if (hit) return hit;
  const isPane = (t: number): boolean => {
    const i = solid.idx[t];
    const r = solid.col[i * 3], g = solid.col[i * 3 + 1], b = solid.col[i * 3 + 2];
    const hi = Math.max(r, g, b);
    const sat = hi > 0 ? (hi - Math.min(r, g, b)) / hi : 0;
    return Math.abs(solid.nrm[i * 3 + 1]) < 0.3 && b > r * 1.25 && b >= g * 0.95 && sat > 0.3;
  };
  const keep: number[] = [];
  const win: number[] = [];
  for (let t = 0; t < solid.idx.length; t += 3) (isPane(t) ? win : keep).push(t);
  const take = (tris: number[]): Part => {
    const map = new Map<number, number>();
    const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
    for (const t of tris) for (let k = 0; k < 3; k++) {
      const i = solid.idx[t + k];
      let j = map.get(i);
      if (j === undefined) {
        j = map.size;
        map.set(i, j);
        pos.push(solid.pos[i * 3], solid.pos[i * 3 + 1], solid.pos[i * 3 + 2]);
        nrm.push(solid.nrm[i * 3], solid.nrm[i * 3 + 1], solid.nrm[i * 3 + 2]);
        col.push(solid.col[i * 3], solid.col[i * 3 + 1], solid.col[i * 3 + 2]);
      }
      idx.push(j);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx: map.size > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
  };
  const out = win.length ? { rest: take(keep), panes: take(win) } : { rest: solid, panes: null };
  splitCache.set(id, out);
  return out;
}

/**
 * How big each connected piece of a part is (width across its face, height), per vertex. Brick goes only on the big
 * pieces (the walls themselves): window surrounds, sills, lintels, doors and trims keep their own colour.
 */
const sizeCache = new WeakMap<Part, Float32Array>();
function pieceSizes(part: Part): Float32Array {
  const hit = sizeCache.get(part);
  if (hit) return hit;
  const n = part.pos.length / 3;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t < part.idx.length; t += 3) {
    const a = find(part.idx[t]);
    const b = find(part.idx[t + 1]);
    if (a !== b) parent[a] = b;
    const c = find(part.idx[t + 2]);
    const d = find(part.idx[t + 1]);
    if (c !== d) parent[c] = d;
  }
  const box = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let bb = box.get(r);
    if (!bb) box.set(r, (bb = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]));
    for (let a = 0; a < 3; a++) {
      bb[a * 2] = Math.min(bb[a * 2], part.pos[i * 3 + a]);
      bb[a * 2 + 1] = Math.max(bb[a * 2 + 1], part.pos[i * 3 + a]);
    }
  }
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const bb = box.get(find(i))!;
    out[i * 2] = Math.max(bb[1] - bb[0], bb[5] - bb[4]);
    out[i * 2 + 1] = bb[3] - bb[2];
  }
  sizeCache.set(part, out);
  return out;
}

function paneHash(x: number, z: number, k: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/** Grows as pieces are baked in. */
/** Width of one baked chunk of street along x, metres: about two screens' worth on a phone. */
export const STREET_CHUNK = 12;

class Bucket {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  /** 1 on building walls (the only surfaces that may be laid in brick), 2 on house walls (always brick), 0 on props. */
  wall: number[] = [];
  /** Lit panes only: (u, v) within the pane, a random number for the pane, and its width in metres. */
  win: number[] | null;

  constructor(lit = false) {
    this.win = lit ? [] : null;
  }

  add(part: Part, pl: Placement, tint: THREE.Color | null): void {
    // Brick goes on a building's walls only: never on props, nor on what stands out in front of a façade
    // (awnings, canopies, signs, shop fascias' projecting parts).
    const info = index?.[pl.model];
    const wallZ = info?.building ? info.wall ?? null : null;
    const front = wallZ === null ? 0 : Math.sign(wallZ) || 1;
    const sizes = wallZ === null ? null : pieceSizes(part);
    // Houses (the neighbourhood kit's, built as American clapboard) are British brick whatever their paint: 2.
    const house = pl.model.startsWith('hood/');
    const base = this.pos.length / 3;
    const c = Math.cos(pl.ry);
    const s = Math.sin(pl.ry);
    const n = part.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const x = part.pos[i * 3] * pl.sx;
      const y = part.pos[i * 3 + 1] * pl.sy;
      const z = part.pos[i * 3 + 2] * pl.sz;
      this.pos.push(x * c + z * s + pl.x, y + pl.y, -x * s + z * c + pl.z);
      // Normals take the inverse scale, then the same turn.
      let nx = part.nrm[i * 3] / pl.sx;
      let ny = part.nrm[i * 3 + 1] / pl.sy;
      let nz = part.nrm[i * 3 + 2] / pl.sz;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      this.nrm.push(nx * c + nz * s, ny, -nx * s + nz * c);
      if (tint) this.col.push(part.col[i * 3] * tint.r, part.col[i * 3 + 1] * tint.g, part.col[i * 3 + 2] * tint.b);
      else this.col.push(part.col[i * 3], part.col[i * 3 + 1], part.col[i * 3 + 2]);
      this.wall.push(wallZ !== null && (part.pos[i * 3 + 2] - wallZ) * front < 0.2 && sizes![i * 2] >= 1.5 && sizes![i * 2 + 1] >= 1.2 ? (house ? 2 : 1) : 0);
    }
    if (this.win) {
      const pw = panes(part);
      for (let i = 0; i < n; i++) this.win.push(pw[i * 4], pw[i * 4 + 1], paneHash(pl.x, pl.z, pw[i * 4 + 3]), pw[i * 4 + 2] * Math.abs(pl.sx));
    }
    for (let i = 0; i < part.idx.length; i++) this.idx.push(part.idx[i] + base);
  }

  block(b: Block): void {
    const base = this.pos.length / 3;
    const c = new THREE.Color(b.colour);
    const hx = b.w / 2;
    const hy = b.h / 2;
    const hz = b.d / 2;
    // Six faces, four corners each, flat normals.
    const faces: [number, number, number, number[][]][] = [
      [0, 1, 0, [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]],
      [0, -1, 0, [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]]],
      [0, 0, 1, [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
      [0, 0, -1, [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
      [1, 0, 0, [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
      [-1, 0, 0, [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    ];
    let v = base;
    for (const [nx, ny, nz, corners] of faces) {
      const r = paneHash(b.x, b.z, nx * 3 + nz * 7 + ny * 11);
      for (const k of corners) {
        this.pos.push(b.x + k[0], b.y + k[1], b.z + k[2]);
        this.nrm.push(nx, ny, nz);
        this.col.push(c.r, c.g, c.b);
        this.wall.push(b.plain ? 0 : 1);
        // A glowing block's faces are panes too: across is x (or z on the ends), up is y.
        if (this.win) this.win.push(nx !== 0 ? (k[2] + hz) / (2 * hz) : (k[0] + hx) / (2 * hx), ny !== 0 ? (k[2] + hz) / (2 * hz) : (k[1] + hy) / (2 * hy), r, nx !== 0 ? b.d : b.w);
      }
      this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }

  geometry(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    // Blocks are building masses: walls. Padded so every vertex has a value.
    while (this.wall.length < this.pos.length / 3) this.wall.push(1);
    g.setAttribute('sdWall', new THREE.Float32BufferAttribute(this.wall, 1));
    if (this.win) g.setAttribute('rlWin', new THREE.Float32BufferAttribute(this.win, 4));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export interface KitStreetView {
  group: THREE.Group;
  /** Triangles drawn, for the debug overlay and the budgets. */
  triangles: number;
  /** Models the plan named that the pack does not hold. */
  missing: string[];
  /** Vehicles in front of the fight, each its own group, for fading. */
  faders: KitFader[];
  dispose(): void;
}

export interface KitFader {
  group: THREE.Group;
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/**
 * Bakes a planned street into meshes. `night` picks how strongly the lit
 * windows and lamps glow.
 */
export function buildKitStreet(plan: StreetPlan, o: { night?: boolean } = {}): KitStreetView | null {
  const steps = buildKitStreetSteps(plan, o);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export function* buildKitStreetSteps(plan: StreetPlan, o: { night?: boolean } = {}): Generator<void, KitStreetView | null, unknown> {
  if (!polyKitReady()) return null;
  // The street is baked in chunks along x, so the camera (and the shadow camera) can cull what's off screen.
  // One mesh per district used to be drawn whole, twice (shadow pass and colour), for each of three districts.
  const chunks = new Map<number, { solid: Bucket; glass: Bucket; lit: Bucket }>();
  const chunk = (x: number) => {
    const k = Math.floor(x / STREET_CHUNK);
    let c = chunks.get(k);
    if (!c) chunks.set(k, (c = { solid: new Bucket(), glass: new Bucket(), lit: new Bucket(true) }));
    return c;
  };
  const missing = new Set<string>();
  const tint = new THREE.Color();
  const paint = new THREE.Color();
  /** Placements built as their own meshes (vehicles that fade), by name. */
  const own = new Map<string, { solid: Bucket; glass: Bucket; lit: Bucket }>();
  for (const pl of plan.placements) {
    const m = model(pl.model);
    if (!m) {
      missing.add(pl.model);
      continue;
    }
    let into = chunk(pl.x);
    if (pl.own) {
      let o = own.get(pl.own);
      if (!o) own.set(pl.own, (o = { solid: new Bucket(), glass: new Bucket(), lit: new Bucket(true) }));
      into = o;
    }
    const t = pl.tint ? tint.set(pl.tint) : null;
    if (m.solid) {
      if (index![pl.model]?.building) {
        const sp = splitWindows(pl.model, m.solid);
        into.solid.add(sp.rest, pl, t);
        if (sp.panes) into.lit.add(sp.panes, pl, null);
      } else into.solid.add(m.solid, pl, t);
    }
    if (m.paint) {
      paint.set(pl.paint ?? index![pl.model].paint ?? '#8a8f96');
      if (t) paint.multiply(t);
      into.solid.add(m.paint, pl, paint);
    }
    if (m.glass) into.glass.add(m.glass, pl, null);
    if (m.lit) into.lit.add(m.lit, pl, null);
    yield;
  }
  for (const b of plan.blocks) {
    const c = chunk(b.x);
    (b.glow ? c.lit : c.solid).block(b);
    yield;
  }

  const group = new THREE.Group();
  group.name = `kit-street:${plan.area}`;
  const disposables: { dispose(): void }[] = [];
  let triangles = 0;
  let complete = false;
  try {
  const add = (b: Bucket, mat: THREE.Material, shadows: boolean, order = 0, name = ''): void => {
    const g = b.geometry();
    if (!g) return;
    disposables.push(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name;
    // The street's buildings and ground take shadows but don't cast them: the light comes from in front, so a
    // frontage only ever shadowed itself, unseen, and drawing it into the shadow map was about half that pass
    // (the street's people, cars, bikes and furniture still cast).
    mesh.castShadow = false;
    mesh.receiveShadow = shadows;
    mesh.renderOrder = order;
    group.add(mesh);
    triangles += b.idx.length / 3;
  };
  const street = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  // Asphalt, concrete and brick from the texture library, laid by world position (materials/streetDetail.ts).
  streetDetail(street, [...plan.area].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7), plan.ground);
  // Windows and lamp heads glow; their own colour is ignored at night so every pane reads as warm light.
  const litMat = new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: new THREE.Color('#ffc880'), emissiveIntensity: o.night === false ? 0.3 : 0.6, roughness: 0.5 });
  roomLight(litMat);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fc0d0', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
  disposables.push(street, litMat, glassMat);
  for (const k of [...chunks.keys()].sort((a, b) => a - b)) {
    const c = chunks.get(k)!;
    add(c.solid, street, true, 0, 'solid');
    add(c.lit, litMat, false, 0, 'lit');
    add(c.glass, glassMat, false, 2, 'glass');
    yield;
  }

  // Vehicles of their own: one mesh each (bodywork plus glass), with their own materials so they can fade.
  const faders: KitFader[] = [];
  for (const [name, o] of own) {
    const g = o.solid.geometry();
    if (!g) continue;
    const v = new THREE.Group();
    v.name = name;
    const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
    const mats = [body];
    const bm = new THREE.Mesh(g, body);
    bm.castShadow = true;
    bm.receiveShadow = true;
    v.add(bm);
    disposables.push(g, body);
    triangles += o.solid.idx.length / 3;
    const gg = o.glass.geometry();
    if (gg) {
      const gl = new THREE.MeshStandardMaterial({ color: '#9fc0d0', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
      const gm = new THREE.Mesh(gg, gl);
      gm.renderOrder = 2;
      v.add(gm);
      disposables.push(gg, gl);
    }
    // carModel.fadeCar fades whatever it finds here.
    v.userData.fade = { value: 1, materials: mats };
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    faders.push({ group: v, x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2, hx: (bb.max.x - bb.min.x) / 2, hz: (bb.max.z - bb.min.z) / 2 });
    group.add(v);
    yield;
  }

  for (const s of plan.signs) {
    const board = signBoard(s);
    disposables.push(board.geometry, board.material as THREE.Material);
    const map = (board.material as THREE.MeshStandardMaterial).map;
    if (map) disposables.push(map);
    group.add(board);
    yield;
  }
  complete = true;
  return {
    group,
    triangles,
    faders,
    missing: [...missing],
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
  } finally {
    if (!complete) {
      for (const resource of disposables) resource.dispose();
      group.clear();
    }
  }
}

/**
 * Lit windows read as rooms, not cream panels: each pane (by its place on the wall) gets its own
 * brightness and colour of light (warm lamps, a cool screen's flicker of blue, some with the
 * curtains drawn), brighter at the top where the ceiling light is and falling off to the sill.
 */
function roomLight(mat: THREE.MeshStandardMaterial): void {
  mat.onBeforeCompile = (sh: { vertexShader: string; fragmentShader: string }) => {
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute vec4 rlWin;\nvarying vec3 rlWorld;\nvarying vec4 vWin;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  rlWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vWin = rlWin;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 rlWorld;
varying vec4 vWin;
float rlHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float rlFrame = 0.0;
  if (vWin.w > 0.01) {
    // A window, not a panel: a white frame and glazing bars, and glass that shows the sky (lighter up top).
    vec2 uv = vWin.xy;
    float w = max(vWin.w, 0.3);
    float bx = 0.07 / w;
    float by = 0.06;
    rlFrame = max(max(step(uv.x, bx), step(1.0 - bx, uv.x)), max(step(uv.y, by), step(1.0 - by, uv.y)));
    if (w > 1.1) rlFrame = max(rlFrame, step(abs(uv.x - 0.5), 0.03 / w));
    if (vWin.z > 0.5) rlFrame = max(rlFrame, step(abs(uv.y - 0.7), 0.025));
    vec3 sky = mix(vec3(0.05, 0.065, 0.085), vec3(0.28, 0.33, 0.4), smoothstep(0.1, 1.0, uv.y + 0.15 * (uv.x - 0.5)));
    diffuseColor.rgb = mix(sky, vec3(0.82, 0.8, 0.76), rlFrame);
  }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  if (vWin.w > 0.01) {
    // The room behind the glass: one in five or so dark, the rest lit from a ceiling lamp, falling off to the
    // sill, some with curtains drawn back at the sides, some with blinds, a few blue with a telly on.
    vec2 uv = vWin.xy;
    float r = vWin.z;
    float r2 = fract(r * 7.13);
    float r3 = fract(r * 13.7);
    float on = step(0.22, r);
    vec3 tint = r3 > 0.86 ? vec3(0.55, 0.72, 1.2) : (r3 < 0.3 ? vec3(1.1, 0.82, 0.58) : vec3(1.0));
    float lamp = exp(-((uv.x - 0.5) * (uv.x - 0.5) * 5.0 + (uv.y - 0.95) * (uv.y - 0.95) * 6.0));
    vec3 room = tint * (0.28 + 0.8 * lamp) * mix(0.45, 1.0, smoothstep(0.0, 0.8, uv.y));
    // Furniture and the sill: the bottom quarter in shadow.
    room *= mix(0.45, 1.0, smoothstep(0.12, 0.32, uv.y));
    if (r2 > 0.5) {
      float cw = 0.14 + 0.12 * r3;
      float cur = max(step(uv.x, cw), step(1.0 - cw, uv.x));
      vec3 cloth = r3 > 0.6 ? vec3(0.55, 0.18, 0.16) : (r3 > 0.3 ? vec3(0.25, 0.3, 0.5) : vec3(0.75, 0.68, 0.55));
      room = mix(room, cloth * (0.35 + 0.5 * lamp), cur);
    } else if (r2 < 0.2) {
      room *= 0.62 + 0.38 * step(0.45, fract(uv.y * 16.0));
    }
    totalEmissiveRadiance *= room * on * (1.0 - rlFrame);
  } else {
    vec2 cell = floor(vec2((rlWorld.x + rlWorld.z) / 1.3, rlWorld.y / 1.7));
    float h = rlHash(cell);
    float h2 = rlHash(cell + 17.0);
    float fy = fract(rlWorld.y / 1.7);
    float bright = h < 0.18 ? 0.12 : mix(0.35, 1.0, h2);
    vec3 tint = h2 > 0.82 ? vec3(0.55, 0.7, 1.15) : (h2 < 0.25 ? vec3(1.1, 0.85, 0.6) : vec3(1.0));
    totalEmissiveRadiance *= tint * bright * (0.55 + 0.6 * fy);
  }`,
      );
  };
  mat.customProgramCacheKey = () => 'room-light-2';
}

function signBoard(s: Sign): THREE.Mesh {
  const tex = signTexture(s.text, s.bg, s.fg, { aspect: s.w / s.h, neon: s.neon, h: 128 });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: new THREE.Color(s.neon ? s.fg : '#ffffff'), emissiveMap: tex, emissiveIntensity: s.neon ? 0.9 : 0.35 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
  mesh.position.set(s.x, s.y, s.z);
  return mesh;
}

// ---- interiors ---------------------------------------------------------------------------------

/** Floor coverings for rooms, from the kit's own tiles. */
export type KitFloor = 'boards' | 'carpet' | 'tiles' | 'encaustic' | 'resin' | 'access';
const FLOOR_MODEL: Record<KitFloor, string> = {
  boards: 'cafe/timber-deck-tile',
  carpet: 'office/carpet-tile',
  tiles: 'office/access-floor-tile',
  encaustic: 'cafe/cafe-encaustic-floor-tile',
  resin: 'cafe/kitchen-resin-floor-tile',
  access: 'office/access-floor-tile',
};

/**
 * A room's floor laid from kit tiles over x0..x1, z0..z1 (top at y = 0), each tile a touch different
 * in shade so it reads as laid, not printed. `tint` multiplies the kit colours (a finish's colour).
 * Returns null until the kit has loaded.
 */
export function kitFloor(kind: KitFloor, x0: number, x1: number, z0: number, z1: number, tint: string, seed = 1): THREE.Mesh | null {
  const id = FLOOR_MODEL[kind];
  const m = model(id);
  const info = index?.[id];
  if (!m?.solid || !info) return null;
  const b = new Bucket();
  const tw = info.max[0] - info.min[0];
  const td = info.max[2] - info.min[2];
  const top = info.max[1];
  const nx = Math.max(1, Math.round((x1 - x0) / tw));
  const nz = Math.max(1, Math.round((z1 - z0) / td));
  const sx = (x1 - x0) / nx / tw;
  const sz = (z1 - z0) / nz / td;
  // The finish's colour, keeping the tile's own light and shade: divide out the tile's average colour.
  const mean = [0, 0, 0];
  const nv = m.solid.col.length / 3;
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) mean[k] += m.solid.col[i * 3 + k] / nv;
  const want = new THREE.Color(tint);
  const base = new THREE.Color(want.r / Math.max(0.02, mean[0]), want.g / Math.max(0.02, mean[1]), want.b / Math.max(0.02, mean[2]));
  const c = new THREE.Color();
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Boards run in staggered rows; everything else on a plain grid.
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = 0.9 + rnd() * 0.18;
      c.copy(base).multiplyScalar(k);
      const stagger = kind === 'boards' && j % 2 ? 0.5 : 0;
      const x = x0 + (i + 0.5 + stagger) * tw * sx;
      if (x > x1 + 1e-3) continue;
      b.add(m.solid, { model: id, x, y: -top, z: z0 + (j + 0.5) * td * sz, ry: 0, sx, sy: 1, sz }, c);
    }
  const g = b.geometry();
  if (!g) return null;
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'tiles' || kind === 'encaustic' ? 0.4 : 0.85 }));
  mesh.receiveShadow = true;
  mesh.name = `kit-floor:${kind}`;
  return mesh;
}

/**
 * A wall in the low-poly style: flat colour, with a pattern built from blocks rather than painted on
 * (tiles as a grid of raised squares, brick as staggered courses, stripes as bands).
 */
export function kitWall(pattern: string | undefined, colour: string, colour2: string | undefined, x0: number, x1: number, z: number, h: number): THREE.Mesh {
  const b = new Bucket();
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  b.block({ x: cx, y: h / 2, z: z - 0.02, w, h, d: 0.04, colour });
  const c2 = colour2 ?? new THREE.Color(colour).multiplyScalar(0.82).getStyle();
  if (pattern === 'tiles') {
    for (let y = 0.1; y < h - 0.05; y += 0.3)
      for (let x = x0 + 0.02; x < x1 - 0.1; x += 0.3) b.block({ x: x + 0.14, y: y + 0.07, z: z + 0.005, w: 0.27, h: 0.27, d: 0.012, colour });
    b.block({ x: cx, y: h / 2, z: z - 0.002, w, h, d: 0.004, colour: c2 });
  } else if (pattern === 'brick') {
    let row = 0;
    for (let y = 0; y < h; y += 0.075, row++)
      for (let x = x0 - (row % 2 ? 0.11 : 0); x < x1; x += 0.225) {
        const l = Math.max(x0, x);
        const r = Math.min(x1, x + 0.21);
        if (r - l > 0.02) b.block({ x: (l + r) / 2, y: y + 0.033, z: z + 0.006, w: r - l, h: 0.065, d: 0.014, colour: row % 3 === 1 ? c2 : colour });
      }
  } else if (pattern === 'stripes') {
    for (let x = x0 + 0.1; x < x1; x += 0.5) b.block({ x, y: h / 2, z: z + 0.003, w: 0.18, h, d: 0.006, colour: c2 });
  } else if (pattern === 'panelling') {
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.6) b.block({ x, y: 0.55, z: z + 0.02, w: 0.5, h: 0.8, d: 0.02, colour: c2 });
  }
  const mesh = new THREE.Mesh(b.geometry()!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  mesh.receiveShadow = true;
  mesh.name = 'kit-wall';
  return mesh;
}

// ---- single pieces, for rooms ------------------------------------------------------------------

const pieceGeo = new Map<string, Partial<Record<PartName, THREE.BufferGeometry>>>();
let pieceMats: Record<PartName, THREE.MeshStandardMaterial> | null = null;

function pieceMaterials(): Record<PartName, THREE.MeshStandardMaterial> {
  if (pieceMats) return pieceMats;
  const lit = new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: new THREE.Color('#ffc880'), emissiveIntensity: 0.6, roughness: 0.5 });
  pieceMats = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fc0d0', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.25, depthWrite: false }),
    lit,
  };
  for (const m of Object.values(pieceMats)) m.userData.shared = true;
  return pieceMats;
}

/** Painted parts are stored white: one shared material per colour (they outlive levels, like the rest). */
const paints = new Map<string, THREE.MeshStandardMaterial>();
function paintMat(colour: string): THREE.MeshStandardMaterial {
  let m = paints.get(colour);
  if (!m) {
    m = pieceMaterials().paint.clone();
    m.color.set(colour);
    m.userData.shared = true;
    paints.set(colour, m);
  }
  return m;
}

/** Does the kit have this model (and has it loaded)? */
export function hasKitPiece(id: string): boolean {
  return polyKitReady() && !!index![id];
}

/**
 * One kit model (e.g. 'cafe/service-counter-module') as its own group, fitted into w × h × d metres,
 * standing on y = 0, centred on x and z, front facing +z (`turn` rotates it first). `keepAspect` keeps
 * its proportions inside the box. `paint` recolours its painted parts. Null until the kit has loaded.
 */
export function kitPiece(id: string, w: number, h: number, d: number, o: { keepAspect?: boolean; turn?: number; paint?: string } = {}): THREE.Group | null {
  const m = polyKitReady() ? model(id) : null;
  if (!m) return null;
  let geos = pieceGeo.get(id);
  if (!geos) {
    geos = {};
    for (const [name, part] of Object.entries(m) as [PartName, Part][]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(part.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(part.nrm, 3));
      g.setAttribute('color', new THREE.BufferAttribute(part.col, 3));
      g.setIndex(new THREE.BufferAttribute(part.idx, 1));
      g.userData.shared = true;
      geos[name] = g;
    }
    pieceGeo.set(id, geos);
  }
  const mats = pieceMaterials();
  const inner = new THREE.Group();
  for (const [name, g] of Object.entries(geos) as [PartName, THREE.BufferGeometry][]) {
    let mat = mats[name];
    if (name === 'paint' && (o.paint ?? index![id].paint)) mat = paintMat(o.paint ?? index![id].paint!);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = name === 'solid' || name === 'paint';
    mesh.receiveShadow = name !== 'glass';
    mesh.userData.shared = true;
    if (name === 'glass') mesh.renderOrder = 2;
    inner.add(mesh);
  }
  inner.rotation.y = o.turn ?? 0;
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  let sx = w / Math.max(1e-3, size.x);
  let sy = h / Math.max(1e-3, size.y);
  let sz = d / Math.max(1e-3, size.z);
  if (o.keepAspect) sx = sy = sz = Math.min(sx, sy, sz);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const holder = new THREE.Group();
  holder.add(inner);
  holder.scale.set(sx, sy, sz);
  const out = new THREE.Group();
  out.add(holder);
  return out;
}
