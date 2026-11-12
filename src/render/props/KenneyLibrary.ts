/**
 * Kenney's furniture and food kits (CC0, public/models/kenney): furniture for
 * the flat, produce for the market stalls.
 *
 * The furniture comes with flat colours; here every material gets a surface:
 * wood gets grain, upholstery a weave, metal a brush, so no piece is one plain
 * colour. Models are fitted to the space the level gives them.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BASE = '/models/kenney/';

export const FURNITURE = [
  'bedDouble', 'bedSingle', 'bookcaseClosedDoors', 'desk', 'chairDesk', 'loungeSofa', 'loungeSofaCorner', 'loungeChair',
  'cabinetTelevision', 'televisionModern', 'table', 'chair', 'tableCoffee', 'kitchenFridgeLarge', 'kitchenStove',
  'kitchenCabinet', 'kitchenSink', 'kitchenCabinetUpper', 'kitchenMicrowave', 'bathtub', 'toilet', 'bathroomSink',
  'lampRoundTable', 'lampSquareFloor', 'rugRectangle', 'pottedPlant', 'plantSmall1', 'books', 'laptop', 'sideTable',
  'washer', 'trashcan', 'radio', 'speaker',
] as const;
export type FurnitureId = (typeof FURNITURE)[number];

export const PRODUCE = [
  'apple', 'orange', 'banana', 'pear', 'lemon', 'tomato', 'carrot', 'cabbage', 'broccoli', 'onion', 'paprika',
  'cauliflower', 'eggplant', 'leek', 'corn', 'grapes', 'pineapple', 'watermelon', 'mushroom', 'strawberry',
  'bread', 'loaf', 'loaf-round', 'croissant', 'fish', 'meat-raw', 'cheese', 'can', 'soda-can', 'carton', 'bottle-oil',
] as const;
export type ProduceId = (typeof PRODUCE)[number];

const models = new Map<string, THREE.Object3D>();
let loading: Promise<void> | null = null;

// ---- surfaces ----

function canvasTex(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void, repeat: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;
  paint(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let seed = 77;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const woodTex = (light: boolean) =>
  canvasTex(
    256,
    (g, s) => {
      g.fillStyle = light ? '#b08458' : '#5a3a22';
      g.fillRect(0, 0, s, s);
      // Grain: long wavy lines with knots now and then.
      for (let i = 0; i < 70; i++) {
        const y0 = rnd() * s;
        g.strokeStyle = `rgba(${light ? '70,40,15' : '25,12,5'},${0.2 + rnd() * 0.35})`;
        g.lineWidth = 0.8 + rnd() * 2.4;
        g.beginPath();
        for (let x = 0; x <= s; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 3 + Math.sin(x * 0.11) * 0.8);
        g.stroke();
      }
      for (let k = 0; k < 2; k++) {
        g.fillStyle = `rgba(40,20,8,0.35)`;
        g.beginPath();
        g.ellipse(rnd() * s, rnd() * s, 6, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    },
    3,
  );

const weaveTex = () =>
  canvasTex(
    64,
    (g, s) => {
      const img = g.createImageData(s, s);
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const v = 200 + ((x + y) % 4 < 2 ? 30 : 0) + rnd() * 25 - ((x % 8 === 0 || y % 8 === 0) ? 20 : 0);
          const k = (y * s + x) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.min(255, v);
          img.data[k + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    6,
  );

const brushTex = () =>
  canvasTex(
    128,
    (g, s) => {
      g.fillStyle = '#c8c8c8';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 300; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '60,60,60'},${rnd() * 0.15})`;
        g.fillRect(0, rnd() * s, s, 1);
      }
    },
    2,
  );

let surfaces: Record<string, THREE.MeshStandardMaterial> | null = null;
function surfacesFor(): Record<string, THREE.MeshStandardMaterial> {
  if (surfaces) return surfaces;
  const wood = woodTex(true);
  const dark = woodTex(false);
  const weave = weaveTex();
  const brush = brushTex();
  const m = (o: THREE.MeshStandardMaterialParameters) => {
    const x = new THREE.MeshStandardMaterial(o);
    x.userData.shared = true;
    return x;
  };
  const named = (all: Record<string, THREE.MeshStandardMaterial>) => {
    for (const [k, v] of Object.entries(all)) v.name = k;
    return all;
  };
  surfaces = named({
    wood: m({ map: wood, color: '#ffffff', roughness: 0.62 }),
    woodDark: m({ map: dark, color: '#ffffff', roughness: 0.55 }),
    carpet: m({ map: weave, color: '#5a6a4a', roughness: 0.95 }),
    carpetWhite: m({ map: weave, color: '#e6e0d4', roughness: 0.95 }),
    carpetBlue: m({ map: weave, color: '#2a4470', roughness: 0.95 }),
    carpetDarker: m({ map: weave, color: '#3a3a3e', roughness: 0.95 }),
    metal: m({ map: brush, color: '#9a9ea4', roughness: 0.35, metalness: 0.8 }),
    metalDark: m({ map: brush, color: '#3a3c40', roughness: 0.4, metalness: 0.7 }),
    metalMedium: m({ map: brush, color: '#6a6e74', roughness: 0.38, metalness: 0.75 }),
    metalLight: m({ map: brush, color: '#d8dadc', roughness: 0.3, metalness: 0.6 }),
    glass: m({ color: '#a8c4d0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 }),
    lamp: m({ color: '#fff0c8', emissive: '#ffd890', emissiveIntensity: 1.2, roughness: 0.6 }),
    plant: m({ color: '#3a6a2a', roughness: 0.8 }),
    fur: m({ map: weave, color: '#8a6a4a', roughness: 1 }),
    _defaultMat: m({ color: '#f2f0ea', roughness: 0.3 }),
  });
  return surfaces;
}

/** The furniture has no texture coordinates: project them from the sides of a box, so grain and weave show. */
function boxUV(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  if (!pos || !nrm) return;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Grain runs front to back on tops, up and down on the sides and doors.
    if (ay >= ax && ay >= az) [uv[i * 2], uv[i * 2 + 1]] = [x, z];
    else if (ax >= az) [uv[i * 2], uv[i * 2 + 1]] = [y, z];
    else [uv[i * 2], uv[i * 2 + 1]] = [y, x];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Load both kits once. Never rejects. */
export function loadKenney(): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    const one = async (dir: string, id: string) => {
      try {
        const g = await loader.loadAsync(`${BASE}${dir}/${id}.glb`);
        const root = g.scene;
        root.traverse((o: THREE.Object3D) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.geometry.userData.shared = true;
          // disposeGroup skips meshes marked shared: these geometries and materials outlive any level.
          mesh.userData.shared = true;
          if (dir === 'furniture') {
            boxUV(mesh.geometry);
            const name = (mesh.material as THREE.Material).name;
            mesh.material = surfacesFor()[name] ?? surfacesFor()._defaultMat;
          } else (mesh.material as THREE.Material).userData.shared = true;
        });
        models.set(`${dir}/${id}`, root);
      } catch (e) {
        console.warn(`[kenney] ${dir}/${id} failed`, e);
      }
    };
    await Promise.all([...FURNITURE.map((id) => one('furniture', id)), ...PRODUCE.map((id) => one('food', id))]);
  })();
  return loading;
}

