import * as THREE from 'three';
import { FX_CELLS, textureImage } from './textureFiles';

const CAPACITY = 400;

/**
 * Pooled particle bursts for impacts: warm sparks and sweat spray on clean
 * hits, cold flecks on blocks. One draw call for every particle.
 *
 * Once public/textures/fx/particles.webp has loaded, each particle is a sprite
 * from that atlas (spark, star burst, shard, glint, warning ring, droplet) at
 * its own size; until then (or without the file) they're the old square dots.
 */
const cellOf = (k: (typeof FX_CELLS)[number]) => FX_CELLS.indexOf(k);
export class HitFX {
  readonly points: THREE.Points;
  private pos = new Float32Array(CAPACITY * 3);
  private col = new Float32Array(CAPACITY * 3);
  private vel = new Float32Array(CAPACITY * 3);
  private life = new Float32Array(CAPACITY);
  private maxLife = new Float32Array(CAPACITY);
  private base = new Float32Array(CAPACITY * 3);
  private cell = new Float32Array(CAPACITY);
  private size = new Float32Array(CAPACITY).fill(1);
  private material: THREE.PointsMaterial;
  private textured = false;
  private cursor = 0;
  private geometry: THREE.BufferGeometry;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geometry.setAttribute('fxCell', new THREE.BufferAttribute(this.cell, 1));
    this.geometry.setAttribute('fxSize', new THREE.BufferAttribute(this.size, 1));
    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    // Each point its own size and its own cell of the atlas (4 × 2 cells).
    material.onBeforeCompile = (sh: { vertexShader: string; fragmentShader: string }) => {
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'attribute float fxCell;\nattribute float fxSize;\nvarying float vFxCell;\nvoid main() {')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * fxSize;\n\tvFxCell = fxCell;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vFxCell;\nvoid main() {').replace(
        '#include <map_particle_fragment>',
        `#ifdef USE_MAP
  vec2 fxUv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
  fxUv = (fxUv + vec2(mod(vFxCell, 4.0), 1.0 - floor(vFxCell / 4.0))) * vec2(0.25, 0.5);
  diffuseColor *= texture2D(map, fxUv);
#endif`,
      );
    };
    material.customProgramCacheKey = () => 'hitfx';
    this.material = material;
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    for (let i = 0; i < CAPACITY; i++) this.pos[i * 3 + 1] = -100;
  }

  /** dir: which way the hit travelled along x (1 or -1). */
  /** Use the sprite atlas once it has loaded. */
  private useAtlas(): void {
    if (this.textured) return;
    const img = textureImage('fx/particles');
    if (!img) return;
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    this.material.map = t;
    this.material.size = 0.3;
    this.material.needsUpdate = true;
    this.textured = true;
  }

  burst(x: number, y: number, z: number, dir: number, kind: 'hit' | 'heavy' | 'block' | 'glint' | 'danger'): void {
    this.useAtlas();
    const hangs = kind === 'glint' || kind === 'danger';
    const count = kind === 'heavy' ? 46 : kind === 'hit' ? 26 : kind === 'glint' ? 14 : kind === 'danger' ? 18 : 18;
    const color = kind === 'block' ? [0.55, 0.75, 1.0] : kind === 'heavy' ? [1.0, 0.75, 0.4] : kind === 'glint' ? [1.0, 1.0, 1.0] : kind === 'danger' ? [1.0, 0.18, 0.12] : [1.0, 0.9, 0.7];
    // A glint (parry coming) or a danger flash (big shot coming) barely moves: it hangs a moment so it reads.
    const speed = kind === 'heavy' ? 4.2 : hangs ? 0.5 : 2.8;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % CAPACITY;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      const spread = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = dir * s * (0.6 + Math.random() * 0.6) + Math.cos(spread) * s * 0.35;
      this.vel[i * 3 + 1] = Math.sin(spread) * s * 0.6 + (hangs ? 0.9 : 0.8);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * s * 0.8;
      const l = hangs ? 0.24 + Math.random() * 0.12 : 0.18 + Math.random() * 0.22;
      this.life[i] = l;
      this.maxLife[i] = l;
      const v = 0.75 + Math.random() * 0.25;
      this.base[i * 3] = color[0] * v;
      this.base[i * 3 + 1] = color[1] * v;
      this.base[i * 3 + 2] = color[2] * v;
      // Sprite and size: the first particle of a burst is its centrepiece (flare, star, ring), the rest sparks.
      const lead = n === 0;
      const [c, sz] =
        kind === 'heavy' ? (lead ? ['heavy', 4] : n % 5 === 0 ? ['drop', 0.6] : ['hit', 0.9 + Math.random() * 0.5])
        : kind === 'hit' ? (lead ? ['hit', 3] : n % 4 === 0 ? ['drop', 0.5] : ['hit', 0.6 + Math.random() * 0.5])
        : kind === 'block' ? (lead ? ['block', 2] : ['block', 0.5 + Math.random() * 0.4])
        : kind === 'glint' ? (lead ? ['glint', 5] : ['glint', 0.6 + Math.random() * 0.6])
        : lead ? ['danger', 3.2] : ['dot', 0.6 + Math.random() * 0.4];
      this.cell[i] = cellOf(c as (typeof FX_CELLS)[number]);
      this.size[i] = this.textured ? (sz as number) : 1;
      if (this.textured && lead) {
        // The centrepiece stays where the hit landed and lasts a moment longer.
        this.vel[i * 3] = this.vel[i * 3 + 1] = this.vel[i * 3 + 2] = 0;
        this.life[i] = this.maxLife[i] = kind === 'danger' || kind === 'glint' ? 0.32 : 0.16;
      }
    }
    (this.geometry.getAttribute('fxCell') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('fxSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < CAPACITY; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      if (this.vel[i * 3] !== 0 || this.vel[i * 3 + 1] !== 0) this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // Additive blending: fading to black fades out.
      this.col[i * 3] = this.base[i * 3] * k;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * k;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -100;
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
