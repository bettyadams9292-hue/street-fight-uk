/**
 * Approved models, built once and shared.
 *
 * The approved factories make a fresh set of meshes and materials every call. Here each model is built once and
 * folded into a handful of parts that share a few materials across the whole library: plain-coloured surfaces
 * become vertex colours on one of three shared materials (matte, satin, metal), and glass one shared glass.
 * Anything with a texture keeps its own material (built once, so still shared by every copy).
 *
 * `bakeApproved` then merges any number of copies into one mesh per material, so a street full of approved
 * furniture costs a few draws per 12 m chunk, culled like the kit street around it.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPROVED } from './registry';

export interface ProtoPart {
  geometry: THREE.BufferGeometry;
  /** A shared palette material, or the model's own (textured) material. */
  material: THREE.Material;
}

export interface Prototype {
  id: string;
  parts: ProtoPart[];
  /** Bounds of the model as authored (metres, y up, its front facing +z). */
  box: THREE.Box3;
  /** Its plain colours (linear, as hex), the one covering most of it first: what a recolour swaps. */
  colours: string[];
  triangles: number;
}

const PALETTE = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
  satin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: '#b6ccd2', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.55, side: THREE.DoubleSide }),
};
for (const [k, m] of Object.entries(PALETTE)) m.name = `approved:${k}`;

type Std = THREE.MeshStandardMaterial & { transmission?: number };

function classify(m: THREE.Material): keyof typeof PALETTE | null {
  const s = m as Std;
  if (s.map || s.alphaMap || s.normalMap || s.roughnessMap || s.emissiveMap) return null;
  if (s.transparent || (s.opacity ?? 1) < 0.95 || (s.transmission ?? 0) > 0.2) return 'glass';
  if (s.emissive && s.emissiveIntensity > 0.05 && s.emissive.r + s.emissive.g + s.emissive.b > 0.3) return 'glow';
  if ((s.metalness ?? 0) >= 0.3) return 'metal';
  if ((s.roughness ?? 1) < 0.6) return 'satin';
  return 'matte';
}

/** Position, normal and (for palette parts) colour only, so every piece of a part merges. */
function normalise(src: THREE.BufferGeometry, matrix: THREE.Matrix4, colour: THREE.Color | null, keepUv: boolean): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.applyMatrix4(matrix);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && !(keepUv && name === 'uv')) g.deleteAttribute(name);
  if (keepUv && !g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (colour) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = colour.r;
      c[i * 3 + 1] = colour.g;
      c[i * 3 + 2] = colour.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

const cache = new Map<string, Prototype>();

/** The approved model `id`, built once. Throws for an id that isn't in the registry. */
export function prototype(id: string): Prototype {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = APPROVED[id];
  if (!def) throw new Error(`approved asset ${id}: not in the registry`);
  const root = def.build();
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const push = (m: THREE.Material, g: THREE.BufferGeometry) => {
    let b = buckets.get(m);
    if (!b) buckets.set(m, (b = []));
    b.push(g);
  };
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.getAttribute('position')) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // One material per mesh in every approved model; a mesh with several would take its first for the whole piece.
    const m = mats[0];
    const cls = classify(m);
    if (cls === 'glass') push(PALETTE.glass, normalise(mesh.geometry, mesh.matrixWorld, null, false));
    else if (cls === 'glow') {
      const s = m as Std;
      const c = s.emissive.clone().multiplyScalar(Math.max(0.6, s.emissiveIntensity)).add(s.color.clone().multiplyScalar(0.3));
      push(PALETTE.glow, normalise(mesh.geometry, mesh.matrixWorld, c, false));
    } else if (cls) push(PALETTE[cls], normalise(mesh.geometry, mesh.matrixWorld, (m as Std).color?.clone() ?? new THREE.Color('#888888'), false));
    else push(m, normalise(mesh.geometry, mesh.matrixWorld, null, true));
  });
  const parts: ProtoPart[] = [];
  let triangles = 0;
  for (const [material, geos] of buckets) {
    const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!geometry) continue;
    for (const g of geos) if (g !== geometry) g.dispose();
    geometry.computeBoundingBox();
    triangles += geometry.getAttribute('position').count / 3;
    parts.push({ geometry, material });
  }
  const box = new THREE.Box3();
  for (const p of parts) box.union(p.geometry.boundingBox!);
  // Plain colours by how much of the model they cover (area), so a caller can repaint the main one.
  const area = new Map<string, number>();
  const tmp = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const p of parts) {
    const col = p.geometry.getAttribute('color');
    const pos = p.geometry.getAttribute('position');
    if (!col) continue;
    for (let i = 0; i + 2 < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      const k = '#' + tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHexString(THREE.LinearSRGBColorSpace);
      area.set(k, (area.get(k) ?? 0) + b.sub(a).cross(c.sub(a)).length() / 2);
    }
  }
  const colours = [...area].sort((x, y) => y[1] - x[1]).map(([k]) => k);
  const proto = { id, parts, box, triangles, colours };
  cache.set(id, proto);
  return proto;
}

