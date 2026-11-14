import { WEAPONS } from '../combat/Weapons';
import { ITEMS, RARITY_COLOURS, type ItemDef } from '../items/items';
import { RENDERED_ICON_IDS } from './itemIconList';

/**
 * Item artwork, painted once per item on a canvas and cached as an image.
 * Each kind of thing (watch, chain, phone, hoodie, kebab...) has its own
 * drawing, tinted with the item's colour, on a rarity-coloured backdrop.
 */

const cache = new Map<string, string>();
const SIZE = 128;

/** Items with an icon rendered from their own model (public/icons/items, tools/icons/render_items.mjs). */
const RENDERED = new Set(RENDERED_ICON_IDS);

/** The rendered icon file for an item, or null if it only has the painted one. */
export function renderedIconUrl(id: string): string | null {
  return RENDERED.has(id) ? `/icons/items/${id}.webp` : null;
}

export function itemIconUrl(id: string, colourOverride?: string): string {
  // A rendered icon shows the model's own colours, so a recoloured item keeps the painted one.
  const file = renderedIconUrl(id);
  if (file && (!colourOverride || colourOverride.toLowerCase() === ITEMS[id]?.colour?.toLowerCase())) return file;
  const key = `${id}|${colourOverride ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = ITEMS[id];
  if (!d || typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (!g) return '';
  paint(g, d, colourOverride ?? d.colour);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch((n >> 16) & 255);
  const gg = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${gg},${b})`;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A shiny vertical gradient fill. */
function gloss(g: CanvasRenderingContext2D, colour: string, y0: number, y1: number): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, shade(colour, 0.35));
  gr.addColorStop(0.5, colour);
  gr.addColorStop(1, shade(colour, -0.45));
  return gr;
}

function metalGrad(g: CanvasRenderingContext2D, colour: string, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, shade(colour, 0.5));
  gr.addColorStop(0.35, colour);
  gr.addColorStop(0.55, shade(colour, -0.4));
  gr.addColorStop(0.75, shade(colour, 0.3));
  gr.addColorStop(1, shade(colour, -0.3));
  return gr;
}

function paint(g: CanvasRenderingContext2D, d: ItemDef, col: string): void {
  // Backdrop: dark tile with a rarity glow.
  const rc = RARITY_COLOURS[d.rarity];
  const bg = g.createRadialGradient(64, 58, 6, 64, 64, 90);
  bg.addColorStop(0, shade(rc, -0.55));
  bg.addColorStop(1, '#0c0e13');
  g.fillStyle = bg;
  g.fillRect(0, 0, SIZE, SIZE);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.save();
  // Soft drop shadow under the object.
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  DRAW[d.icon]?.(g, col, d);
  g.restore();
}

type Painter = (g: CanvasRenderingContext2D, col: string, d: ItemDef) => void;

