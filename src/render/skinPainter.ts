import * as THREE from 'three';
import type { TattooDesign } from '../character/Appearance';

/**
 * Paints skin textures with tattoos and scars for the procedural rig.
 *
 * UV layout notes (Three.js primitives):
 *  - Capsules (lathe): u runs around the limb starting at +Z (front), v along its length.
 *  - Spheres: u = 0.25 is the front (+Z); v runs top (0) to bottom (1) on the canvas.
 */

export interface SkinPaint {
  tone: string;
  tattoo?: TattooDesign;
  ink?: string;
  /** Where on the canvas (u, 0..1) the design is centred; drawn wrapped. Several entries = drawn several times. */
  tattooAt?: number[];
  scars?: { u: number; v: number; length: number; angle: number }[];
  /** Darkened lower face for stubble, as a v range. */
  stubble?: { colour: string; fromV: number; toV: number; u: number; width: number };
}

const cache = new Map<string, THREE.CanvasTexture>();

export function paintedSkinMaterial(p: SkinPaint, roughness = 0.6): THREE.MeshStandardMaterial {
  const plain = !p.tattoo || p.tattoo === 'none';
  if (plain && !p.scars?.length && !p.stubble) return new THREE.MeshStandardMaterial({ color: p.tone, roughness, metalness: 0 });
  const key = JSON.stringify(p);
  let tex = cache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(paint(p));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    cache.set(key, tex);
    if (cache.size > 64) {
      const first = cache.keys().next().value as string;
      cache.get(first)?.dispose();
      cache.delete(first);
    }
  }
  return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness, metalness: 0 });
}

function paint(p: SkinPaint): HTMLCanvasElement {
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = p.tone;
  g.fillRect(0, 0, W, H);

  if (p.stubble) {
    const s = p.stubble;
    g.fillStyle = s.colour;
    g.globalAlpha = 0.45;
    for (const off of [-W, 0, W]) {
      const x0 = (s.u - s.width / 2) * W + off;
      g.fillRect(x0, s.fromV * H, s.width * W, (s.toV - s.fromV) * H);
    }
    // Speckle for texture.
    g.globalAlpha = 0.5;
    for (let i = 0; i < 500; i++) {
      const u = s.u + (Math.random() - 0.5) * s.width;
      const v = s.fromV + Math.random() * (s.toV - s.fromV);
      g.fillRect(((u + 1) % 1) * W, v * H, 1, 1);
    }
    g.globalAlpha = 1;
  }

  if (p.tattoo && p.tattoo !== 'none') {
    const ink = p.ink ?? '#1a2230';
    for (const u of p.tattooAt ?? [0.25, 0.75]) {
      for (const off of [-W, 0, W]) drawDesign(g, p.tattoo, u * W + off, H / 2, W, H, ink);
    }
  }

  for (const s of p.scars ?? []) {
    g.save();
    g.translate(s.u * W, s.v * H);
    g.rotate(s.angle);
    g.strokeStyle = 'rgba(214,160,150,0.95)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo((-s.length / 2) * W, 0);
    g.lineTo((s.length / 2) * W, 0);
    g.stroke();
    g.strokeStyle = 'rgba(120,60,55,0.6)';
    g.lineWidth = 1;
    for (let x = -s.length / 2; x < s.length / 2; x += 0.02) {
      g.beginPath();
      g.moveTo(x * W, -4);
      g.lineTo(x * W, 4);
      g.stroke();
    }
    g.restore();
  }
  return c;
}

/** Original simple tattoo designs, drawn in code. */
function drawDesign(g: CanvasRenderingContext2D, design: TattooDesign, cx: number, cy: number, W: number, H: number, ink: string): void {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  const s = H / 128;
  switch (design) {
    case 'tribal': {
      g.beginPath();
      g.moveTo(-30 * s, -40 * s);
      g.quadraticCurveTo(10 * s, -20 * s, -5 * s, 0);
      g.quadraticCurveTo(-20 * s, 20 * s, 25 * s, 42 * s);
      g.quadraticCurveTo(-5 * s, 30 * s, -12 * s, 4 * s);
      g.quadraticCurveTo(-5 * s, -15 * s, -30 * s, -40 * s);
      g.fill();
      g.beginPath();
      g.moveTo(20 * s, -42 * s);
      g.quadraticCurveTo(30 * s, -10 * s, 8 * s, 8 * s);
      g.quadraticCurveTo(22 * s, -12 * s, 20 * s, -42 * s);
      g.fill();
      break;
    }
    case 'rose': {
      g.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(0, -12 * s, (6 + i * 5) * s, i * 0.9, i * 0.9 + Math.PI * 1.4);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(0, 10 * s);
      g.quadraticCurveTo(-6 * s, 30 * s, 2 * s, 45 * s);
      g.stroke();
      g.beginPath();
      g.ellipse(-10 * s, 26 * s, 9 * s, 4 * s, -0.5, 0, Math.PI * 2);
      g.ellipse(10 * s, 32 * s, 9 * s, 4 * s, 0.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'swallow': {
      g.beginPath();
      g.moveTo(-34 * s, -6 * s);
      g.quadraticCurveTo(-10 * s, -20 * s, 8 * s, -8 * s);
      g.lineTo(34 * s, -22 * s);
      g.lineTo(18 * s, 0);
      g.lineTo(34 * s, 18 * s);
      g.lineTo(6 * s, 6 * s);
      g.quadraticCurveTo(-14 * s, 14 * s, -34 * s, -6 * s);
      g.fill();
      break;
    }
    case 'crown': {
      g.beginPath();
      g.moveTo(-28 * s, 18 * s);
      g.lineTo(-28 * s, -14 * s);
      g.lineTo(-14 * s, 2 * s);
      g.lineTo(0, -24 * s);
      g.lineTo(14 * s, 2 * s);
      g.lineTo(28 * s, -14 * s);
      g.lineTo(28 * s, 18 * s);
      g.closePath();
      g.stroke();
      g.fillRect(-28 * s, 20 * s, 56 * s, 6 * s);
      for (const x of [-28, 0, 28]) {
        g.beginPath();
        g.arc(x * s, (x === 0 ? -28 : -18) * s, 4 * s, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'geometric': {
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 30 * s;
        const y = Math.sin(a) * 30 * s;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(0, -30 * s);
      g.lineTo(26 * s, 15 * s);
      g.lineTo(-26 * s, 15 * s);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.arc(0, 0, 8 * s, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'sleeve': {
      // Wraps the whole limb: bands and waves.
      g.restore();
      g.save();
      g.fillStyle = ink;
      g.strokeStyle = ink;
      g.globalAlpha = 0.85;
      g.lineWidth = 5;
      for (let y = 12; y < H; y += 26) {
        g.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const yy = y + Math.sin((x / W) * Math.PI * 8) * 7;
          if (x === 0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
      }
      g.globalAlpha = 0.5;
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.arc(((i * 37) % W) + 10, ((i * 23) % H) + 6, 6, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'none':
      break;
  }
  g.restore();
  void W;
}