/** One copy of an approved model to bake: where it stands, how it's turned and scaled. */
export interface ApprovedCopy {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  /** Uniform scale, or per axis. */
  s?: number | [number, number, number];
  /** Repaint colours of this copy: [from, to] hex pairs (an awning's stripes in its shop's colour). */
  recolour?: readonly (readonly [string, string])[];
}

export function repaint(g: THREE.BufferGeometry, pairs: readonly (readonly [string, string])[]): void {
  const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!col) return;
  // A 'from' written as 'linear:#rrggbb' is one of a prototype's own `colours` (already linear).
  const from = (h: string) => (h.startsWith('linear:') ? new THREE.Color().setHex(parseInt(h.slice(8), 16), THREE.LinearSRGBColorSpace) : new THREE.Color(h));
  const swaps = pairs.map(([a, b]) => [from(a), new THREE.Color(b)] as const);
  for (let i = 0; i < col.count; i++) {
    for (const [from, to] of swaps) {
      if (Math.abs(col.getX(i) - from.r) + Math.abs(col.getY(i) - from.g) + Math.abs(col.getZ(i) - from.b) < 0.02) {
        col.setXYZ(i, to.r, to.g, to.b);
        break;
      }
    }
  }
}

/**
 * Merge copies into one mesh per material, in 12 m chunks along x (so off-screen chunks are culled in both
 * passes, as the kit street is). `shadows` for things that should cast them (street furniture does; small
 * stock behind shop glass needn't).
 */
export function bakeApproved(copies: readonly ApprovedCopy[], o: { chunk?: number; shadows?: boolean; name?: string } = {}): THREE.Group {
  const out = new THREE.Group();
  out.name = o.name ?? 'approved';
  const size = o.chunk ?? 12;
  const chunks = new Map<number, Map<THREE.Material, THREE.BufferGeometry[]>>();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const c of copies) {
    const p = prototype(c.id);
    const s = c.s ?? 1;
    m4.compose(new THREE.Vector3(c.x, c.y, c.z), q.setFromAxisAngle(up, c.ry), typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
    const k = Math.floor(c.x / size);
    let ch = chunks.get(k);
    if (!ch) chunks.set(k, (ch = new Map()));
    for (const part of p.parts) {
      const g = part.geometry.clone().applyMatrix4(m4);
      if (c.recolour?.length) repaint(g, c.recolour);
      let b = ch.get(part.material);
      if (!b) ch.set(part.material, (b = []));
      b.push(g);
    }
  }
  for (const ch of chunks.values()) {
    for (const [material, geos] of ch) {
      const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      for (const g of geos) if (g !== geometry) g.dispose();
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      const glassy = material === PALETTE.glass;
      mesh.castShadow = !!o.shadows && !glassy;
      mesh.receiveShadow = !glassy;
      if (glassy) mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      out.add(mesh);
    }
  }
  return out;
}

/** One live copy (not baked), for things that move or that the player picks up: shares the prototype's geometry. */
export function approvedObject(id: string): THREE.Group {
  const p = prototype(id);
  const g = new THREE.Group();
  g.name = `approved:${id}`;
  for (const part of p.parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = part.material !== PALETTE.glass;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}
