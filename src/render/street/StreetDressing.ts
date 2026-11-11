/**
 * Phase 3 street pass: everything that makes a street read as a wet British
 * street at night without changing where anything is or how it plays.
 *
 *   light pools and beams under the lamps      irregular puddles
 *   rain splashes on the ground                drainpipes, grime, weeds, litter
 *   soft contact shadows under street furniture
 *
 * Nothing here collides, moves a prop or is read by the simulation.
 * `?street=classic` leaves it all out.
 */
import * as THREE from 'three';
import type { LevelDef } from '../../world/LevelTypes';
import { propHalf } from '../../world/LevelTypes';

function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SPLASHES = 150;

export class StreetDressing {
  readonly group = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private splash: THREE.Points | null = null;
  private splashSeed = new Float32Array(SPLASHES * 3);

  constructor(
    private readonly level: LevelDef,
    private readonly back: number,
    private readonly front: number,
    private readonly X0: number,
    private readonly X1: number,
    private readonly rnd: () => number,
  ) {
    this.group.name = 'street-dressing';
    this.lightPools();
    this.puddles();
    this.wall();
    this.contactShadows();
    this.litter();
    if (level.weather === 'rain') this.rainSplashes();
  }

  private keep<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private flat(w: number, d: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(w, d)), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  /** Each lamp throws a warm pool on the ground and the wall, and a faint beam through the rain. */
  private lightPools(): void {
    const glow = this.keep(
      canvasTexture(128, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }),
    );
    const beam = this.keep(
      canvasTexture(128, (ctx, s) => {
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
          const down = y / (s - 1); // 0 at the lamp
          const half = 0.06 + down * 0.44;
          for (let x = 0; x < s; x++) {
            const off = Math.abs(x / (s - 1) - 0.5) / half;
            const a = off >= 1 ? 0 : (1 - off * off) * (1 - down * 0.75);
            const i = (y * s + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
            img.data[i + 3] = Math.round(a * 255);
          }
        }
        ctx.putImageData(img, 0, 0);
      }),
    );
    for (const l of this.level.lights) {
      const colour = new THREE.Color(l.colour);
      const additive = (map: THREE.Texture, opacity: number) =>
        this.keep(new THREE.MeshBasicMaterial({ map, color: colour, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const r = (l.range ?? 12) * 0.42;
      this.flat(r * 2, r * 1.1, l.x, 0.014, Math.max(this.back + r * 0.5, l.z), additive(glow, 0.3));
      const onWall = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(r * 1.7, r * 1.2)), additive(glow, 0.22));
      onWall.position.set(l.x, Math.min(l.y - 0.6, 2.6), this.back + 0.035);
      this.group.add(onWall);
      const shaft = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(r * 1.5, l.y)), additive(beam, 0.07));
      shaft.position.set(l.x, l.y / 2, l.z);
      this.group.add(shaft);
    }
  }

  /** Standing water in uneven patches: they mirror the lamps where the paving dips. */
  private puddles(): void {
    const water = this.keep(new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.03, metalness: 0.5, transparent: true, opacity: 0.6, depthWrite: false }));
    const W = this.X1 - this.X0;
    const count = Math.floor(W / 6);
    for (let i = 0; i < count; i++) {
      const shape = new THREE.Shape();
      const lobes = 9;
      const wob = Array.from({ length: lobes }, () => 0.62 + this.rnd() * 0.5);
      for (let k = 0; k <= lobes; k++) {
        const a = (k / lobes) * Math.PI * 2;
        const rad = wob[k % lobes];
        if (k === 0) shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else {
          const am = ((k - 0.5) / lobes) * Math.PI * 2;
          const rm = (wob[(k - 1) % lobes] + rad) / 2 + 0.08;
          shape.quadraticCurveTo(Math.cos(am) * rm, Math.sin(am) * rm, Math.cos(a) * rad, Math.sin(a) * rad);
        }
      }
      const p = new THREE.Mesh(this.keep(new THREE.ShapeGeometry(shape, 5)), water);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = this.rnd() * Math.PI;
      p.scale.set(0.5 + this.rnd() * 0.9, 0.22 + this.rnd() * 0.3, 1);
      const onRoad = this.rnd() < 0.35;
      const z = onRoad ? this.front + 0.9 + this.rnd() * 2.5 : this.back + 0.9 + this.rnd() * (this.front - this.back - 1.4);
      p.position.set(this.X0 + this.rnd() * W, onRoad ? -0.012 : 0.006, z);
      p.receiveShadow = true;
      this.group.add(p);
    }
    // The gutter runs wet along the kerb.
    const gutter = this.keep(new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.05, metalness: 0.45, transparent: true, opacity: 0.5, depthWrite: false }));
    this.flat(W, 0.42, (this.X0 + this.X1) / 2, -0.014, this.front + 0.48, gutter);
  }

  /** The wall stops being one clean sheet: pipes at the party walls, damp at its foot, weeds in the joint. */
  private wall(): void {
    const W = this.X1 - this.X0;
    const grime = this.keep(
      canvasTexture(64, (ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, 'rgba(6,8,10,0)');
        g.addColorStop(0.6, 'rgba(6,8,10,0.28)');
        g.addColorStop(1, 'rgba(6,8,10,0.72)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }),
    );
    const strip = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(W, 1.1)), this.keep(new THREE.MeshBasicMaterial({ map: grime, transparent: true, depthWrite: false })));
    strip.position.set((this.X0 + this.X1) / 2, 0.55, this.back + 0.026);
    this.group.add(strip);
    // Where the wall meets the paving, a dark wet line.
    this.flat(W, 0.5, (this.X0 + this.X1) / 2, 0.01, this.back + 0.27, this.keep(new THREE.MeshBasicMaterial({ color: 0x050607, transparent: true, opacity: 0.45, depthWrite: false })));

    const iron = this.keep(new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.55, metalness: 0.6 }));
    const pipeGeo = this.keep(new THREE.CylinderGeometry(0.055, 0.055, 4.4, 10));
    const clipGeo = this.keep(new THREE.BoxGeometry(0.2, 0.05, 0.1));
    const shoeGeo = this.keep(new THREE.CylinderGeometry(0.055, 0.07, 0.3, 10));
    const doors = this.level.exits.filter((e) => e.kind === 'door').map((e) => e.x);
    for (const f of this.level.facades) {
      const x = f.x0 + 0.35;
      if (x <= this.level.bounds.minX - 2 || doors.some((d) => Math.abs(d - x) < 1.4)) continue;
      const pipe = new THREE.Mesh(pipeGeo, iron);
      pipe.position.set(x, 2.35, this.back + 0.1);
      pipe.castShadow = true;
      this.group.add(pipe);
      for (const y of [0.7, 2.0, 3.3]) {
        const clip = new THREE.Mesh(clipGeo, iron);
        clip.position.set(x, y, this.back + 0.07);
        this.group.add(clip);
      }
      const shoe = new THREE.Mesh(shoeGeo, iron);
      shoe.position.set(x, 0.2, this.back + 0.2);
      shoe.rotation.x = 0.9;
      this.group.add(shoe);
    }

    const weed = this.keep(new THREE.MeshStandardMaterial({ color: 0x2f4a26, roughness: 1 }));
    const tuft = this.keep(new THREE.ConeGeometry(0.05, 0.2, 5));
    for (let i = 0; i < Math.floor(W / 3.5); i++) {
      const x = this.X0 + this.rnd() * W;
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(tuft, weed);
        m.position.set(x + (k - 1) * 0.05, 0.04 + this.rnd() * 0.03, this.back + 0.07 + this.rnd() * 0.05);
        m.rotation.z = (k - 1) * 0.4;
        m.scale.setScalar(0.4 + this.rnd() * 0.45);
        this.group.add(m);
      }
    }
  }

  /** A soft dark patch under each piece of street furniture, so it sits on the ground instead of floating. */
  private contactShadows(): void {
    const soft = this.keep(
      canvasTexture(64, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(0,0,0,0.6)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }),
    );
    const m = this.keep(new THREE.MeshBasicMaterial({ map: soft, transparent: true, depthWrite: false }));
    for (const p of this.level.props) {
      const [hx, hz] = propHalf(p);
      if (hx <= 0 || hz <= 0) continue;
      this.flat(hx * 2 + 0.7, hz * 2 + 0.7, p.x, 0.012, p.z, m);
    }
  }

  /** A little rubbish against the wall and in the gutter. */
  private litter(): void {
    const W = this.X1 - this.X0;
    const colours = [0xd8d2c4, 0xb23a2e, 0x2c5fa8, 0xd9b23a, 0x8a8a84];
    const mats = colours.map((c) => this.keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide })));
    const paper = this.keep(new THREE.PlaneGeometry(0.2, 0.14));
    const can = this.keep(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8));
    for (let i = 0; i < Math.floor(W / 2.6); i++) {
      const againstWall = this.rnd() < 0.55;
      const x = this.X0 + this.rnd() * W;
      const z = againstWall ? this.back + 0.15 + this.rnd() * 0.3 : this.front + 0.32 + this.rnd() * 0.3;
      const mat = mats[Math.floor(this.rnd() * mats.length)];
      if (this.rnd() < 0.3) {
        const m = new THREE.Mesh(can, mat);
        m.rotation.z = Math.PI / 2;
        m.rotation.y = this.rnd() * Math.PI;
        m.position.set(x, againstWall ? 0.034 : 0.014, z);
        this.group.add(m);
      } else {
        const m = new THREE.Mesh(paper, mat);
        m.rotation.x = -Math.PI / 2 + (this.rnd() - 0.5) * 0.3;
        m.rotation.z = this.rnd() * Math.PI;
        m.scale.setScalar(0.6 + this.rnd() * 0.9);
        m.position.set(x, againstWall ? 0.02 : 0.0, z);
        this.group.add(m);
      }
    }
  }

  /** Rings where raindrops land. One draw call; positions come from the clock, so they need no state. */
  private rainSplashes(): void {
    const ring = this.keep(
      canvasTexture(32, (ctx, s) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(s / 2, s / 2, s * 0.38, s * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }),
    );
    for (let i = 0; i < SPLASHES * 3; i++) this.splashSeed[i] = this.rnd();
    const geo = this.keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPLASHES * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPLASHES * 3), 3));
    const mat = this.keep(new THREE.PointsMaterial({ map: ring, size: 0.2, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.splash = new THREE.Points(geo, mat);
    this.splash.frustumCulled = false;
    this.group.add(this.splash);
  }

  update(time: number, camX: number): void {
    if (!this.splash) return;
    const pos = this.splash.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.splash.geometry.getAttribute('color') as THREE.BufferAttribute;
    const zSpan = this.front + 3.5 - (this.back + 0.4);
    for (let i = 0; i < SPLASHES; i++) {
      const period = 0.35 + this.splashSeed[i * 3] * 0.3;
      const t = time / period + this.splashSeed[i * 3 + 1] * 10;
      const cycle = Math.floor(t);
      const age = t - cycle;
      // A cheap hash of (drop, cycle): every landing is somewhere new.
      const hx = Math.sin(i * 12.9898 + cycle * 78.233) * 43758.5453;
      const hz = Math.sin(i * 39.3468 + cycle * 11.135) * 24634.6345;
      const fx = hx - Math.floor(hx);
      const fz = hz - Math.floor(hz);
      pos.setXYZ(i, camX + (fx - 0.5) * 24, 0.03, this.back + 0.4 + fz * zSpan);
      const k = (1 - age) * (1 - age) * 0.5;
      col.setXYZ(i, k * 0.75, k * 0.85, k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
