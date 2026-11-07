import * as THREE from 'three';
import type { WeaponData } from '../combat/Weapons';

/**
 * A held or dropped weapon. Built along +Y from the grip (y=0) to the tip
 * (y=length), so it can hang from a hand or lie on the floor.
 */
export function buildWeaponMesh(w: WeaponData): THREE.Group {
  const g = new THREE.Group();
  const col = new THREE.Color(w.colour);
  const L = w.length;
  if (w.id === 'bottle') {
    const glass = new THREE.MeshStandardMaterial({ color: col, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 });
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, L * 0.4, 10), glass);
    neck.position.y = L * 0.2;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L * 0.6, 12), glass);
    body.position.y = L * 0.7;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, L * 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.8 }));
    label.position.y = L * 0.68;
    g.add(neck, body, label);
  } else if (w.id === 'bat') {
    const wood = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, L * 0.32, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
    grip.position.y = L * 0.16;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, L * 0.68, 0.035), wood);
    blade.position.y = L * 0.66;
    g.add(grip, blade);
  } else {
    const metal = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.8 });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, L, 10), metal);
    pipe.position.y = L / 2;
    const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), metal);
    elbow.position.y = L - 0.04;
    g.add(pipe, elbow);
  }
  g.traverse((o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        (m as THREE.MeshStandardMaterial).emissiveMap?.dispose();
        m.dispose();
      }
    }
  });
}
