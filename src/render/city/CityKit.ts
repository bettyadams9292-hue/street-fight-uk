/**
 * The city kit at runtime: the converted MegaKit (tools/megakit/convert.py)
 * as Three.js geometry and shared materials.
 *
 * Loaded once at boot. Each piece is split by material into its own geometry,
 * so the facade builder can instance every piece-and-material pair and colour
 * each instance (paint, brick tone, lit or dark windows) without new materials.
 */
import * as THREE from 'three';

interface PrimJson {
  mat: string;
  count: number;
  pos: number;
  nrm: number;
  uv: number;
  idx: number;
  icount: number;
  i32: boolean;
}
interface KitJson {
  materials: Record<string, { map: string | null; orm: string | null; normal: string | null; color: number[]; roughness: number; blend: boolean }>;
  pieces: Record<string, { min: number[]; max: number[]; prims: PrimJson[] }>;
}

/** Which palette colour tints a kit material. */
export type TintSlot = 'brick' | 'trim' | 'trim_dark' | 'metal' | 'interior' | 'door' | 'none';

export const SLOT_OF: Readonly<Record<string, TintSlot>> = {
  MI_RedBrick: 'brick',
  MI_RedBrick_Pale: 'brick',
  MI_InteriorWall: 'brick',
  MI_Trim: 'trim',
  MI_Trim_Green: 'trim',
  MI_Trim_Dark: 'trim_dark',
  MI_Trim_MetalConcrete: 'metal',
  MI_Concrete: 'metal',
  MI_FakeInterior: 'interior',
};

export interface KitPrim {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  mat: string;
  slot: TintSlot;
}

export class CityKit {
  private readonly prims = new Map<string, KitPrim[]>();
  /** Window interiors: three different rooms, picked per window. */
  readonly interiors: THREE.MeshBasicMaterial[] = [];

  private constructor(
    private readonly json: KitJson,
    private readonly bin: ArrayBuffer,
    private readonly materials: Map<string, THREE.Material>,
  ) {}

  static async load(base = '/models/city/'): Promise<CityKit> {
    const [json, bin] = await Promise.all([
      fetch(`${base}kit.json`).then((r) => {
        if (!r.ok) throw new Error(`kit.json: ${r.status}`);
        return r.json() as Promise<KitJson>;
      }),
      fetch(`${base}kit.bin`).then((r) => {
        if (!r.ok) throw new Error(`kit.bin: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
    const loader = new THREE.TextureLoader();
    const cache = new Map<string, Promise<THREE.Texture>>();
    const tex = (file: string | null, srgb: boolean): Promise<THREE.Texture> | null => {
      if (!file) return null;
      const key = `${file}:${srgb}`;
      if (!cache.has(key))
        cache.set(
          key,
          loader.loadAsync(`${base}tex/${file}`).then((t: THREE.Texture) => {
            // glTF texture convention: no vertical flip.
            t.flipY = false;
            t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 4;
            return t;
          }),
        );
      return cache.get(key)!;
    };

    const materials = new Map<string, THREE.Material>();
    const pending: Promise<unknown>[] = [];
    for (const [name, m] of Object.entries(json.materials)) {
      if (name === 'MI_Glass') {
        materials.set(name, new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }));
        continue;
      }
      if (name === 'MI_StreetDecals') {
        const mat = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        pending.push(tex(m.map, true)!.then((t) => ((mat.map = t), (mat.needsUpdate = true))));
        materials.set(name, mat);
        continue;
      }
      const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      const map = tex(m.map, true);
      const orm = tex(m.orm, false);
      const nrm = tex(m.normal, false);
      if (map) pending.push(map.then((t) => (mat.map = t)));
      if (orm) pending.push(orm.then((t) => ((mat.roughnessMap = t), (mat.metalnessMap = t), (mat.aoMap = null))));
      if (nrm) pending.push(nrm.then((t) => ((mat.normalMap = t), mat.normalScale.set(1, 1))));
      if (name === 'MI_Trim_MetalConcrete') mat.metalness = 0.6;
      materials.set(name, mat);
    }
    const kit = new CityKit(json, bin, materials);
    for (const f of ['T_lit_interior_1.webp', 'T_lit_interior_2.webp', 'T_dark_interior.webp']) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
      pending.push(tex(f, true)!.then((t) => (m.map = t)));
      kit.interiors.push(m);
    }
    await Promise.all(pending);
    for (const m of materials.values()) m.needsUpdate = true;
    for (const m of kit.interiors) m.needsUpdate = true;
    return kit;
  }

  has(piece: string): boolean {
    return piece in this.json.pieces;
  }

  /** A piece, split by material. Geometry is built once and shared. */
  piece(piece: string): KitPrim[] {
    let list = this.prims.get(piece);
    if (list) return list;
    const p = this.json.pieces[piece];
    if (!p) throw new Error(`city kit has no piece ${piece}`);
    list = p.prims.map((pr) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.bin, pr.pos, pr.count * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.bin, pr.nrm, pr.count * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.bin, pr.uv, pr.count * 2), 2));
      g.setIndex(new THREE.BufferAttribute(pr.i32 ? new Uint32Array(this.bin, pr.idx, pr.icount) : new Uint16Array(this.bin, pr.idx, pr.icount), 1));
      g.computeBoundingSphere();
      // Doors are painted their own colour, whatever material the kit gives them.
      const slot: TintSlot = piece.startsWith('Door_') && pr.mat !== 'MI_Glass' ? 'door' : SLOT_OF[pr.mat] ?? 'none';
      return { geometry: g, material: this.materials.get(pr.mat)!, mat: pr.mat, slot };
    });
    this.prims.set(piece, list);
    return list;
  }
}

let kitPromise: Promise<CityKit | null> | null = null;
let loaded: CityKit | null = null;

/** Start loading the kit (once). Never rejects: on failure streets fall back to their built-in look. */
export function loadCityKit(): Promise<CityKit | null> {
  kitPromise ??= CityKit.load()
    .then((k) => (loaded = k))
    .catch((e) => {
      console.warn('[city] kit failed to load; using built-in facades', e);
      return null;
    });
  return kitPromise;
}

/** The kit if it has finished loading, else null. */
export function cityKit(): CityKit | null {
  return loaded;
}
