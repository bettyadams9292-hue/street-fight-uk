/**
 * Kenney's furniture and food kits (CC0, public/models/kenney): furniture for
 * the flat, produce for the market stalls.
 *
 * The furniture comes with flat colours; here every material gets a surface:
 * wood gets grain, upholstery a weave, metal a brush, so no piece is one plain
 * colour. Models are fitted to the space the level gives them.
 */
import { loadGlb } from '../../performance/assetFetch';
import * as THREE from 'three';
import { attachNormal, fileTexture, loadTextureFiles, type TextureName } from '../textureFiles';
import { CLOTHS, WOODS } from '../materials/assign';
import { dress, nearest, type LibraryName } from '../materials/library';

const BASE = '/models/kenney/';

export const FURNITURE = [
  'bedDouble', 'bedSingle', 'bookcaseClosedDoors', 'desk', 'chairDesk', 'loungeSofa', 'loungeSofaCorner', 'loungeChair',
  'cabinetTelevision', 'televisionModern', 'table', 'chair', 'tableCoffee', 'kitchenFridgeLarge', 'kitchenStove',
  'kitchenCabinet', 'kitchenSink', 'kitchenCabinetUpper', 'kitchenMicrowave', 'bathtub', 'toilet', 'bathroomSink',
  'lampRoundTable', 'lampSquareFloor', 'rugRectangle', 'pottedPlant', 'plantSmall1', 'books', 'laptop', 'sideTable',
  'washer', 'trashcan', 'radio', 'speaker',
  // For the furniture you buy for your place (homeFurniture.ts).
  'loungeDesignSofa', 'cabinetTelevisionDoors', 'bookcaseClosedWide', 'bookcaseOpenLow', 'rugRound', 'cabinetBedDrawerTable', 'cabinetBedDrawer', 'chairCushion', 'kitchenCabinetDrawer', 'kitchenBar', 'kitchenCabinetUpperDouble', 'bathroomMirror', 'rugDoormat', 'plantSmall2', 'lampRoundFloor', 'lampWall',
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

function canvasTex(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void, repeat: number, file?: TextureName, fileRepeat = repeat): THREE.Texture | null {
  // The texture file (public/textures/furniture), with its normal map; the canvas below without it.
  const fromFile = file ? fileTexture(file, fileRepeat, fileRepeat) : null;
  if (fromFile) return fromFile;
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
    light ? 'furniture/wood_light' : 'furniture/wood_dark',
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
    'furniture/weave',
    3,
  );

const brushTex = () =>
  canvasTex(
    128,
    (g, s) => {
      g.fillStyle = '#c8c8c8';
      g.fillRect(0, 0, s, s);
      // Vertical in the texture, so with boxUV the brushing runs across fronts and sides, not up them.
      for (let i = 0; i < 300; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '60,60,60'},${rnd() * 0.1})`;
        g.fillRect(rnd() * s, 0, 1, s);
      }
    },
    2,
    'furniture/brushed_metal',
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
    // Not in the kit's names: what some of its parts really are (see PART_SURFACE).
    ceramic: m({ color: '#f4f2ee', roughness: 0.18 }),
    enamel: m({ color: '#e2e2e0', roughness: 0.3, metalness: 0.05 }),
    enamelGrey: m({ color: '#b8bcc0', roughness: 0.32, metalness: 0.1 }),
    screen: m({ color: '#0c0d10', roughness: 0.12, metalness: 0.2 }),
    plastic: m({ color: '#1c1d20', roughness: 0.45 }),
  });
  for (const v of Object.values(surfaces)) attachNormal(v);
  // Real surfaces from the texture library, each kept in the colour above (materials/library.ts).
  // boxUV lays the texture coordinates out in metres, so a set repeats at its own real size.
  const LIB: Record<string, LibraryName> = {
    wood: 'Wood082B', woodDark: 'Wood066', carpet: 'Fabric028', carpetWhite: 'Fabric001', carpetBlue: 'Fabric081A', carpetDarker: 'Fabric082A', fur: 'Fabric029',
    metal: 'Metal052A', metalDark: 'Metal038', metalMedium: 'Metal061A', metalLight: 'Metal041A', ceramic: 'Porcelain001', enamel: 'Metal050C', enamelGrey: 'Metal050C',
  };
  const own: Record<string, string> = { wood: '#b08458', woodDark: '#5a3a22' };
  for (const [k, set] of Object.entries(LIB)) {
    const v = surfaces[k];
    for (const key of ['map', 'normalMap'] as const) v[key] = null;
    dress(v, set, { tint: own[k] ?? `#${v.color.getHexString()}`, w: 1, h: 1, rough: k.startsWith('metal') ? 0.9 : 1 });
  }
  return surfaces;
}

