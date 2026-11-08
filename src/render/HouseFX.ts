import * as THREE from 'three';

/**
 * Little bits of life for the house's activities: the fridge door swinging
 * open with the light on inside, a pan on the hob with steam coming off it,
 * the oven glowing, a chopping board, a plate on the table, water from the
 * shower and the taps, steam in the bathroom, the shower curtain drawn.
 */
export type HouseFxSpec =
  | { kind: 'water'; x: number; z: number; top: number; bottom: number; spread: number }
  | { kind: 'tap'; x: number; y: number; z: number }
  | { kind: 'steam'; x: number; y: number; z: number; spread: number; amount?: number }
  | { kind: 'curtain'; x0: number; x1: number; z: number; y0: number; y1: number; colour: string }
  | { kind: 'door'; x: number; y: number; z: number; w: number; h: number; hinge: 'left' | 'right'; colour: string; light?: boolean; open?: number }
  | { kind: 'pan'; x: number; y: number; z: number; colour: string }
  | { kind: 'oven'; x: number; y: number; z: number }
  | { kind: 'plate'; x: number; y: number; z: number; colour: string }
  | { kind: 'board'; x: number; y: number; z: number; colour: string };

interface Particles {
  points: THREE.Points;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  spec: HouseFxSpec;
}

interface Entry {
  group: THREE.Group;
  particles: Particles | null;
  /** Doors swing open over a moment. */
  door?: { pivot: THREE.Group; target: number; sign: number };
  glow?: THREE.Mesh;
}

export class HouseFX {
  readonly group = new THREE.Group();
  private entries = new Map<string, Entry>();
  private time = 0;

