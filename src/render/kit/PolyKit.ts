/**
 * The low-poly kits the long street is built from (public/models/polyfork,
 * Polyfork, CC BY 4.0, credits in CREDITS.txt beside the pack).
 *
 * The pack is one binary file. A whole district's worth of models is baked
 * into at most four meshes (solid, glass, lit, plus sign boards), so a street
 * of two hundred pieces costs a handful of draw calls.
 */
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
      const [j, b] = await Promise.all([fetch(`${BASE}kit.json`), fetch(`${BASE}kit.bin`)]);
      if (!j.ok || !b.ok) return false;
      index = ((await j.json()) as { models: Record<string, ModelInfo> }).models;
      blob = await b.arrayBuffer();
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
    out[name] = { pos, nrm, col, idx: p.wide ? new Uint32Array(blob, p.idx, p.count) : new Uint16Array(blob, p.idx, p.count) };
  }
  decoded.set(id, out);
  return out;
}

/** Grows as pieces are baked in. */
class Bucket {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  add(part: Part, pl: Placement, tint: THREE.Color | null): void {
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
      for (const k of corners) {
        this.pos.push(b.x + k[0], b.y + k[1], b.z + k[2]);
        this.nrm.push(nx, ny, nz);
        this.col.push(c.r, c.g, c.b);
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
  dispose(): void;
}

/**
 * Bakes a planned street into meshes. `night` picks how strongly the lit
 * windows and lamps glow.
 */
export function buildKitStreet(plan: StreetPlan, o: { night?: boolean } = {}): KitStreetView | null {
  if (!polyKitReady()) return null;
  const solid = new Bucket();
  const glass = new Bucket();
  const lit = new Bucket();
  const missing = new Set<string>();
  const tint = new THREE.Color();
  const paint = new THREE.Color();
  for (const pl of plan.placements) {
    const m = model(pl.model);
    if (!m) {
      missing.add(pl.model);
      continue;
    }
    const t = pl.tint ? tint.set(pl.tint) : null;
    if (m.solid) solid.add(m.solid, pl, t);
    if (m.paint) {
      paint.set(pl.paint ?? index![pl.model].paint ?? '#8a8f96');
      if (t) paint.multiply(t);
      solid.add(m.paint, pl, paint);
    }
    if (m.glass) glass.add(m.glass, pl, null);
    if (m.lit) lit.add(m.lit, pl, null);
  }
  for (const b of plan.blocks) (b.glow ? lit : solid).block(b);

  const group = new THREE.Group();
  group.name = `kit-street:${plan.area}`;
  const disposables: { dispose(): void }[] = [];
  let triangles = 0;
  const add = (b: Bucket, mat: THREE.Material, shadows: boolean, order = 0): void => {
    const g = b.geometry();
    disposables.push(mat);
    if (!g) return;
    disposables.push(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.renderOrder = order;
    group.add(mesh);
    triangles += b.idx.length / 3;
  };
  add(solid, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }), true);
  // Windows and lamp heads glow; their own colour is ignored at night so every pane reads as warm light.
  add(lit, new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: new THREE.Color('#ffc880'), emissiveIntensity: o.night === false ? 0.35 : 0.7, roughness: 0.5 }), false);
  add(glass, new THREE.MeshStandardMaterial({ color: '#9fc0d0', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }), false, 2);

  for (const s of plan.signs) {
    const board = signBoard(s);
    disposables.push(board.geometry, board.material as THREE.Material);
    const map = (board.material as THREE.MeshStandardMaterial).map;
    if (map) disposables.push(map);
    group.add(board);
  }
  return {
    group,
    triangles,
    missing: [...missing],
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function signBoard(s: Sign): THREE.Mesh {
  const tex = signTexture(s.text, s.bg, s.fg, { aspect: s.w / s.h, neon: s.neon, h: 128 });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: new THREE.Color(s.neon ? s.fg : '#ffffff'), emissiveMap: tex, emissiveIntensity: s.neon ? 0.9 : 0.35 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
  mesh.position.set(s.x, s.y, s.z);
  return mesh;
}
