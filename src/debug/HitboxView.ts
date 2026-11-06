import * as THREE from 'three';
import { BODY_HEIGHT, BODY_RADIUS } from '../core/constants';
import { hitSphereOf } from '../combat/CombatSystem';
import { isActiveFrame } from '../combat/MoveData';
import type { Fighter } from '../fighter/Fighter';

/**
 * Debug overlay: hurt capsules (green), active hit spheres (red) and the
 * depth tolerance band. Toggle with F1 or in Settings.
 */
export class HitboxView {
  readonly group = new THREE.Group();
  private hurt = new Map<number, THREE.Mesh>();
  private hit = new Map<number, THREE.Mesh>();
  private band = new Map<number, THREE.Mesh>();

  constructor() {
    this.group.visible = false;
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  update(fighters: Fighter[]): void {
    if (!this.group.visible) return;
    for (const f of fighters) {
      let hurt = this.hurt.get(f.id);
      if (!hurt) {
        hurt = new THREE.Mesh(
          new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_HEIGHT - 0.15, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0x3cff7a, wireframe: true, transparent: true, opacity: 0.35 }),
        );
        this.hurt.set(f.id, hurt);
        this.group.add(hurt);
      }
      hurt.position.set(f.pos.x, f.pos.y + 0.15 + (BODY_HEIGHT - 0.15) / 2, f.pos.z);
      hurt.visible = !f.isInvulnerable;

      let hit = this.hit.get(f.id);
      let band = this.band.get(f.id);
      if (!hit || !band) {
        hit = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3030, wireframe: true }));
        band = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.25 }));
        this.hit.set(f.id, hit);
        this.band.set(f.id, band);
        this.group.add(hit, band);
      }
      const m = f.move;
      const active = !!m && f.state === 'attack' && isActiveFrame(m);
      hit.visible = active;
      band.visible = active;
      if (active && m) {
        const s = hitSphereOf(f, m);
        hit.position.set(s.x, s.y, s.z);
        hit.scale.setScalar(s.r);
        band.position.set(s.x, 0.02, s.z);
        band.scale.set(s.r * 2, 1, m.data.depthTolerance * 2);
      }
    }
  }
}
