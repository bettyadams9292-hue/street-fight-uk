/**
 * Ground surfaces built from the city kit's own textures (concrete, asphalt,
 * dirt, marble, red brick, metal-edged concrete, street decals), laid out by a
 * shader in world space: paving slabs, granite plaza flags, block paviours,
 * setts, concrete yard panels and patched asphalt. No surface is one stretched
 * picture: each mixes a laying pattern (joints, per-stone colour and tilt), the
 * kit texture for grain, a second texture at a much larger scale for staining,
 * grime gathered along walls and kerbs, and wet patches that shine.
 */
import * as THREE from 'three';

export type Surface = 'paving' | 'flags' | 'paviours' | 'setts' | 'yard' | 'asphalt' | 'marble' | 'concrete' | 'dirt';

const TEX = '/models/city/tex/';
const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function tex(name: string, srgb: boolean): THREE.Texture {
  const hit = cache.get(name);
  if (hit) return hit;
  const t = loader.load(TEX + name + '.webp');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  cache.set(name, t);
  return t;
}

/** A kit texture (shared), for kerbs and other street furniture. */
export function kitGroundTexture(name: string, srgb: boolean): THREE.Texture {
  return tex(name, srgb);
}

/** Start loading every ground texture (resolves when they're in). */
export function loadFlooring(): Promise<void> {
  const names: [string, boolean][] = [
    ['T_Concrete_BaseColor', true], ['T_Concrete_Normal', false], ['T_Concrete_Asphalt_BaseColor', true],
    ['T_Dirt_BaseColor', true], ['T_Dirt_Normal', false], ['T_MarbleFloor_BaseColor', true], ['T_MarbleFloor_Normal', false],
    ['T_RedBrick_BaseColor', true], ['T_RedBrick_Normal', false], ['T_MetalConcrete_BaseColor', true], ['T_Street_Decals', true],
  ];
  return Promise.all(
    names.map(
      ([n, srgb]) =>
        new Promise<void>((res) => {
          if (cache.has(n)) return res();
          const t = loader.load(TEX + n + '.webp', () => res(), undefined, () => res());
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = 8;
          cache.set(n, t);
        }),
    ),
  ).then(() => undefined);
}

interface Recipe {
  /** Grain texture and its size on the ground (m per repeat). */
  grain: string;
  normal: string;
  scale: number;
  /** Laying pattern: 0 none, 1 slabs, 2 setts, 3 paviours (stretcher bond), 4 panels. */
  pattern: number;
  /** Stone size (m): along the street (x), across it (z). */
  cell: [number, number];
  /** Joint width (m). */
  joint: number;
  tint: string;
  /** How much each stone's colour varies. */
  vary: number;
  rough: number;
  /** Grain contrast (how strongly the texture shows). */
  grainMix: number;
}

