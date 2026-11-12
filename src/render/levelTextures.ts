import * as THREE from 'three';
import { canvas, toTexture } from './textures';

/**
 * Canvas textures for the neighbourhood: signs, graffiti, tiles, cladding,
 * floors. Generated at load from a seed, so every visit looks the same.
 */

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shop fascia / pub board lettering. */
export function signTexture(
  text: string,
  bg: string,
  fg: string,
  opts: { serif?: boolean; neon?: boolean; w?: number; h?: number; aspect?: number; gilt?: boolean; maxLetter?: number } = {},
): THREE.CanvasTexture {
  // The canvas takes the board's shape, so letters are never stretched.
  const h = opts.h ?? 160;
  const w = opts.aspect ? Math.max(h, Math.min(4096, Math.round(h * opts.aspect))) : opts.w ?? 1024;
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (!opts.neon) {
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
  }
  let size = h * (opts.maxLetter ?? 0.62);
  const font = (s: number) => `${opts.serif ? '700' : '800'} ${s}px ${opts.serif ? 'Georgia, "Times New Roman", serif' : '"Arial Black", Arial, sans-serif'}`;
  g.font = font(size);
  while (g.measureText(text).width > w * 0.9 && size > 10) {
    size -= 4;
    g.font = font(size);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opts.neon) {
    g.shadowColor = fg;
    g.shadowBlur = 28;
  }
  if (opts.gilt) {
    // Signwritten gold leaf: a dark drop shadow, then a light-to-deep gold gradient, then a fine outline.
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillText(text, w / 2 + h * 0.025, h / 2 + 4 + h * 0.03);
    const grad = g.createLinearGradient(0, h * 0.2, 0, h * 0.8);
    grad.addColorStop(0, '#fff2b8');
    grad.addColorStop(0.45, '#d9b14a');
    grad.addColorStop(0.55, '#a67a1e');
    grad.addColorStop(1, '#e8c86a');
    g.fillStyle = grad;
    g.fillText(text, w / 2, h / 2 + 4);
    g.lineWidth = Math.max(1, h * 0.012);
    g.strokeStyle = 'rgba(60,40,10,0.8)';
    g.strokeText(text, w / 2, h / 2 + 4);
    return toTexture(c);
  }
  if (!opts.neon) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillText(text, w / 2 + h * 0.02, h / 2 + 4 + h * 0.025);
  }
  g.fillStyle = fg;
  g.fillText(text, w / 2, h / 2 + 4);
  return toTexture(c);
}

const TAG_SYLLABLES = ['KRO', 'ZEP', 'DEK', 'MOX', 'RAZ', 'SKY', 'NUK', 'VEX', 'TOM', 'OKE', 'FLO', 'BIZ', 'JAX', 'REK', 'SNO', 'GRIT', 'KAZ', 'ONE', 'TWO', 'UKO'];
const SPRAY = ['#e8e8e8', '#ff3d6e', '#3dd7ff', '#ffd23d', '#7dff5a', '#b06bff', '#ff7a2e'];

