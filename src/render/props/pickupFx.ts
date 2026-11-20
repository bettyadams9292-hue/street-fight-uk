import * as THREE from 'three';

/**
 * The glow under anything you can pick up, in its rarity colour:
 * - a ring lying flat on the floor, turning slowly, with a soft pool of light inside it;
 * - a faint column of light rising from it, fading out by knee height (the "hologram");
 * - a halo that always faces the camera behind the item, so it glows from any angle;
 * - a few motes drifting up through the column.
 * Everything is additive and writes no depth, so it lights what's under it rather than covering it, and
 * shares four small textures drawn once on a canvas.
 */

let tex: { ring: THREE.Texture; pool: THREE.Texture; beam: THREE.Texture; dot: THREE.Texture } | null = null;

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textures() {
  if (tex) return tex;
  const ring = canvasTex(256, (g, s) => {
    const c = s / 2;
    // A bright thin band with a soft bloom either side, and four short ticks round it (so its turning shows).
    const grad = g.createRadialGradient(c, c, s * 0.3, c, c, s * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    grad.addColorStop(0.72, 'rgba(255,255,255,1)');
    grad.addColorStop(0.8, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = s * 0.018;
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2;
      g.beginPath();
      g.arc(c, c, s * 0.3, a0, a0 + 0.55);
      g.stroke();
    }
  });
  const pool = canvasTex(128, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  const beam = canvasTex(64, (g, s) => {
    // Bright at the floor, gone by the top; a little brighter at the edges, like light seen through glass.
    const v = g.createLinearGradient(0, s, 0, 0);
    v.addColorStop(0, 'rgba(255,255,255,0.8)');
    v.addColorStop(0.25, 'rgba(255,255,255,0.22)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, s, s);
  });
  const dot = canvasTex(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  tex = { ring, pool, beam, dot };
  return tex;
}

const glowMat = (map: THREE.Texture, colour: THREE.Color, opacity: number, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshBasicMaterial({ map, color: colour, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side, toneMapped: false });

export interface PickupFx {
  root: THREE.Group;
  /** The halo behind the item: add it to whatever bobs, so it stays with the item. */
  halo: THREE.Sprite;
  update(time: number): void;
}

/** A pickup's glow, sized for an item about `size` metres across. */
export function pickupFx(colour: THREE.ColorRepresentation, size = 0.4, seed = 0): PickupFx {
  const t = textures();
  const c = new THREE.Color(colour);
  const root = new THREE.Group();
  root.name = 'pickupFx';
  const r = Math.max(0.26, size * 0.85);

  const ring = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), glowMat(t.ring, c, 0.95));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  ring.renderOrder = 2;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.7, r * 1.7), glowMat(t.pool, c, 0.45));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  pool.renderOrder = 1;

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.62, 0.7, 24, 1, true), glowMat(t.beam, c, 0.16, THREE.DoubleSide));
  beam.position.y = 0.35;
  beam.renderOrder = 3;

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.dot, color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(size * 1.5);
  halo.renderOrder = 0;

  const motes: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.dot, color: c.clone().lerp(new THREE.Color('#ffffff'), 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.scale.setScalar(0.045);
    m.userData.phase = i / 5 + seed * 0.37;
    m.userData.ang = (i / 5) * Math.PI * 2 + seed;
    motes.push(m);
  }
  root.add(pool, ring, beam, ...motes);

  return {
    root,
    halo,
    update(time: number) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.6 + seed);
      ring.rotation.z = time * 0.8 + seed;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * pulse;
      ring.scale.setScalar(0.96 + 0.06 * pulse);
      (pool.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * pulse;
      (beam.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.08 * pulse;
      (halo.material as THREE.SpriteMaterial).opacity = 0.35 + 0.25 * pulse;
      for (const m of motes) {
        // Each mote rises through the column on a slow spiral, fading in and out.
        const k = (time * 0.45 + (m.userData.phase as number)) % 1;
        const a = (m.userData.ang as number) + time * 0.9;
        m.position.set(Math.cos(a) * r * 0.45, 0.05 + k * 0.7, Math.sin(a) * r * 0.45);
        (m.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.9;
      }
    },
  };
}