export function kenneyReady(): boolean {
  return models.size > 0;
}

/**
 * A piece of furniture fitted into a box w × h × d (metres), standing on y = 0, centred on x and z,
 * front facing +z. `upholstery` recolours the fabric. Returns null until the kit has loaded.
 */
export function furniture(id: FurnitureId, w: number, h: number, d: number, opts: { upholstery?: string; turn?: number; keepAspect?: boolean } = {}): THREE.Group | null {
  const src = models.get(`furniture/${id}`);
  if (!src) return null;
  const inner = src.clone(true);
  if (opts.upholstery) {
    const up = surfacesFor().carpet.clone();
    up.color.set(opts.upholstery);
    inner.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      const name = mesh.isMesh ? (mesh.material as THREE.Material).name : '';
      if (name.startsWith('carpet') && name !== 'carpetWhite') mesh.material = up;
    });
  }
  inner.rotation.y = opts.turn ?? 0;
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  let sx = w / Math.max(1e-3, size.x);
  let sy = h / Math.max(1e-3, size.y);
  let sz = d / Math.max(1e-3, size.z);
  if (opts.keepAspect) sx = sy = sz = Math.min(sx, sy, sz);
  const out = new THREE.Group();
  const holder = new THREE.Group();
  holder.add(inner);
  holder.scale.set(sx, sy, sz);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  out.add(holder);
  return out;
}

/**
 * A heaped display of produce filling a crate-top w × d: each item rotated and nudged at random,
 * so the display reads as loose fruit, not a coloured block.
 */
export function produceHeap(id: ProduceId, w: number, d: number, rand: () => number, item = 0.09): THREE.Group | null {
  const src = models.get(`food/${id}`);
  if (!src) return null;
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3());
  const k = item / Math.max(size.x, size.z, 1e-3);
  const g = new THREE.Group();
  const step = item * 0.95;
  for (let layer = 0; layer < 2; layer++)
    for (let x = -w / 2 + step / 2; x <= w / 2 - step / 2; x += step)
      for (let z = -d / 2 + step / 2; z <= d / 2 - step / 2; z += step) {
        if (layer === 1 && rand() < 0.45) continue;
        const o = src.clone(true);
        o.scale.setScalar(k * (0.9 + rand() * 0.2));
        o.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
        o.position.set(x + (rand() - 0.5) * step * 0.3 + layer * step * 0.5, layer * size.y * k * 0.7, z + (rand() - 0.5) * step * 0.3);
        g.add(o);
      }
  return g;
}
