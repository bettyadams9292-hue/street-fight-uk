/**
 * Real surfaces for the low-poly kit streets.
 *
 * A kit street is one merged mesh coloured per vertex, with no texture coordinates, so the
 * library's textures are laid on by where each point is in the world:
 * - the road (dark, flat, at ground level) gets an asphalt set;
 * - pavements, yards and other flat ground get concrete;
 * - walls the colour of brick get a brick set, laid in courses up the wall.
 * The kit's own colours stay: each texture is divided by its average colour, so it brings the
 * grain, cracks and mortar lines without repainting the street. Each district picks its asphalt
 * and its brick by seed, so neighbouring districts differ. Painted and rendered walls, shop
 * fronts, roofs and street furniture are left as the kit made them.
 */
import * as THREE from 'three';
import { LIBRARY, type LibraryName } from './catalogue';
import { loadSet, pick } from './library';

const ROADS: LibraryName[] = ['Road012A', 'Road012B', 'Road012C', 'Road014B', 'Road014C', 'Road015A'];
const STREET_BRICKS: LibraryName[] = ['Bricks005', 'Bricks097', 'Bricks007', 'Bricks070'];
const PAVES: LibraryName[] = ['Concrete034'];
/** The grain of rendered and painted walls: a fine concrete, laid faintly under the wall's own colour. */
const RENDER: LibraryName = 'Concrete034';
/** Paving with real joints, chosen by the kind of ground the district has (see GroundKind in city/street.ts). */
const PAVING_BY_GROUND: Record<string, LibraryName> = {
  street: 'PavingStones109', // grey small-block high-street pavement
  suburb: 'PavingStones036', // grey block paving
  // Precincts and the market: red and grey block paving. The chevron set (PavingStones102) read as a black and
  // white checkerboard from the game's camera: the "black squares" reported at the market.
  plaza: 'PavingStones092',
  lane: 'PavingStones083', // wet herringbone setts
  yard: 'PavingStones036',
  quay: 'PavingStones036',
};

let blank: { colour: THREE.Texture; normal: THREE.Texture } | null = null;
function blanks(): { colour: THREE.Texture; normal: THREE.Texture } {
  if (!blank) {
    const one = (r: number, g: number, b: number): THREE.DataTexture => {
      const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
      t.needsUpdate = true;
      return t;
    };
    blank = { colour: one(255, 255, 255), normal: one(128, 128, 255) };
  }
  return blank;
}

