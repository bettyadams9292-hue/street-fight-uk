/**
 * Drawing a car's cosmetic mods (property/carMods.ts) onto its own model from the car kit (VehicleLibrary.carPiece).
 * Everything is fitted to the model it's going on: its size from its bounding box, the deck for a spoiler and the
 * bonnet and roof for rally stripes found by casting rays at the body, the alloys on each wheel's outer face. All of
 * it is added in the model's own (file) space before it's scaled to the car, so it stretches with the body and the
 * wheels stay round. A handful of small meshes; nothing per frame.
 *
 * File space: front along +z, width along x, standing on y.
 */
import * as THREE from 'three';
import type { CarMods } from '../../property/carMods';

const WHEEL: Record<NonNullable<CarMods['wheels']>, [string, number, number] | null> = {
  stock: null,
  // Metalness kept moderate: there's no environment map, so full metal would read black.
  chrome: ['#e8ebf0', 0.22, 0.5],
  black: ['#141414', 0.3, 0.4],
  gold: ['#d9b23a', 0.3, 0.5],
  bronze: ['#9a6332', 0.35, 0.45],
  white: ['#f2f2ee', 0.4, 0.2],
};
const CALLIPER: Record<NonNullable<CarMods['calliper']>, string | null> = { stock: null, red: '#d0201a', yellow: '#f2c200', blue: '#1f5fd0', green: '#2c9a46' };
const TINT: Record<NonNullable<CarMods['tint']>, [number, number] | null> = { none: null, light: [0x0b1016, 0.08], dark: [0x040506, 0.05], limo: [0x000000, 0.02] };
const RIDE: Record<NonNullable<CarMods['ride']>, number> = { stock: 0, lowered: -0.03, slammed: -0.06, lifted: 0.07 };

const std = (colour: string | number, rough: number, metal: number) => new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal });

/** A UK plate: white at the front, yellow at the back, black characters. */
function plateTexture(text: string, rear: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 260;
  c.height = 56;
  const g = c.getContext('2d')!;
  g.fillStyle = rear ? '#f2c200' : '#f4f4ee';
  g.fillRect(0, 0, 260, 56);
  g.fillStyle = '#1b4fa8';
  g.fillRect(0, 0, 22, 56);
  g.fillStyle = '#111';
  g.font = 'bold 40px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 141, 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Put `mods` on a car model (`inner`: the file's root, not yet scaled). `paint` is the body colour, for kit parts
 * painted to match.
 */
