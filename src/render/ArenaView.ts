import * as THREE from 'three';
import type { Arena } from '../world/Arena';
import { brickTexture, pavingTexture, roadTexture, shutterTexture, windowsTexture } from './textures';

/**
 * Stage 1 test arena: a back alley behind a British high street at night.
 * Built from simple shapes and procedural textures (TEMPORARY art: the
 * Stage 5 locations are modelled in Blender). Walkable band is z -2..2;
 * the wall is behind it (negative z), the road in front (positive z).
 */
export class ArenaView {
  readonly group = new THREE.Group();
  readonly shadowLights: THREE.SpotLight[] = [];
  private flicker: { light: THREE.PointLight; base: number }[] = [];

  constructor(private readonly arena: Arena) {
    this.build();
  }

  private build(): void {
    const g = this.group;
    const W = 60;

    // ---- ground --------------------------------------------------------------
    const paving = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 6),
      new THREE.MeshStandardMaterial({ map: pavingTexture(W / 2.4, 6 / 2.4), roughness: 0.82, metalness: 0 }),
    );
    paving.rotation.x = -Math.PI / 2;
    paving.position.set(0, 0, -0.6);
    paving.receiveShadow = true;
    g.add(paving);

    const kerb = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x77787c, roughness: 0.9 }));
    kerb.position.set(0, 0.06, 2.45);
    kerb.receiveShadow = true;
    g.add(kerb);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 6),
      new THREE.MeshStandardMaterial({ map: roadTexture(W / 8), roughness: 0.55, metalness: 0.05 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.02, 5.55);
    road.receiveShadow = true;
    g.add(road);

    // Puddles: low roughness picks up the sodium lamps as glints.
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.04, metalness: 0.6 });
    const puddles: [number, number, number, number][] = [
      [-3.5, 0.8, 1.1, 0.6], [4.5, -1.2, 0.9, 0.5], [9, 1.2, 1.4, 0.7], [-8.5, -0.6, 1.0, 0.45], [1.2, 3.6, 2.2, 0.8],
    ];
    for (const [x, z, sx, sz] of puddles) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.scale.set(sx, sz, 1);
      p.position.set(x, 0.005, z);
      p.receiveShadow = true;
      g.add(p);
    }

    // ---- back wall: shop rears with flats above ----------------------------
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 9),
      new THREE.MeshStandardMaterial({ map: brickTexture(W / 4, 9 / 4), roughness: 0.95 }),
    );
    wall.position.set(0, 4.5, -3.6);
    wall.receiveShadow = true;
    g.add(wall);

    const windows = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: windowsTexture(), emissiveIntensity: 0.9, transparent: true, opacity: 0.95 }),
    );
    (windows.material as THREE.MeshStandardMaterial).emissiveMap!.repeat.set(W / 16, 1);
    (windows.material as THREE.MeshStandardMaterial).emissiveMap!.wrapS = THREE.RepeatWrapping;
    windows.position.set(0, 5.2, -3.58);
    g.add(windows);

    const shutterMat = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.5 });
    for (const x of [-6, 5.5, 14]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), shutterMat);
      s.position.set(x, 1.3, -3.57);
      g.add(s);
    }
    // Back door with a little canopy.
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshStandardMaterial({ color: 0x1d3a2a, roughness: 0.7 }));
    door.position.set(-1.5, 1.05, -3.57);
    g.add(door);

    // Drainpipes.
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.4 });
    for (const x of [1.0, 9.5, -10.5]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 9, 8), pipeMat);
      pipe.position.set(x, 4.5, -3.5);
      g.add(pipe);
    }

    // ---- street furniture ---------------------------------------------------
    this.addWheelieBin(-7.4, -3.0, 0x1e5a2c);
    this.addWheelieBin(-6.6, -3.05, 0x1b1d22);
    this.addWheelieBin(7.6, -3.0, 0x2a3f7a);
    this.addPostBox(-11.5, -2.9);
    this.addLampPost(-4, -3.1);
    this.addLampPost(6, -3.1);
    for (const x of [-12, -9, 9, 12]) this.addBollard(x, 2.25);
    // Parked cars sit at the far ends of the road so they never block the fight.
    this.addCar(-17, 4.6, 0x1f2a44);
    this.addCar(17.5, 4.6, 0x6b6b70);

    // ---- lighting ----------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0x55607e, 0x14100c, 0.9);
    g.add(hemi);
    // Soft light from the road side (passing headlights / shop glow) so fighters aren't silhouettes.
    const front = new THREE.DirectionalLight(0xffd2a8, 0.75);
    front.position.set(2, 3, 12);
    g.add(front);
    const moon = new THREE.DirectionalLight(0x8ea2d6, 0.35);
    moon.position.set(-6, 12, 10);
    g.add(moon);
  }

  private addWheelieBin(x: number, z: number, color: number): void {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.7), mat);
    body.position.set(x, 0.55, z);
    body.castShadow = true;
    body.receiveShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.76), mat);
    lid.position.set(x, 1.08, z + 0.02);
    lid.rotation.x = -0.05;
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const dx of [-0.22, 0.22]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x + dx, 0.1, z - 0.3);
      this.group.add(w);
    }
    this.group.add(body, lid);
  }

  /** Classic red pillar box. */
  private addPostBox(x: number, z: number): void {
    const red = new THREE.MeshStandardMaterial({ color: 0xb3121b, roughness: 0.35, metalness: 0.1 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.15, 24), black);
    base.position.set(x, 0.075, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 1.25, 24), red);
    body.position.set(x, 0.775, z);
    body.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red);
    cap.position.set(x, 1.4, z);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.02), black);
    slot.position.set(x, 1.15, z + 0.27);
    this.group.add(base, body, cap, slot);
  }

  private addBollard(x: number, z: number): void {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.4, metalness: 0.5 }));
    b.position.set(x, 0.45, z);
    b.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4 }));
    band.position.set(x, 0.78, z);
    this.group.add(b, band);
  }

  /** Lamp post with a sodium-orange head; the main light for the fight. */
  private addLampPost(x: number, z: number): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.6, 10), mat);
    pole.position.set(x, 2.8, z);
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), mat);
    arm.position.set(x, 5.55, z + 0.65);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.6), mat);
    head.position.set(x, 5.5, z + 1.35);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.5), new THREE.MeshBasicMaterial({ color: 0xffb35c }));
    glow.position.set(x, 5.42, z + 1.35);
    this.group.add(pole, arm, head, glow);

    const spot = new THREE.SpotLight(0xff9d45, 70, 16, 0.95, 0.65, 1.6);
    spot.position.set(x, 5.35, z + 1.35);
    spot.target.position.set(x + 0.2, 0, z + 2.6);
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 14;
    this.group.add(spot, spot.target);
    this.shadowLights.push(spot);

    const fill = new THREE.PointLight(0xff9a40, 6, 7, 2);
    fill.position.set(x, 4.6, z + 1.4);
    this.group.add(fill);
    this.flicker.push({ light: fill, base: 6 });
  }

  private addCar(x: number, z: number, color: number): void {
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.1, metalness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.7, 1.75), paint);
    body.position.set(x, 0.6, z);
    body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.6), glass);
    cabin.position.set(x - 0.2, 1.22, z);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 1.55), paint);
    roof.position.set(x - 0.2, 1.54, z);
    const tyre = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 });
    for (const dx of [-1.3, 1.3]) {
      for (const dz of [-0.8, 0.8]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16), tyre);
        w.rotation.x = Math.PI / 2;
        w.position.set(x + dx, 0.33, z + dz);
        this.group.add(w);
      }
    }
    // UK plates: white front, yellow rear.
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshBasicMaterial({ color: 0xe8e8e2 }));
    front.position.set(x + 1.96, 0.55, z);
    front.rotation.y = Math.PI / 2;
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshBasicMaterial({ color: 0xe0b400 }));
    rear.position.set(x - 1.96, 0.55, z);
    rear.rotation.y = -Math.PI / 2;
    const tail = new THREE.MeshBasicMaterial({ color: 0x7a0b0b });
    for (const dz of [-0.7, 0.7]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.12), tail);
      l.position.set(x - 1.96, 0.75, z + dz);
      l.rotation.y = -Math.PI / 2;
      this.group.add(l);
    }
    this.group.add(body, cabin, roof, front, rear);
  }

  /** Subtle sodium-lamp flicker. */
  update(time: number): void {
    for (const [i, f] of this.flicker.entries()) {
      const n = Math.sin(time * 13.1 + i * 7) * Math.sin(time * 3.7 + i);
      f.light.intensity = f.base * (n > 0.97 ? 0.4 : 1);
    }
  }

  get bounds() {
    return this.arena.bounds;
  }
}