/** A spray-painted tag: made-up letters, outline and fill, a few drips. */
export function graffitiTexture(rnd: () => number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  const word = TAG_SYLLABLES[Math.floor(rnd() * TAG_SYLLABLES.length)] + (rnd() < 0.5 ? TAG_SYLLABLES[Math.floor(rnd() * TAG_SYLLABLES.length)] : '');
  const fill = SPRAY[Math.floor(rnd() * SPRAY.length)];
  const outline = SPRAY[Math.floor(rnd() * SPRAY.length)];
  g.save();
  g.translate(256, 135);
  g.rotate((rnd() - 0.5) * 0.25);
  g.transform(1, 0, (rnd() - 0.5) * 0.5, 1, 0, 0);
  let size = 130;
  g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  while (g.measureText(word).width > 470) {
    size -= 6;
    g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 22;
  g.strokeStyle = '#101010';
  g.strokeText(word, 0, 0);
  g.lineWidth = 10;
  g.strokeStyle = outline;
  g.strokeText(word, 0, 0);
  g.fillStyle = fill;
  g.fillText(word, 0, 0);
  g.restore();
  // Drips.
  g.strokeStyle = fill;
  g.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const x = 60 + rnd() * 390;
    const y = 150 + rnd() * 30;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + 20 + rnd() * 60);
    g.stroke();
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Fly-posters and council notices. */
export function posterTexture(rnd: () => number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 360);
  const bg = ['#f2e8d0', '#1d1d1d', '#d63a2a', '#2a5bd6', '#f5d000', '#ffffff'][Math.floor(rnd() * 6)];
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 360);
  const dark = bg === '#1d1d1d' || bg === '#2a5bd6' || bg === '#d63a2a';
  g.fillStyle = dark ? '#f5f5f5' : '#151515';
  const heads = ['LIVE TONIGHT', 'CAR BOOT SALE', 'MISSING CAT', 'NO BALL GAMES', 'RAVE', 'KARAOKE', 'BOXING NIGHT', 'FLAT TO LET', 'CASH 4 GOLD', 'STREET PARTY'];
  g.font = '900 34px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  const head = heads[Math.floor(rnd() * heads.length)];
  const words = head.split(' ');
  words.forEach((w, i) => g.fillText(w, 128, 60 + i * 40));
  g.fillRect(30, 60 + words.length * 40, 196, 4);
  g.font = '600 18px Arial, sans-serif';
  for (let i = 0; i < 6; i++) g.fillRect(36, 200 + i * 22, 120 + rnd() * 64, 8);
  return toTexture(c);
}

/** Glazed wall tiles (subway, kitchen, pub frontage). */
export function tileTexture(base: string, grout: string, repeatX: number, repeatY: number, size = 32): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = grout;
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 256; x += size) {
      g.fillStyle = base;
      g.globalAlpha = 0.85 + Math.random() * 0.15;
      g.fillRect(x + 2, y + 2, size - 4, size - 4);
    }
  }
  g.globalAlpha = 1;
  // Grime towards the bottom.
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(30,25,15,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return toTexture(c, repeatX, repeatY);
}

/** Corrugated sheet cladding. */
export function corrugatedTexture(colour: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = colour;
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.12)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0.12)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 16, 256);
  }
  // Rust streaks.
  for (let i = 0; i < 10; i++) {
    g.fillStyle = `rgba(120,60,20,${0.1 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * 256, Math.random() * 100, 3 + Math.random() * 5, 60 + Math.random() * 150);
  }
  return toTexture(c, repeatX, repeatY);
}

/** Painted plaster with a little mottling (interior walls, rendered fronts). */
export function plasterTexture(colour: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = colour;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 20, 6 + Math.random() * 20);
  }
  return toTexture(c, repeatX, repeatY);
}

/** Concrete panels with seams and stains (towers, yards, offices). */
export function concreteTexture(colour: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = colour;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 30, 2 + Math.random() * 30);
  }
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  return toTexture(c, repeatX, repeatY);
}

export function woodFloorTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  for (let y = 0; y < 256; y += 32) {
    const shade = 90 + Math.random() * 30;
    g.fillStyle = `rgb(${shade + 40},${shade + 10},${shade - 30})`;
    g.fillRect(0, y, 256, 32);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y, 256, 2);
    const cut = Math.random() * 256;
    g.fillRect(cut, y, 2, 32);
  }
  return toTexture(c, repeatX, repeatY);
}

/** Lit and unlit windows in a grid (towers and offices). */
export function windowGridTexture(cols: number, rows: number, lit: string, unlit: string, frame: string, litChance = 0.35): THREE.CanvasTexture {
  const [c, g] = canvas(cols * 32, rows * 40);
  g.fillStyle = frame;
  g.fillRect(0, 0, cols * 32, rows * 40);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      g.fillStyle = Math.random() < litChance ? lit : unlit;
      g.fillRect(col * 32 + 5, r * 40 + 6, 22, 26);
    }
  }
  return toTexture(c);
}

/** Painted floor markings (yards, car parks). */
export function markingsTexture(base: string, line: string, repeatX: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 128);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 512, Math.random() * 128, 4 + Math.random() * 20, 4 + Math.random() * 20);
  }
  g.fillStyle = line;
  g.fillRect(0, 100, 512, 6);
  for (let x = 0; x < 512; x += 128) g.fillRect(x, 20, 6, 80);
  return toTexture(c, repeatX, 1);
}
