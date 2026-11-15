/**
 * The material library: the owner's texture sets (public/textures/lib, catalogued in
 * docs/assets/TEXTURE_CATALOGUE.md) as physically based materials.
 *
 * - A set is three files: colour, normal, and one packed file with ambient occlusion in red,
 *   roughness in green and metalness in blue (the channels three.js reads them from).
 * - Nothing is fetched until something uses it, and each file is fetched and uploaded once
 *   however many materials share it.
 * - A material starts as a flat colour and gains its maps when they arrive, so nothing ever
 *   shows black while loading, and a missing file just leaves the flat colour.
 * - `tint` asks for an average colour: the texture keeps its grain, weave or mortar lines but is
 *   shifted to that colour. That is how one oak texture serves a dark table and a pale shelf.
 * - Sizes are in metres: give the size of the surface (or let `fitUVs` work it out from the
 *   mesh) and the texture repeats at its real-world scale instead of stretching.
 */
import * as THREE from 'three';
import { LIBRARY, type LibraryName } from './catalogue';

export type { LibraryName } from './catalogue';

const BASE = '/textures/lib/';
const loader = new THREE.TextureLoader();

interface Maps {
  colour: THREE.Texture;
  normal: THREE.Texture;
  orm: THREE.Texture;
}
const loading = new Map<LibraryName, Promise<Maps | null>>();
const ready = new Map<LibraryName, Maps>();

function load(url: string, srgb: boolean): Promise<THREE.Texture | null> {
  return new Promise((res) => {
    loader.load(
      url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        res(t);
      },
      undefined,
      () => res(null),
    );
  });
}

/** Fetch a set (once). Null if any of its files is missing. */
export function loadSet(name: LibraryName): Promise<Maps | null> {
  let p = loading.get(name);
  if (!p) {
    p = Promise.all([load(`${BASE}${name}_c.webp`, true), load(`${BASE}${name}_n.webp`, false), load(`${BASE}${name}_orm.webp`, false)]).then(([colour, normal, orm]) => {
      if (!colour || !normal || !orm) return null;
      const maps = { colour, normal, orm };
      ready.set(name, maps);
      return maps;
    });
    loading.set(name, p);
  }
  return p;
}

/** Sets something has asked for so far (for the performance report and tests). */
export function setsInUse(): LibraryName[] {
  return [...loading.keys()];
}

export interface SurfaceOptions {
  /** The average colour wanted. Without it the texture shows in its own colours. */
  tint?: THREE.ColorRepresentation;
  /** Size in metres that UV 0..1 covers. Leave out when `fitUVs` will size the UVs from the mesh. */
  w?: number;
  h?: number;
  /** Scales the texture's roughness (1 = as photographed). */
  rough?: number;
  /** Normal map strength. */
  normal?: number;
  /** Turn the pattern a quarter turn (boards running the other way). */
  turn?: boolean;
  /** Surface only: the set's relief and sheen under a flat coat of the tint (painted plaster, painted metal). */
  plain?: boolean;
}

const WHITE = new THREE.Color(1, 1, 1);

/** The colour multiplier that brings a set's average colour to `want`, kept within sane bounds. */
function tintFor(name: LibraryName, want: THREE.Color): THREE.Color {
  const avg = LIBRARY[name].avg;
  const k = (w: number, a: number) => Math.min(3.2, Math.max(0.12, w / Math.max(0.015, a)));
  return new THREE.Color(k(want.r, avg[0]), k(want.g, avg[1]), k(want.b, avg[2]));
}

/**
 * Put a set's maps on a material. Until they load the material keeps its flat colour.
 * With a tint the flat colour is the tint; without, the set's own average colour.
 */
export function dress(m: THREE.MeshStandardMaterial, name: LibraryName, o: SurfaceOptions = {}): THREE.MeshStandardMaterial {
  const entry = LIBRARY[name];
  const want = o.tint !== undefined ? new THREE.Color(o.tint) : null;
  m.color.copy(want ?? new THREE.Color(entry.avg[0], entry.avg[1], entry.avg[2]));
  m.userData.lib = name;
  // Sized here, or left for fitUVs to size from each mesh.
  const sized = o.w !== undefined && o.h !== undefined;
  if (!sized) m.userData.tile = entry.tile;
  void loadSet(name).then((maps) => {
    if (!maps) return;
    const own = (t: THREE.Texture): THREE.Texture => {
      const c = t.clone();
      if (sized) c.repeat.set(o.w! / entry.tile, o.h! / (entry.tile / entry.aspect));
      if (o.turn) {
        c.center.set(0.5, 0.5);
        c.rotation = Math.PI / 2;
      }
      c.needsUpdate = true;
      return c;
    };
    // Unsized, unturned materials can share the loaded textures as they are.
    const share = !sized && !o.turn;
    if (!o.plain) m.map = share ? maps.colour : own(maps.colour);
    m.normalMap = share ? maps.normal : own(maps.normal);
    const orm = share ? maps.orm : own(maps.orm);
    m.roughnessMap = orm;
    m.aoMap = orm;
    m.aoMapIntensity = 0.8;
    m.roughness = o.rough ?? 1;
    if (entry.metal) {
      m.metalnessMap = orm;
      m.metalness = 1;
    }
    const n = o.normal ?? 1;
    m.normalScale.set(n, n);
    m.color.copy(want ? (o.plain ? want : tintFor(name, want)) : WHITE);
    if (entry.alpha) {
      m.alphaTest = 0.5;
      m.side = THREE.DoubleSide;
    }
    m.needsUpdate = true;
  });
  return m;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** A material for a set (cached: the same request gives the same material). */
export function surface(name: LibraryName, o: SurfaceOptions = {}): THREE.MeshStandardMaterial {
  const key = `${name}|${o.tint === undefined ? '' : new THREE.Color(o.tint).getHexString()}|${o.w ?? ''}|${o.h ?? ''}|${o.rough ?? ''}|${o.normal ?? ''}|${o.turn ? 1 : 0}|${o.plain ? 1 : 0}`;
  let m = cache.get(key);
  if (!m) {
    const e = LIBRARY[name];
    m = dress(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: e.metal ? 0.6 : 0 }), name, o);
    // Levels dispose their own materials when they are torn down; these are shared between levels.
    m.userData.shared = true;
    m.userData.keepMap = true;
    cache.set(key, m);
  }
  return m;
}

