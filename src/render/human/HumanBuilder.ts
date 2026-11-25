/**
 * Builds a rendered character from the MakeHuman packs: a morphed, skinned
 * body on the 67-bone game rig, with eyes, clothes, hair and accessories fitted
 * to it and sharing its skeleton.
 *
 * Packs load once (loadHumanAssets); textures load on first use and are shared.
 * Origin at the feet, facing +z, in the rest pose (arms in an A).
 */
import { PRIORITY } from '../../performance/requests';
import { fetchBytes, fetchJson } from '../../performance/assetFetch';
import { loadTextureFile } from '../../performance/assetFetch';
import { fetchBinary } from '../../core/fetchBinary';
import { detail, type LibraryName } from '../materials/library';
import * as THREE from 'three';
import { inkedSkin, type InkSpot } from './tattooSkin';
import { BodyData, type placeBones, type BodyMeta } from '../../characters/human/body';
import { ProxyData, type ProxyMeta } from '../../characters/human/proxy';
import type { Fabric } from '../../characters/human/garments';
import { computeHuman, type ComputeDeps, type HumanData, type HumanSpec, type PartData } from '../../characters/human/compute';

/**
 * Skinned meshes can't use their geometry's bounds (the bones move the vertices), so they used to have culling
 * switched off, and every person in a level was drawn in both passes even when off screen. Instead each part
 * gets one fixed sphere round the whole person: centred at the hips, 1.9 m across each way, which covers
 * standing, reaching, kicking and lying flat (mesh space is metres with the feet at the origin).
 */
const CHARACTER_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.9);
function cullAsCharacter(mesh: THREE.SkinnedMesh): void {
  mesh.frustumCulled = true;
  mesh.boundingSphere = CHARACTER_SPHERE.clone();
}
import { attachNormal, fileTexture } from '../textureFiles';

export interface SkinInfo {
  id: string;
  gender: string;
  tone: number;
  age: string;
  tags: string[];
  diffuse: string;
  normal: string | null;
}

export type { HumanItem, HumanGarment, HumanSpec } from '../../characters/human/compute';

const BASE = '/models/human/';


interface Assets {
  body: BodyData;
  /**
   * The same body with about a sixth of its triangles (tools/human/lod.mjs, `body_lod.bin`): for people in the
   * background (passers-by, the crowd, shopkeepers). Same vertices, so morphs, skin weights and UVs are shared,
   * and clothes cut from it come out lighter too. The full body if the file's missing.
   */
  lite: BodyData;
  catalogue: Record<string, ProxyMeta>;
  skins: SkinInfo[];
}

let assets: Promise<Assets | null> | null = null;
let ready: Assets | null = null;
const proxyCache = new Map<string, Promise<ProxyData | null>>();
const proxyReady = new Map<string, ProxyData>();
const textures = new Map<string, THREE.Texture>();
/** Mean brightness of each colour texture, so a tint can keep the weave and folds without the cloth's own colour. */
const meanLum = new Map<string, number>();
const meanRgb = new Map<string, [number, number, number]>();

/** Load the body pack, item catalogue and skin list (once). Never rejects. */
export function loadHumanAssets(): Promise<Assets | null> {
  assets ??= (async () => {
    try {
      const [meta, bin, catalogue, skins, lod] = await Promise.all([
        fetchJson<BodyMeta>(BASE + 'body.json', PRIORITY.now),
        fetchBinary(BASE + 'body.bin', PRIORITY.now),
        fetchJson<Record<string, ProxyMeta>>(BASE + 'proxies/catalogue.json', PRIORITY.now),
        fetchJson<SkinInfo[]>(BASE + 'skins.json', PRIORITY.now),
        fetchBytes(BASE + 'body_lod.bin', PRIORITY.now).catch(() => null),
      ]);
      const body = new BodyData(meta, bin);
      ready = { body, lite: lod ? body.withIndex(new Uint32Array(new Uint16Array(lod))) : body, catalogue, skins };
      return ready;
    } catch (e) {
      console.warn('[human] assets failed to load', e);
      return null;
    }
  })();
  return assets;
}

