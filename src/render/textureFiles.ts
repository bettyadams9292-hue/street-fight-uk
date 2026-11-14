/**
 * Texture files (public/textures/, made by tools/textures/gen_textures.py): colour maps, normal
 * maps, atlases and particle sprites that replace the canvas textures drawn in code.
 *
 * They load once at boot (loadTextureFiles, awaited with the model sets in main.ts) and are then
 * handed out synchronously, so the old canvas functions can ask "is the file here?" and fall back
 * to drawing the canvas exactly as before when it isn't (no file, no network, or tests in Node).
 *
 * Colour maps come back as CanvasTextures (painted from the file into a canvas, in the caller's
 * colours where the old function took colours), so everything that treats them as canvas textures
 * (LevelView.flattenTextures, `userData.text`) keeps working. Each carries the name of its normal
 * map in `userData.normal`; attachNormals() puts the normal maps on the materials afterwards.
 */
import * as THREE from 'three';

const BASE = '/textures/';

/** Every file the game reads (colour maps; those in WITH_NORMAL also have a `_n` normal map). */
export const TEXTURE_NAMES = [
  'street/brick', 'street/paving', 'street/road', 'street/markings', 'street/concrete', 'street/plaster', 'street/corrugated',
  'street/tiles', 'street/shutter', 'street/wood_floor', 'street/sign_board', 'street/windows', 'street/graffiti', 'street/posters',
  'furniture/wood_light', 'furniture/wood_dark', 'furniture/weave', 'furniture/brushed_metal',
  'character/brow', 'character/lash',
  'character/fabric_fleece', 'character/fabric_knit', 'character/fabric_nylon', 'character/fabric_denim', 'character/fabric_leather', 'character/fabric_cotton', 'character/fabric_canvas',
  'home/f_oak', 'home/f_walnut', 'home/f_grey_carpet', 'home/f_cream_carpet', 'home/f_plum_carpet', 'home/f_red_carpet', 'home/f_check_tiles', 'home/f_stone_tiles', 'home/f_slate_tiles',
  'home/w_magnolia', 'home/w_white', 'home/w_sage', 'home/w_navy', 'home/w_charcoal', 'home/w_blush', 'home/w_slate_blue', 'home/w_stone', 'home/w_stripes', 'home/w_brick', 'home/w_panelling', 'home/w_tiles',
  'fx/particles', 'fx/rain',
] as const;
export type TextureName = (typeof TEXTURE_NAMES)[number];

/** Effects have no normal map. */
export const hasNormal = (name: string): boolean => !name.startsWith('fx/');

/** Cells of the window atlas (4 × 2, each 128 × 256), in order. */
export const WINDOW_CELLS = ['unlit', 'unlit_blinds', 'lit_warm', 'lit_warm2_curtains', 'lit_cool', 'lit_cream_blinds', 'lit_amber_curtains', 'lit_tv'] as const;
export type WindowCell = (typeof WINDOW_CELLS)[number];
/** Cells of the particle atlas (4 × 2, each 128 px), in order. */
export const FX_CELLS = ['hit', 'heavy', 'block', 'glint', 'danger', 'dot', 'smoke', 'drop'] as const;

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

/** Load every texture file once. Never rejects: a file that fails keeps its canvas version. */
export function loadTextureFiles(): Promise<void> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve();
  loading ??= Promise.all(
    TEXTURE_NAMES.flatMap((n) => [n, ...(hasNormal(n) ? [`${n}_n`] : [])]).map(async (n) => {
      const img = await loadImage(`${BASE}${n}.webp`);
      if (img) images.set(n, img);
      else console.info(`[textures] ${n} not loaded: using the canvas version`);
    }),
  ).then(() => undefined);
  return loading;
}

/** The loaded image, or null (not loaded, or not in a browser). */
export function textureImage(name: string): HTMLImageElement | null {
  return images.get(name) ?? null;
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  return g ? [c, g] : null;
}