const DRAW: Record<string, Painter> = {
  weapon: (g, col, d) => {
    const w = d.weapon ? WEAPONS[d.weapon] : null;
    drawWeapon(g, d.weapon ?? 'bat', col, w?.length ?? 0.8);
  },
  top: (g, col, d) => {
    const style = d.wear?.top ?? 'tshirt';
    const longSleeves = !['tshirt', 'vest', 'football'].includes(style);
    g.fillStyle = gloss(g, col, 24, 110);
    g.beginPath();
    if (style === 'vest') {
      g.moveTo(44, 22); g.lineTo(54, 22); g.quadraticCurveTo(64, 40, 74, 22); g.lineTo(84, 22); g.lineTo(88, 50); g.lineTo(90, 108); g.lineTo(38, 108); g.lineTo(40, 50); g.closePath();
    } else {
      const sl = longSleeves ? 100 : 56;
      g.moveTo(48, 20); g.quadraticCurveTo(64, 32, 80, 20); g.lineTo(104, 30); g.lineTo(114, sl); g.lineTo(100, sl + 4); g.lineTo(92, 50);
      g.lineTo(92, 110); g.lineTo(36, 110); g.lineTo(36, 50); g.lineTo(28, sl + 4); g.lineTo(14, sl); g.lineTo(24, 30); g.closePath();
    }
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = shade(col, -0.5);
    g.lineWidth = 2;
    g.stroke();
    // Details by style.
    g.strokeStyle = shade(col, -0.35);
    if (style === 'hoodie' || style === 'designer_hoodie') {
      g.fillStyle = shade(col, -0.25);
      g.beginPath(); g.ellipse(64, 24, 18, 10, 0, 0, Math.PI); g.fill();
      rr(g, 46, 74, 36, 18, 4); g.stroke();
      g.strokeStyle = '#e8e4d8'; g.beginPath(); g.moveTo(58, 30); g.lineTo(57, 48); g.moveTo(70, 30); g.lineTo(71, 48); g.stroke();
      if (style === 'designer_hoodie') {
        g.fillStyle = '#c9a227'; g.font = 'bold 15px Georgia'; g.textAlign = 'center'; g.fillText('MAISON', 64, 64);
      }
    } else if (style === 'tracksuit' || style === 'bomber' || style === 'puffer' || style === 'leather' || style === 'denim' || style === 'coat' || style === 'workwear') {
      g.strokeStyle = style === 'bomber' || style === 'leather' ? '#c9ccd2' : shade(col, -0.5);
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(64, 26); g.lineTo(64, 110); g.stroke();
      if (style === 'tracksuit') {
        g.strokeStyle = '#e8e4d8'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(22, 34); g.lineTo(16, 98); g.moveTo(106, 34); g.lineTo(112, 98); g.stroke();
      }
      if (style === 'puffer') {
        g.strokeStyle = shade(col, -0.45); g.lineWidth = 2;
        for (let y = 44; y < 108; y += 14) { g.beginPath(); g.moveTo(37, y); g.lineTo(91, y); g.stroke(); }
        for (let y = 44; y < 100; y += 14) { g.beginPath(); g.moveTo(16, y); g.lineTo(32, y + 2); g.moveTo(112, y); g.lineTo(96, y + 2); g.stroke(); }
      }
      if (style === 'bomber') {
        g.fillStyle = '#d86a1a'; g.fillRect(58, 22, 12, 6);
        g.fillStyle = shade(col, -0.3); g.fillRect(36, 102, 56, 8); g.fillRect(14, 96, 14, 6); g.fillRect(100, 96, 14, 6);
      }
      if (style === 'denim') {
        g.strokeStyle = '#c9a227'; g.setLineDash([3, 3]);
        rr(g, 42, 46, 16, 14, 2); g.stroke(); rr(g, 70, 46, 16, 14, 2); g.stroke(); g.setLineDash([]);
      }
      if (style === 'workwear') {
        g.fillStyle = '#d8d8d0'; g.fillRect(36, 76, 56, 6); g.fillRect(36, 90, 56, 6); g.fillRect(14, 70, 16, 5); g.fillRect(98, 70, 16, 5);
      }
      if (style === 'coat') {
        g.fillStyle = shade(col, -0.35); g.beginPath(); g.moveTo(48, 20); g.lineTo(60, 52); g.lineTo(64, 26); g.lineTo(68, 52); g.lineTo(80, 20); g.fill();
      }
    } else if (style === 'football') {
      g.fillStyle = '#e8e4d8'; g.fillRect(36, 58, 56, 5);
      g.fillStyle = '#c9a227'; g.beginPath(); g.arc(78, 44, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8e4d8'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText('9', 64, 98);
    } else if (style === 'tshirt') {
      g.beginPath(); g.ellipse(64, 22, 12, 5, 0, 0, Math.PI); g.stroke();
    }
  },
  bottoms: (g, col, d) => {
    const style = d.wear?.bottoms ?? 'jeans';
    const short = style === 'shorts';
    g.fillStyle = gloss(g, col, 16, 118);
    g.beginPath();
    g.moveTo(38, 16); g.lineTo(90, 16); g.lineTo(96, short ? 70 : 116); g.lineTo(70, short ? 70 : 116); g.lineTo(64, 46); g.lineTo(58, short ? 70 : 116); g.lineTo(32, short ? 70 : 116); g.closePath();
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = shade(col, -0.5); g.lineWidth = 2; g.stroke();
    g.fillStyle = shade(col, -0.3); g.fillRect(38, 16, 52, 8);
    if (style === 'trackies' || style === 'joggers') {
      g.strokeStyle = '#e8e4d8'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 26); g.lineTo(33, 112); g.moveTo(92, 26); g.lineTo(95, 112); g.stroke();
      if (style === 'joggers') { g.fillStyle = shade(col, -0.35); g.fillRect(32, 106, 26, 10); g.fillRect(70, 106, 26, 10); }
    }
    if (style === 'jeans') {
      g.strokeStyle = '#c9a227'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(44, 26); g.quadraticCurveTo(50, 40, 58, 30); g.moveTo(84, 26); g.quadraticCurveTo(78, 40, 70, 30); g.stroke(); g.setLineDash([]);
    }
    if (style === 'cargos' || style === 'workwear') {
      g.fillStyle = shade(col, -0.25); rr(g, 34, 62, 18, 20, 3); g.fill(); rr(g, 76, 62, 18, 20, 3); g.fill();
    }
  },
  shoes: (g, col, d) => drawShoe(g, col, d.wear?.shoes ?? 'trainers'),
  trainers: (g, col) => {
    drawShoe(g, col, 'hitops');
    g.shadowColor = 'transparent';
    g.strokeStyle = '#e8e4d8'; g.lineWidth = 2; rr(g, 10, 14, 108, 26, 4); g.stroke();
    g.fillStyle = '#e8e4d8'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText('LIMITED', 64, 32);
  },
  cap: (g, col) => {
    g.fillStyle = gloss(g, col, 30, 90);
    g.beginPath(); g.ellipse(60, 76, 38, 40, 0, Math.PI, 0); g.fill();
    g.fillStyle = shade(col, -0.25); g.beginPath(); g.ellipse(92, 78, 30, 9, -0.1, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = shade(col, 0.2); g.beginPath(); g.arc(60, 37, 4, 0, Math.PI * 2); g.fill();
  },
  beanie: (g, col) => {
    g.fillStyle = gloss(g, col, 26, 96);
    g.beginPath(); g.ellipse(64, 80, 38, 46, 0, Math.PI, 0); g.fill();
    g.fillStyle = shade(col, -0.2); g.fillRect(26, 78, 76, 22);
    g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.4); g.lineWidth = 2;
    for (let x = 30; x < 100; x += 6) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x, 98); g.stroke(); }
  },
  sunglasses: (g, col) => {
    g.fillStyle = '#101012';
    for (const x of [36, 92]) { g.beginPath(); g.ellipse(x, 66, 24, 18, 0, 0, Math.PI * 2); g.fill(); }
    g.shadowColor = 'transparent';
    g.strokeStyle = shade(col === '#101012' ? '#c9a227' : col, 0); g.lineWidth = 4; g.beginPath(); g.moveTo(58, 60); g.quadraticCurveTo(64, 54, 70, 60); g.stroke();
    g.fillStyle = 'rgba(160,200,255,0.25)'; for (const x of [30, 86]) { g.beginPath(); g.ellipse(x, 60, 8, 5, -0.4, 0, Math.PI * 2); g.fill(); }
  },
  snood: (g, col) => {
    g.fillStyle = gloss(g, col, 30, 100);
    rr(g, 26, 34, 76, 62, 16); g.fill();
    g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.4); g.lineWidth = 2;
    for (let y = 44; y < 92; y += 8) { g.beginPath(); g.moveTo(30, y); g.quadraticCurveTo(64, y + 4, 98, y); g.stroke(); }
  },
  chain: (g, col, d) => {
    const thick = d.id === 'chain_cuban' ? 7 : d.id.includes('rope') || d.id === 'chain_gold' || d.id === 'lucky_chain' ? 5 : 3.5;
    g.shadowColor = 'transparent';
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * 0.1 + (i / 25) * Math.PI * 0.8;
      const x = 64 - Math.cos(a) * 44;
      const y = 28 + Math.sin(a) * 72;
      g.fillStyle = metalGrad(g, col, x - thick, y - thick, x + thick, y + thick);
      g.beginPath(); g.ellipse(x, y, thick * 1.4, thick, a, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(col, -0.5); g.lineWidth = 1; g.stroke();
    }
    if (d.id === 'lucky_chain') { g.fillStyle = metalGrad(g, col, 54, 96, 74, 116); g.beginPath(); g.moveTo(64, 98); g.lineTo(74, 108); g.lineTo(64, 120); g.lineTo(54, 108); g.fill(); }
  },
  bracelet: (g, col) => {
    g.shadowColor = 'transparent';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const x = 64 + Math.cos(a) * 34;
      const y = 64 + Math.sin(a) * 22;
      g.fillStyle = metalGrad(g, col, x - 6, y - 6, x + 6, y + 6);
      g.beginPath(); g.ellipse(x, y, 7, 5, a + Math.PI / 2, 0, Math.PI * 2); g.fill();
    }
  },
  watch: (g, col, d) => {
    const strap = d.id === 'watch_gold' ? '#4a2a14' : d.id === 'watch_basic' ? '#1b1d22' : col;
    g.fillStyle = d.id === 'watch_gold' || d.id === 'watch_basic' ? strap : metalGrad(g, col, 50, 0, 78, 0);
    g.fillRect(50, 6, 28, 116);
    g.shadowColor = 'transparent';
    if (!(d.id === 'watch_gold' || d.id === 'watch_basic')) { g.strokeStyle = shade(col, -0.45); for (let y = 10; y < 120; y += 8) { g.beginPath(); g.moveTo(50, y); g.lineTo(78, y); g.stroke(); } }
    g.fillStyle = metalGrad(g, d.id === 'watch_basic' ? '#3a3d44' : col, 30, 34, 98, 94);
    g.beginPath(); g.arc(64, 64, 32, 0, Math.PI * 2); g.fill();
    g.fillStyle = d.id === 'watch_diver' ? '#0e2a5a' : d.id === 'watch_basic' ? '#9ab890' : '#f4f0e6';
    g.beginPath(); g.arc(64, 64, 25, 0, Math.PI * 2); g.fill();
    if (d.id === 'watch_basic') { g.fillStyle = '#1b1d22'; g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText('12:45', 64, 70); return; }
    g.strokeStyle = d.id === 'watch_diver' ? '#e8e4d8' : '#1b1d22'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20); g.lineTo(64 + Math.cos(a) * 23, 64 + Math.sin(a) * 23); g.stroke(); }
    g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 48); g.moveTo(64, 64); g.lineTo(76, 70); g.stroke();
    g.fillStyle = metalGrad(g, col, 94, 58, 102, 70); g.fillRect(95, 59, 7, 10);
  },
  smartwatch: (g, col) => {
    g.fillStyle = col; g.fillRect(48, 6, 32, 116);
    g.fillStyle = metalGrad(g, '#5a5e64', 34, 36, 94, 92); rr(g, 34, 36, 60, 56, 12); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#05070c'; rr(g, 39, 41, 50, 46, 9); g.fill();
    g.strokeStyle = '#4ad8a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(44, 66); g.lineTo(54, 66); g.lineTo(58, 54); g.lineTo(64, 76); g.lineTo(68, 62); g.lineTo(84, 62); g.stroke();
  },
  ring: (g, col, d) => {
    g.strokeStyle = metalGrad(g, col === '#e8f4ff' ? '#d8dce4' : col, 30, 40, 98, 110);
    g.lineWidth = 12; g.beginPath(); g.ellipse(64, 78, 30, 24, 0, 0, Math.PI * 2); g.stroke();
    if (d.id === 'ring_diamond') {
      g.shadowColor = 'rgba(200,230,255,0.9)'; g.shadowBlur = 14;
      g.fillStyle = '#e8f4ff'; g.beginPath(); g.moveTo(64, 30); g.lineTo(80, 44); g.lineTo(64, 60); g.lineTo(48, 44); g.closePath(); g.fill();
      g.strokeStyle = '#9ab8e8'; g.lineWidth = 1; g.stroke();
    } else if (d.id === 'ring_signet') {
      g.fillStyle = metalGrad(g, col, 48, 40, 80, 64); rr(g, 46, 40, 36, 22, 6); g.fill();
    }
  },
  earring: (g, col, d) => {
    for (const x of d.id === 'earrings_diamond' ? [44, 84] : [64]) {
      if (d.id === 'earrings_diamond') {
        g.shadowColor = 'rgba(200,230,255,0.9)'; g.shadowBlur = 12;
        g.fillStyle = '#e8f4ff'; g.beginPath(); g.arc(x, 64, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 4, 60, 3, 0, Math.PI * 2); g.fill();
      } else {
        g.strokeStyle = metalGrad(g, col, x - 20, 40, x + 20, 100); g.lineWidth = 6; g.beginPath(); g.arc(x, 68, 22, 0, Math.PI * 2); g.stroke();
      }
    }
  },
  belt: (g, col) => {
    g.fillStyle = gloss(g, col, 50, 78); g.fillRect(6, 52, 116, 24);
    g.shadowColor = 'transparent'; g.strokeStyle = '#c9a227'; g.lineWidth = 5; rr(g, 46, 46, 30, 36, 4); g.stroke();
    g.fillStyle = '#c9a227'; g.fillRect(58, 54, 4, 20);
    g.fillStyle = '#1a1008'; for (const x of [90, 102, 114]) { g.beginPath(); g.arc(x, 64, 2.5, 0, Math.PI * 2); g.fill(); }
  },
  wraps: (g, col) => {
    g.fillStyle = gloss(g, col, 20, 110);
    g.beginPath(); g.ellipse(64, 70, 30, 44, 0.2, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.3); g.lineWidth = 2;
    for (let y = 36; y < 108; y += 9) { g.beginPath(); g.moveTo(36, y); g.quadraticCurveTo(64, y + 10, 94, y - 4); g.stroke(); }
  },
  gumshield: (g, col) => {
    g.fillStyle = gloss(g, col, 40, 96);
    g.beginPath(); g.ellipse(64, 74, 44, 30, 0, Math.PI, 0); g.lineTo(100, 74); g.ellipse(64, 74, 30, 16, 0, 0, Math.PI, true); g.closePath(); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(48, 56, 10, 4, -0.5, 0, Math.PI * 2); g.fill();
  },
  headguard: (g, col) => {
    g.fillStyle = gloss(g, col, 16, 112);
    g.beginPath(); g.ellipse(64, 66, 42, 50, 0, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#0c0e13'; g.beginPath(); g.ellipse(64, 72, 22, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = shade(col, -0.2); g.fillRect(40, 38, 48, 10);
  },
  food: (g, col, d) => {
    const id = d.id;
    if (id === 'chips') {
      g.fillStyle = '#f4f0e6'; g.beginPath(); g.moveTo(28, 44); g.lineTo(100, 44); g.lineTo(88, 116); g.lineTo(40, 116); g.closePath(); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#e8c060';
      for (let i = 0; i < 9; i++) { g.save(); g.translate(40 + i * 7, 46); g.rotate((i - 4) * 0.12); g.fillRect(-3, -30, 6, 34); g.restore(); }
      return;
    }
    if (id === 'kebab' || id === 'curry') {
      g.fillStyle = '#e8e4d8'; rr(g, 18, 60, 92, 50, 8); g.fill();
      g.shadowColor = 'transparent';
      g.fillStyle = id === 'curry' ? '#d88a2a' : '#c88a4a'; g.beginPath(); g.ellipse(64, 64, 42, 18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = id === 'curry' ? '#f4f0e6' : '#5aa03a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(34 + i * 8, 60 + (i % 3) * 4, 4, 0, Math.PI * 2); g.fill(); }
      return;
    }
    if (id === 'fry_up') {
      g.fillStyle = '#f4f0e6'; g.beginPath(); g.ellipse(64, 70, 54, 40, 0, 0, Math.PI * 2); g.fill();
      g.shadowColor = 'transparent';
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(48, 58, 16, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f0b020'; g.beginPath(); g.arc(48, 58, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a3a1a'; rr(g, 66, 50, 30, 10, 5); g.fill(); rr(g, 70, 64, 28, 10, 5); g.fill();
      g.fillStyle = '#d84a2a'; g.beginPath(); g.ellipse(52, 86, 16, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c06a3a'; rr(g, 70, 80, 26, 14, 4); g.fill();
      return;
    }
    if (id === 'protein_bar') {
      g.fillStyle = gloss(g, '#2a2d33', 46, 82); rr(g, 14, 46, 100, 36, 6); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#d8a050'; g.font = 'bold 16px Arial'; g.textAlign = 'center'; g.fillText('PROTEIN', 64, 70);
      return;
    }
    if (id === 'meal_deal') {
      g.fillStyle = gloss(g, '#e8d8b0', 40, 100); g.beginPath(); g.moveTo(20, 100); g.lineTo(64, 40); g.lineTo(108, 100); g.closePath(); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#5aa03a'; g.fillRect(28, 88, 72, 6); g.fillStyle = '#f4f0e6'; g.fillRect(28, 82, 72, 6);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.strokeRect(18, 38, 92, 64);
      return;
    }
    // Pasties, rolls, butties: golden pastry.
    g.fillStyle = gloss(g, col, 36, 100);
    g.beginPath(); g.ellipse(64, 72, 46, 28, 0, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.35); g.lineWidth = 3;
    if (id === 'pasty') { g.beginPath(); for (let x = 26; x <= 102; x += 8) g.lineTo(x, 46 + ((x / 8) % 2) * 6); g.stroke(); }
    else { for (let x = 40; x < 92; x += 12) { g.beginPath(); g.moveTo(x, 54); g.lineTo(x + 6, 90); g.stroke(); } }
  },
  plate: (g, col) => {
    // A plate of home cooking, seen from above at an angle.
    g.fillStyle = '#f4f2ec'; g.beginPath(); g.ellipse(64, 72, 54, 38, 0, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#d8d4cc'; g.lineWidth = 3; g.beginPath(); g.ellipse(64, 72, 42, 28, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = gloss(g, col, 50, 92); g.beginPath(); g.ellipse(60, 70, 30, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = shade(col, 0.35); for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(46 + i * 7, 64 + (i % 2) * 8, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c8c8c8'; rr(g, 98, 50, 6, 44, 3); g.fill();
  },
  grocery: (g, col, d) => {
    const id = d.id;
    if (id === 'g_eggs') {
      g.fillStyle = '#a89070'; rr(g, 18, 60, 92, 40, 6); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#f4ecd8';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(36 + i * 28, 58, 11, 14, 0, 0, Math.PI * 2); g.fill(); }
      return;
    }
    if (id === 's_fruit' || id === 'g_tomatoes' || id === 'g_onions' || id === 'g_potatoes' || id === 'g_mushrooms') {
      g.fillStyle = gloss(g, col, 30, 110); g.beginPath(); g.arc(64, 70, 38, 0, Math.PI * 2); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(50, 54, 10, 6, -0.6, 0, Math.PI * 2); g.fill();
      if (id === 's_fruit' || id === 'g_tomatoes') { g.fillStyle = '#4a7a2a'; g.fillRect(62, 26, 4, 10); }
      return;
    }
    if (id === 'g_milk') {
      g.fillStyle = '#f8f8f4'; rr(g, 40, 28, 48, 88, 10); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#2a8a3a'; rr(g, 52, 14, 24, 16, 4); g.fill(); g.fillStyle = '#4aa8ff'; g.fillRect(40, 66, 48, 16);
      return;
    }
    const tin = ['g_beans', 'g_sauce', 'g_curry_sauce'].includes(id);
    if (tin) {
      g.fillStyle = gloss(g, col, 30, 110); rr(g, 34, 30, 60, 80, 8); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = metalGrad(g, '#c9ccd2', 34, 0, 94, 0); g.fillRect(36, 26, 56, 8);
      g.fillStyle = '#f4f0e6'; g.fillRect(34, 56, 60, 22);
    } else {
      // A packet or a box with a label.
      g.fillStyle = gloss(g, col, 26, 112); rr(g, 22, 26, 84, 86, 8); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = 'rgba(255,255,255,0.85)'; rr(g, 30, 54, 68, 28, 4); g.fill();
    }
    g.fillStyle = '#1a1a1a'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
    const word = d.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 9);
    g.fillText(word, 64, tin ? 72 : 73);
  },
  drink: (g, col, d) => {
    if (d.id === 'flask_tea') {
      g.fillStyle = metalGrad(g, '#5a7a9a', 40, 0, 88, 0); rr(g, 40, 20, 48, 96, 10); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#2a2d33'; rr(g, 44, 10, 40, 16, 5); g.fill();
      return;
    }
    if (d.id === 'water') {
      g.fillStyle = 'rgba(140,200,255,0.55)'; rr(g, 46, 30, 36, 88, 10); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#2f6fa8'; g.fillRect(46, 64, 36, 18); g.fillStyle = '#e8f4ff'; g.fillRect(54, 16, 20, 14);
      return;
    }
    // Cans.
    g.fillStyle = metalGrad(g, col, 38, 0, 90, 0);
    rr(g, 38, 22, 52, 92, 8); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = metalGrad(g, '#c9ccd2', 38, 0, 90, 0); g.fillRect(40, 18, 48, 8); g.fillRect(40, 110, 48, 6);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.save(); g.translate(64, 68); g.rotate(-Math.PI / 2); g.fillText(d.id === 'energy_drink' ? 'VOLT' : 'FIZZ', 0, 5); g.restore();
  },
  medkit: (g, col, d) => {
    if (d.id === 'plasters') {
      g.fillStyle = gloss(g, '#e8c8a0', 40, 90); rr(g, 22, 40, 84, 50, 8); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#d81e1e'; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillText('PLASTERS', 64, 70);
      return;
    }
    g.fillStyle = gloss(g, col, 30, 110); rr(g, 18, 34, 92, 72, 10); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#f4f0e6'; g.fillRect(56, 48, 16, 44); g.fillRect(42, 62, 44, 16);
    g.fillStyle = '#2a2d33'; rr(g, 50, 24, 28, 12, 4); g.fill();
  },
  phone: (g, col, d) => {
    g.fillStyle = metalGrad(g, col, 36, 0, 92, 0); rr(g, 38, 8, 52, 112, 10); g.fill();
    g.shadowColor = 'transparent';
    const screen = g.createLinearGradient(42, 14, 86, 112);
    screen.addColorStop(0, d.id === 'dunc_phone' ? '#1a1a1a' : '#2a4aa8');
    screen.addColorStop(1, d.id === 'dunc_phone' ? '#3a3a3a' : '#a040c0');
    g.fillStyle = screen; rr(g, 42, 14, 44, 98, 6); g.fill();
    if (d.id === 'phone_cheap') { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(48, 20); g.lineTo(62, 50); g.lineTo(56, 70); g.moveTo(62, 50); g.lineTo(82, 60); g.stroke(); }
    if (d.id === 'dunc_phone') { g.fillStyle = '#4ad84a'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText('THE BOSS', 64, 60); }
    g.fillStyle = '#05070c'; rr(g, 58, 16, 12, 4, 2); g.fill();
  },
  tablet: (g, col) => {
    g.fillStyle = metalGrad(g, col, 14, 0, 114, 0); rr(g, 14, 22, 100, 84, 8); g.fill();
    g.shadowColor = 'transparent';
    const s = g.createLinearGradient(20, 28, 108, 100); s.addColorStop(0, '#1f6fd8'); s.addColorStop(1, '#40c0a0');
    g.fillStyle = s; rr(g, 20, 28, 88, 72, 4); g.fill();
  },
  headphones: (g, col) => {
    g.strokeStyle = metalGrad(g, '#5a5e64', 20, 0, 108, 0); g.lineWidth = 9; g.beginPath(); g.arc(64, 70, 42, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.fillStyle = gloss(g, col, 60, 110);
    for (const x of [26, 102]) { g.beginPath(); g.ellipse(x, 84, 15, 24, 0, 0, Math.PI * 2); g.fill(); }
  },
  console: (g, col) => {
    g.fillStyle = gloss(g, col, 30, 100); rr(g, 22, 34, 84, 54, 8); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#4ad8ff'; g.fillRect(30, 80, 30, 3);
    g.fillStyle = '#2a2d33'; rr(g, 40, 92, 48, 26, 10); g.fill();
    g.fillStyle = '#5a5e64'; g.beginPath(); g.arc(52, 104, 4, 0, Math.PI * 2); g.arc(76, 104, 4, 0, Math.PI * 2); g.fill();
  },
  handheld: (g, col) => {
    g.fillStyle = gloss(g, col, 40, 96); rr(g, 6, 42, 26, 54, 10); g.fill(); rr(g, 96, 42, 26, 54, 10); g.fill();
    g.fillStyle = '#1b1d22'; rr(g, 30, 42, 68, 54, 4); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#3a8ad8'; g.fillRect(34, 46, 60, 46);
  },
  camera: (g, col) => {
    g.fillStyle = gloss(g, col, 36, 100); rr(g, 14, 40, 100, 62, 8); g.fill(); rr(g, 24, 30, 30, 14, 4); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = metalGrad(g, '#5a5e64', 44, 46, 92, 94); g.beginPath(); g.arc(68, 72, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0a1830'; g.beginPath(); g.arc(68, 72, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(62, 66, 5, 0, Math.PI * 2); g.fill();
  },
  coin: (g, col, d) => {
    const n = d.stack > 1 ? 3 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const y = 76 - i * 10;
      g.fillStyle = metalGrad(g, col, 30, y - 30, 98, y + 30);
      g.beginPath(); g.ellipse(64, y, 38, 30, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(col, -0.4); g.lineWidth = 2; g.stroke();
    }
    g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.3); g.lineWidth = 2; g.beginPath(); g.ellipse(64, 56, 28, 21, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = shade(col, -0.35); g.font = 'bold 16px Georgia'; g.textAlign = 'center'; g.fillText(d.id === 'coin_rare' ? '50' : '£', 64, 62);
  },
  cash: (g, col, d) => {
    for (let i = 0; i < 4; i++) {
      g.save(); g.translate(64, 70 - i * 6); g.rotate(-0.15 + i * 0.08);
      g.fillStyle = gloss(g, col, -26, 26); g.fillRect(-48, -24, 96, 48);
      g.strokeStyle = shade(col, -0.4); g.lineWidth = 2; g.strokeRect(-44, -20, 88, 40);
      g.restore();
    }
    g.shadowColor = 'transparent';
    g.fillStyle = shade(col, -0.5); g.font = 'bold 20px Georgia'; g.textAlign = 'center'; g.fillText(d.id === 'old_fiver' ? '£5' : '£20', 64, 58);
    if (d.id === 'cash_bundle') { g.fillStyle = '#d84a2a'; g.fillRect(58, 30, 10, 52); }
  },
  wallet_hw: (g) => {
    g.fillStyle = metalGrad(g, '#3a3d44', 30, 0, 98, 0); rr(g, 36, 16, 56, 96, 10); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#05070c'; rr(g, 44, 28, 40, 30, 4); g.fill();
    g.fillStyle = '#f0b020'; g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.fillText('₿', 64, 50);
    g.fillStyle = '#5a5e64'; for (const y of [72, 90]) { g.beginPath(); g.arc(54, y, 6, 0, Math.PI * 2); g.arc(74, y, 6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#e8e4d8'; g.fillRect(40, 104, 48, 6);
  },
  handbag: (g, col) => {
    g.strokeStyle = shade(col, -0.3); g.lineWidth = 6; g.beginPath(); g.arc(64, 54, 26, Math.PI, 0); g.stroke();
    g.fillStyle = gloss(g, col, 50, 116); rr(g, 22, 50, 84, 64, 10); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#c9a227'; rr(g, 56, 62, 16, 12, 3); g.fill();
    g.strokeStyle = 'rgba(201,162,39,0.4)'; g.lineWidth = 1;
    for (let x = 30; x < 100; x += 12) for (let y = 82; y < 110; y += 12) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.stroke(); }
  },
  shirt_signed: (g, col, d) => {
    DRAW.top(g, col, { ...d, wear: { slot: 'top', top: 'football' } });
    g.shadowColor = 'transparent'; g.strokeStyle = '#101418'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(42 + (i % 3) * 16, 70 + Math.floor(i / 3) * 22); g.bezierCurveTo(48 + (i % 3) * 16, 62, 52 + (i % 3) * 16, 80, 58 + (i % 3) * 16, 70 + Math.floor(i / 3) * 22); g.stroke(); }
  },
  programme: (g) => {
    g.fillStyle = gloss(g, '#e8e4d8', 14, 116); g.fillRect(28, 14, 72, 102);
    g.shadowColor = 'transparent'; g.fillStyle = '#b3121b'; g.fillRect(28, 14, 72, 22);
    g.fillStyle = '#101418'; g.font = 'bold 12px Georgia'; g.textAlign = 'center'; g.fillText('WORLD CUP', 64, 30); g.font = 'bold 20px Georgia'; g.fillText('1966', 64, 66);
    g.font = '10px Georgia'; g.fillText('FINAL TIE', 64, 82); g.fillText('WEMBLEY', 64, 96);
  },
  antique: (g, col, d) => {
    if (d.id === 'candlestick') {
      g.fillStyle = metalGrad(g, col, 44, 0, 84, 0);
      g.beginPath(); g.ellipse(64, 112, 30, 8, 0, 0, Math.PI * 2); g.fill(); g.fillRect(58, 34, 12, 78); g.beginPath(); g.ellipse(64, 34, 16, 6, 0, 0, Math.PI * 2); g.fill();
      g.shadowColor = 'transparent'; g.fillStyle = '#f4f0e6'; g.fillRect(60, 12, 8, 22);
      return;
    }
    if (d.id === 'toby_jug') {
      g.fillStyle = gloss(g, col, 30, 112); g.beginPath(); g.ellipse(60, 76, 34, 38, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1d22'; g.beginPath(); g.ellipse(60, 36, 34, 10, 0, 0, Math.PI * 2); g.fill(); g.fillRect(40, 24, 40, 14);
      g.shadowColor = 'transparent'; g.strokeStyle = gloss(g, col, 50, 100); g.lineWidth = 8; g.beginPath(); g.arc(96, 76, 14, -Math.PI / 2, Math.PI / 2); g.stroke();
      g.fillStyle = '#f4d8c0'; g.beginPath(); g.arc(60, 68, 14, 0, Math.PI * 2); g.fill();
      return;
    }
    // Pocket watch.
    g.strokeStyle = metalGrad(g, col, 50, 6, 78, 30); g.lineWidth = 5; g.beginPath(); g.arc(64, 22, 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = metalGrad(g, col, 24, 32, 104, 112); g.beginPath(); g.arc(64, 74, 40, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#f4f0e6'; g.beginPath(); g.arc(64, 74, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1d22'; g.font = '10px Georgia'; g.textAlign = 'center';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g.fillText(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i - 1], 64 + Math.cos(a) * 22, 78 + Math.sin(a) * 22); }
  },
  vinyl: (g) => {
    g.fillStyle = gloss(g, '#e8e4d8', 10, 118); g.fillRect(10, 10, 84, 108);
    g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(78, 64, 46, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.strokeStyle = '#222'; for (let r = 20; r < 46; r += 4) { g.beginPath(); g.arc(78, 64, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d84a2a'; g.beginPath(); g.arc(78, 64, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#101418'; g.font = 'bold 13px Arial'; g.textAlign = 'left'; g.fillText('FIRST', 16, 34); g.fillText('PRESS', 16, 50);
  },
  key: (g, col) => {
    g.strokeStyle = metalGrad(g, '#c9a227', 20, 20, 60, 60); g.lineWidth = 9; g.beginPath(); g.arc(40, 52, 20, 0, Math.PI * 2); g.stroke();
    g.fillStyle = metalGrad(g, '#c9a227', 56, 46, 116, 58); g.fillRect(58, 47, 56, 10); g.fillRect(96, 57, 8, 14); g.fillRect(108, 57, 6, 10);
    g.shadowColor = 'transparent'; g.fillStyle = col; rr(g, 26, 78, 30, 20, 4); g.fill();
  },
  document: (g) => {
    g.fillStyle = gloss(g, '#3a2414', 14, 116); rr(g, 22, 14, 84, 102, 4); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#e8e4d8'; g.fillRect(30, 22, 68, 86);
    g.fillStyle = '#2a2d33'; for (let y = 34; y < 102; y += 9) g.fillRect(36, y, 30 + ((y * 7) % 26), 3);
    g.fillStyle = '#b3121b'; for (let y = 34; y < 102; y += 9) g.fillRect(80, y, 12, 3);
  },
  scrap: (g, col, d) => {
    if (d.id === 'lighter') {
      g.fillStyle = metalGrad(g, col, 40, 0, 88, 0); rr(g, 42, 40, 44, 66, 6); g.fill();
      g.fillStyle = metalGrad(g, col, 40, 0, 88, 0); rr(g, 42, 26, 44, 18, 4); g.fill();
      g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.4); g.beginPath(); g.moveTo(42, 44); g.lineTo(86, 44); g.stroke();
      return;
    }
    g.strokeStyle = metalGrad(g, col, 20, 20, 108, 108); g.lineWidth = 10;
    g.beginPath(); g.moveTo(20, 90); g.lineTo(70, 40); g.lineTo(108, 52); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(26, 50); g.quadraticCurveTo(64, 100, 104, 96); g.stroke();
    g.strokeStyle = metalGrad(g, '#b87333', 20, 20, 108, 108); g.lineWidth = 3;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(70, 80, 10 + i * 3, 0, Math.PI * 1.6); g.stroke(); }
  },
  bag: (g, col, d) => {
    const big = d.id === 'bag_holdall';
    if (big) {
      g.fillStyle = gloss(g, col, 46, 108); rr(g, 10, 46, 108, 60, 22); g.fill();
      g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.4); g.lineWidth = 6; g.beginPath(); g.arc(64, 50, 22, Math.PI, 0); g.stroke();
      g.strokeStyle = '#c9ccd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 62); g.lineTo(104, 62); g.stroke();
      return;
    }
    g.fillStyle = gloss(g, col, 20, 116); rr(g, 30, d.id === 'bag_bumbag' ? 56 : 22, 68, d.id === 'bag_bumbag' ? 40 : 94, 18); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = shade(col, -0.25); rr(g, 40, d.id === 'bag_bumbag' ? 66 : 70, 48, d.id === 'bag_bumbag' ? 22 : 34, 8); g.fill();
    g.strokeStyle = '#c9ccd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(44, d.id === 'bag_bumbag' ? 70 : 74); g.lineTo(84, d.id === 'bag_bumbag' ? 70 : 74); g.stroke();
  },
  card: (g, col, d) => {
    g.fillStyle = gloss(g, col, 34, 98); rr(g, 14, 34, 100, 64, 8); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 15px Arial'; g.textAlign = 'center';
    g.fillText(d.id === 'vip_pass' ? 'VIP' : d.id === 'bus_pass' ? 'BUS PASS' : 'ADMIT ONE', 64, 72);
    if (d.id === 'vip_pass') { g.strokeStyle = '#c9a227'; g.lineWidth = 3; rr(g, 20, 40, 88, 52, 6); g.stroke(); }
  },
  football: (g, col) => {
    g.fillStyle = gloss(g, col, 20, 110); g.beginPath(); g.arc(64, 66, 44, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent'; g.strokeStyle = shade(col, -0.5); g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, 66); g.quadraticCurveTo(64, 40, 108, 66); g.moveTo(20, 66); g.quadraticCurveTo(64, 92, 108, 66); g.moveTo(64, 22); g.lineTo(64, 110); g.stroke();
    g.strokeStyle = '#e8e4d8'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(58, 44 + i * 6); g.lineTo(70, 44 + i * 6); g.stroke(); }
  },
};

function drawShoe(g: CanvasRenderingContext2D, col: string, style: string): void {
  const high = style === 'hitops' || style === 'boots';
  g.fillStyle = gloss(g, col, high ? 30 : 56, 106);
  g.beginPath();
  g.moveTo(16, 100); g.lineTo(16, high ? 36 : 62); g.quadraticCurveTo(28, high ? 28 : 54, 48, high ? 34 : 58);
  g.lineTo(58, 66); g.quadraticCurveTo(96, 66, 112, 88); g.lineTo(114, 100); g.closePath(); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = style === 'boots' ? '#151515' : '#efefea'; rr(g, 12, 98, 106, 12, 4); g.fill();
  g.strokeStyle = style === 'boots' ? '#c9a227' : shade(col, -0.5); g.lineWidth = 2;
  for (let i = 0; i < (high ? 5 : 3); i++) { g.beginPath(); g.moveTo(44 + i * 6, (high ? 42 : 64) + i * 6); g.lineTo(56 + i * 6, (high ? 40 : 62) + i * 6); g.stroke(); }
  if (style === 'runners' || style === 'trainers') { g.strokeStyle = '#e8e4d8'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 90); g.quadraticCurveTo(64, 74, 92, 90); g.stroke(); }
}

function drawWeapon(g: CanvasRenderingContext2D, id: string, col: string, length: number): void {
  g.save();
  g.translate(64, 64);
  g.rotate(-Math.PI / 4);
  const L = Math.min(104, 40 + length * 52);
  const metal = (x0: number, x1: number) => metalGrad(g, col, x0, -6, x1, 6);
  const wood = (c: string) => gloss(g, c, -10, 10);
  const handle = (len: number, c = '#1b1d22', w = 7) => { g.fillStyle = gloss(g, c, -w, w); rr(g, -L / 2, -w / 2, len, w, 3); g.fill(); };
  switch (id) {
    case 'bottle':
    case 'broken_bottle': {
      g.fillStyle = 'rgba(47,107,58,0.85)';
      g.beginPath(); g.moveTo(-40, -5); g.lineTo(-10, -5); g.quadraticCurveTo(0, -14, 10, -14); g.lineTo(40, -14); g.lineTo(40, 14); g.lineTo(10, 14); g.quadraticCurveTo(0, 14, -10, 5); g.lineTo(-40, 5); g.closePath(); g.fill();
      if (id === 'broken_bottle') { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(20, -16); g.lineTo(26, 0); g.lineTo(34, -10); g.lineTo(38, 4); g.lineTo(44, -6); g.lineTo(44, 18); g.lineTo(20, 18); g.fill(); g.globalCompositeOperation = 'source-over'; }
      else { g.fillStyle = '#d8c8a0'; g.fillRect(14, -12, 18, 24); }
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-30, -3, 50, 2);
      break;
    }
    case 'knife':
    case 'machete': {
      const blade = id === 'machete' ? L * 0.68 : L * 0.5;
      handle(L - blade, '#2a1a0a', 10);
      g.fillStyle = metal(-L / 2, L / 2);
      g.beginPath(); g.moveTo(-L / 2 + (L - blade), -6); g.lineTo(L / 2 - 6, id === 'machete' ? -10 : -5); g.lineTo(L / 2, 0); g.lineTo(L / 2 - 4, 6); g.lineTo(-L / 2 + (L - blade), 6); g.closePath(); g.fill();
      g.fillStyle = '#c9ccd2'; g.fillRect(-L / 2 + (L - blade) - 3, -9, 4, 18);
      break;
    }
    case 'hammer': {
      g.fillStyle = wood('#8a6a3a'); rr(g, -L / 2, -4, L, 8, 3); g.fill();
      g.fillStyle = metal(L / 2 - 12, L / 2 + 12); rr(g, L / 2 - 14, -16, 16, 32, 3); g.fill();
      g.beginPath(); g.moveTo(L / 2 - 14, -16); g.quadraticCurveTo(L / 2 - 28, -24, L / 2 - 30, -12); g.lineTo(L / 2 - 14, -8); g.fill();
      break;
    }
    case 'wrench': {
      g.fillStyle = metal(-L / 2, L / 2); rr(g, -L / 2, -5, L - 12, 10, 3); g.fill();
      g.fillStyle = metalGrad(g, '#a01818', -10, -10, 10, 10); rr(g, L / 2 - 22, -14, 22, 28, 4); g.fill();
      g.fillStyle = '#0c0e13'; g.fillRect(L / 2 - 6, -6, 8, 12);
      break;
    }
    case 'frying_pan': {
      handle(L * 0.55, '#1a1a1a', 8);
      g.fillStyle = metalGrad(g, '#2a2a2a', 0, -26, 30, 26); g.beginPath(); g.arc(L / 2 - 26, 0, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(L / 2 - 26, 0, 20, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'tv':
    case 'monitor': {
      g.restore(); g.save(); g.translate(64, 64);
      g.fillStyle = gloss(g, id === 'tv' ? '#3a3a3a' : '#18191c', -40, 40);
      if (id === 'tv') { rr(g, -44, -36, 88, 68, 10); g.fill(); g.fillStyle = '#0a1018'; rr(g, -36, -28, 60, 52, 8); g.fill(); g.fillStyle = '#5a5e64'; for (const y of [-14, 0, 14]) { g.beginPath(); g.arc(34, y, 4, 0, Math.PI * 2); g.fill(); } g.strokeStyle = '#5a5e64'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -36); g.lineTo(-24, -54); g.moveTo(10, -36); g.lineTo(24, -54); g.stroke(); }
      else { rr(g, -48, -34, 96, 58, 4); g.fill(); g.fillStyle = '#0a1830'; g.fillRect(-44, -30, 88, 50); g.fillStyle = '#18191c'; g.fillRect(-6, 24, 12, 14); g.fillRect(-24, 36, 48, 6); }
      break;
    }
    case 'cone': {
      g.restore(); g.save(); g.translate(64, 64);
      g.fillStyle = gloss(g, '#ff5a1a', -40, 40); g.beginPath(); g.moveTo(-8, -46); g.lineTo(8, -46); g.lineTo(30, 38); g.lineTo(-30, 38); g.closePath(); g.fill();
      g.fillStyle = '#f0f0f0'; g.beginPath(); g.moveTo(-16, -12); g.lineTo(16, -12); g.lineTo(21, 6); g.lineTo(-21, 6); g.closePath(); g.fill();
      g.fillStyle = '#1a1a1a'; g.fillRect(-40, 38, 80, 8);
      break;
    }
    case 'road_sign': {
      g.fillStyle = metal(-L / 2, L / 2); rr(g, -L / 2, -3, L, 6, 2); g.fill();
      g.save(); g.translate(L / 2 - 20, 0); g.rotate(Math.PI / 4);
      g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d81e1e'; g.lineWidth = 7; g.stroke();
      g.fillStyle = '#1b1d22'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.fillText('30', 0, 7);
      g.restore();
      break;
    }
    case 'chain': {
      for (let i = 0; i < 12; i++) {
        const x = -L / 2 + i * (L / 11);
        g.strokeStyle = metal(x - 6, x + 6); g.lineWidth = 3;
        g.beginPath(); g.ellipse(x, Math.sin(i * 0.8) * 6, 6, 4, i % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2); g.stroke();
      }
      break;
    }
    case 'mop':
    case 'broom':
    case 'rake':
    case 'shovel':
    case 'garden_fork': {
      g.fillStyle = wood(id === 'mop' ? '#4a7ab0' : '#8a6a3a'); rr(g, -L / 2, -3, L - 20, 6, 2); g.fill();
      const hx = L / 2 - 20;
      if (id === 'mop') { g.fillStyle = '#d8d0c0'; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(hx, i * 2); g.quadraticCurveTo(hx + 18, i * 4, hx + 26, i * 5); g.lineWidth = 3; g.strokeStyle = '#d8d0c0'; g.stroke(); } }
      if (id === 'broom') { g.fillStyle = '#2a5a2a'; rr(g, hx, -14, 8, 28, 2); g.fill(); g.fillStyle = '#c8a860'; g.fillRect(hx + 8, -12, 16, 24); }
      if (id === 'rake') { g.fillStyle = metal(hx, hx + 6); g.fillRect(hx, -18, 5, 36); for (let i = -16; i <= 16; i += 6) g.fillRect(hx + 4, i - 1, 10, 2); }
      if (id === 'shovel') { g.fillStyle = metalGrad(g, '#5a6a5a', hx, -16, hx + 30, 16); g.beginPath(); g.moveTo(hx, -12); g.lineTo(hx + 26, -14); g.quadraticCurveTo(hx + 34, 0, hx + 26, 14); g.lineTo(hx, 12); g.fill(); }
      if (id === 'garden_fork') { g.fillStyle = metal(hx, hx + 30); g.fillRect(hx, -12, 4, 24); for (let i = -10; i <= 10; i += 7) g.fillRect(hx + 4, i - 1.5, 24, 3); }
      break;
    }
    case 'skateboard': {
      g.fillStyle = gloss(g, '#d83a2a', -12, 12); rr(g, -L / 2, -12, L, 24, 12); g.fill();
      g.fillStyle = '#1b1d22'; rr(g, -L / 2 + 4, -10, L - 8, 6, 3); g.fill();
      g.fillStyle = '#f0e8d0'; for (const x of [-L / 2 + 14, L / 2 - 14]) for (const y of [-16, 16]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'umbrella': {
      g.fillStyle = gloss(g, '#1f2a44', -12, 12); g.beginPath(); g.moveTo(-L / 2 + 14, 0); g.lineTo(L / 2 - 4, -10); g.lineTo(L / 2, 0); g.lineTo(L / 2 - 4, 10); g.closePath(); g.fill();
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 5; g.beginPath(); g.arc(-L / 2 + 10, 8, 8, -Math.PI / 2, Math.PI, true); g.stroke();
      break;
    }
    case 'chair':
    case 'brick':
    case 'dustbin_lid': {
      g.restore(); g.save(); g.translate(64, 64);
      if (id === 'brick') { g.fillStyle = gloss(g, '#9a4a32', -20, 20); rr(g, -34, -18, 68, 36, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-26, -8, 52, 16); break; }
      if (id === 'dustbin_lid') { g.fillStyle = metalGrad(g, '#8a8d93', -40, -40, 40, 40); g.beginPath(); g.ellipse(0, 4, 44, 34, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5a5e64'; rr(g, -14, -10, 28, 10, 3); g.fill(); break; }
      g.fillStyle = wood('#5a3a20');
      g.fillRect(-30, -40, 8, 80); g.fillRect(22, -40, 8, 80); g.fillRect(-30, -40, 60, 10); g.fillRect(-34, 0, 68, 10); g.fillRect(-30, 10, 6, 34); g.fillRect(24, 10, 6, 34);
      break;
    }
    case 'torch': {
      g.fillStyle = metal(-L / 2, L / 2); rr(g, -L / 2, -8, L - 16, 16, 4); g.fill();
      g.fillStyle = metal(L / 2 - 20, L / 2); rr(g, L / 2 - 20, -13, 20, 26, 4); g.fill();
      g.fillStyle = '#fff8c0'; g.beginPath(); g.ellipse(L / 2, 0, 3, 11, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'golf_club': {
      g.fillStyle = metal(-L / 2, L / 2); rr(g, -L / 2 + 12, -2, L - 18, 4, 2); g.fill();
      handle(16, '#1b1d22', 8);
      g.fillStyle = metal(L / 2 - 10, L / 2 + 8); g.beginPath(); g.moveTo(L / 2 - 8, -4); g.lineTo(L / 2 + 6, -4); g.lineTo(L / 2 + 10, 14); g.lineTo(L / 2 - 4, 12); g.closePath(); g.fill();
      break;
    }
    case 'pool_cue': {
      const gr = g.createLinearGradient(-L / 2, 0, L / 2, 0); gr.addColorStop(0, '#2a1a0a'); gr.addColorStop(0.35, '#2a1a0a'); gr.addColorStop(0.36, '#d8b070'); gr.addColorStop(1, '#e8c890');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-L / 2, -5); g.lineTo(L / 2, -2); g.lineTo(L / 2, 2); g.lineTo(-L / 2, 5); g.closePath(); g.fill();
      g.fillStyle = '#4a7ab0'; g.fillRect(L / 2 - 3, -2, 3, 4);
      break;
    }
    case 'bat':
    case 'baseball_bat':
    case 'club':
    case 'chair_leg':
    case 'table_leg':
    case 'plank': {
      const c = id === 'bat' ? '#c9a46a' : id === 'baseball_bat' ? '#8a5a32' : id === 'plank' ? '#b08a5a' : '#6a4a2a';
      if (id === 'bat') { handle(L * 0.32, '#1b1d22', 7); g.fillStyle = wood(c); rr(g, -L / 2 + L * 0.3, -11, L * 0.7, 22, 5); g.fill(); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-L / 2 + L * 0.35, -2, L * 0.6, 4); }
      else if (id === 'plank') { g.fillStyle = wood(c); g.fillRect(-L / 2, -9, L, 18); g.strokeStyle = 'rgba(60,40,20,0.5)'; g.beginPath(); g.moveTo(-L / 2, -3); g.lineTo(L / 2, -1); g.moveTo(-L / 2, 4); g.lineTo(L / 2, 5); g.stroke(); g.fillStyle = '#5a5e64'; g.beginPath(); g.arc(L / 2 - 8, 0, 2, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = wood(c); g.beginPath(); g.moveTo(-L / 2, -4); g.lineTo(L / 2, -9); g.quadraticCurveTo(L / 2 + 6, 0, L / 2, 9); g.lineTo(-L / 2, 4); g.closePath(); g.fill(); if (id === 'baseball_bat') { g.fillStyle = '#1b1d22'; g.fillRect(-L / 2, -5, 16, 10); } }
      break;
    }
    default: {
      // Pipes, bars, crowbars, poles, shelving.
      g.fillStyle = metal(-L / 2, L / 2); rr(g, -L / 2, -5, L, 10, 3); g.fill();
      if (id === 'crowbar') { g.strokeStyle = metal(L / 2 - 20, L / 2); g.lineWidth = 10; g.beginPath(); g.arc(L / 2 - 10, 10, 12, -Math.PI / 2, Math.PI / 2); g.stroke(); }
      if (id === 'pipe') { g.fillStyle = metal(L / 2 - 14, L / 2); rr(g, L / 2 - 14, -8, 14, 16, 3); g.fill(); }
      if (id === 'shelf_bar') { g.fillStyle = '#0c0e13'; for (let x = -L / 2 + 8; x < L / 2 - 6; x += 9) g.fillRect(x, -2, 5, 4); }
      if (id === 'metal_bar') { g.strokeStyle = shade(col, -0.4); g.lineWidth = 2; for (let x = -L / 2; x < L / 2; x += 6) { g.beginPath(); g.moveTo(x, -5); g.lineTo(x + 4, 5); g.stroke(); } }
    }
  }
  g.restore();
}
