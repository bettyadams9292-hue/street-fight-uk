import * as THREE from 'three';
import type { WeaponData } from '../combat/Weapons';
import { weaponModel } from './props/PropLibrary';

/**
 * Procedural models for every melee weapon and improvised object.
 * Convention: the grip sits at the origin and the weapon extends along +y
 * for `length` metres, so FighterView can put the origin in the hand.
 */
export function buildWeaponMesh(w: WeaponData): THREE.Group {
  // Modelled weapons (public/models/props) where there is one; primitives otherwise.
  const model = weaponModel(w.id, w.length);
  if (model) return model;
  const g = new THREE.Group();
  const L = w.length;
  const col = w.colour;
  const std = (c: string | number, rough = 0.6, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, ...extra });
  const wood = (c: string = col) => std(c, 0.7);
  const steel = (c = '#a8acb2') => std(c, 0.3, 0.85);
  const rubber = () => std('#161616', 0.9);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };
  const rod = (r0: number, r1: number, y0: number, y1: number, m: THREE.Material, seg = 10) =>
    add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), m, 0, (y0 + y1) / 2);
  const box = (sx: number, sy: number, sz: number, x: number, y: number, m: THREE.Material, z = 0) => add(new THREE.BoxGeometry(sx, sy, sz), m, x, y, z);
  const grip = (len: number, r = 0.02) => rod(r, r, 0, len, rubber());

  switch (w.id) {
    case 'bottle':
    case 'broken_bottle': {
      const glass = std(col, 0.08, 0.1, { transparent: true, opacity: 0.85 });
      rod(0.018, 0.022, 0, L * 0.4, glass);
      if (w.id === 'bottle') {
        rod(0.04, 0.04, L * 0.4, L, glass, 12);
        add(new THREE.CylinderGeometry(0.041, 0.041, L * 0.18, 12), std('#d8c8a0', 0.8), 0, L * 0.68);
      } else {
        rod(0.04, 0.035, L * 0.4, L * 0.75, glass, 12);
        // Jagged shards.
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(new THREE.ConeGeometry(0.012, 0.06 + (i % 2) * 0.04, 4), glass, Math.cos(a) * 0.03, L * 0.8 + (i % 2) * 0.02, Math.sin(a) * 0.03);
        }
      }
      break;
    }
    case 'bat': {
      grip(L * 0.32, 0.018);
      box(0.1, L * 0.68, 0.035, 0, L * 0.66, wood());
      add(new THREE.CylinderGeometry(0.03, 0.02, 0.06, 8), wood(), 0, L * 0.34);
      break;
    }
    case 'baseball_bat': {
      rod(0.02, 0.02, 0, L * 0.25, rubber());
      add(new THREE.SphereGeometry(0.028, 8, 6), wood(), 0, 0);
      rod(0.02, 0.042, L * 0.25, L * 0.92, wood(), 14);
      add(new THREE.SphereGeometry(0.042, 12, 8), wood(), 0, L * 0.92);
      break;
    }
    case 'pipe':
    case 'metal_bar':
    case 'shelf_bar': {
      const m = w.id === 'metal_bar' ? std(col, 0.75, 0.6) : steel(col);
      if (w.id === 'shelf_bar') {
        box(0.04, L, 0.04, 0, L / 2, m);
        for (let y = 0.1; y < L; y += 0.08) box(0.042, 0.02, 0.01, 0, y, std('#22252a', 0.5), 0.02);
      } else {
        rod(0.022, 0.022, 0, L, m);
        add(new THREE.CylinderGeometry(0.032, 0.032, 0.08, 10), m, 0, L - 0.04);
        if (w.id === 'metal_bar') add(new THREE.TorusGeometry(0.03, 0.006, 6, 12), std('#7a3a1a', 0.9, 0.3), 0, L * 0.5, 0, Math.PI / 2);
      }
      break;
    }
    case 'crowbar': {
      const m = std(col, 0.45, 0.6);
      rod(0.014, 0.014, 0, L * 0.9, m, 8);
      add(new THREE.TorusGeometry(0.06, 0.014, 6, 12, Math.PI), m, -0.06, L * 0.9, 0, 0, 0, 0);
      add(new THREE.BoxGeometry(0.05, 0.012, 0.02), m, -0.03, 0, 0, 0, 0, 0.4);
      break;
    }
    case 'hammer': {
      rod(0.016, 0.018, 0, L * 0.85, wood('#8a6a42'));
      grip(L * 0.35, 0.02);
      box(0.13, 0.035, 0.035, 0.02, L * 0.9, steel('#4a4d52'));
      add(new THREE.BoxGeometry(0.06, 0.012, 0.025), steel('#4a4d52'), -0.06, L * 0.93, 0, 0, 0, 0.6);
      break;
    }
    case 'machete':
    case 'knife': {
      const handle = w.id === 'knife' ? std('#1a1a1a', 0.6) : wood('#3a2a1a');
      const hl = w.id === 'knife' ? 0.1 : 0.14;
      box(0.026, hl, 0.02, 0, hl / 2, handle);
      box(0.04, 0.012, 0.024, 0, hl, steel('#6a6e72'));
      const bw = w.id === 'knife' ? 0.03 : 0.055;
      box(bw, L - hl, 0.004, bw * 0.2, hl + (L - hl) / 2, steel(col));
      add(new THREE.ConeGeometry(bw / 2, 0.05, 3), steel(col), bw * 0.2, L + 0.02, 0, 0, Math.PI / 6);
      break;
    }
    case 'chain': {
      const m = steel(col);
      const links = Math.round(L / 0.035);
      for (let i = 0; i < links; i++) {
        const t = i / links;
        // Hangs in a loose curve.
        const x = Math.sin(t * Math.PI) * 0.08;
        add(new THREE.TorusGeometry(0.014, 0.004, 4, 8), m, x, t * L, 0, 0, i % 2 ? Math.PI / 2 : 0, 0);
      }
      box(0.03, 0.08, 0.03, 0, 0.02, rubber());
      break;
    }
    case 'wrench': {
      const m = std(col, 0.45, 0.5);
      box(0.035, L * 0.75, 0.02, 0, L * 0.375, m);
      box(0.09, 0.05, 0.035, 0.02, L * 0.8, steel('#7a7e84'));
      box(0.03, 0.12, 0.035, 0.05, L * 0.9, steel('#7a7e84'));
      box(0.03, 0.06, 0.035, -0.02, L * 0.92, steel('#7a7e84'));
      break;
    }
    case 'club':
    case 'table_leg':
    case 'chair_leg': {
      const top = w.id === 'club' ? 0.05 : w.id === 'table_leg' ? 0.035 : 0.022;
      rod(0.02, top, 0, L, wood(), 10);
      if (w.id === 'table_leg') box(0.06, 0.06, 0.06, 0, L, wood());
      if (w.id === 'chair_leg') add(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 4), steel('#888'), 0.02, L, 0, 0, 0, Math.PI / 2);
      if (w.id === 'club') for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.035, 0.005, 4, 10), std('#2a1a10', 0.8), 0, L * (0.55 + i * 0.12), 0, Math.PI / 2);
      break;
    }
    case 'pool_cue':
    case 'golf_club':
    case 'umbrella': {
      if (w.id === 'pool_cue') {
        rod(0.016, 0.006, 0, L, wood(), 10);
        rod(0.017, 0.016, 0, L * 0.35, std('#1a1a1a', 0.4));
        add(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 8), std('#3a6ab0', 0.8), 0, L);
      } else if (w.id === 'golf_club') {
        grip(0.25, 0.014);
        rod(0.008, 0.006, 0.25, L, steel(col), 8);
        add(new THREE.BoxGeometry(0.09, 0.03, 0.04), steel('#3a3d42'), 0.04, L, 0, 0, 0, -0.2);
      } else {
        add(new THREE.TorusGeometry(0.035, 0.008, 6, 10, Math.PI), std('#2a1a10', 0.6), -0.035, 0, 0, 0, 0, Math.PI);
        rod(0.008, 0.008, 0, L, steel('#2a2a2a'), 6);
        add(new THREE.ConeGeometry(0.06, L * 0.75, 8), std(col, 0.9), 0, L * 0.6, 0, Math.PI);
      }
      break;
    }
    case 'pole': {
      const m = steel(col);
      rod(0.024, 0.024, 0, L, m);
      add(new THREE.BoxGeometry(0.08, 0.06, 0.08), steel('#5a5e64'), 0, L - 0.05);
      break;
    }
    case 'torch': {
      rod(0.022, 0.022, 0, L * 0.75, std(col, 0.35, 0.7));
      rod(0.022, 0.035, L * 0.75, L, std(col, 0.35, 0.7));
      add(new THREE.CircleGeometry(0.032, 12), std('#ffffff', 0.2, 0, { emissive: 0xfff4c0, emissiveIntensity: 0.8 }), 0, L + 0.001, 0, -Math.PI / 2);
      break;
    }
    case 'mop':
    case 'broom':
    case 'rake': {
      rod(0.014, 0.014, 0, L, wood(w.id === 'mop' ? '#c8c8c0' : '#a07a4a'), 8);
      if (w.id === 'mop') {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          add(new THREE.CylinderGeometry(0.008, 0.01, 0.2, 4), std('#d8d4c0', 1), Math.cos(a) * 0.035, L + 0.06, Math.sin(a) * 0.035, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
        }
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), std(col, 0.5), 0, L - 0.02);
      } else if (w.id === 'broom') {
        box(0.3, 0.05, 0.05, 0, L, std(col, 0.6));
        box(0.28, 0.07, 0.04, 0, L + 0.06, std('#2a2420', 1));
      } else {
        box(0.36, 0.02, 0.02, 0, L, steel('#5a5e64'));
        for (let i = 0; i < 12; i++) box(0.006, 0.05, 0.006, -0.17 + i * 0.031, L + 0.03, steel('#5a5e64'), 0.01);
      }
      break;
    }
    case 'road_sign': {
      rod(0.02, 0.02, 0, L * 0.72, steel('#9aa0a8'));
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24), std('#ffffff', 0.5), 0, L * 0.85, 0, Math.PI / 2);
      add(new THREE.TorusGeometry(0.18, 0.025, 6, 24), std(col, 0.5), 0, L * 0.85, 0.008);
      break;
    }
    case 'cone': {
      add(new THREE.ConeGeometry(0.13, L * 0.9, 16, 1, true), std(col, 0.6), 0, L * 0.55);
      add(new THREE.CylinderGeometry(0.075, 0.095, 0.08, 16, 1, true), std('#f0f0f0', 0.4), 0, L * 0.5);
      box(0.3, 0.04, 0.3, 0, 0.02, std('#1a1a1a', 0.8));
      break;
    }
    case 'plank': {
      box(0.12, L, 0.025, 0, L / 2, wood());
      for (const y of [L * 0.3, L * 0.8]) add(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4), steel('#777'), 0.03, y, 0.02, Math.PI / 2);
      break;
    }
    case 'chair': {
      const m = wood();
      // Held upside down by a leg.
      const s = L * 0.5;
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.03, s, 0.03, dx, s / 2, m, dz);
      box(0.42, 0.04, 0.42, 0, s, m);
      box(0.42, 0.4, 0.03, 0, s + 0.2, m, 0.2);
      break;
    }
    case 'tv':
    case 'monitor': {
      const m = std(col, 0.5);
      if (w.id === 'tv') {
        box(0.5, 0.4, 0.4, 0, L * 0.55, m);
        box(0.42, 0.32, 0.01, 0, L * 0.55, std('#203028', 0.15, 0.3), 0.205);
      } else {
        box(0.5, 0.32, 0.04, 0, L * 0.6, m);
        box(0.46, 0.28, 0.005, 0, L * 0.6, std('#0a0e18', 0.1, 0.4, { emissive: 0x1a2a4a, emissiveIntensity: 0.4 }), 0.022);
        box(0.04, 0.18, 0.04, 0, L * 0.25, m);
        box(0.2, 0.02, 0.14, 0, 0.02, m);
      }
      break;
    }
    case 'skateboard': {
      box(0.2, L, 0.015, 0, L / 2, std(col, 0.6));
      box(0.21, L * 0.9, 0.002, 0, L / 2, std('#111', 1), -0.009);
      for (const y of [L * 0.2, L * 0.8]) {
        box(0.16, 0.03, 0.03, 0, y, steel('#9a9ea4'), 0.025);
        for (const dx of [-0.08, 0.08]) add(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 12), std('#f0e8c8', 0.4), dx, y, 0.045, 0, 0, Math.PI / 2);
      }
      break;
    }
    case 'shovel':
    case 'garden_fork': {
      add(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), std('#1a1a1a', 0.7), 0, 0.02, 0, 0, 0, Math.PI);
      rod(0.016, 0.016, 0, L * 0.72, wood('#a07a4a'), 8);
      rod(0.02, 0.022, L * 0.72, L * 0.8, std(col, 0.5, 0.5), 8);
      if (w.id === 'shovel') {
        box(0.22, L * 0.22, 0.01, 0, L * 0.9, steel('#6a6e74'));
        add(new THREE.ConeGeometry(0.11, 0.06, 4), steel('#6a6e74'), 0, L + 0.02, 0, 0, Math.PI / 4);
      } else {
        box(0.2, 0.03, 0.02, 0, L * 0.81, steel('#6a6e74'));
        for (let i = 0; i < 4; i++) box(0.012, L * 0.18, 0.012, -0.09 + i * 0.06, L * 0.91, steel('#6a6e74'));
      }
      break;
    }
    case 'brick': {
      box(0.1, L, 0.065, 0, L / 2, std(col, 0.95));
      break;
    }
    case 'frying_pan': {
      box(0.03, L * 0.55, 0.015, 0, L * 0.27, std('#1a1a1a', 0.6));
      add(new THREE.CylinderGeometry(0.13, 0.11, 0.04, 20), std(col, 0.4, 0.6), 0, L * 0.55 + 0.13, 0, Math.PI / 2);
      break;
    }
    case 'dustbin_lid': {
      add(new THREE.SphereGeometry(0.27, 18, 8, 0, Math.PI * 2, 0, Math.PI / 4), steel(col), 0, L * 0.5, 0, -Math.PI / 2);
      box(0.12, 0.03, 0.03, 0, L * 0.5, steel('#5a5e64'), -0.03);
      break;
    }
    default: {
      // Anything new gets a sensible pipe until it has a model.
      rod(0.022, 0.022, 0, L, steel(col));
    }
  }
  g.traverse((o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o: THREE.Object3D) => {
    // Shared prop geometry and cached materials (propModels.ts) outlive any one level.
    if (o instanceof THREE.Mesh && !o.userData.shared) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        (m as THREE.MeshStandardMaterial).emissiveMap?.dispose();
        (m as THREE.MeshStandardMaterial).normalMap?.dispose();
        m.dispose();
      }
    }
  });
}
