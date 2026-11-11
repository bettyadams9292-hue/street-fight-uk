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
import { cutGarment, hoodShell, GARMENTS, type Fabric, type GarmentKind } from '../../characters/human/garments';

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
  if (srgb) meanLum.set(file, measure(t.image as CanvasImageSource & { width: number; height: number }));
  textures.set(file, t);
  return t;
}

function measure(img: CanvasImageSource & { width: number; height: number }): number {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return 0.5;
    x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      // sRGB to linear, then luminance.
      const lin = (v: number) => Math.pow(v / 255, 2.2);
      sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
      n++;
    }
    return n ? Math.max(0.02, sum / n) : 0.5;
  } catch {
    return 0.5;
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

export interface BuiltHuman {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  bones: Map<string, THREE.Bone>;
  height: number;
  dispose(): void;
}

/** Build a character. Call after preloadHuman(spec); anything not loaded is left out. */
export function buildHuman(spec: HumanSpec): BuiltHuman | null {
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
  for (const { mesh } of cut) for (let v = 0; v < mesh.covers.length; v++) if (mesh.covers[v]) hidden[v] = 1;
  const keep: number[] = [];
  const idx = body.index;
  for (let i = 0; i < idx.length; i += 3) {
    const b0 = body.renderBase[idx[i]];
    const b1 = body.renderBase[idx[i + 1]];
    const b2 = body.renderBase[idx[i + 2]];
    if (!(hidden[b0] && hidden[b1] && hidden[b2])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
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
    color: new THREE.Color(spec.skinTint ?? '#ffffff'),
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
  if (eyes) addProxy(eyes, spec.eyeColour);

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
    if (GARMENTS[g.kind].hood) {
      const h = hoodShell(body, pos, 0.02);
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(h.position, 3));
      hg.setAttribute('normal', new THREE.BufferAttribute(h.normal, 3));
      const bi = body.meta.boneNames.indexOf(h.bone);
      const cnt = h.position.length / 3;
      const hsi = new Uint16Array(cnt * 4);
      const hsw = new Float32Array(cnt * 4);
      for (let i = 0; i < cnt; i++) {
        hsi[i * 4] = bi;
        hsw[i * 4] = 1;
      }
      hg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(hsi, 4));
      hg.setAttribute('skinWeight', new THREE.BufferAttribute(hsw, 4));
      hg.setIndex(new THREE.BufferAttribute(h.index, 1));
      disposables.push(hg);
      const hm = new THREE.MeshStandardMaterial({ color: new THREE.Color(g.colour).multiplyScalar(0.92), roughness: FABRIC_ROUGH[mesh.fabric] });
      disposables.push(hm);
      const hood = new THREE.SkinnedMesh(hg, hm);
      hood.name = 'hood';
      root.add(hood);
      hood.bind(skeleton);
      hood.castShadow = true;
      hood.frustumCulled = false;
    }
  }
  for (const { it, data } of items) addProxy(data, it.colour);

  let top = 0;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  return {
    root,
    skeleton,
    bones: new Map(bones.map((b) => [b.name, b])),
    height: top,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
