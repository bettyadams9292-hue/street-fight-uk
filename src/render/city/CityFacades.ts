/**
 * Builds a street's frontages from the city kit: one instanced mesh per
 * piece-and-material pair for the whole area, coloured per building by
 * instance colour, plus the signs that the level data names.
 */
import * as THREE from 'three';
import type { FacadePlan, PlannedBuilding } from '../../city/compose';
import { signTexture } from '../levelTextures';
import type { CityKit, KitPrim, TintSlot } from './CityKit';

export interface SignedFacade {
  kind: string;
  label?: string;
  colour?: string;
  buildings: PlannedBuilding[];
}

const tmp = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();

/** Front-door paint: the colours British doors actually are. */
const DOOR_PAINT = ['#1d3a2a', '#6a1414', '#1d2a5a', '#202022', '#3a6a6a', '#4a2a4a', '#5a3a1a'];

function tint(slot: TintSlot, b: PlannedBuilding, lit: number, out: THREE.Color, x = 0): THREE.Color {
  switch (slot) {
    case 'door':
      return out.set(DOOR_PAINT[Math.abs(Math.floor(x * 7.31)) % DOOR_PAINT.length]);
    case 'brick':
      return out.set(b.palette.brick);
    case 'trim':
      return out.set(b.palette.trim);
    case 'trim_dark':
      return out.set(b.palette.trim).multiplyScalar(0.3);
    case 'metal':
      return out.set(b.palette.metal);
    case 'interior':
      // Lit rooms run bright enough to bloom; dark ones barely show.
      return lit > 0.5 ? out.setRGB(1.25 * lit + 0.2, 1.1 * lit + 0.15, 0.85 * lit + 0.1) : out.setScalar(0.06 + lit);
    default:
      return out.setRGB(1, 1, 1);
  }
}

export function buildCityFacades(kit: CityKit, plans: FacadePlan[], backZ: number, signs: SignedFacade[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'city-facades';

  // Gather instances per piece-and-material (and, for windows, per interior picture).
  interface Batch {
    prim: KitPrim;
    material: THREE.Material;
    items: { m: THREE.Matrix4; c: THREE.Color }[];
  }
  const batches = new Map<string, Batch>();
  const colour = new THREE.Color();
  for (const plan of plans) {
    for (const p of plan.placements) {
      const b = plan.buildings[p.building];
      pos.set(p.x, p.y, backZ + p.z);
      scl.set(p.sx, 1, 1);
      tmp.compose(pos, quat, scl);
      kit.piece(p.piece).forEach((prim, i) => {
        let material = prim.material;
        let key = `${p.piece}#${i}`;
        if (prim.slot === 'interior') {
          const room = Math.floor(Math.abs(Math.sin(p.x * 12.9898 + p.y * 78.233)) * 43758.5453) % 3;
          material = kit.interiors[p.lit > 0.5 ? room % 2 : 2];
          key += `:${material.uuid}`;
        }
        let batch = batches.get(key);
        if (!batch) batches.set(key, (batch = { prim, material, items: [] }));
        batch.items.push({ m: tmp.clone(), c: tint(prim.slot, b, p.lit, colour, p.x).clone() });
      });
    }
  }
  for (const { prim, material, items } of batches.values()) {
    const mesh = new THREE.InstancedMesh(prim.geometry, material, items.length);
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const solid = prim.slot !== 'interior' && prim.mat !== 'MI_Glass';
    mesh.castShadow = solid;
    mesh.receiveShadow = solid;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  for (const s of signs) addSign(group, s, backZ);
  return group;
}

function box(group: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

/** The business's own sign over the ground floor, in the style its kind calls for. */
function addSign(group: THREE.Group, s: SignedFacade, backZ: number): void {
  if (!s.label || !s.buildings.length) return;
  const b = s.buildings[0];
  const x0 = s.buildings[0].x0;
  const x1 = s.buildings[s.buildings.length - 1].x1;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  // The level's own colour for the business, else the colour its builder always used.
  const paint = s.colour ?? (s.kind === 'pub' ? '#1d3a2a' : s.kind === 'showroom' ? '#1a2a4a' : s.kind === 'warehouse' || s.kind === 'dock' ? '#2a2c30' : '#8a1a1a');
  const ink = new THREE.Color(paint).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55 ? '#111111' : '#ffffff';
  const lit = (t: THREE.Texture, k: number) => new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: k, roughness: 0.6 });
  switch (s.kind) {
    case 'house_front': {
      const t = signTexture(s.label, '#e8e4d8', '#111111', { w: 128, h: 128, serif: true });
      const door = b.doors[0] ?? cx;
      box(group, 0.28, 0.28, 0.04, door + 0.75, 2.3, backZ + 0.18, new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
      return;
    }
    case 'club':
    case 'casino': {
      const neon = s.kind === 'casino' ? '#ffcf4a' : s.label === 'VELVET' ? '#ff4ac0' : '#a070ff';
      const t = signTexture(s.label, '#060608', neon, { neon: true });
      box(group, Math.min(w - 2, 9), 1.3, 0.12, cx, 3.9, backZ + 0.45, lit(t, 1.7));
      // A lit canopy over the door.
      const door = b.doors[0] ?? cx;
      box(group, 3.2, 0.15, 1.2, door, 2.75, backZ + 0.7, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, emissive: new THREE.Color(neon), emissiveIntensity: 0.6 }));
      return;
    }
    case 'office':
    case 'leisure':
    case 'market': {
      const t = signTexture(s.label, '#1a1c20', '#e8e4d8', { serif: s.kind === 'market' });
      box(group, Math.min(w - 2, 10), 0.7, 0.1, cx, 3.35, backZ + 0.4, lit(t, 0.25));
      return;
    }
    case 'pub': {
      const t = signTexture(s.label, paint, '#d9b65a', { serif: true });
      box(group, w - 0.6, 0.7, 0.14, cx, 2.75, backZ + 0.32, lit(t, 0.3));
      // Hanging sign on a bracket at the first-floor line.
      const hx = x0 + 1.2;
      box(group, 0.06, 0.06, 1.1, hx, 3.6, backZ + 0.75, new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.6 }));
      const hs = signTexture(s.label.replace(/^THE /, ''), paint, '#d9b65a', { serif: true, w: 256, h: 256 });
      box(group, 0.06, 1.0, 1.0, hx, 3.0, backZ + 1.2, lit(hs, 0.25));
      return;
    }
    default: {
      // Shops, showrooms, the gym, precinct units, warehouses: a fascia board.
      const t = signTexture(s.label, paint, ink);
      box(group, w - 0.6, 0.65, 0.14, cx, 2.78, backZ + 0.34, lit(t, s.label === 'TO LET' ? 0.03 : 0.35));
    }
  }
}
