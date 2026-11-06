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

    this.shakeSeed += dt * 60;
    const sx = this.shake * (Math.sin(this.shakeSeed * 1.7) + Math.sin(this.shakeSeed * 3.1) * 0.5);
    const sy = this.shake * (Math.cos(this.shakeSeed * 2.3) * 0.7);
    this.shake = Math.max(0, this.shake - dt * 1.6);

    this.camera.position.set(this.focus.x + sx, 2.35 + this.distance * 0.06 + sy, this.focus.z + this.distance);
    this.camera.lookAt(this.focus.x + sx * 0.5, this.focus.y + 0.15, this.focus.z - 0.4);
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
