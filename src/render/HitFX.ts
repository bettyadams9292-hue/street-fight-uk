import * as THREE from 'three';

const CAPACITY = 400;

/**
 * Pooled particle bursts for impacts: warm sparks and sweat spray on clean
 * hits, cold flecks on blocks. One draw call for every particle.
 */
export class HitFX {
  readonly points: THREE.Points;
  private pos = new Float32Array(CAPACITY * 3);
  private col = new Float32Array(CAPACITY * 3);
  private vel = new Float32Array(CAPACITY * 3);
  private life = new Float32Array(CAPACITY);
  private maxLife = new Float32Array(CAPACITY);
  private base = new Float32Array(CAPACITY * 3);
  private cursor = 0;
  private geometry: THREE.BufferGeometry;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    for (let i = 0; i < CAPACITY; i++) this.pos[i * 3 + 1] = -100;
  }

  /** dir: which way the hit travelled along x (1 or -1). */
  burst(x: number, y: number, z: number, dir: number, kind: 'hit' | 'heavy' | 'block' | 'glint'): void {
    const count = kind === 'heavy' ? 46 : kind === 'hit' ? 26 : kind === 'glint' ? 14 : 18;
    const color = kind === 'block' ? [0.55, 0.75, 1.0] : kind === 'heavy' ? [1.0, 0.75, 0.4] : kind === 'glint' ? [1.0, 1.0, 1.0] : [1.0, 0.9, 0.7];
    // A glint barely moves: it hangs on the guard for a moment so it reads.
    const speed = kind === 'heavy' ? 4.2 : kind === 'glint' ? 0.5 : 2.8;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % CAPACITY;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      const spread = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = dir * s * (0.6 + Math.random() * 0.6) + Math.cos(spread) * s * 0.35;
      this.vel[i * 3 + 1] = Math.sin(spread) * s * 0.6 + (kind === 'glint' ? 0.9 : 0.8);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * s * 0.8;
      const l = kind === 'glint' ? 0.22 + Math.random() * 0.1 : 0.18 + Math.random() * 0.22;
      this.life[i] = l;
      this.maxLife[i] = l;
      const v = 0.75 + Math.random() * 0.25;
      this.base[i * 3] = color[0] * v;
      this.base[i * 3 + 1] = color[1] * v;
      this.base[i * 3 + 2] = color[2] * v;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < CAPACITY; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= 9 * dt;
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