  set(key: string, spec: HouseFxSpec | null): void {
    const old = this.entries.get(key);
    if (old) {
      // A door closing: swing it shut first, then remove.
      if (!spec && old.door) {
        old.door.target = 0;
        this.closing.set(key, old);
        this.entries.delete(key);
        return;
      }
      this.remove(key);
    }
    if (!spec) return;
    const e = this.build(spec);
    this.group.add(e.group);
    this.entries.set(key, e);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  private closing = new Map<string, Entry>();

  private remove(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    this.dispose(e);
    this.entries.delete(key);
  }

  private dispose(e: Entry): void {
    this.group.remove(e.group);
    e.group.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }

  clear(): void {
    for (const k of [...this.entries.keys()]) this.remove(k);
    for (const e of this.closing.values()) this.dispose(e);
    this.closing.clear();
  }

  private build(spec: HouseFxSpec): Entry {
    const g = new THREE.Group();
    const mat = (c: string | number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...extra });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = g) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const cyl = (r: number, h: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), m);
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    const e: Entry = { group: g, particles: null };
    switch (spec.kind) {
      case 'water':
        e.particles = this.particles(spec, 140, 0xb8dcff, 0.035, 0.75);
        break;
      case 'tap':
        e.particles = this.particles(spec, 40, 0xc8e4ff, 0.022, 0.85);
        break;
      case 'steam':
        e.particles = this.particles(spec, spec.amount ?? 40, 0xffffff, 0.16, 0.16);
        break;
      case 'curtain': {
        const w = spec.x1 - spec.x0;
        const h = spec.y1 - spec.y0;
        // Folds: a few slightly angled panels.
        const n = 7;
        const m = mat(spec.colour, { transparent: true, opacity: 0.86, side: THREE.DoubleSide, roughness: 0.9 });
        for (let i = 0; i < n; i++) {
          const p = box(w / n + 0.02, h, 0.01, spec.x0 + (w / n) * (i + 0.5), spec.y0 + h / 2, spec.z + (i % 2 ? 0.025 : -0.025), m);
          p.rotation.y = i % 2 ? 0.18 : -0.18;
        }
        box(w + 0.1, 0.02, 0.02, spec.x0 + w / 2, spec.y1 + 0.02, spec.z, mat('#d8d8d8', { metalness: 1, roughness: 0.2 }));
        break;
      }
      case 'door': {
        const pivot = new THREE.Group();
        const hingeX = spec.hinge === 'left' ? spec.x - spec.w / 2 : spec.x + spec.w / 2;
        pivot.position.set(hingeX, spec.y, spec.z);
        g.add(pivot);
        const dx = spec.hinge === 'left' ? spec.w / 2 : -spec.w / 2;
        box(spec.w, spec.h, 0.04, dx, 0, 0.02, mat(spec.colour, { roughness: 0.35 }), pivot);
        // Shelves on the inside of the door (fridge).
        if (spec.light) for (const y of [-0.45, 0, 0.45]) box(spec.w * 0.8, 0.03, 0.08, dx, y, -0.03, mat('#f4f4f4'), pivot);
        if (spec.light) {
          // The light inside, and a glimpse of food on the shelves.
          const inside = box(spec.w * 0.9, spec.h * 0.9, 0.01, spec.x, spec.y, spec.z + 0.006, mat('#f8fbff', { emissive: 0xdde8ff, emissiveIntensity: 0.9 }));
          const food = ['#e04030', '#f0c040', '#5ab040', '#f8f8f4', '#d86a5a'];
          food.forEach((c, i) => box(0.09, 0.1, 0.02, spec.x - spec.w * 0.3 + i * spec.w * 0.15, spec.y + (i % 2 ? 0.25 : -0.2), spec.z + 0.015, mat(c), g));
          e.glow = inside;
        }
        e.door = { pivot, target: (spec.open ?? 1.75) * (spec.hinge === 'left' ? -1 : 1), sign: spec.hinge === 'left' ? -1 : 1 };
        break;
      }
      case 'pan': {
        cyl(0.14, 0.07, spec.x, spec.y + 0.035, spec.z, mat('#2a2a2e', { metalness: 0.7, roughness: 0.35 }));
        const food = cyl(0.12, 0.01, spec.x, spec.y + 0.07, spec.z, mat(spec.colour, { roughness: 0.8 }));
        food.name = 'food';
        box(0.25, 0.025, 0.03, spec.x + 0.25, spec.y + 0.06, spec.z, mat('#1a1a1a'));
        // The ring glowing under it.
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff4a1a }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(spec.x, spec.y + 0.003, spec.z);
        g.add(ring);
        e.particles = this.particles({ kind: 'steam', x: spec.x, y: spec.y + 0.1, z: spec.z, spread: 0.1, amount: 24 }, 24, 0xffffff, 0.12, 0.14);
        break;
      }
      case 'oven': {
        const glass = box(0.5, 0.3, 0.01, spec.x, spec.y, spec.z, new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85 }));
        e.glow = glass;
        const light = new THREE.PointLight(0xff8a3a, 0.6, 1.4);
        light.position.set(spec.x, spec.y, spec.z + 0.2);
        g.add(light);
        break;
      }
      case 'plate': {
        cyl(0.14, 0.015, spec.x, spec.y + 0.008, spec.z, mat('#f4f2ec', { roughness: 0.25 }));
        const food = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(spec.colour, { roughness: 0.8 }));
        food.scale.set(1, 0.4, 0.8);
        food.position.set(spec.x, spec.y + 0.03, spec.z);
        food.name = 'food';
        g.add(food);
        box(0.015, 0.005, 0.16, spec.x + 0.19, spec.y + 0.004, spec.z, mat('#c8c8c8', { metalness: 1, roughness: 0.2 }));
        break;
      }
      case 'board': {
        box(0.36, 0.025, 0.24, spec.x, spec.y + 0.012, spec.z, mat('#a87a4a', { roughness: 0.8 }));
        for (let i = 0; i < 5; i++) box(0.04, 0.03, 0.06, spec.x - 0.08 + i * 0.035, spec.y + 0.04, spec.z + (i % 2 ? 0.03 : -0.02), mat(spec.colour));
        box(0.2, 0.006, 0.03, spec.x + 0.1, spec.y + 0.03, spec.z + 0.09, mat('#d8d8d8', { metalness: 1, roughness: 0.2 }));
        break;
      }
    }
    if (e.particles) g.add(e.particles.points);
    return e;
  }

  private particles(spec: HouseFxSpec, n: number, colour: number, size: number, opacity: number): Particles {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const life = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: colour, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(geo, m);
    points.frustumCulled = false;
    const p: Particles = { points, pos, vel, life, spec };
    for (let i = 0; i < n; i++) this.respawn(p, i, Math.random());
    return p;
  }

  private respawn(p: Particles, i: number, age = 0): void {
    const s = p.spec;
    const r = Math.random;
    const k = i * 3;
    if (s.kind === 'water') {
      p.pos[k] = s.x + (r() - 0.5) * s.spread;
      p.pos[k + 1] = s.top - age * (s.top - s.bottom);
      p.pos[k + 2] = s.z + (r() - 0.5) * s.spread;
      p.vel[k] = (r() - 0.5) * 0.3;
      p.vel[k + 1] = -3.5 - r() * 1.5;
      p.vel[k + 2] = (r() - 0.5) * 0.3 + 0.15;
      p.life[i] = 1;
    } else if (s.kind === 'tap') {
      p.pos[k] = s.x + (r() - 0.5) * 0.02;
      p.pos[k + 1] = s.y - age * 0.15;
      p.pos[k + 2] = s.z + (r() - 0.5) * 0.02;
      p.vel[k] = 0;
      p.vel[k + 1] = -1.4 - r() * 0.4;
      p.vel[k + 2] = 0;
      p.life[i] = 1;
    } else if (s.kind === 'steam') {
      p.pos[k] = s.x + (r() - 0.5) * s.spread;
      p.pos[k + 1] = s.y + age * 0.6;
      p.pos[k + 2] = s.z + (r() - 0.5) * s.spread * 0.6;
      p.vel[k] = (r() - 0.5) * 0.08;
      p.vel[k + 1] = 0.25 + r() * 0.2;
      p.vel[k + 2] = (r() - 0.5) * 0.08 + 0.03;
      p.life[i] = 1.6 + r() * 1.4;
    }
  }

  update(dt: number): void {
    this.time += dt;
    const step = Math.min(0.05, dt);
    for (const [key, e] of [...this.entries, ...this.closing]) {
      if (e.particles) {
        const p = e.particles;
        const s = p.spec;
        const n = p.life.length;
        for (let i = 0; i < n; i++) {
          const k = i * 3;
          p.pos[k] += p.vel[k] * step;
          p.pos[k + 1] += p.vel[k + 1] * step;
          p.pos[k + 2] += p.vel[k + 2] * step;
          if (s.kind === 'steam') {
            p.life[i] -= step;
            if (p.life[i] <= 0) this.respawn(p, i);
          } else {
            const floor = s.kind === 'water' ? s.bottom : s.kind === 'tap' ? s.y - 0.16 : -1;
            if (p.pos[k + 1] < floor) this.respawn(p, i);
          }
        }
        (p.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }
      if (e.door) {
        const r = e.door.pivot.rotation;
        r.y += (e.door.target - r.y) * Math.min(1, step * 7);
        if (this.closing.get(key) === e && Math.abs(r.y) < 0.03) {
          this.dispose(e);
          this.closing.delete(key);
        }
      }
      if (e.glow) {
        const m = e.glow.material as THREE.Material;
        if (m.transparent) m.opacity = 0.75 + 0.1 * Math.sin(this.time * 5);
      }
    }
  }
}
