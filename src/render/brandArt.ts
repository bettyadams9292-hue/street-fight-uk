/**
 * Draws a business's brand (city/brands.ts) onto canvas textures: its fascia, the posters in its window, the vinyl
 * along the bottom of the glass and the banner hung inside the top of it. Everything is original lettering in the
 * game's own fonts (Big Shoulders, Overpass; public/fonts) or the device's serif and script faces.
 */
import * as THREE from 'three';
import type { Brand, BrandFace } from '../city/brands';
import { canvas, toTexture } from './textures';

// The web fonts are only drawn into a canvas once loaded: ask for them up front.
if (typeof document !== 'undefined' && typeof document.fonts?.load === 'function') {
  for (const f of ['900 40px "Big Shoulders"', '900 40px "Big Shoulders Stencil"', '800 40px "Overpass"', 'italic 800 40px "Overpass"']) void document.fonts.load(f).catch(() => undefined);
}

function font(face: BrandFace, px: number): string {
  switch (face) {
    case 'condensed':
      return `900 ${px}px "Big Shoulders", "Arial Narrow", Impact, sans-serif`;
    case 'stencil':
      return `900 ${px}px "Big Shoulders Stencil", "Big Shoulders", Impact, sans-serif`;
    case 'serif':
      return `700 ${px}px Georgia, "Times New Roman", serif`;
    case 'serifItalic':
      return `italic 700 ${px}px Georgia, "Times New Roman", serif`;
    case 'script':
      return `italic 700 ${px}px "Brush Script MT", "Snell Roundhand", "Segoe Script", cursive`;
    case 'rounded':
      return `800 ${px}px "Arial Rounded MT Bold", "Trebuchet MS", "Overpass", sans-serif`;
    case 'italic':
      return `italic 800 ${px}px "Overpass", "Arial Black", sans-serif`;
    default:
      return `800 ${px}px "Overpass", "Arial Black", Arial, sans-serif`;
  }
}

/** The biggest size up to `max` at which `text` fits `w` wide. */
function fitText(g: CanvasRenderingContext2D, text: string, face: BrandFace, max: number, w: number): number {
  let px = max;
  g.font = font(face, px);
  while (px > 8 && g.measureText(text).width > w) {
    px -= 2;
    g.font = font(face, px);
  }
  return px;
}

function textTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.userData.text = true;
  return t;
}

const shown = (b: Brand, s: string) => (b.lower ? s.toLowerCase() : s);

function gild(g: CanvasRenderingContext2D, h: number, y0: number, y1: number): CanvasGradient {
  const grad = g.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, '#fff2b8');
  grad.addColorStop(0.45, '#d9b14a');
  grad.addColorStop(0.55, '#a67a1e');
  grad.addColorStop(1, '#e8c86a');
  void h;
  return grad;
}

/** The fascia: the name in the brand's own lettering on its colour, with its stripe or gold leaf. */
export function fasciaTexture(text: string, b: Brand, aspect: number): THREE.CanvasTexture {
  const h = 128;
  const w = Math.max(h, Math.min(2048, Math.round(h * aspect)));
  const [c, g] = canvas(w, h);
  g.fillStyle = b.bg;
  g.fillRect(0, 0, w, h);
  // A soft sheen across a backlit acrylic panel; a painted board keeps its flat colour.
  if (!b.gilt) {
    const sheen = g.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);
  }
  if (b.stripe) {
    g.fillStyle = b.accent;
    g.fillRect(0, h - 16, w, 10);
  }
  g.strokeStyle = b.gilt ? '#a67a1e' : 'rgba(0,0,0,0.3)';
  g.lineWidth = b.gilt ? 4 : 6;
  g.strokeRect(5, 5, w - 10, h - 10);
  const name = shown(b, text);
  const px = fitText(g, name, b.face, h * (b.face === 'condensed' || b.face === 'stencil' ? 0.78 : 0.6), w * 0.9);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const y = h / 2 + (b.stripe ? -3 : 3);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillText(name, w / 2 + 3, y + 4);
  g.fillStyle = b.gilt ? gild(g, h, y - px / 2, y + px / 2) : b.fg;
  g.fillText(name, w / 2, y);
  return textTex(c);
}

