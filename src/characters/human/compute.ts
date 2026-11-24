/**
 * Everything about building a person that's just numbers: morph the body to their shape, place the bones, cut
 * the skin that clothes cover, cut the clothes, fit the eyes and items, the brows and lashes. No three.js and no
 * DOM, so it runs on the main thread or in the build worker (render/human/buildWorker.ts) alike, and both give
 * exactly the same person. render/human/HumanBuilder.ts turns the result into meshes and materials.
 */
import { footY, morph, placeBones, type BodyData, type BodyShape, type BonePlacement } from './body';
import { fitProxy, proxySkin, type ProxyData } from './proxy';
import { cutBrows, cutLashes, type BrowMesh } from './brows';
import { cutGarment, type Fabric, type GarmentKind } from './garments';

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
  /** Background person: the lighter body (and lighter clothes cut from it), no eyelashes. */
  lite?: boolean;
}

/**
 * How far each kind of item sits out from the skin, in metres. Clothes are pushed out along their
 * normals by their layer so skin never pokes through, and outer layers (a jumper) cover inner ones
 * (the waistband of trousers).
 */
const LAYER_GAP: Record<string, number> = { socks: 0.002, bottoms: 0.004, shoes: 0.004, top: 0.007, suit: 0.006, gloves: 0.003, beard: 0.001 };

type Arr = Float32Array | Uint16Array;

/** One skinned part, as arrays, with what the material needs to know. */
export interface PartData {
  /** 'body', a proxy's id, 'eyebrows' / 'eyelashes', a garment's kind, or a garment's `<kind>_brim` / `_sole`. */
  name: string;
  kind: 'body' | 'proxy' | 'band' | 'garment' | 'extra';
  attrs: { position: Float32Array; normal?: Float32Array; uv?: Float32Array; color?: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array };
  index: Uint32Array | Uint16Array;
  /** Brows, lashes and rigid extras: normals worked out from the triangles when the mesh is made. */
  computeNormals?: boolean;
  /** proxy: its item colour. band: its colour. */
  colour?: string;
  /** garment and extra: the garment's index in the spec (an extra shares its garment's material). */
  garment?: number;
  fabric?: Fabric;
  part?: 'top' | 'bottoms' | 'head' | 'feet';
}

export interface HumanData {
  placed: BonePlacement[];
  height: number;
  parts: PartData[];
}

export interface ComputeDeps {
  body: BodyData;
  lite: BodyData;
  proxy: (id: string) => ProxyData | undefined;
}

