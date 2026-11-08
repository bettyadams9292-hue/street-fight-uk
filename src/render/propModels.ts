import * as THREE from 'three';
import { BIKES, CARS, FURNITURE, type BikeDef, type CarDef, type FurnitureDef } from '../property/catalogue';
import { signTexture } from './levelTextures';
import { EQUIPMENT } from '../business/catalogue';

/**
 * Furniture, cars and off-road bikes, built from primitives so they share
 * materials and stay cheap. Used by the levels, the shop previews and the
 * rider on a bike. Each model faces the camera (+z) at rotation 0, stands on
 * y = 0 and is centred on x/z; cars and bikes point their nose along +x.
 */

const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(colour: string | number, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const key = `${colour}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal, ...extra });
    mats.set(key, m);
  }
  return m;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new Map<string, THREE.CylinderGeometry>();
function cylinder(r0: number, r1: number, h: number, seg: number): THREE.CylinderGeometry {
  const k = `${r0}|${r1}|${h}|${seg}`;
  let g = cylGeo.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r0, r1, h, seg);
    cylGeo.set(k, g);
  }
  return g;
}


function B(g: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, cast = true): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeo, m);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.userData.shared = true;
  g.add(mesh);
  return mesh;
}

function C(g: THREE.Object3D, r0: number, r1: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 14, cast = true): THREE.Mesh {
  const geo = cylinder(r0, r1, h, seg);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.userData.shared = true;
  g.add(mesh);
  return mesh;
}

const darker = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

// ---- furniture -------------------------------------------------------------------------------

/** A furniture piece. Wall pieces hang at their own height with their back on z = -depth/2. */
export function buildFurnitureModel(id: string, colour?: string): THREE.Group {
  const def = FURNITURE[id];
  const g = new THREE.Group();
  if (!def) {
    B(g, 0.6, 0.6, 0.6, 0, 0.3, 0, mat('#888'));
    return g;
  }
  const c = colour ?? def.colours[0];
  const W = def.size[0] * 2;
  const D = def.size[1] * 2;
  const y0 = def.mount === 'wall' ? (def.wallY ?? 1.6) : 0;
  furniture(g, def, c, W, D, y0);
  return g;
}

function furniture(g: THREE.Group, def: FurnitureDef, c: string, W: number, D: number, y0: number): void {
  const fabric = mat(c, 1);
  const wood = mat(c, 0.55);
  const dark = mat('#1a1a1c', 0.5);
  const legs = (w: number, d: number, h: number, m: THREE.Material, r = 0.025) => {
    for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) C(g, r, r, h, dx, h / 2, dz, m, 6, false);
  };
  switch (def.id) {
    case 'sofa_3':
    case 'sofa_2': {
      B(g, W - 0.3, 0.22, D - 0.2, 0, 0.28, 0.05, fabric);
      B(g, W, 0.14, D, 0, 0.14, 0, mat(darker(c, 0.7), 1));
      B(g, W, 0.55, 0.24, 0, 0.56, -D / 2 + 0.12, fabric);
      for (const dx of [-W / 2 + 0.11, W / 2 - 0.11]) B(g, 0.22, 0.58, D, dx, 0.31, 0, fabric);
      const n = def.id === 'sofa_3' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const w = (W - 0.44) / n;
        B(g, w - 0.04, 0.1, D - 0.35, -W / 2 + 0.22 + w * (i + 0.5), 0.44, 0.08, mat(darker(c, 1.15), 1));
        B(g, w - 0.08, 0.36, 0.12, -W / 2 + 0.22 + w * (i + 0.5), 0.64, -D / 2 + 0.3, mat(darker(c, 1.1), 1));
      }
      B(g, 0.3, 0.28, 0.1, -W / 2 + 0.45, 0.62, -D / 2 + 0.42, mat('#c9a227', 1), false);
      legs(W - 0.1, D - 0.1, 0.07, mat('#2a1a10', 0.5), 0.03);
      break;
    }
    case 'armchair': {
      B(g, W - 0.24, 0.16, D - 0.15, 0, 0.36, 0.04, mat(darker(c, 1.1), 1));
      B(g, W, 0.24, D, 0, 0.2, 0, fabric);
      B(g, W, 0.85, 0.18, 0, 0.7, -D / 2 + 0.09, fabric);
      for (const dx of [-W / 2 + 0.08, W / 2 - 0.08]) B(g, 0.16, 0.5, D - 0.1, dx, 0.45, 0.03, fabric);
      legs(W - 0.1, D - 0.1, 0.08, mat('#2a1a10', 0.5), 0.025);
      break;
    }
    case 'coffee_table':
      B(g, W, 0.05, D, 0, 0.42, 0, wood);
      B(g, W - 0.1, 0.03, D - 0.08, 0, 0.12, 0, wood, false);
      legs(W - 0.08, D - 0.08, 0.42, wood, 0.03);
      B(g, 0.16, 0.03, 0.06, 0.2, 0.46, 0.05, dark, false);
      break;
    case 'tv_unit':
      B(g, W, 0.42, D, 0, 0.25, 0, wood);
      for (const dx of [-W / 4, W / 4]) B(g, W / 2 - 0.04, 0.34, 0.01, dx, 0.25, D / 2 + 0.005, mat(darker(c, 0.85), 0.5), false);
      B(g, 0.12, 0.02, 0.01, -0.06, 0.25, D / 2 + 0.012, mat('#c8c8c8', 0.3, 0.8), false);
      legs(W - 0.1, D - 0.06, 0.04, dark);
      break;
    case 'tv_43': {
      B(g, W, 0.48, D, 0, 0.24, 0, mat('#2a2a2a', 0.6));
      B(g, 0.08, 0.2, 0.06, 0, 0.58, 0, dark);
      B(g, W * 1.05, 0.62, 0.05, 0, 0.98, 0, mat(c, 0.3, 0.5));
      B(g, W, 0.56, 0.01, 0, 0.98, 0.028, mat('#0a0e18', 0.1, 0, { emissive: 0x3a6aff, emissiveIntensity: 0.55 }), false);
      break;
    }
    case 'tv_65': {
      B(g, W, 0.86, 0.05, 0, y0, -D / 2 + 0.03, mat(c, 0.3, 0.5));
      B(g, W - 0.04, 0.8, 0.01, 0, y0, -D / 2 + 0.06, mat('#0a0e18', 0.1, 0, { emissive: 0x5a7aff, emissiveIntensity: 0.6 }), false);
      break;
    }
    case 'bookcase': {
      const H = 1.9;
      B(g, W, H, 0.03, 0, H / 2, -D / 2 + 0.015, wood);
      for (const dx of [-W / 2 + 0.02, W / 2 - 0.02]) B(g, 0.04, H, D, dx, H / 2, 0, wood);
      for (let i = 0; i < 6; i++) B(g, W - 0.04, 0.03, D, 0, 0.05 + i * 0.37, 0, wood, false);
      const bookCols = ['#7a1414', '#1f2a44', '#2a5a3a', '#c9a227', '#e8e4dc', '#4a2a5a'];
      for (let s = 0; s < 5; s++) {
        let x = -W / 2 + 0.06;
        let k = s * 3;
        while (x < W / 2 - 0.12) {
          const bw = 0.04 + ((k * 7) % 5) * 0.012;
          const bh = 0.22 + ((k * 13) % 4) * 0.025;
          B(g, bw, bh, D - 0.08, x + bw / 2, 0.07 + s * 0.37 + bh / 2, 0, mat(bookCols[k % bookCols.length], 0.9), false);
          x += bw + 0.008;
          k++;
        }
      }
      break;
    }
    case 'shelf_low':
      B(g, W, 0.8, D, 0, 0.4, 0, wood);
      for (let i = 0; i < 4; i++) {
        const x = -W / 2 + W / 8 + (i % 2 === 0 ? 0 : W / 4) + Math.floor(i / 2) * (W / 2);
        B(g, W / 4 - 0.06, 0.3, 0.02, x, i < 2 ? 0.22 : 0.58, D / 2 + 0.01, mat(['#c8a070', '#e8e4dc', '#2a2a2e', '#a85a3a'][i], 1), false);
      }
      break;
    case 'rug_round': {
      const r = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(c, 1));
      r.rotation.x = -Math.PI / 2;
      r.scale.set(W / 2, D / 2, 1);
      r.position.y = 0.012;
      r.receiveShadow = true;
      g.add(r);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.8, 40), mat(darker(c, 1.5), 1));
      ring.rotation.x = -Math.PI / 2;
      ring.scale.set(W / 2, D / 2, 1);
      ring.position.y = 0.014;
      g.add(ring);
      break;
    }
    case 'rug_long':
    case 'bath_mat': {
      B(g, W, 0.015, D, 0, 0.008, 0, mat(c, 1), false);
      if (def.id === 'rug_long') {
        B(g, W - 0.16, 0.017, D - 0.16, 0, 0.009, 0, mat(darker(c, 1.4), 1), false);
        B(g, W - 0.36, 0.019, D - 0.36, 0, 0.01, 0, mat(c, 1), false);
        B(g, W * 0.3, 0.021, D * 0.3, 0, 0.011, 0, mat('#c9a227', 1), false);
      }
      break;
    }
    case 'bed_double':
    case 'bed_single': {
      B(g, W, 0.3, D, 0, 0.2, 0.02, mat('#2a1a10', 0.6));
      B(g, W - 0.06, 0.2, D - 0.1, 0, 0.45, 0.04, mat('#f0eee8', 0.9));
      B(g, W - 0.02, 0.1, D * 0.62, 0, 0.56, D * 0.17, fabric);
      B(g, W, 1.05, 0.12, 0, 0.6, -D / 2 + 0.06, fabric);
      const pillows = def.id === 'bed_double' ? [-W / 4, W / 4] : [0];
      for (const dx of pillows) B(g, W / pillows.length - 0.12, 0.12, 0.32, dx, 0.6, -D / 2 + 0.3, mat('#ffffff', 1));
      break;
    }
    case 'wardrobe2': {
      const H = 1.95;
      B(g, W, H, D, 0, H / 2 + 0.05, 0, wood);
      B(g, 0.01, H - 0.12, 0.01, 0, H / 2 + 0.05, D / 2 + 0.006, mat(darker(c, 0.6), 0.6), false);
      for (const dx of [-0.08, 0.08]) B(g, 0.02, 0.22, 0.03, dx, 1.05, D / 2 + 0.02, mat('#c8c8c8', 0.3, 0.8), false);
      B(g, W + 0.04, 0.05, D + 0.04, 0, H + 0.075, 0, wood);
      break;
    }
    case 'bedside':
      B(g, W, 0.5, D, 0, 0.27, 0, wood);
      B(g, W - 0.06, 0.16, 0.01, 0, 0.4, D / 2 + 0.005, mat(darker(c, 0.85), 0.5), false);
      B(g, 0.08, 0.02, 0.02, 0, 0.4, D / 2 + 0.015, mat('#c8c8c8', 0.3, 0.8), false);
      C(g, 0.06, 0.08, 0.2, 0.06, 0.62, 0, mat('#e8e4dc', 0.5));
      C(g, 0.12, 0.08, 0.14, 0.06, 0.79, 0, mat('#fff4d8', 1, 0, { emissive: 0xffd8a0, emissiveIntensity: 0.6 }), 14, false);
      break;
    case 'drawers':
      B(g, W, 0.85, D, 0, 0.45, 0, wood);
      for (let i = 0; i < 4; i++) {
        B(g, W - 0.06, 0.18, 0.01, 0, 0.15 + i * 0.2, D / 2 + 0.005, mat(darker(c, 0.85), 0.5), false);
        B(g, 0.12, 0.02, 0.02, 0, 0.18 + i * 0.2, D / 2 + 0.015, mat('#c8c8c8', 0.3, 0.8), false);
      }
      break;
    case 'mirror_stand': {
      const f = B(g, W, 1.6, 0.04, 0, 0.85, 0, mat(c, 0.4, 0.5));
      f.rotation.x = -0.08;
      const m = B(g, W - 0.08, 1.5, 0.01, 0, 0.85, 0.025, mat('#a8b8c8', 0.05, 0.2, { emissive: 0x6a7a8a, emissiveIntensity: 0.45 }), false);
      m.rotation.x = -0.08;
      for (const dx of [-W / 2, W / 2]) B(g, 0.03, 0.03, D * 2, dx, 0.02, -0.05, mat(c, 0.4, 0.5));
      break;
    }
    case 'desk2':
      B(g, W, 0.04, D, 0, 0.74, 0, wood);
      for (const dx of [-W / 2 + 0.03, W / 2 - 0.03]) B(g, 0.04, 0.74, D, dx, 0.37, 0, wood);
      B(g, 0.34, 0.02, 0.24, -0.1, 0.77, 0, mat('#2a2a2e', 0.4, 0.4), false);
      B(g, 0.34, 0.22, 0.01, -0.1, 0.88, -0.11, mat('#0a0e18', 0.2, 0, { emissive: 0x2a4a8a, emissiveIntensity: 0.4 }), false);
      break;
    case 'dining_table':
      B(g, W, 0.05, D, 0, 0.75, 0, wood);
      legs(W - 0.1, D - 0.1, 0.75, wood, 0.035);
      C(g, 0.08, 0.06, 0.18, 0, 0.86, 0, mat('#e8e4dc', 0.3), 12);
      break;
    case 'dining_chair':
      B(g, W, 0.04, D, 0, 0.46, 0, wood);
      legs(W - 0.05, D - 0.05, 0.46, wood, 0.02);
      B(g, W, 0.45, 0.03, 0, 0.7, -D / 2 + 0.015, wood);
      break;
    case 'fridge2': {
      const m = mat(c, 0.25, 0.6);
      B(g, W, 1.8, D, 0, 0.9, 0, m);
      B(g, 0.01, 1.76, 0.01, 0, 0.9, D / 2 + 0.005, mat('#1a1a1a', 0.5), false);
      for (const dx of [-0.05, 0.05]) B(g, 0.025, 0.6, 0.04, dx, 1.1, D / 2 + 0.03, mat('#c8c8c8', 0.2, 0.9), false);
      B(g, 0.2, 0.28, 0.01, -W / 4, 1.2, D / 2 + 0.008, mat('#2a2a2e', 0.3), false);
      break;
    }
    case 'cupboard':
    case 'worktop': {
      B(g, W, 0.86, D - 0.04, 0, 0.45, -0.02, mat(c, 0.6));
      B(g, W + 0.02, 0.04, D, 0, 0.9, 0, mat('#3a3a3a', 0.35, 0.2));
      const n = def.id === 'worktop' ? 2 : 1;
      for (let i = 0; i < n; i++) B(g, 0.12, 0.02, 0.02, -W / 2 + (W / n) * (i + 0.5), 0.75, D / 2 - 0.01, mat('#c8c8c8', 0.3, 0.8), false);
      if (def.id === 'worktop') {
        B(g, 0.4, 0.04, 0.3, W / 4, 0.93, 0, mat('#c8c8c8', 0.2, 0.9), false);
        C(g, 0.015, 0.015, 0.3, W / 4, 1.05, -D / 2 + 0.08, mat('#c8c8c8', 0.2, 0.9), 8, false);
      }
      break;
    }
    case 'washer':
      B(g, W, 0.85, D, 0, 0.43, 0, mat(c, 0.4, 0.2));
      {
        const door = C(g, 0.18, 0.18, 0.04, 0, 0.4, D / 2 + 0.01, mat('#2a3a4a', 0.1, 0.6), 24, false);
        door.rotation.x = Math.PI / 2;
      }
      B(g, W - 0.06, 0.1, 0.01, 0, 0.78, D / 2 + 0.005, mat('#c8c8c8', 0.4), false);
      break;
    case 'island':
      B(g, W - 0.2, 0.86, D - 0.15, 0, 0.45, -0.07, mat(c, 0.6));
      B(g, W, 0.05, D, 0, 0.9, 0, mat('#e8e4dc', 0.25));
      for (const dx of [-W / 4, W / 4]) {
        C(g, 0.15, 0.15, 0.04, dx, 0.66, D / 2 + 0.05, mat('#2a2a2e', 0.5), 12);
        C(g, 0.02, 0.02, 0.64, dx, 0.32, D / 2 + 0.05, mat('#c8c8c8', 0.3, 0.8), 6, false);
      }
      break;
    case 'wall_cupboards':
      B(g, W, 0.6, D, 0, y0, 0, mat(c, 0.6));
      for (const dx of [-W / 4, W / 4]) {
        B(g, W / 2 - 0.04, 0.56, 0.01, dx, y0, D / 2 + 0.005, mat(darker(c, 0.9), 0.6), false);
        B(g, 0.02, 0.12, 0.02, dx + (dx < 0 ? W / 4 - 0.06 : -W / 4 + 0.06), y0 - 0.18, D / 2 + 0.015, mat('#c8c8c8', 0.3, 0.8), false);
      }
      break;
    case 'bath_cabinet':
      B(g, W, 0.55, D, 0, y0, 0, mat(c, 0.5));
      B(g, W - 0.06, 0.49, 0.01, 0, y0, D / 2 + 0.005, mat('#a8b8c8', 0.05, 0.2, { emissive: 0x6a7a8a, emissiveIntensity: 0.4 }), false);
      break;
    case 'bath_mirror': {
      const rim = C(g, W / 2, W / 2, 0.03, 0, y0, -D / 2 + 0.02, mat(c, 0.3, 0.8), 32, false);
      rim.rotation.x = Math.PI / 2;
      const glass = C(g, W / 2 - 0.03, W / 2 - 0.03, 0.03, 0, y0, -D / 2 + 0.03, mat('#a8b8c8', 0.05, 0.2, { emissive: 0x6a7a8a, emissiveIntensity: 0.45 }), 32, false);
      glass.rotation.x = Math.PI / 2;
      break;
    }
    case 'bath_tower':
      B(g, W, 1.6, D, 0, 0.8, 0, mat(c, 0.6));
      for (let i = 0; i < 3; i++) B(g, W - 0.08, 0.16, D - 0.04, 0, 0.35 + i * 0.4, 0.01, mat(['#e8e4dc', '#3a5a4a', '#e8e4dc'][i], 1), false);
      break;
    case 'towel_rail':
      for (let i = 0; i < 5; i++) C(g, 0.012, 0.012, W, 0, y0 - 0.3 + i * 0.15, -D / 2 + 0.04, mat(c, 0.2, 0.9), 6, false).rotation.z = Math.PI / 2;
      for (const dx of [-W / 2, W / 2]) C(g, 0.015, 0.015, 0.75, dx, y0, -D / 2 + 0.04, mat(c, 0.2, 0.9), 6, false);
      B(g, W * 0.7, 0.4, 0.03, 0, y0 - 0.05, -D / 2 + 0.07, mat('#e8e4dc', 1), false);
      break;
    case 'laundry':
      C(g, W / 2 - 0.02, W / 2, 0.5, 0, 0.25, 0, mat(c, 1), 14);
      C(g, W / 2, W / 2, 0.04, 0, 0.52, 0, mat(darker(c, 0.85), 1), 14);
      break;
    case 'painting':
    case 'canvas_art':
    case 'poster_frame': {
      const h = def.id === 'canvas_art' ? 0.75 : def.id === 'poster_frame' ? 0.85 : 0.65;
      if (def.id !== 'canvas_art') B(g, W, h, 0.03, 0, y0, -D / 2 + 0.015, mat(c, 0.4, def.id === 'painting' ? 0.6 : 0), false);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(W - (def.id === 'canvas_art' ? 0 : 0.08), h - (def.id === 'canvas_art' ? 0 : 0.08)), artMaterial(def.id, c));
      art.position.set(0, y0, -D / 2 + 0.035);
      g.add(art);
      break;
    }
    case 'wall_clock': {
      const face = C(g, W / 2, W / 2, 0.04, 0, y0, -D / 2 + 0.02, mat('#f0eee8', 0.6), 32, false);
      face.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(W / 2, 0.018, 8, 32), mat(c, 0.3, 0.6));
      rim.position.set(0, y0, -D / 2 + 0.04);
      g.add(rim);
      const h1 = B(g, 0.012, W * 0.3, 0.005, 0, y0 + W * 0.12, -D / 2 + 0.045, mat('#111'), false);
      h1.rotation.z = -0.6;
      B(g, 0.012, W * 0.38, 0.005, 0.03, y0 + 0.05, -D / 2 + 0.046, mat('#111'), false).rotation.z = 1.9;
      break;
    }
    case 'wall_shelf':
      B(g, W, 0.04, D, 0, y0, 0, wood);
      C(g, 0.05, 0.06, 0.18, -W / 3, y0 + 0.11, 0, mat('#1f2a44', 0.3), 12);
      C(g, 0.03, 0.03, 0.1, -W / 10, y0 + 0.07, 0, mat('#f0eee8', 0.6, 0, { emissive: 0xffc070, emissiveIntensity: 0.3 }), 10);
      B(g, 0.12, 0.16, 0.08, W / 4, y0 + 0.1, 0, mat('#c9a227', 0.3, 0.7));
      break;
    case 'plant_tall':
    case 'plant_small': {
      const tall = def.id === 'plant_tall';
      const pr = W / 2 - 0.02;
      C(g, pr, pr * 0.8, tall ? 0.35 : 0.18, 0, tall ? 0.175 : 0.09, 0, mat(c, 0.5), 14);
      const leaf = mat('#2f6b3a', 0.85);
      if (tall) {
        C(g, 0.02, 0.025, 0.9, 0, 0.75, 0, mat('#5a3a1a', 0.9), 6, false);
        for (let i = 0; i < 9; i++) {
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), leaf);
          const a = i * 2.4;
          l.scale.set(1, 0.6, 0.35);
          l.position.set(Math.cos(a) * 0.14, 0.75 + i * 0.09, Math.sin(a) * 0.1);
          l.rotation.set(0.3, a, 0.4);
          l.castShadow = true;
          g.add(l);
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const l = B(g, 0.05, 0.42, 0.015, Math.cos(i) * 0.04, 0.38, Math.sin(i) * 0.04, mat('#3a6a2a', 0.8));
          l.rotation.set(Math.sin(i * 1.7) * 0.25, i, Math.cos(i * 1.3) * 0.2);
        }
      }
      break;
    }
    case 'vase':
      C(g, W / 2 - 0.04, W / 2, 0.6, 0, 0.3, 0, mat(c, 0.15, 0.1), 16);
      C(g, 0.05, W / 2 - 0.04, 0.12, 0, 0.66, 0, mat(c, 0.15, 0.1), 16);
      for (let i = 0; i < 7; i++) C(g, 0.006, 0.006, 0.6, Math.cos(i) * 0.03, 0.98, Math.sin(i) * 0.03, mat('#c8a870', 1), 4, false).rotation.set(Math.sin(i) * 0.3, 0, Math.cos(i) * 0.3);
      break;
    case 'trophy_cab':
      B(g, W, 1.6, D, 0, 0.8, 0, wood);
      B(g, W - 0.08, 1.2, 0.01, 0, 1.0, D / 2 + 0.005, mat('#a8c8d8', 0.05, 0.2, { transparent: true, opacity: 0.35 }), false);
      for (let i = 0; i < 3; i++) {
        C(g, 0.05, 0.03, 0.22, -0.2 + i * 0.2, 0.62 + (i % 2) * 0.4, 0, mat('#c9a227', 0.2, 0.9, { emissive: 0x5a4010, emissiveIntensity: 0.3 }), 10);
      }
      B(g, 0.5, 0.06, 0.05, 0, 1.35, 0, mat('#c9a227', 0.2, 0.9), false);
      break;
    case 'floor_lamp':
      C(g, 0.13, 0.15, 0.04, 0, 0.02, 0, mat(c, 0.3, 0.7), 16);
      C(g, 0.015, 0.015, 1.45, 0, 0.75, 0, mat(c, 0.3, 0.7), 6, false);
      C(g, 0.12, 0.18, 0.26, 0, 1.52, 0, mat('#f0e8d8', 1, 0, { emissive: 0xffd8a0, emissiveIntensity: 0.8, side: THREE.DoubleSide }), 16, false);
      break;
    case 'arc_lamp': {
      C(g, 0.16, 0.18, 0.06, 0, 0.03, 0, mat('#e8e4dc', 0.3), 16);
      C(g, 0.015, 0.015, 1.6, 0, 0.8, 0, mat(c, 0.3, 0.8), 6, false);
      const arm = C(g, 0.012, 0.012, 1.0, 0.35, 1.85, 0.25, mat(c, 0.3, 0.8), 6, false);
      arm.rotation.z = -1.0;
      arm.rotation.x = 0.5;
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, 0.3, 0.8, { side: THREE.DoubleSide, emissive: 0xffd8a0, emissiveIntensity: 0.2 }));
      shade.position.set(0.75, 2.0, 0.5);
      g.add(shade);
      break;
    }
    case 'wall_light':
      B(g, 0.08, 0.14, 0.04, 0, y0, -D / 2 + 0.02, mat(c, 0.3, 0.8), false);
      C(g, 0.07, 0.04, 0.12, 0, y0 + 0.06, 0, mat('#f8f0e0', 0.6, 0, { emissive: 0xffd8a0, emissiveIntensity: 1.0 }), 12, false);
      break;
    case 'neon_sign': {
      const tex = signTexture('KNOCKOUT', '#000000', c, { neon: true, w: 512, h: 128 });
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xffffff });
      B(g, W, 0.36, 0.02, 0, y0, -D / 2 + 0.01, mat('#111', 0.5), false);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.32), m);
      p.position.set(0, y0, -D / 2 + 0.025);
      g.add(p);
      break;
    }
    default:
      B(g, W, 0.8, D, 0, def.mount === 'wall' ? y0 : 0.4, 0, wood);
  }
}

const artCache = new Map<string, THREE.Material>();
function artMaterial(id: string, colour: string): THREE.Material {
  const k = `${id}|${colour}`;
  let m = artCache.get(k);
  if (m) return m;
  const cnv = document.createElement('canvas');
  cnv.width = 128;
  cnv.height = 128;
  const g = cnv.getContext('2d')!;
  if (id === 'painting') {
    const sky = g.createLinearGradient(0, 0, 0, 80);
    sky.addColorStop(0, '#6a8ab8');
    sky.addColorStop(1, '#e8c8a0');
    g.fillStyle = sky;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#4a6a3a';
    g.beginPath();
    g.moveTo(0, 90);
    g.quadraticCurveTo(40, 60, 80, 85);
    g.quadraticCurveTo(110, 70, 128, 80);
    g.lineTo(128, 128);
    g.lineTo(0, 128);
    g.fill();
    g.fillStyle = '#2f4a2a';
    g.fillRect(0, 105, 128, 23);
  } else if (id === 'canvas_art') {
    g.fillStyle = '#f0eee8';
    g.fillRect(0, 0, 128, 128);
    const cols = [colour, '#1a1a1a', '#e8c040', '#2a6aa8', '#d84a2a'];
    for (let i = 0; i < 7; i++) {
      g.fillStyle = cols[i % cols.length];
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(20 + ((i * 37) % 100), 20 + ((i * 53) % 100), 12 + ((i * 11) % 22), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  } else {
    g.fillStyle = '#1a1a1a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#d84a2a';
    g.fillRect(10, 10, 108, 60);
    g.fillStyle = '#f0eee8';
    g.font = 'bold 22px sans-serif';
    g.textAlign = 'center';
    g.fillText('LIVE', 64, 48);
    g.font = '12px sans-serif';
    g.fillText('THE BRIXTON', 64, 92);
    g.fillText('ACADEMY', 64, 108);
  }
  const t = new THREE.CanvasTexture(cnv);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  artCache.set(k, m);
  return m;
}

// ---- cars ------------------------------------------------------------------------------------------

/** A car with its nose along +x. */
export function buildCarModel(id: string, colour?: string): THREE.Group {
  const def = CARS[id];
  const g = new THREE.Group();
  if (!def) return g;
  car(g, def, colour ?? def.colours[0]);
  return g;
}

function car(g: THREE.Group, def: CarDef, colour: string): void {
  const L = def.size[0] * 2;
  const Wd = def.size[1] * 2;
  const cls = def.cls;
  const paint = mat(colour, 0.22, 0.75);
  const glass = mat('#0a0d12', 0.08, 0.85);
  const trim = mat('#141416', 0.5, 0.3);
  const chrome = mat('#d8d8d8', 0.15, 1);
  const tall = cls === 'suv' || cls === '4x4';
  const low = cls === 'sports' || cls === 'performance';
  const wheelR = tall ? 0.4 : low ? 0.34 : 0.32;
  const ride = tall ? 0.42 : low ? 0.22 : 0.3;
  const bodyH = tall ? 0.7 : low ? 0.42 : 0.55;
  const cabinH = tall ? 0.62 : low ? 0.4 : 0.52;
  // Cabin position and length differ by shape.
  const cab = cls === 'hatchback' ? { x: -0.1, l: 0.58 } : cls === 'saloon' ? { x: -0.05, l: 0.46 } : low ? { x: -0.18, l: 0.38 } : cls === '4x4' && def.id === 'brute' ? { x: 0.25, l: 0.36 } : { x: -0.08, l: 0.6 };

  const body = B(g, L, bodyH, Wd, 0, ride + bodyH / 2, 0, paint);
  body.castShadow = true;
  // Bonnet slope and bumpers.
  B(g, 0.12, bodyH * 0.6, Wd - 0.04, L / 2 + 0.03, ride + bodyH * 0.35, 0, trim);
  B(g, 0.12, bodyH * 0.6, Wd - 0.04, -L / 2 - 0.03, ride + bodyH * 0.35, 0, trim);
  // Glasshouse.
  const cl = L * cab.l;
  B(g, cl, cabinH, Wd - 0.12, cab.x * L, ride + bodyH + cabinH / 2, 0, glass);
  B(g, cl * (low ? 0.75 : 0.88), 0.05, Wd - 0.14, cab.x * L - (low ? cl * 0.08 : 0), ride + bodyH + cabinH + 0.02, 0, paint);
  // Pillars.
  for (const dx of [-cl / 2, cl / 2]) B(g, 0.06, cabinH, Wd - 0.1, cab.x * L + dx, ride + bodyH + cabinH / 2, 0, paint, false);
  B(g, 0.06, cabinH, Wd - 0.1, cab.x * L, ride + bodyH + cabinH / 2, 0, paint, false);
  // Sills and arches.
  B(g, L * 0.7, 0.08, Wd + 0.02, 0, ride + 0.04, 0, trim, false);
  // Wheels.
  const tyre = mat('#0b0b0b', 0.9);
  const rim = mat(low ? '#2a2a2e' : '#b8b8bc', 0.25, 0.9);
  const wx = L / 2 - wheelR - 0.25;
  for (const dx of [-wx, wx]) for (const dz of [-Wd / 2 + 0.06, Wd / 2 - 0.06]) {
    const t = C(g, wheelR, wheelR, 0.24, dx, wheelR, dz, tyre, 18);
    t.rotation.x = Math.PI / 2;
    const r = C(g, wheelR * 0.62, wheelR * 0.62, 0.02, dx, wheelR, dz + Math.sign(dz) * 0.125, rim, 12, false);
    r.rotation.x = Math.PI / 2;
  }
  // Lights and plates.
  for (const dz of [-Wd / 2 + 0.18, Wd / 2 - 0.18]) {
    B(g, 0.03, 0.1, 0.22, L / 2 + 0.005, ride + bodyH * 0.72, dz, mat('#f8f8f0', 0.2, 0, { emissive: 0xfff8e0, emissiveIntensity: 0.6 }), false);
    B(g, 0.03, 0.1, 0.22, -L / 2 - 0.005, ride + bodyH * 0.72, dz, mat('#8a1010', 0.3, 0, { emissive: 0xc81010, emissiveIntensity: 0.5 }), false);
  }
  B(g, 0.02, 0.11, 0.5, L / 2 + 0.1, ride + bodyH * 0.3, 0, mat('#f0f0e8', 0.5), false);
  B(g, 0.02, 0.11, 0.5, -L / 2 - 0.1, ride + bodyH * 0.3, 0, mat('#e0b400', 0.5), false);
  // Grille.
  B(g, 0.02, bodyH * 0.3, Wd * 0.45, L / 2 + 0.01, ride + bodyH * 0.45, 0, def.cls === 'saloon' || def.id === 'sovereign' ? chrome : trim, false);
  // Mirrors and handles.
  for (const dz of [-Wd / 2 - 0.05, Wd / 2 + 0.05]) {
    B(g, 0.1, 0.07, 0.08, cab.x * L + cl / 2 - 0.05, ride + bodyH + 0.06, dz, paint, false);
    B(g, 0.1, 0.025, 0.02, cab.x * L, ride + bodyH * 0.8, dz * 0.97, chrome, false);
  }
  // Class extras.
  if (cls === 'performance' || def.id === 'vixen') {
    B(g, 0.25, 0.04, Wd - 0.1, -L / 2 + 0.15, ride + bodyH + (def.id === 'hornet' ? 0.38 : 0.12), 0, paint);
    for (const dz of [-Wd / 2 + 0.25, Wd / 2 - 0.25]) B(g, 0.08, def.id === 'hornet' ? 0.36 : 0.1, 0.04, -L / 2 + 0.15, ride + bodyH + (def.id === 'hornet' ? 0.18 : 0.05), dz, trim, false);
  }
  if (cls === '4x4') {
    B(g, L * 0.45, 0.05, Wd - 0.1, cab.x * L, ride + bodyH + cabinH + 0.1, 0, trim, false);
    const spare = C(g, wheelR, wheelR, 0.2, -L / 2 - 0.12, ride + bodyH * 0.7, 0, tyre, 16);
    spare.rotation.z = Math.PI / 2;
    if (def.id === 'brute') B(g, L * 0.35, 0.05, Wd - 0.1, -L * 0.3, ride + bodyH + 0.02, 0, trim, false);
  }
  if (cls === 'suv' || cls === 'saloon') for (const dz of [-Wd / 2 + 0.05, Wd / 2 - 0.05]) B(g, L * 0.5, 0.03, 0.02, -0.1, ride + bodyH * 0.5, dz * 1.01, chrome, false);
}

// ---- off-road bikes --------------------------------------------------------------------------------

/** An off-road bike with its front wheel along +x. */
export function buildBikeModel(id: string, colour?: string): THREE.Group {
  const def = BIKES[id];
  const g = new THREE.Group();
  if (!def) return g;
  bike(g, def, colour ?? def.colours[0]);
  return g;
}

const plateMats = new Map<string, THREE.MeshStandardMaterial>();

function bike(g: THREE.Group, def: BikeDef, colour: string): void {
  const R = def.wheel;
  const s = R / 0.37;
  /** Heights above the axle are a touch lower than lengths: a real seat is about 0.95 m up. */
  const v = 0.78 * s;
  const wb = 1.45 * s;
  const plastic = mat(colour, 0.35, 0.05);
  const frame = mat(def.cls === 'racing' ? '#1a1a1a' : '#8a8a90', 0.35, 0.8);
  const black = mat('#111113', 0.6);
  const alloy = mat('#c8c8cc', 0.25, 0.9);
  const tyre = mat('#0d0d0d', 0.95);
  // Wheels: knobbly tyres (torus + studs), spokes as a thin disc, hub.
  for (const x of [-wb / 2, wb / 2]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05 * s, 0.055 * s, 10, 28), tyre);
    t.position.set(x, R, 0);
    t.castShadow = true;
    g.add(t);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const k = B(g, 0.035 * s, 0.03 * s, 0.13 * s, x + Math.cos(a) * R, R + Math.sin(a) * R, 0, tyre, false);
      k.rotation.z = a;
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1 * s, 0.012, 6, 28), alloy);
    rim.position.set(x, R, 0);
    g.add(rim);
    const spokes = C(g, R - 0.1 * s, R - 0.1 * s, 0.01, x, R, 0, mat('#a8a8b0', 0.4, 0.8, { transparent: true, opacity: 0.35 }), 20, false);
    spokes.rotation.x = Math.PI / 2;
    const hub = C(g, 0.05 * s, 0.05 * s, 0.14, x, R, 0, alloy, 10, false);
    hub.rotation.x = Math.PI / 2;
  }
  // Brake disc on the front.
  const disc = C(g, 0.12 * s, 0.12 * s, 0.01, wb / 2, R, 0.07, alloy, 18, false);
  disc.rotation.x = Math.PI / 2;
  // Forks, raked back.
  for (const dz of [-0.09, 0.09]) {
    const f = C(g, 0.03, 0.035, 0.85 * s, wb / 2 - 0.13 * s, R + 0.38 * v, dz, def.suspension >= 9 ? mat('#c9a227', 0.2, 0.9) : alloy, 8);
    f.rotation.z = 0.42;
  }
  // Triple clamp and bars.
  B(g, 0.08, 0.05, 0.28, wb / 2 - 0.3 * s, R + 0.78 * v, 0, black);
  const bars = C(g, 0.014, 0.014, 0.8 * s, wb / 2 - 0.36 * s, R + 0.86 * v, 0, alloy, 6, false);
  bars.rotation.x = Math.PI / 2;
  for (const dz of [-0.4 * s, 0.4 * s]) {
    const grip = C(g, 0.022, 0.022, 0.12, wb / 2 - 0.36 * s, R + 0.86 * v, dz * 0.9, black, 8, false);
    grip.rotation.x = Math.PI / 2;
  }
  // Front number board and mudguard.
  const plate = B(g, 0.04, 0.22 * s, 0.26 * s, wb / 2 - 0.22 * s, R + 0.62 * v, 0, plastic);
  plate.rotation.z = 0.42;
  const fg = B(g, 0.55 * s, 0.03, 0.14, wb / 2 + 0.05 * s, R + 0.3 * v, 0, plastic);
  fg.rotation.z = -0.12;
  // Frame: down tube, top rail, swingarm.
  const down = B(g, 0.07, 0.75 * s, 0.07, wb / 2 - 0.55 * s, R + 0.32 * v, 0, frame);
  down.rotation.z = 0.75;
  const top = B(g, 0.85 * s, 0.06, 0.07, -0.05 * s, R + 0.62 * v, 0, frame);
  top.rotation.z = -0.12;
  const arm = B(g, 0.7 * s, 0.06, 0.16, -wb / 4, R + 0.05 * v, 0, alloy);
  arm.rotation.z = -0.1;
  // Engine block and cylinder.
  B(g, 0.4 * s, 0.32 * s, 0.24, 0.05 * s, R + 0.12 * v, 0, mat('#3a3a3e', 0.4, 0.6));
  B(g, 0.18 * s, 0.24 * s, 0.18, 0.1 * s, R + 0.38 * v, 0, mat('#2a2a2e', 0.4, 0.7));
  // Tank and radiator shrouds.
  B(g, 0.46 * s, 0.2 * s, 0.32, 0.12 * s, R + 0.68 * v, 0, plastic);
  for (const dz of [-0.17, 0.17]) {
    const sh = B(g, 0.3 * s, 0.3 * s, 0.02, 0.24 * s, R + 0.5 * v, dz, plastic);
    sh.rotation.z = 0.25;
  }
  // Seat and rear end.
  B(g, 0.7 * s, 0.08, 0.22, -0.32 * s, R + 0.74 * v, 0, black);
  const rear = B(g, 0.6 * s, 0.05, 0.2, -0.68 * s, R + 0.72 * v, 0, plastic);
  rear.rotation.z = 0.18;
  // Side plates with a number.
  const num = String(10 + (def.id.length * 7) % 89);
  let plateMat = plateMats.get(num);
  if (!plateMat) {
    plateMat = new THREE.MeshStandardMaterial({ map: signTexture(num, '#f0eee8', '#111', { w: 128, h: 128 }), roughness: 0.6 });
    plateMats.set(num, plateMat);
  }
  for (const dz of [-0.13, 0.13]) {
    const p = B(g, 0.26 * s, 0.2 * s, 0.01, -0.42 * s, R + 0.56 * v, dz, plateMat, false);
    p.rotation.z = 0.15;
  }
  // Exhaust.
  const ex = C(g, 0.05 * s, 0.06 * s, 0.5 * s, -0.5 * s, R + 0.5 * v, -0.14, def.cls === 'racing' || def.cls === 'mx_pro' ? mat('#8a8aa8', 0.15, 1) : alloy, 10);
  ex.rotation.z = Math.PI / 2 - 0.25;
  // Shock.
  const shock = C(g, 0.03, 0.03, 0.35 * s, -0.15 * s, R + 0.38 * v, 0, mat('#c9a227', 0.3, 0.8), 8, false);
  shock.rotation.z = -0.4;
  // Pegs.
  for (const dz of [-0.16, 0.16]) B(g, 0.05, 0.03, 0.08, -0.05 * s, R + 0.08 * v, dz, alloy, false);
  // Enduro: headlight and kickstand.
  if (def.cls === 'enduro') B(g, 0.05, 0.1, 0.12, wb / 2 - 0.16 * s, R + 0.62 * v, 0, mat('#f8f8f0', 0.2, 0, { emissive: 0xffffe0, emissiveIntensity: 0.6 }), false);
}

/** Car or bike, whichever the id is. */
export function buildVehicleModel(id: string, colour?: string): THREE.Group {
  return CARS[id] ? buildCarModel(id, colour) : buildBikeModel(id, colour);
}

// ---- basement business equipment -------------------------------------------------------------------

/**
 * Grow shop and basement equipment. `state` is 'ok|fill|on': faulty kit has
 * no glow and a hazard tag; storage fills with boxes as stock builds; lights
 * glow when the business is running.
 */
export function buildEquipmentModel(id: string, state = 'ok|0|on'): THREE.Group {
  const def = EQUIPMENT[id];
  const g = new THREE.Group();
  if (!def) return g;
  const [cond, fillS, power] = state.split('|');
  const faulty = cond === 'faulty';
  const on = power === 'on' && !faulty;
  const fill = Math.max(0, Math.min(1, Number(fillS) || 0));
  const W = def.size[0] * 2;
  const D = def.size[1] * 2;
  const y0 = def.mount === 'wall' ? def.wallY ?? 1.6 : 0;
  const steel = mat('#8a8e94', 0.4, 0.7);
  const dark = mat('#1c1e22', 0.5, 0.4);
  const black = mat('#111214', 0.6);
  const glow = (c: number, k = 1) => mat('#ffffff', 0.4, 0, { emissive: c, emissiveIntensity: on ? k : 0.05 });
  const foliage = (x: number, z: number, h: number, r: number) => {
    // Stylised greenery: clusters, nothing botanical.
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.7 + 0.1 * i), 0), mat(i % 2 ? '#2f7a32' : '#3d8f3a', 0.85));
      s.position.set(x + Math.cos(i * 1.9) * r * 0.4, h - i * r * 0.35, z + Math.sin(i * 1.9) * r * 0.3);
      s.castShadow = true;
      g.add(s);
    }
    C(g, r * 0.6, r * 0.5, 0.22, x, 0.11, z, mat('#2a2a2a', 0.8), 10);
  };
  switch (id) {
    case 'tent_s':
    case 'tent_d': {
      const H = 1.9;
      const fabric = mat('#1a1a1c', 0.95);
      // Frame, fabric walls (front rolled half up), silver lining glowing inside.
      for (const dx of [-W / 2, W / 2]) for (const dz of [-D / 2, D / 2]) C(g, 0.015, 0.015, H, dx, H / 2, dz, steel, 6, false);
      B(g, W, 0.02, D, 0, H, 0, fabric);
      B(g, 0.02, H, D, -W / 2, H / 2, 0, fabric);
      B(g, 0.02, H, D, W / 2, H / 2, 0, fabric);
      B(g, W, H, 0.02, 0, H / 2, -D / 2, fabric);
      B(g, W, H * 0.35, 0.02, 0, H - H * 0.175, D / 2, fabric);
      B(g, W, 0.12, 0.08, 0, H * 0.62, D / 2 + 0.02, fabric);
      B(g, W - 0.04, H * 0.6, 0.01, 0, H * 0.31, -D / 2 + 0.02, mat('#c8ccd0', 0.2, 0.8, { emissive: 0xf0d8ff, emissiveIntensity: on ? 0.25 : 0 }), false);
      // Lamp hanging inside.
      B(g, W * 0.7, 0.04, D * 0.6, 0, H - 0.25, 0, glow(0xf4d8ff, 1.3), false);
      const n = id === 'tent_d' ? 4 : 2;
      for (let i = 0; i < n; i++) foliage(-W / 2 + (W / n) * (i + 0.5), 0.05, 0.75, 0.16);
      if (id === 'tent_d') B(g, 0.02, H * 0.6, 0.03, 0, H * 0.31, D / 2 + 0.01, mat('#2a2a2e', 0.6), false);
      break;
    }
    case 'module': {
      const H = 2.2;
      const panel = mat('#e8ece8', 0.5);
      B(g, W, H, D, 0, H / 2, 0, panel);
      for (let x = -W / 2 + 0.6; x < W / 2; x += 0.6) B(g, 0.02, H, D + 0.01, x, H / 2, 0, mat('#c8ccc8', 0.5), false);
      B(g, 0.8, 1.9, 0.03, -W / 4, 0.95, D / 2 + 0.01, mat('#d0d4d0', 0.4, 0.3), false);
      B(g, 0.05, 0.2, 0.04, -W / 4 + 0.3, 1.0, D / 2 + 0.04, steel, false);
      // Window into the lit room.
      B(g, 0.9, 0.5, 0.02, W / 4, 1.4, D / 2 + 0.01, glow(0xe8d0ff, 0.9), false);
      B(g, W, 0.08, D, 0, H + 0.04, 0, dark);
      C(g, 0.12, 0.12, 0.5, W / 3, H + 0.3, 0, steel, 12);
      B(g, 0.3, 0.12, 0.02, W / 2 - 0.3, 1.9, D / 2 + 0.012, glow(on ? 0x40ff70 : 0x400000, 0.9), false);
      break;
    }
    case 'shelving':
    case 'pallet_rack': {
      const H = id === 'pallet_rack' ? 2.2 : 1.8;
      const frame = id === 'pallet_rack' ? mat('#1f4fa8', 0.5, 0.4) : steel;
      for (const dx of [-W / 2 + 0.03, W / 2 - 0.03]) for (const dz of [-D / 2 + 0.02, D / 2 - 0.02]) B(g, 0.05, H, 0.04, dx, H / 2, dz, frame);
      const levels = id === 'pallet_rack' ? 3 : 4;
      let shown = Math.round(fill * levels * (id === 'pallet_rack' ? 4 : 3));
      for (let l = 0; l < levels; l++) {
        const y = 0.1 + l * (H - 0.15) / levels;
        B(g, W, 0.03, D, 0, y, 0, id === 'pallet_rack' ? mat('#e86a10', 0.5, 0.3) : steel, false);
        const per = id === 'pallet_rack' ? 4 : 3;
        for (let k = 0; k < per && shown > 0; k++, shown--) B(g, W / per - 0.06, 0.26, D - 0.08, -W / 2 + (W / per) * (k + 0.5), y + 0.15, 0, mat(k % 2 ? '#b8946a' : '#a8845a', 0.95));
      }
      break;
    }
    case 'cabinet':
      B(g, W, 1.8, D, 0, 0.9, 0, mat('#5a6a5a', 0.4, 0.4));
      B(g, 0.01, 1.7, 0.01, 0, 0.9, D / 2 + 0.005, black, false);
      B(g, 0.08, 0.08, 0.03, 0.1, 1.0, D / 2 + 0.02, mat('#c9a227', 0.3, 0.8), false);
      for (const y of [0.3, 1.6]) B(g, W - 0.1, 0.03, 0.01, 0, y, D / 2 + 0.005, mat('#4a5a4a', 0.5), false);
      break;
    case 'workbench2':
      B(g, W, 0.06, D, 0, 0.9, 0, mat('#a87a4a', 0.6));
      for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) B(g, 0.06, 0.9, D - 0.06, dx, 0.45, 0, steel);
      B(g, W - 0.1, 0.03, D - 0.1, 0, 0.25, 0, steel, false);
      B(g, W, 0.7, 0.03, 0, 1.3, -D / 2 + 0.015, mat('#c8a870', 0.9), false);
      B(g, 0.25, 0.12, 0.2, -W / 4, 0.99, 0, mat('#2a2a2e', 0.4), false);
      B(g, 0.2, 0.1, 0.15, W / 4, 0.98, 0.02, mat('#b8946a', 0.95));
      C(g, 0.04, 0.04, 0.12, 0.05, 0.99, 0.05, mat('#e8e4dc', 0.4), 10);
      break;
    case 'led_rig':
    case 'led_array':
    case 'light_bars': {
      // Floor stand with a hanging panel; plants under it on bigger rigs.
      const H = 1.7;
      for (const dx of [-W / 2 + 0.03, W / 2 - 0.03]) {
        C(g, 0.02, 0.02, H, dx, H / 2, 0, steel, 6);
        B(g, 0.06, 0.03, D, dx, 0.015, 0, steel, false);
      }
      B(g, W, 0.03, 0.03, 0, H, 0, steel, false);
      const bars = id === 'led_rig' ? 1 : id === 'led_array' ? 3 : 6;
      for (let i = 0; i < bars; i++) {
        const x = bars === 1 ? 0 : -W / 2 + 0.1 + ((W - 0.2) / (bars - 1)) * i;
        B(g, bars === 1 ? W * 0.8 : 0.06, 0.04, D * 0.8, x, H - 0.3, 0, dark, false);
        B(g, bars === 1 ? W * 0.75 : 0.05, 0.01, D * 0.75, x, H - 0.325, 0, glow(0xffd8ff, 1.6), false);
      }
      B(g, 0.12, 0.08, 0.06, W / 2 - 0.1, H - 0.2, 0, dark, false);
      if (id !== 'led_rig') foliage(0, 0, 0.6, 0.15);
      break;
    }
    case 'fan': {
      const f = C(g, 0.12, 0.12, 0.35, 0, 0.6, 0, steel, 16);
      f.rotation.z = Math.PI / 2;
      C(g, 0.16, 0.16, 0.7, 0, 0.35, 0, mat('#2a2a2a', 0.9), 16);
      C(g, 0.17, 0.17, 0.03, 0, 0.71, 0, steel, 16);
      const duct = C(g, 0.08, 0.08, 1.4, 0, 1.45, 0, mat('#b8b8b0', 0.4, 0.6, { flatShading: true }), 10);
      duct.castShadow = false;
      break;
    }
    case 'air_handler':
    case 'air_system': {
      const H = id === 'air_system' ? 1.5 : 1.1;
      B(g, W, H, D, 0, H / 2, 0, mat('#c8ccd0', 0.4, 0.6));
      for (let y = 0.2; y < H - 0.1; y += 0.07) B(g, W * 0.45, 0.02, 0.01, -W / 4, y, D / 2 + 0.005, dark, false);
      const r = C(g, Math.min(W, H) * 0.22, Math.min(W, H) * 0.22, 0.03, W / 4, H / 2, D / 2 + 0.01, dark, 20, false);
      r.rotation.x = Math.PI / 2;
      B(g, 0.08, 0.05, 0.01, W / 4, H - 0.12, D / 2 + 0.01, glow(on ? 0x40ff70 : 0x200000, 0.9), false);
      const duct = B(g, 0.35, 2.6 - H, 0.35, -W / 4, H + (2.6 - H) / 2, 0, mat('#b8b8b0', 0.4, 0.6));
      duct.castShadow = false;
      break;
    }
    case 'cooler':
      B(g, W, 0.8, D, 0, 0.42, 0, mat('#f0eee8', 0.4));
      for (let y = 0.5; y < 0.75; y += 0.05) B(g, W - 0.08, 0.015, 0.01, 0, y, D / 2 + 0.005, mat('#8a8a8a', 0.5), false);
      B(g, 0.1, 0.04, 0.01, 0, 0.25, D / 2 + 0.005, glow(0x40c0ff, 0.9), false);
      for (const dx of [-W / 3, W / 3]) C(g, 0.03, 0.03, 0.04, dx, 0.02, D / 3, black, 8);
      {
        const hose = C(g, 0.06, 0.06, 1.6, 0, 1.6, -D / 2 + 0.08, mat('#c8c8c0', 0.5, 0.4), 10);
        hose.castShadow = false;
      }
      break;
    case 'climate':
      B(g, W, 1.8, D, 0, 0.9, 0, mat('#e8ece8', 0.4, 0.3));
      B(g, W - 0.12, 0.5, 0.01, 0, 1.4, D / 2 + 0.005, mat('#2a2e34', 0.3), false);
      B(g, W - 0.2, 0.22, 0.01, 0, 1.45, D / 2 + 0.01, glow(0x40c0ff, 0.8), false);
      for (let y = 0.2; y < 1.0; y += 0.06) B(g, W - 0.1, 0.02, 0.01, 0, y, D / 2 + 0.005, mat('#a8acb0', 0.5), false);
      break;
    case 'control':
      B(g, W, 0.5, D, 0, y0, -D / 2 + 0.04, mat('#d8dcd8', 0.4, 0.3));
      for (let i = 0; i < 5; i++) B(g, 0.04, 0.08, 0.02, -W / 2 + 0.08 + i * 0.12, y0 + 0.08, 0.005, mat(i % 2 ? '#2a2a2e' : '#c81010', 0.5), false);
      B(g, W - 0.08, 0.1, 0.01, 0, y0 - 0.12, 0.003, glow(0x40ff70, 0.8), false);
      C(g, 0.02, 0.02, 0.8, W / 2 - 0.05, y0 + 0.65, -D / 2 + 0.04, black, 6, false);
      break;
    case 'sensor':
      B(g, W, 0.24, D, 0, y0, -D / 2 + 0.03, mat('#f0eee8', 0.4));
      B(g, W - 0.06, 0.12, 0.01, 0, y0 + 0.03, 0.005, glow(0x40ffc0, 1.1), false);
      break;
    case 'cctv': {
      B(g, 0.06, 0.06, 0.16, 0, y0, -D / 2 + 0.08, mat('#e8e8e4', 0.4));
      const cam = B(g, 0.12, 0.1, 0.24, 0, y0 - 0.05, 0.05, mat('#e8e8e4', 0.4));
      cam.rotation.x = 0.35;
      const lens = C(g, 0.03, 0.03, 0.02, 0, y0 - 0.1, 0.17, black, 10, false);
      lens.rotation.x = Math.PI / 2 + 0.35;
      B(g, 0.015, 0.015, 0.01, 0.04, y0 - 0.02, 0.17, glow(0xff2020, 1.5), false);
      break;
    }
    case 'monitors':
      B(g, W, 0.05, D, 0, 0.75, 0, mat('#2a2a2e', 0.5));
      for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) B(g, 0.05, 0.75, D - 0.05, dx, 0.375, 0, mat('#2a2a2e', 0.5));
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 ? 0.27 : -0.27) * (W / 1.2);
        const y = i < 2 ? 1.05 : 1.37;
        B(g, 0.5, 0.3, 0.04, x, y, -D / 2 + 0.06, black, false);
        B(g, 0.46, 0.26, 0.01, x, y, -D / 2 + 0.085, mat('#101820', 0.2, 0, { emissive: on ? [0x3a6a5a, 0x4a5a7a, 0x5a6a4a, 0x3a5a7a][i] : 0x050505, emissiveIntensity: 0.9 }), false);
      }
      B(g, 0.4, 0.02, 0.14, 0, 0.785, 0.05, dark, false);
      break;
    case 'alarm':
      B(g, W * 1.4, 0.26, D, 0, y0, -D / 2 + 0.03, mat('#f0eee8', 0.4));
      B(g, 0.2, 0.08, 0.01, 0, y0 + 0.05, 0.004, glow(0x40c0ff, 0.8), false);
      for (let i = 0; i < 6; i++) B(g, 0.035, 0.035, 0.01, -0.05 + (i % 3) * 0.05, y0 - 0.05 - Math.floor(i / 3) * 0.05, 0.004, mat('#2a2a2e', 0.5), false);
      B(g, 0.03, 0.03, 0.01, 0.12, y0 + 0.08, 0.004, glow(0xff2020, 1.2), false);
      break;
    case 'safe':
      B(g, W, 0.75, D, 0, 0.38, 0, mat('#3a3e44', 0.35, 0.7));
      B(g, W - 0.08, 0.67, 0.01, 0, 0.38, D / 2 + 0.005, mat('#2e3238', 0.35, 0.7), false);
      {
        const dial = C(g, 0.07, 0.07, 0.03, 0.05, 0.45, D / 2 + 0.02, mat('#c8c8c8', 0.2, 0.9), 20, false);
        dial.rotation.x = Math.PI / 2;
      }
      B(g, 0.03, 0.15, 0.03, 0.18, 0.38, D / 2 + 0.02, mat('#c8c8c8', 0.2, 0.9), false);
      break;
    default:
      B(g, W, 1, D, 0, def.mount === 'wall' ? y0 : 0.5, 0, steel);
  }
  if (faulty) {
    // Hazard tag and tape.
    B(g, Math.min(W, 0.5), 0.06, 0.01, 0, def.mount === 'wall' ? y0 - 0.2 : 0.6, (def.mount === 'wall' ? 0.02 : D / 2 + 0.03), mat('#e8c020', 0.6, 0, { emissive: 0x7a5a00, emissiveIntensity: 0.4 }), false);
  }
  return g;
}

/** Whatever a catalogue id is: furniture, a vehicle or basement equipment. */
export function buildAnyModel(id: string, colour?: string, state?: string): THREE.Group {
  if (FURNITURE[id]) return buildFurnitureModel(id, colour);
  if (EQUIPMENT[id]) return buildEquipmentModel(id, state);
  return buildVehicleModel(id, colour);
}