export function humanAssets(): Assets | null {
  return ready;
}

/** Load the items a character wears (and its textures) before building it. */
export async function preloadHuman(spec: HumanSpec): Promise<void> {
  const a = await loadHumanAssets();
  if (!a) return;
  const skin = a.skins.find((s) => s.id === spec.skin);
  const tex: string[] = [];
  if (skin) tex.push(skin.diffuse, ...(skin.normal ? [skin.normal] : []));
  const ids = ['eyes', ...spec.items.map((i) => i.id)];
  await Promise.all(ids.map((id) => loadProxy(id)));
  for (const id of ids) {
    const m = a.catalogue[id]?.material;
    if (m?.diffuse) tex.push(m.diffuse);
    if (m?.normal) tex.push(m.normal);
  }
  await Promise.all(tex.map((t) => loadTexture(t, !t.endsWith('_n.webp'))));
}

function loadProxy(id: string): Promise<ProxyData | null> {
  let p = proxyCache.get(id);
  if (!p) {
    p = (async () => {
      const a = await loadHumanAssets();
      const meta = a?.catalogue[id];
      if (!meta) return null;
      try {
        const bin = await fetchBytes(`${BASE}proxies/${id}.bin`, PRIORITY.soon);
        const data = new ProxyData(id, meta, bin);
        proxyReady.set(id, data);
        return data;
      } catch (e) {
        console.warn(`[human] item ${id} failed to load`, e);
        return null;
      }
    })();
    proxyCache.set(id, p);
  }
  return p;
}

async function loadTexture(file: string, srgb: boolean): Promise<THREE.Texture> {
  const hit = textures.get(file);
  if (hit) return hit;
  const t = await loadTextureFile(BASE + 'tex/' + file);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  // Decoded off the main thread before it's measured or uploaded: otherwise both pay for it, mid-game.
  try {
    await (t.image as HTMLImageElement | undefined)?.decode?.();
  } catch {
    /* drawn anyway */
  }
  if (srgb) {
    const m = measure(t.image as CanvasImageSource & { width: number; height: number });
    meanLum.set(file, m.lum);
    meanRgb.set(file, m.rgb);
  }
  textures.set(file, t);
  return t;
}

function measure(img: CanvasImageSource & { width: number; height: number }): { lum: number; rgb: [number, number, number] } {
  const none = { lum: 0.5, rgb: [0.5, 0.5, 0.5] as [number, number, number] };
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return none;
    x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data;
    const lin = (v: number) => Math.pow(v / 255, 2.2);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      r += lin(d[i]);
      g += lin(d[i + 1]);
      b += lin(d[i + 2]);
      n++;
    }
    if (!n) return none;
    const rgb: [number, number, number] = [r / n, g / n, b / n];
    return { lum: Math.max(0.02, 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]), rgb };
  } catch {
    return none;
  }
}

/**
 * A material whose colour comes from `colour`, with the texture contributing only its light and
 * shade (texture luminance over its mean), so any garment can be dyed any colour.
 */
function dyed(mat: THREE.MeshStandardMaterial, colour: THREE.Color, mean: number): void {
  mat.color.copy(colour);
  mat.onBeforeCompile = (sh: { uniforms: Record<string, { value: unknown }>; fragmentShader: string }) => {
    sh.uniforms.dyeMean = { value: mean };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float dyeMean;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 texel = texture2D( map, vMapUv );
  float lum = dot( texel.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  diffuseColor.rgb *= clamp( lum / dyeMean, 0.0, 1.8 );
  diffuseColor.a *= texel.a;
#endif`,
      );
  };
  mat.customProgramCacheKey = () => 'dyed';
}