const RECIPES: Record<Surface, Recipe> = {
  paving: { grain: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal', scale: 2.2, pattern: 1, cell: [0.9, 0.6], joint: 0.012, tint: '#8e8b86', vary: 0.12, rough: 0.86, grainMix: 0.7 },
  flags: { grain: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal', scale: 3.0, pattern: 1, cell: [1.2, 0.8], joint: 0.006, tint: '#6f7175', vary: 0.07, rough: 0.6, grainMix: 0.5 },
  paviours: { grain: 'T_RedBrick_BaseColor', normal: 'T_RedBrick_Normal', scale: 1.6, pattern: 3, cell: [0.2, 0.1], joint: 0.006, tint: '#a4644a', vary: 0.18, rough: 0.82, grainMix: 0.35 },
  setts: { grain: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal', scale: 1.2, pattern: 2, cell: [0.2, 0.13], joint: 0.018, tint: '#77726a', vary: 0.22, rough: 0.7, grainMix: 0.6 },
  yard: { grain: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal', scale: 3.5, pattern: 4, cell: [5, 4], joint: 0.01, tint: '#6c6a66', vary: 0.08, rough: 0.9, grainMix: 0.8 },
  concrete: { grain: 'T_Concrete_BaseColor', normal: 'T_Concrete_Normal', scale: 3.0, pattern: 4, cell: [3.6, 3.0], joint: 0.012, tint: '#7c7a75', vary: 0.1, rough: 0.92, grainMix: 0.85 },
  asphalt: { grain: 'T_Concrete_Asphalt_BaseColor', normal: 'T_Concrete_Normal', scale: 2.6, pattern: 0, cell: [1, 1], joint: 0, tint: '#4a4b4f', vary: 0, rough: 0.7, grainMix: 1 },
  marble: { grain: 'T_MarbleFloor_BaseColor', normal: 'T_MarbleFloor_Normal', scale: 2.4, pattern: 1, cell: [0.6, 0.6], joint: 0.003, tint: '#d8d0c2', vary: 0.05, rough: 0.25, grainMix: 0.9 },
  dirt: { grain: 'T_Dirt_BaseColor', normal: 'T_Dirt_Normal', scale: 3.0, pattern: 0, cell: [1, 1], joint: 0, tint: '#8a7a68', vary: 0, rough: 0.95, grainMix: 1 },
};

export interface SurfaceOptions {
  /** Colour multiplied in (district character: buff precinct, pale residential). */
  tint?: string;
  /** Where the building line is (z): grime gathers against it. */
  wallZ?: number;
  /** Where the kerb is (z): grime and wet gather along it. */
  kerbZ?: number;
  /** 0..1: how wet it is (rain). */
  wet?: number;
  /** Asphalt: tar-patched repairs and seams. */
  patches?: boolean;
  /** Painted parking bays (yard), every this many metres. */
  bays?: number;
  seed?: number;
}

const GLSL_HASH = /* glsl */ `
float sfHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sfHash(i), sfHash(i + vec2(1, 0)), u.x), mix(sfHash(i + vec2(0, 1)), sfHash(i + vec2(1, 1)), u.x), u.y);
}
float sfFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * sfNoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/** A ground material for a surface. Meshes using it should be flat (facing up). */
export function surfaceMaterial(kind: Surface, o: SurfaceOptions = {}): THREE.MeshStandardMaterial {
  const r = RECIPES[kind];
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.tint ?? '#ffffff'), roughness: r.rough, metalness: 0 });
  const grain = tex(r.grain, true);
  const normal = tex(r.normal, false);
  const stain = tex(kind === 'dirt' ? 'T_Concrete_BaseColor' : 'T_Dirt_BaseColor', true);
  const decals = tex('T_Street_Decals', true);
  mat.onBeforeCompile = (sh: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }) => {
    Object.assign(sh.uniforms, {
      sfGrain: { value: grain },
      sfNormal: { value: normal },
      sfStain: { value: stain },
      sfDecals: { value: decals },
      sfScale: { value: r.scale },
      sfCell: { value: new THREE.Vector2(r.cell[0], r.cell[1]) },
      sfJoint: { value: r.joint },
      sfTint: { value: new THREE.Color(r.tint) },
      sfVary: { value: r.vary },
      sfGrainMix: { value: r.grainMix },
      sfPattern: { value: r.pattern },
      sfWallZ: { value: o.wallZ ?? -1e4 },
      sfKerbZ: { value: o.kerbZ ?? 1e4 },
      sfWet: { value: o.wet ?? 0.5 },
      sfPatches: { value: o.patches ? 1 : 0 },
      sfBays: { value: o.bays ?? 0 },
      sfSeed: { value: (o.seed ?? 0) % 97 },
    });
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 sfWorld;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  sfWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 sfWorld;
uniform sampler2D sfGrain, sfNormal, sfStain, sfDecals;
uniform float sfScale, sfJoint, sfVary, sfGrainMix, sfPattern, sfWallZ, sfKerbZ, sfWet, sfPatches, sfBays, sfSeed;
uniform vec2 sfCell;
uniform vec3 sfTint;
${GLSL_HASH}
// Laying pattern: x = distance into the stone from its nearest joint (m), y = stone id, zw = position in the stone (0..1).
vec4 sfLay(vec2 p) {
  if (sfPattern < 0.5) return vec4(1.0, 0.0, 0.5, 0.5);
  vec2 c = sfCell;
  vec2 q = p / c;
  float row = floor(q.y);
  // Slabs and setts run in courses with the joints staggered; paviours in stretcher bond.
  if (sfPattern > 0.5 && sfPattern < 3.5) q.x += mod(row, 2.0) * 0.5 + (sfPattern > 1.5 && sfPattern < 2.5 ? sfHash(vec2(row, 7.0)) * 0.3 : 0.0);
  vec2 id = floor(q);
  vec2 f = fract(q);
  vec2 d = min(f, 1.0 - f) * c;
  return vec4(min(d.x, d.y), sfHash(id + sfSeed), f);
}
void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `
  vec2 wp = sfWorld.xz;
  vec4 lay = sfLay(wp);
  float stoneId = lay.y;
  // Grain from the kit texture, offset per stone so neighbouring stones don't match.
  vec2 guv = wp / sfScale + (sfPattern > 0.5 ? vec2(stoneId * 7.13, stoneId * 3.71) : vec2(0.0));
  vec3 g = texture2D(sfGrain, guv).rgb;
  float gl = dot(g, vec3(0.3333));
  vec3 base = sfTint * mix(vec3(1.0), g / max(0.05, gl) * gl * 2.0, sfGrainMix);
  // Each stone a slightly different colour and wear.
  base *= 1.0 + (stoneId - 0.5) * sfVary * 2.0;
  // Large-scale staining from a second texture, broken up by noise.
  float big = sfFbm(wp * 0.18 + sfSeed);
  vec3 st = texture2D(sfStain, wp / 11.0).rgb;
  base = mix(base, base * st * 1.6, smoothstep(0.45, 0.8, big) * 0.45);
  // Joints: dark, gritty, slightly mossy in the setts.
  float joint = 1.0 - smoothstep(sfJoint * 0.5, sfJoint, lay.x);
  vec3 jointCol = sfPattern > 1.5 && sfPattern < 2.5 ? vec3(0.13, 0.14, 0.11) : vec3(0.16, 0.16, 0.17);
  if (sfPattern > 0.5) base = mix(base, jointCol, joint * 0.9);
  // Setts are domed and worn shiny on top; slab edges chipped.
  float dome = sfPattern > 1.5 && sfPattern < 2.5 ? smoothstep(0.0, 0.05, lay.x) : 0.0;
  // Grime gathers against the walls and in the gutter.
  float wall = 1.0 - smoothstep(0.0, 0.9, sfWorld.z - sfWallZ);
  float kerb = 1.0 - smoothstep(0.0, 0.5, abs(sfWorld.z - sfKerbZ));
  float grime = clamp(wall * 0.55 + kerb * 0.45 + (sfFbm(wp * 1.7) - 0.55) * 0.6, 0.0, 1.0);
  base *= 1.0 - grime * 0.35;
  // Asphalt: tar-sealed cracks and patched repairs.
  if (sfPatches > 0.5) {
    vec2 pc = floor(wp / vec2(4.7, 2.3));
    float patchy = step(0.82, sfHash(pc + 3.1));
    vec2 pf = fract(wp / vec2(4.7, 2.3));
    float inPatch = patchy * step(0.15, pf.x) * step(pf.x, 0.85) * step(0.2, pf.y) * step(pf.y, 0.8);
    base *= 1.0 - inPatch * 0.22;
    float crack = smoothstep(0.03, 0.0, abs(sfNoise(wp * vec2(0.6, 2.2)) - 0.5)) * step(0.55, sfNoise(wp * 0.3));
    base = mix(base, vec3(0.05), crack * 0.6);
  }
  // Painted parking bays.
  if (sfBays > 0.0) {
    float bx = abs(fract(wp.x / sfBays) - 0.5) * sfBays;
    float line = step(sfBays * 0.5 - 0.06, bx) * step(sfWallZ + 0.8, sfWorld.z) * step(sfWorld.z, sfWallZ + 5.0);
    base = mix(base, vec3(0.75, 0.62, 0.22), line * (0.6 + 0.3 * sfNoise(wp * 6.0)));
  }
  // Wet: darker, and the low spots hold water.
  float puddle = smoothstep(0.62, 0.7, sfFbm(wp * 0.35 + 11.0)) * sfWet;
  float wetness = clamp(sfWet * 0.6 + puddle + kerb * sfWet * 0.5, 0.0, 1.0);
  base *= 1.0 - wetness * 0.28;
  diffuseColor.rgb *= base;
  float sfShine = wetness * 0.75 + dome * 0.12;
`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (1.0 - sfShine) + joint * 0.15, 0.04, 1.0);
  roughnessFactor = mix(roughnessFactor, 0.06, puddle);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  {
    vec3 tn = texture2D(sfNormal, guv).xyz * 2.0 - 1.0;
    float k = (1.0 - puddle) * 0.8;
    // World normal: grain, plus each stone tilted a little, plus a groove at the joints.
    vec3 nW = normalize(vec3(tn.x * k, 1.0, tn.y * k));
    if (sfPattern > 0.5) {
      float tilt = 0.035 * (sfPattern > 1.5 && sfPattern < 2.5 ? 2.5 : 1.0);
      vec2 rnd = vec2(fract(stoneId * 13.7), fract(stoneId * 71.3)) - 0.5;
      vec2 edge = (lay.zw - 0.5) * 2.0;
      nW = normalize(nW + vec3(rnd.x * tilt + edge.x * joint * 0.6 + dome * edge.x * 0.25, 0.0, rnd.y * tilt + edge.y * joint * 0.6 + dome * edge.y * 0.25));
    }
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }`,
      );
  };
  mat.customProgramCacheKey = () => `surface-${kind}`;
  return mat;
}
