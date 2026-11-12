/**
 * Builds a rendered character from the MakeHuman packs: a morphed, skinned
 * body on the 67-bone game rig, with eyes, clothes, hair and accessories fitted
 * to it and sharing its skeleton.
 *
 * Packs load once (loadHumanAssets); textures load on first use and are shared.
 * Origin at the feet, facing +z, in the rest pose (arms in an A).
 */
import * as THREE from 'three';
import { BodyData, footY, morph, placeBones, type BodyMeta, type BodyShape } from '../../characters/human/body';
import { ProxyData, fitProxy, proxySkin, type ProxyMeta } from '../../characters/human/proxy';
import { cutBrows, cutLashes, type BrowMesh } from '../../characters/human/brows';
import { cutGarment, type Fabric, type GarmentKind } from '../../characters/human/garments';

export interface SkinInfo {
  id: string;
  gender: string;
  tone: number;
  age: string;
  tags: string[];
  diffuse: string;
  normal: string | null;
}

export interface HumanItem {
  id: string;
  /** Multiplies the item's texture or sets its colour. */
  colour?: string;
}

export interface HumanGarment {
  kind: GarmentKind;
  colour: string;
  trim?: string;
}

export interface HumanSpec {
  /** Clothes cut from the body (garments.ts), under or instead of pack items. */
  garments?: HumanGarment[];
  shape: BodyShape;
  skin: string;
  /** Tints the skin texture (for the plain skin, or to adjust a tone). */
  skinTint?: string;
  /** Eyebrow colour (default: dark brown); `browWeight` 0 fine .. 1 heavy. */
  browColour?: string;
  browWeight?: number;
  /** The skin colour wanted: the texture is tinted so its average comes out this colour. */
  skinColour?: string;
  eyeColour?: string;
  items: HumanItem[];
}

const BASE = '/models/human/';

/**
 * How far each kind of item sits out from the skin, in metres. Clothes are pushed out along their
 * normals by their layer so skin never pokes through, and outer layers (a jumper) cover inner ones
 * (the waistband of trousers).
 */
const LAYER_GAP: Record<string, number> = { socks: 0.002, bottoms: 0.004, shoes: 0.004, top: 0.007, suit: 0.006, gloves: 0.003, beard: 0.001 };

interface Assets {
  body: BodyData;
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
      const [meta, bin, catalogue, skins] = await Promise.all([
        fetch(BASE + 'body.json').then((r) => r.json() as Promise<BodyMeta>),
        fetch(BASE + 'body.bin').then((r) => r.arrayBuffer()),
        fetch(BASE + 'proxies/catalogue.json').then((r) => r.json() as Promise<Record<string, ProxyMeta>>),
        fetch(BASE + 'skins.json').then((r) => r.json() as Promise<SkinInfo[]>),
      ]);
      ready = { body: new BodyData(meta, bin), catalogue, skins };
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
        const bin = await fetch(`${BASE}proxies/${id}.bin`).then((r) => r.arrayBuffer());
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
  const t = await new THREE.TextureLoader().loadAsync(BASE + 'tex/' + file);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
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

const fabrics = new Map<Fabric, THREE.Texture>();

/** A small tiling weave for each fabric (grey; garments are coloured per vertex). */
function fabricTexture(kind: Fabric): THREE.Texture | null {
  const hit = fabrics.get(kind);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
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
  fabrics.set(kind, t);
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
function smoothNormals(pos: Float32Array, nBase: number, tris: ArrayLike<number>, toBase: ArrayLike<number>): Float32Array {
  const n = new Float32Array(nBase * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 3) {
    const i0 = toBase[tris[i]];
    const i1 = toBase[tris[i + 1]];
    const i2 = toBase[tris[i + 2]];
    a.fromArray(pos, i0 * 3);
    b.fromArray(pos, i1 * 3).sub(a);
    c.fromArray(pos, i2 * 3).sub(a);
    b.cross(c);
    for (const v of [i0, i1, i2]) {
      n[v * 3] += b.x;
      n[v * 3 + 1] += b.y;
      n[v * 3 + 2] += b.z;
    }
  }
  for (let v = 0; v < nBase; v++) {
    const l = Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) || 1;
    n[v * 3] /= l;
    n[v * 3 + 1] /= l;
    n[v * 3 + 2] /= l;
  }
  return n;
}

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
const MAX_TEMPLATES = 48;

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
export function buildHuman(spec: HumanSpec): BuiltHuman | null {
  const key = JSON.stringify(spec);
  let t = templates.get(key);
  if (!t) {
    const fresh = buildHumanFresh(spec);
    if (!fresh) return null;
    const parts: Template['parts'] = [];
    fresh.root.traverse((o: THREE.Object3D) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) parts.push({ geometry: m.geometry, material: m.material as THREE.Material, name: m.name, order: m.renderOrder, cast: m.castShadow });
    });
    t = { placed: fresh.placed, parts, height: fresh.height, refs: 0, dispose: fresh.dispose };
    templates.set(key, t);
    // Forget the least recently used ones no character is wearing.
    if (templates.size > MAX_TEMPLATES)
      for (const [k, old] of templates) {
        if (templates.size <= MAX_TEMPLATES) break;
        if (old.refs === 0 && old !== t) {
          old.dispose();
          templates.delete(k);
        }
      }
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
    mesh.frustumCulled = false;
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
    },
  };
}

