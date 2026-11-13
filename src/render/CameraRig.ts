import * as THREE from 'three';
import type { Fighter } from '../fighter/Fighter';
import type { ArenaBounds } from '../world/Arena';

/**
 * Side-on fight camera. Frames the player and their current target, pulls
 * back as they spread apart, stays inside the arena, and shakes on impact.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private focus = new THREE.Vector3(0, 1.05, 0);
  private distance = 8.5;
  private shake = 0;
  private shakeSeed = 0;
  /** Phones sit a little closer so fighters read on a small screen. */
  compact = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 120);
    this.camera.position.set(0, 2.4, 8.5);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    // Keep horizontal coverage reasonable on tall (portrait) screens.
    this.camera.fov = aspect < 1 ? 52 : aspect < 1.4 ? 42 : 34;
    this.camera.updateProjectionMatrix();
  }

  addShake(amount: number): void {
    this.shake = Math.min(0.35, this.shake + amount);
  }

  /** A quick push in toward a big hit (0..1), springing straight back out. */
  private punch = 0;
  private punchX = 0;
  addPunch(amount: number, atX: number): void {
    if (amount > this.punch) this.punchX = atX;
    this.punch = Math.min(1, Math.max(this.punch, amount));
  }

  /** The final blow: drift in on where it landed and hold there while time is slowed (0 lets go). */
  private cine = 0;
  private cineWant = 0;
  private cineAt = new THREE.Vector3();
  setCinematic(amount: number, at?: { x: number; y: number; z: number }): void {
    this.cineWant = amount;
    if (at) this.cineAt.set(at.x, at.y, at.z);
  }

  /** Where the camera sits and looks, with the shake, the punch-in and any cinematic push applied. */
  private place(dt: number): void {
    this.shakeSeed += dt * 60;
    const sx = this.shake * (Math.sin(this.shakeSeed * 1.7) + Math.sin(this.shakeSeed * 3.1) * 0.5);
    const sy = this.shake * (Math.cos(this.shakeSeed * 2.3) * 0.7);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    // The punch snaps in and eases back out over about a quarter of a second.
    this.punch = Math.max(0, this.punch - dt * 4.5);
    this.cine += (this.cineWant - this.cine) * (1 - Math.exp(-(this.cineWant > this.cine ? 6 : 3) * dt));
    const p = this.punch * this.punch;
    const pull = 1 - 0.1 * p - 0.38 * this.cine;
    const fx = this.focus.x + (this.punchX - this.focus.x) * 0.25 * p + (this.cineAt.x - this.focus.x) * 0.6 * this.cine;
    const fy = this.focus.y + (this.cineAt.y - 0.2 - this.focus.y) * 0.5 * this.cine;
    const dist = this.distance * pull;
    this.camera.position.set(fx + sx, 2.35 + dist * 0.06 - 0.35 * this.cine + sy, this.focus.z + dist);
    this.camera.lookAt(fx + sx * 0.5, fy + 0.15, this.focus.z - 0.4);
  }

  update(dt: number, player: Fighter | null, target: Fighter | null, bounds: ArenaBounds): void {
    let cx = 0;
    let spread = 0;
    if (player) {
      cx = player.pos.x;
      if (target && Math.abs(target.pos.x - player.pos.x) < 9) {
        cx = (player.pos.x + target.pos.x) / 2;
        spread = Math.abs(target.pos.x - player.pos.x);
      }
    }
    const base = this.compact ? 7.2 : 8.5;
    const wantDist = Math.min(base + 4, base + Math.max(0, spread - 2.5) * 0.6);
    // Keep the view inside the alley.
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * wantDist * this.camera.aspect;
    const minX = bounds.minX + halfWidth * 0.55;
    const maxX = bounds.maxX - halfWidth * 0.55;
    cx = minX < maxX ? Math.min(maxX, Math.max(minX, cx)) : 0;

    const k = 1 - Math.exp(-5 * dt);
    this.focus.x += (cx - this.focus.x) * k;
    this.focus.z += ((player?.pos.z ?? 0) * 0.3 - this.focus.z) * k;
    this.distance += (wantDist - this.distance) * (1 - Math.exp(-3 * dt));

    this.place(dt);
  }

  private deadX = 0;
  private worldReady = false;

  /** Snap straight to the player (new area). */
  resetWorld(): void {
    this.worldReady = false;
  }

  /**
   * Exploring the world: the camera holds still while you move about inside a
   * dead zone, frames you and whoever you're fighting, and is clamped so it
   * never looks past the ends of the area (or out of a locked fight).
   */
  /**
   * Slide the whole frame sideways by dx in one step. Crossing from one district of the long street
   * into the next re-bases the world on the new district; the camera moves with it so nothing is seen to jump.
   */
  shift(dx: number): void {
    this.deadX += dx;
    this.focus.x += dx;
    this.camera.position.x += dx;
  }

  /** `open`: ends of the area where the street carries on into the next district, so the camera is not held back there. */
  updateWorld(dt: number, player: Fighter, target: Fighter | null, bounds: ArenaBounds, lock: { minX: number; maxX: number } | null, open: { left: boolean; right: boolean } = { left: false, right: false }): void {
    const DEAD = 1.2;
    if (!this.worldReady) {
      this.deadX = player.pos.x;
      this.focus.set(player.pos.x, 1.05, player.pos.z * 0.3);
      this.distance = this.compact ? 7.2 : 8.5;
    }
    if (player.pos.x > this.deadX + DEAD) this.deadX = player.pos.x - DEAD;
    if (player.pos.x < this.deadX - DEAD) this.deadX = player.pos.x + DEAD;
    let cx = this.deadX;
    let spread = 0;
    if (target && !target.isKO && Math.abs(target.pos.x - player.pos.x) < 8) {
      cx = (player.pos.x + target.pos.x) / 2;
      spread = Math.abs(target.pos.x - player.pos.x);
      this.deadX = cx;
    }
    const base = this.compact ? 7.2 : 8.5;
    const wantDist = Math.min(base + 3, base + Math.max(0, spread - 3) * 0.5);
    // Half the visible width where the fighters stand.
    const halfW = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * wantDist * this.camera.aspect;
    const clampTo = (lo: number, hi: number, slack: number) => {
      const a = lo + halfW - slack;
      const b = hi - halfW + slack;
      cx = a <= b ? Math.min(b, Math.max(a, cx)) : (lo + hi) / 2;
    };
    if (lock) clampTo(lock.minX, lock.maxX, 1.5);
    clampTo(open.left ? -1e6 : bounds.minX, open.right ? 1e6 : bounds.maxX, 1.0);

    const k = this.worldReady ? 1 - Math.exp(-6 * dt) : 1;
    this.worldReady = true;
    this.focus.x += (cx - this.focus.x) * k;
    this.focus.z += (player.pos.z * 0.3 - this.focus.z) * k;
    this.distance += (wantDist - this.distance) * (1 - Math.exp(-3 * dt));

    this.place(dt);
  }

  get focusX(): number {
    return this.focus.x;
  }

  /** Gentle drift used behind the main menu. */
  attract(time: number): void {
    const x = Math.sin(time * 0.08) * 5;
    this.camera.position.set(x, 2.1, 7.5);
    this.camera.lookAt(x * 0.8, 1.4, -1);
  }

  /** Project a world point to screen pixels (for damage numbers). */
  project(x: number, y: number, z: number, width: number, height: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, visible: v.z < 1 };
  }
}