/** Pick one of several suitable sets, the same one every time for the same seed. */
export function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

/** The set among `list` whose own colour is nearest `want` (so tinting has least to do); `seed` chooses among the nearest few. */
export function nearest(list: readonly LibraryName[], want: THREE.ColorRepresentation, seed = 0, among = 2): LibraryName {
  const c = new THREE.Color(want);
  const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const target = lum(c.r, c.g, c.b);
  const off = (n: LibraryName): number => {
    const a = LIBRARY[n].avg;
    return Math.abs(Math.log((lum(a[0], a[1], a[2]) + 0.02) / (target + 0.02)));
  };
  const ranked = [...list].sort((a, b) => off(a) - off(b));
  return pick(ranked.slice(0, Math.max(1, Math.min(among, ranked.length))), seed);
}

/**
 * Size the UVs of every mesh under `root` whose material came from the library without a size,
 * so the texture repeats at its real scale: a 3 m wall shows the brick twice as many times as a
 * 1.5 m one. Boxes, planes and cylinders are sized exactly; anything else from its bounding box.
 * Each geometry is done once (geometries shared between meshes are sized for the first).
 */
export function fitUVs(root: THREE.Object3D): void {
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const tile = mats.map((m) => m.userData.tile as number | undefined).find((t) => t);
    const g = mesh.geometry as THREE.BufferGeometry & { parameters?: Record<string, number> };
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!tile || !uv || g.userData.fitted) return;
    g.userData.fitted = true;
    const s = mesh.scale;
    const p = g.parameters ?? {};
    const scale = (from: number, to: number, su: number, sv: number): void => {
      for (let i = from; i < to; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    };
    if (g.type === 'BoxGeometry' && uv.count === 24) {
      const w = p.width * s.x, h = p.height * s.y, d = p.depth * s.z;
      scale(0, 8, d / tile, h / tile); // the two ends
      scale(8, 16, w / tile, d / tile); // top and bottom
      scale(16, 24, w / tile, h / tile); // front and back
    } else if (g.type === 'PlaneGeometry') {
      scale(0, uv.count, (p.width * s.x) / tile, (p.height * s.y) / tile);
    } else if (g.type === 'CylinderGeometry') {
      const r = Math.max(p.radiusTop, p.radiusBottom) * Math.max(s.x, s.z);
      scale(0, uv.count, Math.max(1, Math.round((2 * Math.PI * r) / tile)), Math.max(0.25, (p.height * s.y) / tile));
    } else {
      g.computeBoundingBox();
      const b = g.boundingBox!;
      const across = Math.max((b.max.x - b.min.x) * s.x, (b.max.z - b.min.z) * s.z);
      scale(0, uv.count, Math.max(0.25, across / tile), Math.max(0.25, ((b.max.y - b.min.y) * s.y) / tile));
    }
    uv.needsUpdate = true;
  });
}

const detailMaps = new Map<string, { normal: THREE.Texture; orm: THREE.Texture }>();

/**
 * Surface detail only (normal and roughness), for things coloured some other way: clothes are
 * coloured per vertex, so they take a cloth's weave and sheen but not its colour. `repeat` is how
 * many times the set repeats across the UVs. The maps are shared by everything that asks the same.
 */
export function detail(m: THREE.MeshStandardMaterial, name: LibraryName, repeat: number, normal = 1): void {
  void loadSet(name).then((maps) => {
    if (!maps) return;
    const key = `${name}|${repeat}`;
    let d = detailMaps.get(key);
    if (!d) {
      const own = (t: THREE.Texture): THREE.Texture => {
        const c = t.clone();
        c.repeat.set(repeat, repeat);
        c.needsUpdate = true;
        return c;
      };
      d = { normal: own(maps.normal), orm: own(maps.orm) };
      detailMaps.set(key, d);
    }
    m.normalMap = d.normal;
    m.normalScale.set(normal, normal);
    m.roughnessMap = d.orm;
    m.roughness = 1;
    m.userData.lib = name;
    m.needsUpdate = true;
  });
}