function buildHumanFresh(spec: HumanSpec): (BuiltHuman & { placed: ReturnType<typeof placeBones> }) | null {
  const a = ready;
  if (!a) return null;
  const body = a.body;
  const pos = morph(body, spec.shape);
  const ground = footY(body, pos);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= ground;

  // ---- skeleton: bones at their joints, frames aligned with the world ----
  const placed = placeBones(body, pos);
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
  const skeleton = new THREE.Skeleton(bones);
  const root = new THREE.Group();
  root.name = 'human';
  root.add(bones[0]);
  root.updateMatrixWorld(true);
  const disposables: { dispose(): void }[] = [];

  const items = spec.items.map((it) => ({ it, data: proxyReady.get(it.id) })).filter((x) => x.data) as { it: HumanItem; data: ProxyData }[];
  const eyes = proxyReady.get('eyes');

  // ---- body, minus what clothes cover ----
  const hidden = new Uint8Array(body.meta.baseCount);
  for (const { data } of items) for (const v of data.hides) hidden[v] = 1;
  const nb = smoothNormals(pos, body.meta.baseCount, body.index, body.renderBase);
  const cut = (spec.garments ?? []).map((g) => {
    const lin = (hex: string): [number, number, number] => {
      const c = new THREE.Color(hex);
      return [c.r, c.g, c.b];
    };
    return { g, mesh: cutGarment(body, pos, nb, g.kind, { main: lin(g.colour), trim: g.trim ? lin(g.trim) : undefined }) };
  });
  // Skin under a garment: hidden if any corner is covered (the cloth's cut edge sits over it).
  const under = new Uint8Array(body.meta.baseCount);
  for (const { mesh } of cut) for (let v = 0; v < mesh.covers.length; v++) if (mesh.covers[v]) under[v] = 1;
  const edgeTrim = (a: number, b: number, c: number) => (under[a] ? 1 : 0) + (under[b] ? 1 : 0) + (under[c] ? 1 : 0) >= 2;
  const keep: number[] = [];
  const idx = body.index;
  for (let i = 0; i < idx.length; i += 3) {
    const b0 = body.renderBase[idx[i]];
    const b1 = body.renderBase[idx[i + 1]];
    const b2 = body.renderBase[idx[i + 2]];
    if (!(hidden[b0] && hidden[b1] && hidden[b2]) && !edgeTrim(b0, b1, b2)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const rc = body.meta.renderCount;
  const P = new Float32Array(rc * 3);
  const N = new Float32Array(rc * 3);
  const SI = new Uint16Array(rc * 4);
  const SW = new Float32Array(rc * 4);
  for (let r = 0; r < rc; r++) {
    const v = body.renderBase[r];
    for (let k = 0; k < 3; k++) {
      P[r * 3 + k] = pos[v * 3 + k];
      N[r * 3 + k] = nb[v * 3 + k];
    }
    for (let k = 0; k < 4; k++) {
      SI[r * 4 + k] = body.skinIndex[v * 4 + k];
      SW[r * 4 + k] = body.skinWeight[v * 4 + k] / 255;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(body.uv), 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.setIndex(keep);
  disposables.push(g);
  const skin = a.skins.find((s) => s.id === spec.skin) ?? a.skins[0];
  const skinMat = new THREE.MeshStandardMaterial({
    map: textures.get(skin.diffuse) ?? null,
    normalMap: skin.normal ? textures.get(skin.normal) ?? null : null,
    color: skinTintFor(spec, skin),
    roughness: 0.62,
    metalness: 0,
  });
  disposables.push(skinMat);
  const bodyMesh = new THREE.SkinnedMesh(g, skinMat);
  bodyMesh.name = 'body';
  root.add(bodyMesh);
  bodyMesh.bind(skeleton);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = false;

  // ---- eyes and items ----
  const addProxy = (data: ProxyData, colour?: string) => {
    const fp = fitProxy(data, pos, body.meta.scale);
    const sk = proxySkin(data, body);
    const n = data.meta.renderCount;
    const p2 = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const pn = smoothNormals(fp, data.meta.count, data.index, data.renderProxy);
    const gap = LAYER_GAP[data.meta.slot] ?? 0;
    for (let r = 0; r < n; r++) {
      const v = data.renderProxy[r];
      p2[r * 3] = fp[v * 3] + pn[v * 3] * gap;
      p2[r * 3 + 1] = fp[v * 3 + 1] + pn[v * 3 + 1] * gap;
      p2[r * 3 + 2] = fp[v * 3 + 2] + pn[v * 3 + 2] * gap;
      for (let k = 0; k < 4; k++) {
        si[r * 4 + k] = sk.index[v * 4 + k];
        sw[r * 4 + k] = sk.weight[v * 4 + k] / 255;
      }
    }
    const n2 = new Float32Array(n * 3);
    for (let r = 0; r < n; r++) for (let k = 0; k < 3; k++) n2[r * 3 + k] = pn[data.renderProxy[r] * 3 + k];
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    pg.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
    pg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uv), 2));
    pg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    pg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    pg.setIndex(new THREE.BufferAttribute(data.index.slice(), 1));
    disposables.push(pg);
    const m = data.meta.material;
    const map = m.diffuse ? textures.get(m.diffuse) ?? null : null;
    const dye = colour && m.tint && data.meta.slot !== 'eyes' ? new THREE.Color(colour) : null;
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap: m.normal ? textures.get(m.normal) ?? null : null,
      color: map ? new THREE.Color(1, 1, 1) : dye ?? new THREE.Color(m.colour[0], m.colour[1], m.colour[2]),
      roughness: data.meta.slot === 'eyes' ? 0.15 : 0.8,
      transparent: m.alpha,
      alphaTest: m.alpha ? 0.35 : 0,
      side: m.alpha ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: !m.alpha || data.meta.slot === 'hair',
    });
    if (dye && map) dyed(mat, dye, meanLum.get(m.diffuse!) ?? 0.5);
    if (data.meta.slot === 'eyes') irisColour(mat, new THREE.Color(colour ?? '#5a3a22'));
    disposables.push(mat);
    const mesh = new THREE.SkinnedMesh(pg, mat);
    mesh.name = data.id;
    mesh.renderOrder = data.meta.zDepth;
    root.add(mesh);
    mesh.bind(skeleton);
    mesh.castShadow = data.meta.slot !== 'eyes';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  };
  if (eyes) {
    addProxy(eyes, spec.eyeColour);
    // ---- eyebrows, painted on a shell cut from the brow skin ----
    const fe = fitProxy(eyes, pos, body.meta.scale);
    const centre = (sgn: number): [number, number, number] => {
      let x = 0, y = 0, z = 0, c = 0;
      for (let i = 0; i < fe.length; i += 3)
        if (Math.sign(fe[i]) === sgn) {
          x += fe[i];
          y += fe[i + 1];
          z += fe[i + 2];
          c++;
        }
      return c ? [x / c, y / c, z / c] : [0, 0, 0];
    };
    const painted = (band: BrowMesh, map: THREE.Texture | null, colour: string, name: string) => {
      if (!band.index.length) return;
      const m = band.render.length;
      const bg = new THREE.BufferGeometry();
      const si = new Uint16Array(m * 4);
      const sw = new Float32Array(m * 4);
      for (let l = 0; l < m; l++) {
        const v = body.renderBase[band.render[l]];
        for (let k = 0; k < 4; k++) {
          si[l * 4 + k] = body.skinIndex[v * 4 + k];
          sw[l * 4 + k] = body.skinWeight[v * 4 + k] / 255;
        }
      }
      bg.setAttribute('position', new THREE.BufferAttribute(band.position, 3));
      bg.setAttribute('uv', new THREE.BufferAttribute(band.uv, 2));
      bg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      bg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      bg.setIndex(new THREE.BufferAttribute(band.index, 1));
      bg.computeVertexNormals();
      disposables.push(bg);
      const bm = new THREE.MeshStandardMaterial({ map, color: new THREE.Color(colour), transparent: true, alphaTest: 0.08, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
      disposables.push(bm);
      const bmesh = new THREE.SkinnedMesh(bg, bm);
      bmesh.name = name;
      bmesh.renderOrder = 2;
      root.add(bmesh);
      bmesh.bind(skeleton);
      bmesh.frustumCulled = false;
    };
    const eyesAt: [number, number, number][] = [centre(1), centre(-1)];
    painted(cutBrows(body, pos, nb, eyesAt, spec.browWeight ?? 0.5), browTexture(), spec.browColour ?? '#2a1c12', 'eyebrows');
    painted(cutLashes(body, pos, nb, eyesAt), lashTexture(), '#120c08', 'eyelashes');
  }

  // ---- clothes cut from the body ----
  for (const { g, mesh } of cut) {
    const m = mesh.render.length;
    const gg = new THREE.BufferGeometry();
    const uv = new Float32Array(m * 2);
    const si = new Uint16Array(m * 4);
    const sw = new Float32Array(m * 4);
    for (let l = 0; l < m; l++) {
      const r = mesh.render[l];
      const v = body.renderBase[r];
      uv[l * 2] = body.uv[r * 2];
      uv[l * 2 + 1] = body.uv[r * 2 + 1];
      for (let k = 0; k < 4; k++) {
        si[l * 4 + k] = body.skinIndex[v * 4 + k];
        sw[l * 4 + k] = body.skinWeight[v * 4 + k] / 255;
      }
    }
    gg.setAttribute('position', new THREE.BufferAttribute(mesh.position, 3));
    gg.setAttribute('normal', new THREE.BufferAttribute(mesh.normal, 3));
    gg.setAttribute('color', new THREE.BufferAttribute(mesh.colour, 3));
    gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    gg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    gg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    gg.setIndex(new THREE.BufferAttribute(mesh.index, 1));
    disposables.push(gg);
    const mat = new THREE.MeshStandardMaterial({ map: fabricTexture(mesh.fabric), vertexColors: true, roughness: FABRIC_ROUGH[mesh.fabric], side: THREE.DoubleSide });
    disposables.push(mat);
    const gm = new THREE.SkinnedMesh(gg, mat);
    gm.name = g.kind;
    root.add(gm);
    gm.bind(skeleton);
    gm.castShadow = true;
    gm.receiveShadow = true;
    gm.frustumCulled = false;
  }
  for (const { it, data } of items) addProxy(data, it.colour);

  let top = 0;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  return {
    placed,
    root,
    skeleton,
    bones: new Map(bones.map((b) => [b.name, b])),
    height: top,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
