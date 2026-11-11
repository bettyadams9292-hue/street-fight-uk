/**
 * A parked hatchback, shaped rather than boxed: a side profile pushed through
 * the car's width, with glass, wheels in arches, lamps and plates.
 *
 * Its materials are its own (not shared), so one car can fade without the
 * others: LevelView does that when a car stands between the camera and the player.
 */
import * as THREE from 'three';

export interface CarFade {
  materials: THREE.Material[];
  /** Current opacity, 1 = solid. */
  value: number;
}

/** W = length along the street, D = width. The nose points along +x. */
export function buildCar(W: number, D: number, colour: string, project: boolean): THREE.Group {
  const g = new THREE.Group();
  const mats: THREE.Material[] = [];
  const own = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };
  const paint = own(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.28, metalness: 0.65 }));
  const trim = own(new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.7, metalness: 0.2 }));
  const glass = own(new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.06, metalness: 0.9 }));
  const tyre = own(new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.92 }));
  const alloy = own(new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.35, metalness: 0.85 }));
  const head = own(new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.2, emissive: 0xfff0cc, emissiveIntensity: 0.12 }));
  const tail = own(new THREE.MeshStandardMaterial({ color: 0x5a0c0c, roughness: 0.3, emissive: 0xff1a10, emissiveIntensity: 0.3 }));
  const plateF = own(new THREE.MeshBasicMaterial({ color: 0xe8e8e2 }));
  const plateR = own(new THREE.MeshBasicMaterial({ color: 0xe0b400 }));

  const h = W / 2;
  const add = (mesh: THREE.Mesh, cast = true): THREE.Mesh => {
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  // Body: the side profile, rear bumper to nose.
  const s = new THREE.Shape();
  s.moveTo(-h + 0.08, 0.3);
  s.lineTo(-h, 0.52);
  s.lineTo(-h + 0.04, 0.98);
  s.lineTo(-h + 0.3, 1.06);
  s.lineTo(-h + 0.8, 1.44);
  s.lineTo(W * 0.06, 1.47);
  s.lineTo(W * 0.24, 1.02);
  s.lineTo(h - 0.14, 0.9);
  s.lineTo(h, 0.66);
  s.lineTo(h - 0.04, 0.3);
  s.closePath();
  const depth = D - 0.16;
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 4 });
  bodyGeo.translate(0, 0, -depth / 2);
  add(new THREE.Mesh(bodyGeo, paint));

  // Sills and bumpers in black trim.
  const box = (w: number, hh: number, d: number, x: number, y: number, z: number, m: THREE.Material, cast = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m);
    mesh.position.set(x, y, z);
    return add(mesh, cast);
  };
  box(W - 0.3, 0.12, D - 0.04, 0, 0.3, 0, trim);
  box(0.1, 0.16, D - 0.1, h - 0.02, 0.42, 0, trim);
  box(0.1, 0.16, D - 0.1, -h + 0.02, 0.42, 0, trim);

  // Side glass: one greenhouse shape each side, a hair proud of the paint.
  const gl = new THREE.Shape();
  gl.moveTo(-h + 0.5, 1.08);
  gl.lineTo(-h + 0.9, 1.38);
  gl.lineTo(W * 0.04, 1.4);
  gl.lineTo(W * 0.2, 1.06);
  gl.closePath();
  const glassGeo = new THREE.ShapeGeometry(gl);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(glassGeo, glass);
    m.position.z = side * (D / 2 - 0.022);
    if (side < 0) m.rotation.y = Math.PI;
    if (side < 0) m.scale.x = -1;
    add(m, false);
    // Door shut line and handle.
    box(0.015, 0.62, 0.01, -W * 0.06, 0.74, side * (D / 2 - 0.024), trim);
    box(0.14, 0.03, 0.02, W * 0.02, 0.98, side * (D / 2 - 0.018), trim);
    // Wing mirror.
    box(0.12, 0.09, 0.14, W * 0.2, 1.08, side * (D / 2 + 0.04), trim);
  }
  // Windscreen and rear screen, laid on the slopes.
  const screen = box(0.02, 0.5, D - 0.36, W * 0.15, 1.245, 0, glass);
  screen.rotation.z = Math.atan2(W * 0.18, 0.45);
  const rear = box(0.02, 0.44, D - 0.36, -h + 0.55, 1.25, 0, glass);
  rear.rotation.z = -Math.atan2(0.5, 0.38);

  // Wheels sit in dark arches.
  for (const dx of [-h + 0.72, h - 0.78]) {
    for (const side of [1, -1]) {
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20, 0, Math.PI), trim);
      arch.position.set(dx, 0.36, side * (D / 2 - 0.02));
      if (side < 0) arch.rotation.y = Math.PI;
      add(arch, false);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 20), tyre);
      t.rotation.x = Math.PI / 2;
      t.position.set(dx, 0.33, side * (D / 2 - 0.1));
      add(t);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), alloy);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(dx, 0.33, side * (D / 2 + 0.012));
      add(hub, false);
    }
  }

  // Lamps and plates.
  for (const side of [1, -1]) {
    box(0.06, 0.13, 0.3, h - 0.03, 0.72, side * (D / 2 - 0.3), head);
    box(0.06, 0.16, 0.26, -h + 0.03, 0.82, side * (D / 2 - 0.26), tail);
  }
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), plateF);
  pf.position.set(h + 0.035, 0.5, 0);
  pf.rotation.y = Math.PI / 2;
  const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), plateR);
  pr.position.set(-h - 0.035, 0.6, 0);
  pr.rotation.y = -Math.PI / 2;
  g.add(pf, pr);

  if (project) {
    // The home project car: bonnet propped open.
    const bonnet = box(W * 0.26, 0.04, D - 0.2, h - W * 0.2, 1.22, 0, paint, true);
    bonnet.rotation.z = 0.9;
  }

  const fade: CarFade = { materials: mats, value: 1 };
  g.userData.fade = fade;
  return g;
}

/** Fade a car towards an opacity; it is only see-through while it needs to be. */
export function fadeCar(g: THREE.Object3D, target: number, dt: number): void {
  const fade = g.userData.fade as CarFade | undefined;
  if (!fade) return;
  const next = fade.value + (target - fade.value) * (1 - Math.exp(-10 * dt));
  const value = Math.abs(next - target) < 0.01 ? target : next;
  if (value === fade.value) return;
  const wasSolid = fade.value >= 1;
  const isSolid = value >= 1;
  fade.value = value;
  for (const m of fade.materials) {
    m.opacity = value;
    if (wasSolid !== isSolid) {
      m.transparent = !isSolid;
      m.depthWrite = isSolid;
      m.needsUpdate = true;
    }
  }
  g.traverse((o: THREE.Object3D) => {
    if (!(o as THREE.Mesh).isMesh) return;
    if (o.userData.cast0 === undefined) o.userData.cast0 = o.castShadow;
    o.castShadow = isSolid && o.userData.cast0 === true;
  });
}
