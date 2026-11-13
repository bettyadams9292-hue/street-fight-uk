/**
 * Builds a street's frontages from the city kit: one instanced mesh per
 * piece-and-material pair for the whole area, coloured per building by
 * instance colour, plus the signs that the level data names.
 */
import * as THREE from 'three';
import type { FacadePlan, PlannedBuilding } from '../../city/compose';
import { signTexture } from '../levelTextures';
import type { CityKit, KitPrim, TintSlot } from './CityKit';
import { doorPiece, doorsReady, type DoorStyle } from '../props/DoorLibrary';

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
  const doorBox = new Map<string, THREE.Box3>();
  for (const plan of plans) {
    for (const p of plan.placements) {
      const b = plan.buildings[p.building];
      // The kit's flat door leaves become real doors (DoorLibrary), picked per doorway; its frames stay round them.
      if (p.piece.startsWith('Door_') && doorsReady()) {
        let box = doorBox.get(p.piece);
        if (!box) {
          box = new THREE.Box3();
          for (const prim of kit.piece(p.piece)) {
            if (!prim.geometry.boundingBox) prim.geometry.computeBoundingBox();
            box.union(prim.geometry.boundingBox!);
          }
          doorBox.set(p.piece, box);
        }
        const g = b.design.ground;
        const style: DoorStyle = g === 'house' || g === 'stucco' ? 'house' : g === 'shop_trim' || g === 'pub' || g === 'lobby' || g === 'shop_glass' ? 'shop' : 'service';
        const w = (box.max.x - box.min.x) * p.sx;
        const door = doorPiece(style, Math.round(p.x * 100) + p.building * 7919, w * 1.08, box.max.y - box.min.y + 0.04);
        if (door) {
          door.position.set(p.x + ((box.min.x + box.max.x) / 2) * p.sx, p.y + box.min.y, backZ + p.z + box.max.z - 0.15);
          group.add(door);
          continue;
        }
      }
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

/**
 * A traditional shop fascia: the painted board, a moulded cornice over it, a thin
 * bead under it and a console bracket at each end. Lettering keeps its proportions.
 */
function fascia(group: THREE.Group, x: number, y: number, z: number, width: number, height: number, paint: string, t: THREE.Texture, glow: number): void {
  const board = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow, roughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(paint).multiplyScalar(0.55), roughness: 0.5 });
  box(group, width, height, 0.12, x, y, z, board);
  // Cornice: a stepped moulding that throws a shadow on the letters.
  box(group, width + 0.3, 0.07, 0.3, x, y + height / 2 + 0.035, z + 0.04, trim);
  box(group, width + 0.22, 0.05, 0.22, x, y + height / 2 + 0.095, z + 0.0, trim);
  box(group, width + 0.1, 0.035, 0.18, x, y - height / 2 - 0.015, z + 0.02, trim);
  // Console brackets.
  for (const e of [-1, 1]) {
    box(group, 0.16, height + 0.18, 0.24, x + e * (width / 2 + 0.08), y + 0.02, z + 0.04, trim);
    box(group, 0.12, 0.12, 0.28, x + e * (width / 2 + 0.08), y - height / 2 - 0.1, z + 0.02, trim);
  }
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
      const nw = Math.min(w - 2, 9);
      const t = signTexture(s.label, '#060608', neon, { neon: true, aspect: nw / 1.3, h: 160 });
      box(group, nw, 1.3, 0.12, cx, 3.9, backZ + 0.45, lit(t, 1.7));
      // A lit canopy over the door.
      const door = b.doors[0] ?? cx;
      box(group, 3.2, 0.15, 1.2, door, 2.75, backZ + 0.7, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, emissive: new THREE.Color(neon), emissiveIntensity: 0.6 }));
      return;
    }
    case 'office':
    case 'leisure':
    case 'market': {
      // Modern lettering: a slim dark panel with the name in raised cream letters.
      const bw = Math.min(w - 2, 10);
      const t = signTexture(s.label, '#1a1c20', '#e8e4d8', { serif: s.kind === 'market', aspect: bw / 0.7, h: 128, maxLetter: 0.58 });
      box(group, bw, 0.7, 0.1, cx, 3.35, backZ + 0.4, lit(t, 0.25));
      return;
    }
    case 'pub': {
      // Gilt signwriting on the painted fascia.
      const t = signTexture(s.label, paint, '#d9b65a', { serif: true, gilt: true, aspect: (w - 0.9) / 0.7, h: 128, maxLetter: 0.66 });
      fascia(group, cx, 2.75, backZ + 0.32, w - 0.9, 0.7, paint, t, 0.22);
      // Hanging sign on a bracket at the first-floor line.
      const hx = x0 + 1.2;
      box(group, 0.06, 0.06, 1.1, hx, 3.6, backZ + 0.75, new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.6 }));
      const hs = signTexture(s.label.replace(/^THE /, ''), paint, '#d9b65a', { serif: true, w: 256, h: 256 });
      box(group, 0.06, 1.0, 1.0, hx, 3.0, backZ + 1.2, lit(hs, 0.25));
      return;
    }
    default: {
      // Shops, showrooms, the gym, precinct units, warehouses: a fascia board.
      // Old frontages (shops, the bookies) get serif signwriting, gilt on dark paint; the rest a plain modern face.
      const traditional = s.kind === 'shop' || s.kind === 'cafe' || s.kind === 'takeaway';
      const fw = w - 0.9;
      const dark = new THREE.Color(paint).getHSL({ h: 0, s: 0, l: 0 }).l < 0.35;
      const t = signTexture(s.label, paint, ink, { serif: traditional, gilt: traditional && dark, aspect: fw / 0.62, h: 128, maxLetter: 0.6 });
      fascia(group, cx, 2.78, backZ + 0.34, fw, 0.62, paint, t, s.label === 'TO LET' ? 0.03 : 0.3);
    }
  }
}