/** A window card: the offer big on the brand's colours, a sticker on some, the shop's name small underneath. */
export function posterTexture(text: string, b: Brand, seed: number, name: string): THREE.CanvasTexture {
  const W = 256;
  const H = 352;
  const [c, g] = canvas(W, H);
  const flip = seed % 3 === 1;
  const paper = flip ? b.accent : seed % 3 === 2 ? '#f4f1e8' : b.bg;
  const ink = flip ? b.bg : paper === '#f4f1e8' ? b.bg : b.fg;
  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);
  // A band across the top in the other colour.
  g.fillStyle = flip ? b.fg : b.accent;
  g.fillRect(0, 0, W, 34);
  g.fillStyle = flip ? b.accent : paper;
  g.font = font('heavy', 18);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(seed % 2 ? 'IN STORE NOW' : 'THIS WEEK', W / 2, 18);
  // The offer, broken into lines that fit.
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  g.font = font(b.face === 'script' ? 'heavy' : b.face, 60);
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > W - 30 && line) {
      lines.push(line);
      line = word;
    } else line = t;
  }
  if (line) lines.push(line);
  const face: BrandFace = b.face === 'script' ? 'heavy' : b.face;
  const px = Math.min(72, ...lines.map((l) => fitText(g, l, face, 72, W - 28)), Math.floor(220 / lines.length));
  g.font = font(face, px);
  g.fillStyle = ink;
  const top = 60 + (230 - lines.length * px * 1.05) / 2;
  lines.forEach((l, i) => g.fillText(l, W / 2, top + px * 0.55 + i * px * 1.05));
  // A starburst sticker on the price cards.
  if (/£|%|FREE/.test(text) && seed % 2 === 0) {
    const cx = W - 52;
    const cy = 78;
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 30 : 40;
      const a = (i / 24) * Math.PI * 2;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#d8141e';
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = font('heavy', 17);
    g.fillText(/FREE/.test(text) ? 'FREE' : 'DEAL', cx, cy + 1);
  }
  g.fillStyle = ink;
  g.globalAlpha = 0.8;
  g.font = font('heavy', 18);
  g.fillText(name.length > 22 ? name.slice(0, 21) : name, W / 2, H - 22);
  g.globalAlpha = 1;
  // Sun-faded edges and a touch of tape.
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, W - 3, H - 3);
  g.fillStyle = 'rgba(240,235,215,0.7)';
  g.fillRect(W / 2 - 26, -4, 52, 16);
  return textTex(c);
}

/** Window vinyl along the bottom of the glass: the tagline repeated in the brand's lettering, on clear. */
export function vinylTexture(text: string, b: Brand, aspect: number): THREE.CanvasTexture {
  const h = 64;
  const w = Math.max(h, Math.min(2048, Math.round(h * aspect)));
  const [c, g] = canvas(w, h);
  g.clearRect(0, 0, w, h);
  // A frosted band with the accent line over it.
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fillRect(0, 8, w, h - 16);
  g.fillStyle = b.accent;
  g.fillRect(0, 4, w, 4);
  const light = b.bg === '#f4f1e8' || b.bg === '#e8e4d8' || b.bg === '#ffd200' || b.bg === '#ffe600';
  g.fillStyle = light ? b.fg : '#ffffff';
  const unit = `${shown(b, text)}   ·   `;
  g.font = font(b.face === 'script' ? 'heavy' : b.face, 26);
  g.textBaseline = 'middle';
  const uw = g.measureText(unit).width;
  for (let x = 12; x < w; x += uw) g.fillText(unit, x, h / 2 + 2);
  return textTex(c);
}

/** The banner across the top of the window: big letters on the accent, eyelets at the corners. */
export function bannerTexture(text: string, b: Brand, aspect: number): THREE.CanvasTexture {
  const h = 96;
  const w = Math.max(h, Math.min(2048, Math.round(h * aspect)));
  const [c, g] = canvas(w, h);
  const red = '#d8141e';
  const bg = b.accent === b.fg ? red : b.accent;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg === red ? '#ffffff' : b.bg;
  const px = fitText(g, text, 'heavy', 66, w * 0.86);
  g.font = font('heavy', px);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const x of [10, w - 10]) for (const y of [10, h - 10]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  return textTex(c);
}