/**
 * Kenney names its materials after its own palette, not what they are: the bath's enamel is
 * "carpetWhite", a TV screen is "metalDark". Per model, the surface each part really gets.
 */
const PART_SURFACE: Record<string, Record<string, string>> = {
  bathtub: { carpetWhite: 'ceramic', metalLight: 'ceramic' },
  toilet: { carpetWhite: 'ceramic', metalLight: 'ceramic' },
  bathroomSink: { carpetWhite: 'ceramic', metalLight: 'ceramic' },
  kitchenStove: { carpetWhite: 'ceramic' },
  kitchenMicrowave: { carpetWhite: 'ceramic', metalMedium: 'enamelGrey' },
  kitchenFridgeLarge: { metalLight: 'enamel', metalMedium: 'enamelGrey' },
  washer: { metalLight: 'enamel', metalMedium: 'enamelGrey' },
  televisionModern: { metalDark: 'screen', metal: 'plastic' },
};

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
    // The surfaces use the texture files when they're in (never rejects; canvases without them).
    await loadTextureFiles();
    const one = async (dir: string, id: string) => {
      try {
        const g = await loadGlb(`${BASE}${dir}/${id}.glb`);
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
            const real = PART_SURFACE[id]?.[name] ?? name;
            mesh.material = surfacesFor()[real] ?? surfacesFor()._defaultMat;
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
/**
 * A wood finish: wood tones keep the grain and shift its colour (the grain texture is about #8a5a32);
 * painted colours (whites, greys, near-black) lose the grain and become plain satin paint.
 */
/** Wood and cloth variants, so two tables or two sofas aren't cut from the same plank or bolt. */
const variants = new Map<string, THREE.MeshStandardMaterial>();
function variant(base: 'wood' | 'woodDark' | 'carpet', set: LibraryName, colour: string): THREE.MeshStandardMaterial {
  const key = `${base}|${set}|${colour}`;
  let m = variants.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    m.name = base;
    dress(m, set, { tint: colour, w: 1, h: 1 });
    m.userData.shared = true;
    variants.set(key, m);
  }
  return m;
}
const LIGHT_WOODS: LibraryName[] = ['Wood082B', 'Wood052', 'Wood096', 'Wood049'];
const DARK_WOODS: LibraryName[] = ['Wood066', 'Wood026', 'Wood051', 'Wood084A', 'Wood067'];
const idHash = (s: string): number => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

const finishes = new Map<string, THREE.MeshStandardMaterial>();
function finish(colour: string): THREE.MeshStandardMaterial {
  let m = finishes.get(colour);
  if (m) return m;
  const c = new THREE.Color(colour);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const painted = hsl.s < 0.18 || hsl.l > 0.82;
  m = surfacesFor().wood.clone();
  m.name = 'wood';
  if (painted) {
    m.map = m.normalMap = m.roughnessMap = m.aoMap = null;
    delete m.userData.lib;
    m.color.copy(c);
    m.roughness = 0.45;
  } else {
    // The library wood nearest this tone, shifted the rest of the way to it.
    m = variant('wood', nearest(WOODS, colour, idHash(colour), 2), colour);
  }
  m.userData.shared = true;
  finishes.set(colour, m);
  return m;
}

export function furniture(id: FurnitureId, w: number, h: number, d: number, opts: { upholstery?: string; turn?: number; keepAspect?: boolean; wood?: string } = {}): THREE.Group | null {
  const src = models.get(`furniture/${id}`);
  if (!src) return null;
  const inner = src.clone(true);
  if (!opts.wood) {
    // Each kind of piece has its own wood: the kit's two wood tones, in one of several real woods.
    const h = idHash(id);
    const light = variant('wood', LIGHT_WOODS[h % LIGHT_WOODS.length], '#b08458');
    const dark = variant('woodDark', DARK_WOODS[h % DARK_WOODS.length], '#5a3a22');
    inner.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name;
      if (name === 'wood') mesh.material = light;
      else if (name === 'woodDark') mesh.material = dark;
    });
  }
  if (opts.wood) {
    const m = finish(opts.wood);
    inner.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name;
      if (name === 'wood' || name === 'woodDark') mesh.material = m;
    });
  }
  if (opts.upholstery) {
    // Upholstery in the colour asked for, in one of several cloths.
    const up = variant('carpet', nearest(CLOTHS, opts.upholstery, idHash(id + opts.upholstery), 3), opts.upholstery);
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