let brows: THREE.Texture | null = null;
/** A painted eyebrow: soft-edged, thicker at the nose end, made of fine angled hair strokes. White, tinted by the material. */
function browTexture(): THREE.Texture | null {
  if (brows || typeof document === 'undefined') return brows;
  const file = fileTexture('character/brow');
  if (file) {
    file.wrapS = file.wrapT = THREE.ClampToEdgeWrapping;
    return (brows = file);
  }
  const W = 256;
  const H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let i = 0; i < 800; i++) {
    const u = Math.pow(rnd(), 0.85);
    // Height of the brow at u: full at the head, tapering to the tail.
    const h = H * (0.5 - 0.3 * u);
    const y = H / 2 + (rnd() - 0.5) * h;
    const x = u * W * 0.94 + W * 0.03;
    // Hairs point up and outwards at the head, flatten towards the tail.
    const ang = -Math.PI / 2 + (0.4 + u * 1.0) + (rnd() - 0.5) * 0.3;
    const len = 6 + rnd() * 9;
    g.strokeStyle = `rgba(255,255,255,${0.55 + rnd() * 0.45})`;
    g.lineWidth = 1 + rnd() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y - Math.sin(ang) * len * 0.45);
    g.stroke();
  }
  // Soft edges: fade out at the top and bottom of the band and towards both ends.
  g.globalCompositeOperation = 'destination-in';
  const vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.3, 'rgba(0,0,0,1)');
  vg.addColorStop(0.7, 'rgba(0,0,0,1)');
  vg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, 'rgba(0,0,0,0)');
  hg.addColorStop(0.08, 'rgba(0,0,0,1)');
  hg.addColorStop(0.85, 'rgba(0,0,0,1)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hg;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  brows = t;
  return t;
}

let lashes: THREE.Texture | null = null;
/** The upper lash line: a dark line along the lid's edge (the bottom of the band) with fine lashes curling up from it. */
function lashTexture(): THREE.Texture | null {
  if (lashes || typeof document === 'undefined') return lashes;
  const file = fileTexture('character/lash');
  if (file) {
    file.wrapS = file.wrapT = THREE.ClampToEdgeWrapping;
    return (lashes = file);
  }
  const W = 128;
  const H = 32;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Lid line, thickest at the outer corner.
  for (let x = 2; x < W - 2; x++) {
    const k = x / W;
    const t = 2.5 + 3.5 * k;
    g.fillStyle = `rgba(255,255,255,${0.75})`;
    g.fillRect(x, H * 0.62 - t / 2, 1, t);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const k = 0.05 + rnd() * 0.92;
    const x = k * W;
    const len = H * (0.25 + 0.35 * k) * (0.7 + rnd() * 0.3);
    g.strokeStyle = `rgba(255,255,255,${0.5 + rnd() * 0.4})`;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x, H * 0.6);
    g.quadraticCurveTo(x + 2 + k * 4, H * 0.6 - len * 0.7, x + 4 + k * 6, H * 0.6 - len);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  lashes = t;
  return t;
}

/** Each fabric's set in the texture library: [set, repeats across the garment, normal strength]. */
const FABRIC_LIBRARY: Record<Fabric, [LibraryName, number, number]> = {
  fleece: ['Fabric082A', 4, 0.8],
  knit: ['Fabric026', 4, 1],
  nylon: ['Fabric081A', 5, 0.5],
  denim: ['Fabric022', 5, 1],
  leather: ['Leather037', 3, 0.9],
  cotton: ['Fabric064', 5, 0.7],
  canvas: ['Fabric049', 14, 0.45],
};

const fabrics = new Map<Fabric, THREE.Texture>();

