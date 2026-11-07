import * as THREE from 'three';

export type StudioFraming = 'full' | 'upper' | 'face';

/**
 * Photo-studio set for character creation and the character sheet:
 * a curved dark backdrop, a floor disc, warm key light and a cool rim light.
 */
export class StudioView {
  readonly group = new THREE.Group();
  private disposables: { dispose(): void }[] = [];

  constructor() {
    const track = <T extends { dispose(): void }>(x: T) => {
      this.disposables.push(x);
      return x;
    };

    const backdropMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.95, side: THREE.BackSide }));
    const backdrop = new THREE.Mesh(track(new THREE.CylinderGeometry(7, 7, 8, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8)), backdropMat);
    backdrop.position.set(0, 4, 0);
    backdrop.receiveShadow = true;
    this.group.add(backdrop);

    const floor = new THREE.Mesh(track(new THREE.CircleGeometry(7, 48)), track(new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.1 })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Hazard-striped spot mark on the floor.
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(0.62, 0.7, 48)), track(new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.35 })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.group.add(ring);

    const key = new THREE.SpotLight(0xffd9b0, 55, 14, 0.6, 0.5, 1.5);
    key.position.set(2.2, 3.6, 3.4);
    key.target.position.set(0, 1, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    this.group.add(key, key.target);

    const rim = new THREE.DirectionalLight(0x8fb2ff, 1.6);
    rim.position.set(-3, 3, -3);
    this.group.add(rim);

    const fill = new THREE.HemisphereLight(0x5a6378, 0x0c0c0e, 0.9);
    this.group.add(fill);
    const front = new THREE.DirectionalLight(0xfff0e0, 0.9);
    front.position.set(-0.5, 1.8, 5);
    this.group.add(front);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

/** Camera target (look-at height) and distance for each framing. */
export const FRAMING: Record<StudioFraming, { y: number; distance: number }> = {
  full: { y: 0.95, distance: 4.4 },
  upper: { y: 1.3, distance: 2.4 },
  face: { y: 1.62, distance: 1.15 },
};
