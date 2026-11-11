/**
 * Draws the scene through a look (looks.ts): environment reflections, bloom and
 * a colour grade. GameRenderer only builds one of these when a look is chosen;
 * otherwise the scene is drawn directly, exactly as before.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EnvSpec, Look, RGB } from './looks';

const col = (c: RGB): THREE.Color => new THREE.Color(c[0], c[1], c[2]);
const vec = (c: RGB): THREE.Vector3 => new THREE.Vector3(c[0], c[1], c[2]);

/** The final colour grade. Runs after tone mapping, on the picture as the screen will show it. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uTime: { value: 0 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uShadowTint: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uHighlightTint: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uTintAmount: { value: 0 },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uEdges: { value: 0 },
    uPosterize: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uTime;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uTintAmount;
    uniform vec3 uLift;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uEdges;
    uniform float uPosterize;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      // Ink lines: where brightness changes sharply between neighbours.
      if (uEdges > 0.0) {
        vec2 t = uTexel * 1.25;
        float l00 = luma(texture2D(tDiffuse, vUv + vec2(-t.x, -t.y)).rgb);
        float l10 = luma(texture2D(tDiffuse, vUv + vec2( t.x, -t.y)).rgb);
        float l01 = luma(texture2D(tDiffuse, vUv + vec2(-t.x,  t.y)).rgb);
        float l11 = luma(texture2D(tDiffuse, vUv + vec2( t.x,  t.y)).rgb);
        float e = abs(l00 - l11) + abs(l10 - l01);
        c *= 1.0 - uEdges * smoothstep(0.16, 0.42, e);
      }

      float l = luma(c);
      c += (mix(uShadowTint, uHighlightTint, smoothstep(0.0, 0.9, l)) - 0.5) * uTintAmount * (0.35 + 0.65 * sin(3.14159 * clamp(l, 0.0, 1.0)) + 0.25 * (1.0 - l));
      c = (c - 0.5) * uContrast + 0.5;
      c = mix(vec3(luma(c)), c, uSaturation);
      c = max(c, 0.0);

      if (uPosterize > 0.0) {
        vec3 stepped = floor(c * uPosterize + 0.5) / uPosterize;
        c = mix(c, stepped, 0.5);
      }

      c = c + uLift * (1.0 - c);

      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - uVignette * smoothstep(0.32, 0.82, d);

      if (uGrain > 0.0) {
        float n = hash(vUv / uTexel + fract(uTime * 7.0) * 61.0) - 0.5;
        c += n * uGrain * (1.0 - 0.6 * l);
      }

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class PostFX {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly pmrem: THREE.PMREMGenerator;
  private envOut: THREE.Texture | null = null;
  private envIn: THREE.Texture | null = null;
  private readonly baseExposure: number;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    camera: THREE.Camera,
    readonly look: Look,
    antialias: boolean,
  ) {
    this.baseExposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = this.baseExposure * look.grade.exposure;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: antialias ? 4 : 0 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), look.bloom.strength, look.bloom.radius, look.bloom.threshold);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);

    const g = look.grade;
    const u = this.grade.uniforms;
    u.uContrast.value = g.contrast;
    u.uSaturation.value = g.saturation;
    u.uShadowTint.value = vec(g.shadowTint);
    u.uHighlightTint.value = vec(g.highlightTint);
    u.uTintAmount.value = g.tintAmount;
    u.uLift.value = vec(g.lift);
    u.uVignette.value = g.vignette;
    u.uGrain.value = g.grain;
    u.uEdges.value = g.edges;
    u.uPosterize.value = g.posterize;
    u.uTexel.value = new THREE.Vector2(1 / size.x, 1 / size.y);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.setInterior(false);
  }

  /** Reflect the street or a room. */
  setInterior(interior: boolean): void {
    const spec = interior ? this.look.indoors : this.look.outdoors;
    if (interior) this.envIn ??= this.bake(spec);
    else this.envOut ??= this.bake(spec);
    this.scene.environment = interior ? this.envIn : this.envOut;
    this.scene.environmentIntensity = spec.intensity;
  }

  /** A tiny scene of sky, ground and glowing panels, blurred into a reflection map. */
  private bake(spec: EnvSpec): THREE.Texture {
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { uSky: { value: col(spec.sky) }, uHorizon: { value: col(spec.horizon) }, uGround: { value: col(spec.ground) } },
        vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uGround; varying vec3 vDir; void main() { float h = normalize(vDir).y; vec3 c = h > 0.0 ? mix(uHorizon, uSky, smoothstep(0.0, 0.55, h)) : mix(uHorizon, uGround, smoothstep(0.0, 0.25, -h)); gl_FragColor = vec4(c, 1.0); }',
      }),
    );
    env.add(sky);
    for (const p of spec.panels) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.size[0], p.size[1]), new THREE.MeshBasicMaterial({ color: col(p.color).multiplyScalar(p.power), side: THREE.DoubleSide }));
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      m.lookAt(0, 1, 0);
      env.add(m);
    }
    const tex = this.pmrem.fromScene(env, 0.035).texture;
    env.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) (mesh.material as THREE.Material).dispose();
    });
    return tex;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.grade.uniforms.uTexel.value = new THREE.Vector2(1 / Math.max(1, width * pixelRatio), 1 / Math.max(1, height * pixelRatio));
  }

  render(camera: THREE.Camera, time: number): void {
    this.renderPass.camera = camera;
    this.grade.uniforms.uTime.value = time;
    this.composer.render();
  }

  dispose(): void {
    this.renderer.toneMappingExposure = this.baseExposure;
    this.scene.environment = null;
    this.envOut?.dispose();
    this.envIn?.dispose();
    this.pmrem.dispose();
    this.composer.dispose();
  }
}