/** A small tiling weave for each fabric (grey; garments are coloured per vertex). */
function fabricTexture(kind: Fabric): THREE.Texture | null {
  const hit = fabrics.get(kind);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  // The weave from its file (128 px, so half the repeats of the 64 px canvas below).
  const dense = kind === 'denim' || kind === 'canvas' ? 30 : 20;
  const file = fileTexture(`character/fabric_${kind}`, dense, dense);
  if (file) {
    fabrics.set(kind, file);
    return file;
  }
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  if (!x) return null;
  const img = x.createImageData(S, S);
  let seed = 1234 + kind.length * 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      let v = 0.85;
      const n = rnd();
      switch (kind) {
        case 'knit':
          v = 0.72 + 0.22 * Math.abs(Math.sin((i / S) * Math.PI * 8)) + 0.06 * n;
          break;
        case 'fleece':
          v = 0.86 + 0.1 * n;
          break;
        case 'denim':
          v = 0.7 + 0.2 * (((i + j) % 4) < 2 ? 1 : 0) + 0.12 * n;
          break;
        case 'nylon':
          v = 0.9 + 0.05 * n;
          break;
        case 'leather':
          v = 0.8 + 0.18 * n * n;
          break;
        case 'canvas':
          v = 0.75 + 0.15 * ((i % 2) ^ (j % 2)) + 0.1 * n;
          break;
        default:
          v = 0.82 + 0.12 * (((i + j * 2) % 3) === 0 ? 1 : 0) * n;
      }
      const k = (j * S + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(Math.min(1, v) * 255);
      img.data[k + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'denim' || kind === 'canvas' ? 60 : 40, kind === 'denim' || kind === 'canvas' ? 60 : 40);
  t.colorSpace = THREE.SRGBColorSpace;
  // Not cached: once the texture file has loaded, later garments use it.
  return t;
}

const FABRIC_ROUGH: Record<Fabric, number> = { fleece: 0.95, knit: 0.95, nylon: 0.45, denim: 0.9, leather: 0.38, cotton: 0.88, canvas: 0.85 };

/**
 * The eye texture has a red-brown iris. Recolour it: saturated texels (the iris) keep their light and
 * shade but take the wanted eye colour; the white and the pupil are left alone.
 */
function irisColour(mat: THREE.MeshStandardMaterial, colour: THREE.Color): void {
  mat.onBeforeCompile = (sh: { uniforms: Record<string, { value: unknown }>; fragmentShader: string }) => {
    sh.uniforms.irisCol = { value: colour };
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 irisCol;\nvoid main() {').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  {
    vec3 c = diffuseColor.rgb;
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
    float iris = smoothstep(0.35, 0.6, sat);
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(c, irisCol * clamp(lum * 4.0, 0.2, 1.6), iris);
  }`,
    );
  };
  mat.customProgramCacheKey = () => 'iris';
}

/** Smooth normals for points indexed by base vertex, so UV seams don't show as creases. */
/** The colour to multiply a skin texture by so it averages out at spec.skinColour. */
function skinTintFor(spec: HumanSpec, skin: SkinInfo): THREE.Color {
  if (spec.skinTint) return new THREE.Color(spec.skinTint);
  const avg = meanRgb.get(skin.diffuse);
  if (!spec.skinColour || !avg) return new THREE.Color(1, 1, 1);
  const want = new THREE.Color(spec.skinColour);
  // Faces are lit darker than the flat swatch: aim a little lighter.
  const k = 1.12;
  return new THREE.Color(
    Math.min(1.8, Math.max(0.25, (want.r * k) / avg[0])),
    Math.min(1.8, Math.max(0.25, (want.g * k) / avg[1])),
    Math.min(1.8, Math.max(0.25, (want.b * k) / avg[2])),
  );
}

/** Load every item and skin, so any character can be built straight away. */
export async function preloadAllHumans(): Promise<boolean> {
  const a = await loadHumanAssets();
  if (!a) return false;
  const ids = Object.keys(a.catalogue);
  await Promise.all(ids.map((id) => loadProxy(id)));
  const tex = new Set<string>();
  for (const id of ids) {
    const m = a.catalogue[id].material;
    if (m.diffuse) tex.add(m.diffuse);
    if (m.normal) tex.add(m.normal);
  }
  for (const s of a.skins) {
    tex.add(s.diffuse);
    if (s.normal) tex.add(s.normal);
  }
  await Promise.all([...tex].map((t) => loadTexture(t, !t.endsWith('_n.webp')).catch(() => null)));
  allReady = true;
  return true;
}

let allReady = false;
export function humansReady(): boolean {
  return allReady;
}

export interface BuiltHuman {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  bones: Map<string, THREE.Bone>;
  height: number;
  dispose(): void;
}

interface Template {
  placed: ReturnType<typeof placeBones>;
  parts: { geometry: THREE.BufferGeometry; material: THREE.Material; name: string; order: number; cast: boolean }[];
  height: number;
  refs: number;
  dispose: () => void;
}

/** Recently built characters, by spec: the same person (NPCs come from a fixed pool) reuses the geometry. */
const templates = new Map<string, Template>();
// Two districts' regulars (World NPC_POOL) plus the fighters about.
const MAX_TEMPLATES = 64;

function skeletonFrom(placed: ReturnType<typeof placeBones>): { bones: THREE.Bone[]; skeleton: THREE.Skeleton; root: THREE.Group } {
  const bones = placed.map((p) => {
    const b = new THREE.Bone();
    b.name = p.name;
    return b;
  });
  placed.forEach((p, i) => {
    const b = bones[i];
    if (p.parent >= 0) {
      const ph = placed[p.parent].head;
      b.position.set(p.head[0] - ph[0], p.head[1] - ph[1], p.head[2] - ph[2]);
      bones[p.parent].add(b);
    } else b.position.set(p.head[0], p.head[1], p.head[2]);
  });
  const root = new THREE.Group();
  root.name = 'human';
  root.add(bones[0]);
  root.updateMatrixWorld(true);
  return { bones, skeleton: new THREE.Skeleton(bones), root };
}

/**
 * Build a character. Call after preloadHuman(spec); anything not loaded is left out. A spec built
 * before shares its meshes (morphing and cutting clothes take tens of milliseconds).
 */
/** Keep a freshly built person for reuse, forgetting the least recently used ones nobody is wearing. */
function keepTemplate(key: string, fresh: BuiltHuman & { placed: ReturnType<typeof placeBones> }): Template {
  const parts: Template['parts'] = [];
  fresh.root.traverse((o: THREE.Object3D) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) parts.push({ geometry: m.geometry, material: m.material as THREE.Material, name: m.name, order: m.renderOrder, cast: m.castShadow });
  });
  const t: Template = { placed: fresh.placed, parts, height: fresh.height, refs: 0, dispose: fresh.dispose };
  templates.set(key, t);
  if (templates.size > MAX_TEMPLATES)
    for (const [k, old] of templates) {
      if (templates.size <= MAX_TEMPLATES) break;
      if (old.refs === 0 && old !== t) {
        old.dispose();
        templates.delete(k);
      }
    }
  return t;
}

/** Already built: buildHuman will be quick. */
export function humanBuilt(spec: HumanSpec): boolean {
  return templates.has(JSON.stringify(spec));
}

// ---- building in the background (buildWorker.ts) ----

let worker: Worker | null = null;
let workerBroken = typeof Worker === 'undefined';
let nextJob = 1;
const jobs = new Map<number, { key: string; spec: HumanSpec; done: (ok: boolean) => void }>();
const building = new Map<string, Promise<boolean>>();

function buildWorker(): Worker | null {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(new URL('./buildWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    workerBroken = true;
    return null;
  }
  worker.onmessage = (e: MessageEvent<{ id: number; data?: HumanData; error?: string }>) => {
    const job = jobs.get(e.data.id);
    if (!job) return;
    jobs.delete(e.data.id);
    if (!e.data.data) return job.done(false);
    if (!templates.has(job.key)) {
      const fresh = assemble(job.spec, e.data.data);
      if (!fresh) return job.done(false);
      keepTemplate(job.key, fresh);
    }
    job.done(true);
  };
  // A worker that can't start (an old browser, a build without it): everything is built where it's asked for.
  worker.onerror = () => {
    workerBroken = true;
    worker?.terminate();
    worker = null;
    for (const j of jobs.values()) j.done(false);
    jobs.clear();
  };
  return worker;
}

/**
 * Build a person in the background. Resolves true once buildHuman(spec) will be instant; false if it couldn't
 * (no worker): build it the ordinary way then.
 */
export function buildHumanLater(spec: HumanSpec): Promise<boolean> {
  const key = JSON.stringify(spec);
  if (templates.has(key)) return Promise.resolve(true);
  const had = building.get(key);
  if (had) return had;
  const w = ready ? buildWorker() : null;
  if (!w) return Promise.resolve(false);
  const p = new Promise<boolean>((done) => {
    const id = nextJob++;
    jobs.set(id, { key, spec, done });
    w.postMessage({ id, spec });
  }).finally(() => building.delete(key));
  building.set(key, p);
  return p;
}

export function buildHuman(spec: HumanSpec): BuiltHuman | null {
  const key = JSON.stringify(spec);
  let t = templates.get(key);
  if (!t) {
    const fresh = buildHumanFresh(spec);
    if (!fresh) return null;
    t = keepTemplate(key, fresh);
  } else {
    templates.delete(key);
    templates.set(key, t);
  }
  const tpl = t;
  const { bones, skeleton, root } = skeletonFrom(tpl.placed);
  for (const p of tpl.parts) {
    const mesh = new THREE.SkinnedMesh(p.geometry, p.material);
    mesh.name = p.name;
    mesh.renderOrder = p.order;
    mesh.castShadow = p.cast;
    mesh.receiveShadow = true;
    cullAsCharacter(mesh);
    root.add(mesh);
    mesh.bind(skeleton);
  }
  tpl.refs++;
  let released = false;
  return {
    root,
    skeleton,
    bones: new Map(bones.map((b) => [b.name, b])),
    height: tpl.height,
    dispose: () => {
      if (released) return;
      released = true;
      tpl.refs--;
      // This copy's own bone texture (the meshes are the template's, kept for the next copy). Left undisposed,
      // every person who'd gone left one on the GPU: dozens more each visit to the pub.
      skeleton.dispose();
    },
  };
}

/** What the geometry step reads, on this thread. */
function computeDeps(a: Assets): ComputeDeps {
  return { body: a.body, lite: a.lite, proxy: (id) => proxyReady.get(id) };
}

function buildHumanFresh(spec: HumanSpec): (BuiltHuman & { placed: ReturnType<typeof placeBones> }) | null {
  const a = ready;
  if (!a) return null;
  return assemble(spec, computeHuman(spec, computeDeps(a)));
}

/** Meshes and materials round the arrays (made here, or in the build worker). */
function assemble(spec: HumanSpec, data: HumanData): (BuiltHuman & { placed: ReturnType<typeof placeBones> }) | null {
  const a = ready;
  if (!a) return null;
  const { bones, skeleton, root } = skeletonFrom(data.placed);
  const disposables: { dispose(): void }[] = [];
  const geometryOf = (p: PartData): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.attrs.position, 3));
    if (p.attrs.normal) g.setAttribute('normal', new THREE.BufferAttribute(p.attrs.normal, 3));
    if (p.attrs.color) g.setAttribute('color', new THREE.BufferAttribute(p.attrs.color, 3));
    if (p.attrs.uv) g.setAttribute('uv', new THREE.BufferAttribute(p.attrs.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(p.attrs.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(p.attrs.skinWeight, 4));
    g.setIndex(new THREE.BufferAttribute(p.index, 1));
    if (p.computeNormals) g.computeVertexNormals();
    disposables.push(g);
    return g;
  };
  const add = (p: PartData, mat: THREE.Material, o: { cast?: boolean; receive?: boolean; order?: number } = {}) => {
    const mesh = new THREE.SkinnedMesh(geometryOf(p), mat);
    mesh.name = p.name;
    if (o.order !== undefined) mesh.renderOrder = o.order;
    root.add(mesh);
    mesh.bind(skeleton);
    mesh.castShadow = !!o.cast;
    mesh.receiveShadow = !!o.receive;
    cullAsCharacter(mesh);
  };
  const garmentMats = new Map<number, THREE.MeshStandardMaterial>();
  for (const p of data.parts) {
    if (p.kind === 'body') {
      const skin = a.skins.find((s) => s.id === spec.skin) ?? a.skins[0];
      const plain = textures.get(skin.diffuse) ?? null;
      const skinMat = new THREE.MeshStandardMaterial({
        map: plain && spec.tattoos?.length ? inkedSkin(plain, skin.id, spec.ink ?? '#1a2230', spec.tattoos as InkSpot[]) : plain,
        normalMap: skin.normal ? textures.get(skin.normal) ?? null : null,
        color: skinTintFor(spec, skin),
        roughness: 0.62,
        metalness: 0,
      });
      disposables.push(skinMat);
      add(p, skinMat, { cast: true, receive: true });
    } else if (p.kind === 'proxy') {
      const prox = proxyReady.get(p.name);
      if (!prox) continue;
      const m = prox.meta.material;
      const slot = prox.meta.slot;
      const map = m.diffuse ? textures.get(m.diffuse) ?? null : null;
      const dye = p.colour && m.tint && slot !== 'eyes' ? new THREE.Color(p.colour) : null;
      const mat = new THREE.MeshStandardMaterial({
        map,
        normalMap: m.normal ? textures.get(m.normal) ?? null : null,
        color: map ? new THREE.Color(1, 1, 1) : dye ?? new THREE.Color(m.colour[0], m.colour[1], m.colour[2]),
        roughness: slot === 'eyes' ? 0.15 : 0.8,
        transparent: m.alpha,
        alphaTest: m.alpha ? 0.35 : 0,
        side: m.alpha ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !m.alpha || slot === 'hair',
      });
      if (dye && map) dyed(mat, dye, meanLum.get(m.diffuse!) ?? 0.5);
      if (slot === 'eyes') irisColour(mat, new THREE.Color(p.colour ?? '#5a3a22'));
      disposables.push(mat);
      add(p, mat, { cast: slot !== 'eyes', receive: true, order: prox.meta.zDepth });
    } else if (p.kind === 'band') {
      const map = p.name === 'eyebrows' ? browTexture() : lashTexture();
      const bm = new THREE.MeshStandardMaterial({ map, color: new THREE.Color(p.colour), transparent: true, alphaTest: 0.08, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
      attachNormal(bm);
      if (bm.normalMap) disposables.push(bm.normalMap);
      disposables.push(bm);
      add(p, bm, { order: 2 });
    } else {
      let mat = garmentMats.get(p.garment!);
      if (!mat) {
        const fabric = p.fabric!;
        // A shoe's upper is smooth leather or mesh: the drawn weave would streak over the foot's small patch of the atlas.
        mat = new THREE.MeshStandardMaterial({ map: p.part === 'feet' ? null : fabricTexture(fabric), vertexColors: true, roughness: FABRIC_ROUGH[fabric], side: THREE.DoubleSide });
        attachNormal(mat);
        if (mat.normalMap) disposables.push(mat.normalMap);
        disposables.push(mat);
        // The cloth's real weave and sheen from the texture library (the colour stays per vertex).
        const cloth = FABRIC_LIBRARY[fabric];
        // Hats and shoes cover a small patch of the body's texture atlas: tile the weave finer there.
        const fine = p.part === 'head' ? 10 : p.part === 'feet' ? 8 : 1;
        detail(mat, cloth[0], cloth[1] * fine, cloth[2] * (p.part === 'feet' || p.part === 'head' ? 0.2 : 1));
        garmentMats.set(p.garment!, mat);
      }
      add(p, mat, { cast: true, receive: p.kind === 'garment' });
    }
  }
  return {
    placed: data.placed,
    root,
    skeleton,
    bones: new Map(bones.map((b) => [b.name, b])),
    height: data.height,
    dispose: () => {
      for (const d of disposables) d.dispose();
      skeleton.dispose();
    },
  };
}
