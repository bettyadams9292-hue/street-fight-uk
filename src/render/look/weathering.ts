/**
 * City grime on top of any material: walls and street furniture get dirtier
 * towards the pavement (splash-back), rain streaks run down from ledges (the
 * kit's drip noise), and large, slow colour variation stops a repeated texture
 * reading as wallpaper. Works in world space, on instanced meshes too, and
 * keeps the material's own maps.
 */
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let drips: THREE.Texture | null = null;
function dripTexture(): THREE.Texture {
  if (drips) return drips;
  const t = loader.load('/models/city/tex/T_Noise_Drips.webp');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  drips = t;
  return t;
}

export interface WeatherOptions {
  /** 0..1 overall dirt. */
  dirt?: number;
  /** Rain streak strength. */
  streaks?: number;
  /** Height (m) the splash-back grime reaches. */
  splash?: number;
}

type Shader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };

/** Add weathering to a material (once; safe to call again). */
export function weather(mat: THREE.Material, o: WeatherOptions = {}): void {
  const m = mat as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial || m.userData.weathered) return;
  m.userData.weathered = true;
  const prev = m.onBeforeCompile;
  const tex = dripTexture();
  m.onBeforeCompile = (sh: Shader, r: THREE.WebGLRenderer) => {
    prev?.call(m, sh as never, r);
    sh.uniforms.wxDrips = { value: tex };
    sh.uniforms.wxDirt = { value: o.dirt ?? 0.6 };
    sh.uniforms.wxStreaks = { value: o.streaks ?? 0.5 };
    sh.uniforms.wxSplash = { value: o.splash ?? 0.9 };
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 wxWorld;\nvoid main() {').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
  {
    vec4 wxp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wxp = instanceMatrix * wxp;
    #endif
    wxWorld = (modelMatrix * wxp).xyz;
  }`,
    );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 wxWorld;
uniform sampler2D wxDrips;
uniform float wxDirt, wxStreaks, wxSplash;
float wxHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wxHash(i), wxHash(i + vec2(1, 0)), u.x), mix(wxHash(i + vec2(0, 1)), wxHash(i + vec2(1, 1)), u.x), u.y);
}
void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  {
    // Along the wall: x and z both run along it, depending on which way it faces.
    float along = wxWorld.x + wxWorld.z;
    float macro = wxNoise(vec2(along * 0.12, wxWorld.y * 0.2)) * 0.6 + wxNoise(vec2(along * 0.5, wxWorld.y * 0.6)) * 0.4;
    diffuseColor.rgb *= 0.9 + 0.2 * macro;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.88, 0.8), wxDirt * smoothstep(0.4, 0.8, macro) * 0.5);
    // Splash-back and kicked-up dirt near the pavement.
    float low = 1.0 - smoothstep(0.0, wxSplash, wxWorld.y);
    float splash = low * (0.6 + 0.4 * wxNoise(vec2(along * 3.0, wxWorld.y * 9.0)));
    diffuseColor.rgb *= 1.0 - splash * 0.45 * wxDirt;
    // Rain streaks running down, in patches.
    float d = texture2D(wxDrips, vec2(along * 0.22, wxWorld.y * 0.16)).r;
    float patchy = smoothstep(0.45, 0.75, wxNoise(vec2(along * 0.3, 3.7)));
    diffuseColor.rgb *= 1.0 - (1.0 - d) * patchy * wxStreaks * 0.55;
  }`,
      );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|weathered';
  m.needsUpdate = true;
}
