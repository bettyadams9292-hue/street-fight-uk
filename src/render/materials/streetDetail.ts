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
/** Paving with real joints, chosen by the kind of ground the district has (see GroundKind in city/street.ts). */
const PAVING_BY_GROUND: Record<string, LibraryName> = {
  street: 'PavingStones109', // grey small-block high-street pavement
  suburb: 'PavingStones036', // grey block paving
  plaza: 'PavingStones102', // chevron precinct paving
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
  const sets = [pick(ROADS, seed), (ground && PAVING_BY_GROUND[ground]) || pick(PAVES, seed >> 3), pick(STREET_BRICKS, seed >> 5)];
  const b = blanks();
  const u = {
    sdC: { value: [b.colour, b.colour, b.colour] as THREE.Texture[] },
    sdN: { value: [b.normal, b.normal, b.normal] as THREE.Texture[] },
    // Until a set arrives its "average" is white, so the blank texture changes nothing.
    sdAvg: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] },
    sdTile: { value: new THREE.Vector3(LIBRARY[sets[0]].tile, LIBRARY[sets[1]].tile, LIBRARY[sets[2]].tile) },
  };
  sets.forEach((name, i) => {
    void loadSet(name).then((maps) => {
      if (!maps) return;
      u.sdC.value[i] = maps.colour;
      u.sdN.value[i] = maps.normal;
      const a = LIBRARY[name].avg;
      // The colour texture is read as sRGB and decoded to linear, the same space as the averages.
      u.sdAvg.value[i].set(Math.max(0.02, a[0]), Math.max(0.02, a[1]), Math.max(0.02, a[2]));
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
uniform sampler2D sdC[3];
uniform sampler2D sdN[3];
uniform vec3 sdAvg[3];
uniform vec3 sdTile;
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
    vec3 n = normalize(sdNormal);
    float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    // Every lookup is made for every pixel (so the texture filtering is right at the joins), then one is chosen.
    vec2 gUV = sdWorld.xz;
    bool alongZ = abs(n.x) > 0.5;
    vec2 wUV = vec2(alongZ ? sdWorld.z : sdWorld.x, sdWorld.y);
    vec3 road = texture2D(sdC[0], gUV / sdTile.x).rgb / sdAvg[0];
    vec3 pave = texture2D(sdC[1], gUV / sdTile.y).rgb / sdAvg[1];
    vec3 brick = texture2D(sdC[2], wUV / sdTile.z).rgb / sdAvg[2];
    vec3 roadN = texture2D(sdN[0], gUV / sdTile.x).xyz * 2.0 - 1.0;
    vec3 paveN = texture2D(sdN[1], gUV / sdTile.y).xyz * 2.0 - 1.0;
    vec3 brickN = texture2D(sdN[2], wUV / sdTile.z).xyz * 2.0 - 1.0;
    vec3 d = vec3(1.0);
    if (n.y > 0.7 && sdWorld.y < 0.4) {
      // Flat ground: the dark carriageway is asphalt, the rest concrete.
      if (lum < 0.05) { d = road; sdTn = roadN; sdK = 0.9; }
      else { d = pave; sdTn = paveN; sdK = 0.8; }
    } else if (abs(n.y) < 0.3) {
      // Building walls the colour of brick are brick. Awnings, signs and shop panels (props) never are,
      // however red they are.
      vec3 c = diffuseColor.rgb;
      if (sdWallV > 0.5 && c.r > c.g * 1.3 && c.r > c.b * 1.45 && lum > 0.012 && lum < 0.3) {
        d = brick; sdTn = brickN; sdK = 0.75;
        sdT = alongZ ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        sdB = vec3(0.0, 1.0, 0.0);
      }
    }
    diffuseColor.rgb *= mix(vec3(1.0), clamp(d, 0.0, 2.5), sdK);
  }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  if (sdK > 0.0) {
    vec3 nW = normalize(normalize(sdNormal) + (sdT * sdTn.x + sdB * sdTn.y) * 0.9);
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }`,
      );
  };
  mat.customProgramCacheKey = () => 'kit-street-detail';
  mat.needsUpdate = true;
}