/** Give a kit street's solid material its world-laid surfaces. `seed` chooses the district's asphalt and brick. */
export function streetDetail(mat: THREE.MeshStandardMaterial, seed: number, ground?: string): void {
  const sets = [pick(ROADS, seed), (ground && PAVING_BY_GROUND[ground]) || pick(PAVES, seed >> 3), pick(STREET_BRICKS, seed >> 5), RENDER];
  const b = blanks();
  const u = {
    sdC: { value: [b.colour, b.colour, b.colour, b.colour] as THREE.Texture[] },
    sdN: { value: [b.normal, b.normal, b.normal, b.normal] as THREE.Texture[] },
    // Until a set arrives its "average" is white, so the blank texture changes nothing.
    sdAvg: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] },
    sdTile: { value: new THREE.Vector4(LIBRARY[sets[0]].tile, LIBRARY[sets[1]].tile, LIBRARY[sets[2]].tile, LIBRARY[sets[3]].tile) },
    // The brick's own colour (its average), for house walls painted another colour by the kit.
    sdBrickRaw: { value: new THREE.Vector3(0.24, 0.15, 0.1) },
  };
  sets.forEach((name, i) => {
    void loadSet(name).then((maps) => {
      if (!maps) return;
      u.sdC.value[i] = maps.colour;
      u.sdN.value[i] = maps.normal;
      const a = LIBRARY[name].avg;
      // The colour texture is read as sRGB and decoded to linear, the same space as the averages.
      u.sdAvg.value[i].set(Math.max(0.02, a[0]), Math.max(0.02, a[1]), Math.max(0.02, a[2]));
      if (i === 2) u.sdBrickRaw.value.set(a[0], a[1], a[2]);
    });
  });
  mat.userData.lib = sets.join('+');
  mat.onBeforeCompile = (sh: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute float sdWall;\nvarying float sdWallV;\nvarying vec3 sdWorld;\nvarying vec3 sdNormal;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  sdWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  sdNormal = normalize(mat3(modelMatrix) * objectNormal);\n  sdWallV = sdWall;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        `varying float sdWallV;
varying vec3 sdWorld;
varying vec3 sdNormal;
uniform sampler2D sdC[4];
uniform sampler2D sdN[4];
uniform vec3 sdAvg[4];
uniform vec4 sdTile;
uniform vec3 sdBrickRaw;
float sdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Smooth value noise, 0..1: soft variation across the street so no two stretches of paving or tarmac look the same.
float sdNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sdHash(i), sdHash(i + vec2(1.0, 0.0)), f.x), mix(sdHash(i + vec2(0.0, 1.0)), sdHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
bool sdFlat = false;
void main() {
  vec3 sdTn = vec3(0.0, 0.0, 1.0);
  vec3 sdT = vec3(1.0, 0.0, 0.0);
  vec3 sdB = vec3(0.0, 0.0, 1.0);
  float sdK = 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  {
    // A normal that interpolates to nothing (opposite normals across a thin face) would normalise to NaN and
    // draw black: fall back to up.
    vec3 n = dot(sdNormal, sdNormal) > 1e-6 ? normalize(sdNormal) : vec3(0.0, 1.0, 0.0);
    float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    // Every lookup is made for every pixel (so the texture filtering is right at the joins), then one is chosen.
    vec2 gUV = sdWorld.xz;
    bool alongZ = abs(n.x) > 0.5;
    vec2 wUV = vec2(alongZ ? sdWorld.z : sdWorld.x, sdWorld.y);
    // Tarmac has no joints, so two lookups at different scales and angles are blended by a slow noise: the repeat
    // of one tile can't be seen. Paving keeps its joints (one lookup) but every few metres is a shade lighter or darker.
    vec2 rUV2 = mat2(0.8, -0.6, 0.6, 0.8) * gUV * 0.61 + vec2(17.3, 5.1);
    float rMix = smoothstep(0.25, 0.75, sdNoise(gUV / 9.0));
    vec3 road = mix(texture2D(sdC[0], gUV / sdTile.x).rgb, texture2D(sdC[0], rUV2 / sdTile.x).rgb, rMix) / sdAvg[0];
    road *= 0.9 + 0.2 * sdNoise(gUV / 23.0 + 3.7);
    vec3 pave = texture2D(sdC[1], gUV / sdTile.y).rgb / sdAvg[1];
    pave *= 0.92 + 0.16 * sdNoise(gUV / 6.5 + 1.3);
    vec3 brick = texture2D(sdC[2], wUV / sdTile.z).rgb / sdAvg[2];
    vec3 roadN = texture2D(sdN[0], gUV / sdTile.x).xyz * 2.0 - 1.0;
    vec3 paveN = texture2D(sdN[1], gUV / sdTile.y).xyz * 2.0 - 1.0;
    vec3 brickN = texture2D(sdN[2], wUV / sdTile.z).xyz * 2.0 - 1.0;
    vec3 rend = texture2D(sdC[3], wUV / sdTile.w).rgb / sdAvg[3];
    vec3 rendN = texture2D(sdN[3], wUV / sdTile.w).xyz * 2.0 - 1.0;
    vec3 d = vec3(1.0);
    // Ground: the flat tops and the bevelled joints between the kit's paving slabs alike (the joints lit up as a
    // grid of light lines), so the pavement reads as one surface.
    if (n.y > 0.25 && sdWorld.y < 0.4) {
      sdFlat = true;
      // Flat ground: the dark carriageway is asphalt, the rest concrete.
      if (lum < 0.05) { d = road; sdTn = roadN; sdK = 0.9; }
      else {
        d = pave; sdTn = paveN; sdK = 0.8;
        // The kit's plaza tiles are painted as a light and dark checkerboard. Under real paving that reads as
        // big black squares, so greys are evened out to one brightness (the district's tint survives; coloured
        // paint such as yellow lines doesn't count as grey and is left alone).
        vec3 c0 = diffuseColor.rgb;
        float hi = max(c0.r, max(c0.g, c0.b));
        float sat = hi > 0.0 ? (hi - min(c0.r, min(c0.g, c0.b))) / hi : 0.0;
        if (sat < 0.3) diffuseColor.rgb *= clamp(0.2 / max(lum, 0.02), 0.5, 3.0);
      }
    } else if (abs(n.y) < 0.3) {
      // Building walls the colour of brick are brick. Awnings, signs and shop panels (props) never are,
      // however red they are.
      vec3 c = diffuseColor.rgb;
      sdT = alongZ ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
      sdB = vec3(0.0, 1.0, 0.0);
      float hi = max(c.r, max(c.g, c.b));
      float sat = hi > 0.0 ? (hi - min(c.r, min(c.g, c.b))) / hi : 0.0;
      bool brickColour = c.r > c.g * 1.3 && c.r > c.b * 1.45 && lum > 0.012 && lum < 0.3;
      // A house wall painted a warm colour (the kit's clapboard tans and peaches) is brick, in brick's own colour;
      // white and grey trim stays as it is.
      bool houseWall = sdWallV > 1.5 && c.r >= c.g && c.g >= c.b * 0.95 && sat > 0.12 && lum > 0.1 && lum < 0.7;
      if (sdWallV > 0.5 && (brickColour || houseWall)) {
        if (houseWall && !brickColour) diffuseColor.rgb = sdBrickRaw * (0.9 + 0.2 * sdNoise(wUV / 5.0));
        d = brick; sdTn = brickN; sdK = 0.75;
      } else if (sdWallV > 0.5) {
        // Rendered and painted walls: their own colour, with a render's fine grain and unevenness.
        d = mix(vec3(1.0), rend, 0.45); sdTn = rendN * 0.5; sdK = 1.0;
      }
    }
    diffuseColor.rgb *= mix(vec3(1.0), clamp(d, 0.0, 2.5), sdK);
  }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  if (sdK > 0.0) {
    vec3 sdN0 = sdFlat || dot(sdNormal, sdNormal) <= 1e-6 ? vec3(0.0, 1.0, 0.0) : normalize(sdNormal);
    vec3 nW = sdN0 + (sdT * sdTn.x + sdB * sdTn.y) * 0.9;
    nW = dot(nW, nW) > 1e-6 ? normalize(nW) : sdN0;
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }`,
      );
  };
  mat.customProgramCacheKey = () => 'kit-street-detail-3';
  mat.needsUpdate = true;
}