export function applyCarMods(inner: THREE.Object3D, mods: CarMods, paint: string): void {
  const parent = inner.parent;
  if (parent) parent.remove(inner);
  inner.updateMatrixWorld(true);
  const body = inner.getObjectByName('body') ?? inner;
  // Body parts are fitted in the body's own frame and hung on it, so they ride with it.
  const toLocal = body.matrixWorld.clone().invert();
  const bodyMeshes: THREE.Mesh[] = [];
  body.traverse((o) => (o as THREE.Mesh).isMesh && bodyMeshes.push(o as THREE.Mesh));
  const box = new THREE.Box3().setFromObject(body).applyMatrix4(toLocal);
  const size = box.getSize(new THREE.Vector3());
  const W = size.x;
  const H = size.y;
  const L = size.z;
  const ray = new THREE.Raycaster();
  /** The body's surface straight down from above at (x, z), in local space. */
  const deck = (x: number, z: number): number | null => {
    const o = new THREE.Vector3(x, box.max.y + 1, z).applyMatrix4(body.matrixWorld);
    const d = new THREE.Vector3(0, -1, 0).transformDirection(body.matrixWorld);
    ray.set(o, d);
    const hit = ray.intersectObjects(bodyMeshes, false)[0];
    return hit ? hit.point.clone().applyMatrix4(toLocal).y : null;
  };
  const add = (m: THREE.Mesh, to: THREE.Object3D = body) => {
    m.castShadow = true;
    to.add(m);
    return m;
  };
  const boxMesh = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, to?: THREE.Object3D) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return add(m, to);
  };
  const paintMat = std(paint, 0.35, 0.5);
  const black = std('#101012', 0.5, 0.3);

  // Window tint: the car's own glass, darker.
  const tint = TINT[mods.tint ?? 'none'];
  if (tint)
    inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (!mesh.isMesh || !m || m.name !== 'window') return;
      const t = m.clone();
      t.color.setHex(tint[0]);
      t.roughness = tint[1];
      t.metalness = 0.95;
      mesh.material = t;
    });


  // Alloys and callipers, on each wheel's outer face.
  const wheel = WHEEL[mods.wheels ?? 'stock'];
  const calliper = CALLIPER[mods.calliper ?? 'stock'];
  if (wheel || calliper) {
    const centreX = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3()).x;
    inner.traverse((o) => {
      if (o === inner || !o.name.startsWith('wheel') || o.userData.modded) return;
      o.userData.modded = true;
      const wl = o.matrixWorld.clone().invert();
      const wb = new THREE.Box3().setFromObject(o).applyMatrix4(wl);
      const ws = wb.getSize(new THREE.Vector3());
      const wc = wb.getCenter(new THREE.Vector3());
      const r = Math.min(ws.y, ws.z) / 2;
      // Which way is out: away from the middle of the car.
      const worldC = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      // ...in the wheel's own frame (the right-hand wheels may be turned round).
      const out = Math.sign(new THREE.Vector3(worldC.x >= centreX ? 1 : -1, 0, 0).transformDirection(wl).x) || 1;
      const face = wc.x + out * (ws.x / 2 + 0.002);
      if (calliper) boxMesh(ws.x * 0.25, r * 0.36, r * 0.28, wc.x + out * ws.x * 0.32, wc.y + r * 0.32, wc.z - r * 0.25, std(calliper, 0.4, 0.2), o);
      if (wheel) {
        const [col, rough, metal] = wheel;
        const rim = std(col, rough, metal);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, ws.x * 0.06, 24), rim);
        disc.rotation.z = Math.PI / 2;
        disc.position.set(face, wc.y, wc.z);
        add(disc, o);
        // Spokes cut into it: dark slots between five spokes, and a centre cap.
        const slot = std('#0a0a0a', 0.8, 0);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
          const s = boxMesh(0.004, r * 0.36, r * 0.16, face + out * 0.003, wc.y + Math.cos(a) * r * 0.38, wc.z + Math.sin(a) * r * 0.38, slot, o);
          s.rotation.x = -a;
        }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.14, r * 0.14, ws.x * 0.08, 12), rim);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(face + out * 0.004, wc.y, wc.z);
        add(cap, o);
      }
    });
  }

  // Spoiler on the boot: a lip on the edge of the deck, or a wing on posts above it.
  const spoiler = mods.spoiler ?? 'none';
  if (spoiler !== 'none') {
    const z = box.min.z + L * 0.06;
    const y = deck(0, z) ?? box.min.y + H * 0.6;
    if (spoiler === 'lip') boxMesh(W * 0.78, H * 0.035, L * 0.05, 0, y + H * 0.02, z, paintMat);
    else {
      for (const sx of [-1, 1]) boxMesh(W * 0.03, H * 0.14, L * 0.03, sx * W * 0.3, y + H * 0.07, z + L * 0.01, black);
      const wing = boxMesh(W * 0.92, H * 0.025, L * 0.08, 0, y + H * 0.15, z, black);
      wing.rotation.x = -0.12;
      boxMesh(W * 0.02, H * 0.08, L * 0.09, -W * 0.46, y + H * 0.15, z, black);
      boxMesh(W * 0.02, H * 0.08, L * 0.09, W * 0.46, y + H * 0.15, z, black);
    }
  }

  // Body kit: side skirts and a front splitter, in the body colour with a black lip.
  if ((mods.kit ?? 'stock') === 'sport') {
    const y = box.min.y + H * 0.2;
    for (const sx of [-1, 1]) boxMesh(W * 0.03, H * 0.05, L * 0.42, sx * (W / 2 - W * 0.02), y, (box.min.z + box.max.z) / 2, black);
    boxMesh(W * 0.86, H * 0.025, L * 0.05, 0, box.min.y + H * 0.1, box.max.z - L * 0.01, black);
  }

  // Exhaust tips out of the back.
  const ex = mods.exhaust ?? 'stock';
  if (ex !== 'stock') {
    const chrome = std('#d8dce1', 0.25, 0.5);
    const xs = ex === 'twin' ? [-W * 0.3, W * 0.3] : [-W * 0.34, -W * 0.25, W * 0.25, W * 0.34];
    for (const x of xs) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.028, W * 0.028, L * 0.05, 12, 1, true), chrome);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, box.min.y + H * 0.17, box.min.z + L * 0.01);
      chrome.side = THREE.DoubleSide;
      add(t);
    }
  }

  // Private plates, front and back.
  if (mods.plate) {
    const y = box.min.y + H * 0.3;
    const pw = W * 0.32;
    for (const rear of [false, true]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw * 0.215), new THREE.MeshBasicMaterial({ map: plateTexture(mods.plate, rear) }));
      m.position.set(0, y, rear ? box.min.z - 0.004 : box.max.z + 0.004);
      if (rear) m.rotation.y = Math.PI;
      body.add(m);
    }
  }

  // Decals: a stripe down each side, or rally stripes over the bonnet, roof and boot.
  const decal = mods.decal ?? 'none';
  if (decal !== 'none') {
    const dm = std(mods.decalColour ?? '#f4f4f0', 0.5, 0.1);
    if (decal === 'stripe') {
      for (const sx of [-1, 1]) boxMesh(0.004, H * 0.035, L * 0.66, sx * (W / 2 + 0.002), box.min.y + H * 0.42, (box.min.z + box.max.z) / 2, dm);
    } else {
      const n = 14;
      for (const sx of [-W * 0.09, W * 0.09]) {
        let prev: THREE.Vector3 | null = null;
        for (let i = 0; i <= n; i++) {
          const z = box.min.z + L * (0.03 + (0.94 * i) / n);
          const y = deck(sx, z);
          if (y === null) {
            prev = null;
            continue;
          }
          const p = new THREE.Vector3(sx, y + 0.004, z);
          if (prev) {
            const len = p.distanceTo(prev);
            const s = boxMesh(W * 0.06, 0.004, len + 0.002, sx, (p.y + prev.y) / 2, (p.z + prev.z) / 2, dm);
            s.rotation.x = -Math.atan2(p.y - prev.y, p.z - prev.z);
            s.castShadow = false;
          }
          prev = p;
        }
      }
    }
  }

  // Ride height last: the body (and everything hung on it) sits lower or higher on its wheels.
  const lift = RIDE[mods.ride ?? 'stock'];
  if (lift && body !== inner) body.position.y += lift * H;
  if (parent) parent.add(inner);
}