/** A canvas holding the file's pixels (shared; never draw on it). */
const plain = new Map<string, HTMLCanvasElement>();
function plainCanvas(name: string): HTMLCanvasElement | null {
  const hit = plain.get(name);
  if (hit) return hit;
  const img = textureImage(name);
  const cg = img && canvasOf(img.naturalWidth, img.naturalHeight);
  if (!img || !cg) return null;
  cg[1].drawImage(img, 0, 0);
  plain.set(name, cg[0]);
  return cg[0];
}

/**
 * A two-tone file painted in two colours: red is light and shade (204 = 1.0), green mixes from
 * the first colour to the second (grout, line, rust). Cached per colour pair.
 */
const toned = new Map<string, HTMLCanvasElement>();
export function toneCanvas(name: string, c1: string, c2: string | undefined): HTMLCanvasElement | null {
  const key = `${name}|${c1}|${c2 ?? ''}`;
  const hit = toned.get(key);
  if (hit) return hit;
  const src = plainCanvas(name);
  const cg = src && canvasOf(src.width, src.height);
  if (!src || !cg) return null;
  const [c, g] = cg;
  // Canvas colours are sRGB: mix in sRGB, as the old canvases did (any CSS colour works).
  const A = cssRgb(g, c1);
  const B = cssRgb(g, c2 ?? c1);
  const data = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, src.width, src.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const shade = d[i] / 204;
    const m = d[i + 1] / 255;
    d[i] = Math.min(255, (A[0] + (B[0] - A[0]) * m) * shade * 255);
    d[i + 1] = Math.min(255, (A[1] + (B[1] - A[1]) * m) * shade * 255);
    d[i + 2] = Math.min(255, (A[2] + (B[2] - A[2]) * m) * shade * 255);
    d[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  toned.set(key, c);
  return c;
}

/** A CSS colour as sRGB 0..1, read back through the canvas. */
function cssRgb(g: CanvasRenderingContext2D, css: string): [number, number, number] {
  g.clearRect(0, 0, 1, 1);
  g.fillStyle = '#000';
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

/** One Source per file canvas, so every texture cut from it shares one upload to the GPU. */
const sources = new Map<HTMLCanvasElement, THREE.Source>();

function wrap(c: HTMLCanvasElement, name: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  let src = sources.get(c);
  if (!src) sources.set(c, (src = t.source));
  else t.source = src;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.userData.normal = name;
  t.userData.file = name;
  return t;
}

/** A colour map straight from its file, or null. */
export function fileTexture(name: TextureName, repeatX = 1, repeatY = 1): THREE.CanvasTexture | null {
  const c = plainCanvas(name);
  return c ? wrap(c, name, repeatX, repeatY) : null;
}

/** A two-tone file in the caller's colours, or null. */
export function toneTexture(name: TextureName, c1: string, c2: string | undefined, repeatX = 1, repeatY = 1): THREE.CanvasTexture | null {
  const c = toneCanvas(name, c1, c2);
  return c ? wrap(c, name, repeatX, repeatY) : null;
}

/** A canvas with one rectangle of an atlas file drawn into it (sx, sy, sw, sh in file pixels), or null. */
export function atlasCanvas(name: TextureName, sx: number, sy: number, sw: number, sh: number, w = sw, h = sh): HTMLCanvasElement | null {
  const img = textureImage(name);
  const cg = img && canvasOf(w, h);
  if (!img || !cg) return null;
  cg[1].drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return cg[0];
}

/** The window atlas cell for a kind, as an image source rectangle (128 × 256 each). */
export function windowCell(kind: WindowCell): [number, number, number, number] {
  const i = WINDOW_CELLS.indexOf(kind);
  return [(i % 4) * 128, Math.floor(i / 4) * 256, 128, 256];
}

const normals = new Map<string, THREE.Texture>();
/** The shared normal map for a file (linear colour space), or null. */
export function normalTexture(name: string): THREE.Texture | null {
  const hit = normals.get(name);
  if (hit) return hit;
  const img = textureImage(`${name}_n`);
  if (!img) return null;
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  t.userData.shared = true;
  normals.set(name, t);
  return t;
}

/** A canvas of flat normals (pointing straight out), to draw atlas normals into. */
export function flatNormalCanvas(w: number, h: number): HTMLCanvasElement | null {
  const cg = canvasOf(w, h);
  if (!cg) return null;
  cg[1].fillStyle = 'rgb(128,128,255)';
  cg[1].fillRect(0, 0, w, h);
  return cg[0];
}

/**
 * A normal map for `map` (same repeat, offset and wrapping), sharing the file's image. A map cut
 * from an atlas says which part in `userData.normalCrop` ([u, v, width, height] in UV); a map
 * composed from atlas pieces brings its own normals in `userData.normalImage`.
 */
export function normalFor(map: THREE.Texture): THREE.Texture | null {
  const own = map.userData.normalImage as HTMLCanvasElement | undefined;
  if (own) {
    const t = new THREE.CanvasTexture(own);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = map.wrapS;
    t.wrapT = map.wrapT;
    t.repeat.copy(map.repeat);
    t.offset.copy(map.offset);
    return t;
  }
  const name = map.userData.normal as string | undefined;
  const base = name ? normalTexture(name) : null;
  if (!base) return null;
  const t = base.clone();
  const crop = map.userData.normalCrop as [number, number, number, number] | undefined;
  if (crop) {
    t.offset.set(crop[0], crop[1]);
    t.repeat.set(crop[2], crop[3]);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.userData = { shared: false };
    t.needsUpdate = true;
    return t;
  }
  t.repeat.copy(map.repeat);
  t.offset.copy(map.offset);
  t.rotation = map.rotation;
  t.center.copy(map.center);
  t.wrapS = map.wrapS;
  t.wrapT = map.wrapT;
  t.userData = { shared: false };
  t.needsUpdate = true;
  return t;
}

/** How strong the file normal maps read (they're painted subtle already). */
export const NORMAL_SCALE = 0.7;

/** Give a material the normal map that goes with its colour map (once). */
export function attachNormal(m: THREE.Material): void {
  const sm = m as THREE.MeshStandardMaterial;
  if (!sm.isMeshStandardMaterial || sm.normalMap) return;
  const src = sm.map ?? sm.emissiveMap;
  if (!src?.userData.normal && !src?.userData.normalImage) return;
  const n = normalFor(src);
  if (!n) return;
  sm.normalMap = n;
  sm.normalScale.set(NORMAL_SCALE, NORMAL_SCALE);
  sm.needsUpdate = true;
}

/** Put the normal maps on every material under root whose colour map came from a file. */
export function attachNormals(root: THREE.Object3D): void {
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) attachNormal(m);
  });
}