/** Vertex normals from the triangles, per base vertex. */
export function smoothNormals(pos: Float32Array, nBase: number, tris: ArrayLike<number>, toBase: ArrayLike<number>): Float32Array {
  const n = new Float32Array(nBase * 3);
  for (let i = 0; i < tris.length; i += 3) {
    const i0 = toBase[tris[i]];
    const i1 = toBase[tris[i + 1]];
    const i2 = toBase[tris[i + 2]];
    const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
    const bx = pos[i1 * 3] - ax, by = pos[i1 * 3 + 1] - ay, bz = pos[i1 * 3 + 2] - az;
    const cx = pos[i2 * 3] - ax, cy = pos[i2 * 3 + 1] - ay, cz = pos[i2 * 3 + 2] - az;
    const x = by * cz - bz * cy;
    const y = bz * cx - bx * cz;
    const z = bx * cy - by * cx;
    for (const v of [i0, i1, i2]) {
      n[v * 3] += x;
      n[v * 3 + 1] += y;
      n[v * 3 + 2] += z;
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

/**
 * The arrays the result owns outright, to hand back from a worker without copying. An array that's only a view
 * into a bigger buffer (a pack the worker keeps) is left to be copied: handing its buffer over would take the
 * pack away from the worker.
 */
export function transferables(d: HumanData): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>();
  const own = (a: Arr | Uint32Array | undefined) => {
    if (a && a.byteOffset === 0 && a.byteLength === a.buffer.byteLength) out.add(a.buffer as ArrayBuffer);
  };
  for (const p of d.parts) {
    for (const a of Object.values(p.attrs) as (Arr | undefined)[]) own(a);
    own(p.index);
  }
  return [...out];
}

export function computeHuman(spec: HumanSpec, deps: ComputeDeps): HumanData {
  const full = deps.body;
  const body = spec.lite ? deps.lite : full;
  const pos = morph(body, spec.shape);
  const ground = footY(body, pos);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= ground;
  const placed = placeBones(body, pos);
  const parts: PartData[] = [];

  const items = spec.items.map((it) => ({ it, data: deps.proxy(it.id) })).filter((x) => x.data) as { it: HumanItem; data: ProxyData }[];
  const eyes = deps.proxy('eyes');

  // ---- body, minus what clothes cover ----
  const hidden = new Uint8Array(body.meta.baseCount);
  for (const { data } of items) for (const v of data.hides) hidden[v] = 1;
  // Normals from the full body even for the lighter one: its fewer triangles still shade as smoothly.
  const nb = smoothNormals(pos, body.meta.baseCount, full.index, body.renderBase);
  const lin = (hex: string): [number, number, number] => {
    // sRGB hex to linear, as THREE.Color does with colour management on.
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    const v = parseInt(h.slice(0, 6).padEnd(6, '0'), 16);
    const c = (x: number) => {
      const s = x / 255;
      return s <= 0.04045 ? s * 0.0773993808 : Math.pow(s * 0.9478672986 + 0.0521327014, 2.4);
    };
    return [c((v >> 16) & 255), c((v >> 8) & 255), c(v & 255)];
  };
  const cut = (spec.garments ?? []).map((g) => cutGarment(body, pos, nb, g.kind, { main: lin(g.colour), trim: g.trim ? lin(g.trim) : undefined }));
  // Skin under a garment: hidden if any corner is covered (the cloth's cut edge sits over it).
  const under = new Uint8Array(body.meta.baseCount);
  for (const mesh of cut) for (let v = 0; v < mesh.covers.length; v++) if (mesh.covers[v]) under[v] = 1;
  const edgeTrim = (a: number, b: number, c: number) => (under[a] ? 1 : 0) + (under[b] ? 1 : 0) + (under[c] ? 1 : 0) >= 2;
  const keep: number[] = [];
  const idx = body.index;
  for (let i = 0; i < idx.length; i += 3) {
    const b0 = body.renderBase[idx[i]];
    const b1 = body.renderBase[idx[i + 1]];
    const b2 = body.renderBase[idx[i + 2]];
    if (!(hidden[b0] && hidden[b1] && hidden[b2]) && !edgeTrim(b0, b1, b2)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  // Only the vertices the kept triangles use (skin under clothes, and most of the lighter body's, aren't): the
  // built person is kept for reuse, so this is memory saved for as long as they're about.
  const rc = body.meta.renderCount;
  const remap = new Int32Array(rc).fill(-1);
  let used = 0;
  for (const r of keep) if (remap[r] < 0) remap[r] = used++;
  const P = new Float32Array(used * 3);
  const N = new Float32Array(used * 3);
  const UV = new Float32Array(used * 2);
  const SI = new Uint16Array(used * 4);
  const SW = new Float32Array(used * 4);
  for (let r = 0; r < rc; r++) {
    const o = remap[r];
    if (o < 0) continue;
    const v = body.renderBase[r];
    for (let k = 0; k < 3; k++) {
      P[o * 3 + k] = pos[v * 3 + k];
      N[o * 3 + k] = nb[v * 3 + k];
    }
    UV[o * 2] = body.uv[r * 2];
    UV[o * 2 + 1] = body.uv[r * 2 + 1];
    for (let k = 0; k < 4; k++) {
      SI[o * 4 + k] = body.skinIndex[v * 4 + k];
      SW[o * 4 + k] = body.skinWeight[v * 4 + k] / 255;
    }
  }
  parts.push({ name: 'body', kind: 'body', attrs: { position: P, normal: N, uv: UV, skinIndex: SI, skinWeight: SW }, index: new Uint32Array(keep.map((r) => remap[r])) });

  // ---- eyes and items ----
  const proxyPart = (data: ProxyData, colour?: string): PartData => {
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
    return { name: data.id, kind: 'proxy', colour, attrs: { position: p2, normal: n2, uv: new Float32Array(data.uv), skinIndex: si, skinWeight: sw }, index: data.index.slice() };
  };
  if (eyes) {
    parts.push(proxyPart(eyes, spec.eyeColour));
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
    const band = (b: BrowMesh, colour: string, name: string) => {
      if (!b.index.length) return;
      const m = b.render.length;
      const si = new Uint16Array(m * 4);
      const sw = new Float32Array(m * 4);
      for (let l = 0; l < m; l++) {
        const v = body.renderBase[b.render[l]];
        for (let k = 0; k < 4; k++) {
          si[l * 4 + k] = body.skinIndex[v * 4 + k];
          sw[l * 4 + k] = body.skinWeight[v * 4 + k] / 255;
        }
      }
      parts.push({ name, kind: 'band', colour, computeNormals: true, attrs: { position: b.position, uv: b.uv, skinIndex: si, skinWeight: sw }, index: b.index });
    };
    const eyesAt: [number, number, number][] = [centre(1), centre(-1)];
    band(cutBrows(full, pos, nb, eyesAt, spec.browWeight ?? 0.5), spec.browColour ?? '#2a1c12', 'eyebrows');
    // Lashes are a few millimetres: nobody sees them on someone across the street.
    if (!spec.lite) band(cutLashes(body, pos, nb, eyesAt), '#120c08', 'eyelashes');
  }

  // ---- clothes cut from the body ----
  cut.forEach((mesh, gi) => {
    const m = mesh.render.length;
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
    const kind = spec.garments![gi].kind;
    parts.push({ name: kind, kind: 'garment', garment: gi, fabric: mesh.fabric, part: mesh.part, attrs: { position: mesh.position, normal: mesh.normal, color: mesh.colour, uv, skinIndex: si, skinWeight: sw }, index: mesh.index });
    // A cap's peak or a hat's brim: a rigid sheet on the head bone, in the same cloth.
    for (const e of mesh.extra ?? []) {
      if (!e.index.length) continue;
      const bi = placed.findIndex((b) => b.name === e.bone);
      const cnt = e.position.length / 3;
      const esi = new Uint16Array(cnt * 4);
      const esw = new Float32Array(cnt * 4);
      for (let i = 0; i < cnt; i++) {
        esi[i * 4] = Math.max(0, bi);
        esw[i * 4] = 1;
      }
      parts.push({ name: `${kind}_${e.bone === 'head' ? 'brim' : 'sole'}`, kind: 'extra', garment: gi, fabric: mesh.fabric, part: mesh.part, computeNormals: true, attrs: { position: e.position, color: e.colour, skinIndex: esi, skinWeight: esw }, index: e.index });
    }
  });
  for (const { it, data } of items) parts.push(proxyPart(data, it.colour));

  let top = 0;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  return { placed, height: top, parts };
}