/** Metres covered by one repeat of each home finish file. */
const FINISH_TILE: Record<string, number> = {
  f_oak: 1, f_walnut: 1, f_grey_carpet: 1, f_cream_carpet: 1, f_plum_carpet: 1, f_red_carpet: 1,
  f_check_tiles: 1.2, f_stone_tiles: 1.2, f_slate_tiles: 1.2,
  w_magnolia: 2, w_white: 2, w_sage: 2, w_navy: 2, w_charcoal: 2, w_blush: 2, w_slate_blue: 2, w_stone: 2,
  w_stripes: 0.5, w_brick: 1, w_panelling: 1, w_tiles: 0.6,
};
const FINISH_ROUGH: Record<string, number> = {
  f_oak: 0.5, f_walnut: 0.45, f_check_tiles: 0.3, f_stone_tiles: 0.55, f_slate_tiles: 0.5, w_tiles: 0.25, w_brick: 0.95, w_panelling: 0.5, w_stripes: 0.85,
};

/**
 * A home finish (floor or wall) from its file: w × h metres of surface, colour and normal maps,
 * repeated at the finish's real size. Null when the file isn't loaded (use the old look).
 */
export function finishMaterial(id: string, w: number, h: number): THREE.MeshStandardMaterial | null {
  const tile = FINISH_TILE[id];
  if (!tile) return null;
  const map = fileTexture(`home/${id}` as TextureName, w / tile, h / tile);
  if (!map) return null;
  const rough = FINISH_ROUGH[id] ?? (id.startsWith('f_') ? 0.95 : 0.9);
  const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0 });
  // Rooms in the low-poly look are drawn flat (LevelView.flattenTextures): a finish the player chose keeps its texture.
  m.userData.keepMap = true;
  m.userData.finishFile = id;
  attachNormal(m);
  return m;
}
