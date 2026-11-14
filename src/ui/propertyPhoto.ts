import { PROPERTIES, type PropertyDef } from '../realty/catalogue';

/**
 * The listing photo: a painted picture of the outside of a property, drawn
 * from what kind of place it is (a terrace, a semi, a tower block, a glass
 * apartment building, a mansion behind gates), its fit-out and its street.
 * Same picture every time for the same place.
 */

const cache = new Map<string, string>();

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function windows(g: Ctx, x: number, y: number, w: number, h: number, cols: number, rows: number, ww: number, wh: number, lit: () => boolean, frame = '#f0ece2'): void {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cx = x + (w / cols) * (c + 0.5) - ww / 2;
      const cy = y + (h / rows) * (r + 0.5) - wh / 2;
      g.fillStyle = frame;
      g.fillRect(cx - 2, cy - 2, ww + 4, wh + 4);
      g.fillStyle = lit() ? '#ffd890' : '#2a3448';
      g.fillRect(cx, cy, ww, wh);
    }
}

function roof(g: Ctx, x: number, y: number, w: number, h: number, colour: string): void {
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(x - 6, y);
  g.lineTo(x + w * 0.18, y - h);
  g.lineTo(x + w * 0.82, y - h);
  g.lineTo(x + w + 6, y);
  g.closePath();
  g.fill();
}

function paint(d: PropertyDef): string {
  const W = 480;
  const H = 270;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = rng(d.id);
  const lit = () => r() < 0.45;
  // Evening sky and the ground.
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, d.tier === 'super' ? '#1b2440' : '#232838');
  sky.addColorStop(1, d.tier === 'budget' ? '#7a5a4a' : '#c87a5a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const groundY = 222;
  g.fillStyle = d.garden ? '#3d6a34' : '#5a5a5e';
  g.fillRect(0, groundY, W, H - groundY);
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, groundY + 28, W, 20);
  // Neighbours either side, darker.
  g.fillStyle = 'rgba(20,22,30,0.85)';
  g.fillRect(0, 70 + r() * 40, 60, groundY);
  g.fillRect(W - 60, 60 + r() * 50, 60, groundY);
  const brick = ['#8a4a36', '#9a5a40', '#7a4232'][Math.floor(r() * 3)];
  const render = ['#e8e0cc', '#dcd4c0', '#eeece6'][Math.floor(r() * 3)];
  if (d.cat === 'mansion') {
    const modern = d.id === 'm_glasshouse';
    const wall = modern ? '#eeece6' : d.id === 'm_wyvern_hall' ? brick : d.id === 'm_heathfield' ? '#c8bc9e' : render;
    // Wings, main block, roof, portico, then railings and gate piers in front.
    g.fillStyle = wall;
    g.fillRect(70, 110, 90, groundY - 110);
    g.fillRect(320, 110, 90, groundY - 110);
    g.fillRect(140, 70, 200, groundY - 70);
    if (modern) {
      g.fillStyle = '#2a2c30';
      g.fillRect(130, 64, 220, 8);
      g.fillStyle = '#ffd890';
      g.fillRect(150, 150, 180, 60);
      g.fillStyle = '#9ab8d8';
      g.fillRect(160, 84, 160, 46);
      g.fillStyle = '#ffd890';
      g.fillRect(84, 150, 60, 50);
      g.fillRect(334, 150, 60, 50);
    } else {
      roof(g, 140, 70, 200, 26, '#3a3e46');
      roof(g, 70, 110, 90, 16, '#3a3e46');
      roof(g, 320, 110, 90, 16, '#3a3e46');
      windows(g, 140, 80, 200, 90, 6, 2, 16, 26, lit);
      windows(g, 70, 130, 90, 70, 2, 1, 16, 24, lit);
      windows(g, 320, 130, 90, 70, 2, 1, 16, 24, lit);
      if (d.id !== 'm_wyvern_hall') {
        g.fillStyle = '#f2eee4';
        for (const x of [212, 228, 252, 268]) g.fillRect(x, 160, 6, 62);
        g.beginPath();
        g.moveTo(204, 160);
        g.lineTo(240, 140);
        g.lineTo(276, 160);
        g.fill();
      }
      g.fillStyle = '#1a1a1e';
      g.fillRect(232, 186, 16, 36);
    }
    // Railings and gates.
    g.fillStyle = '#18191c';
    for (let x = 0; x < W; x += 7) if (x < 200 || x > 280) g.fillRect(x, groundY - 4, 2, 34);
    g.fillRect(0, groundY - 2, W, 3);
    g.fillStyle = '#d8d0c0';
    g.fillRect(196, groundY - 26, 12, 56);
    g.fillRect(272, groundY - 26, 12, 56);
    g.fillStyle = '#ffd890';
    g.beginPath();
    g.arc(202, groundY - 30, 5, 0, Math.PI * 2);
    g.arc(278, groundY - 30, 5, 0, Math.PI * 2);
    g.fill();
  } else if (d.cat === 'apartment' || (d.cat === 'flat' && (d.id === 'f_lowry_3' || d.id === 'f_hollins_41' || d.id === 'f_fairclough_12'))) {
    const glass = d.id === 'a_ashcombe_tower' || d.id === 'a_pinnacle_ph' || d.id === 'a_shaws_9';
    const conv = d.id === 'a_bonded_4';
    const tall = glass ? 18 : d.cat === 'flat' ? 10 : 6;
    const top = Math.max(10, groundY - tall * 18);
    g.fillStyle = glass ? '#3a4a5e' : conv ? brick : d.id === 'a_belgrave_2' ? render : '#9a9890';
    g.fillRect(140, top, 200, groundY - top);
    if (glass) {
      for (let y = top + 6; y < groundY - 10; y += 16) {
        g.fillStyle = r() < 0.5 ? '#ffd890' : '#6a8aa8';
        g.fillRect(146, y, 188, 10);
      }
      if (d.id === 'a_pinnacle_ph') {
        g.fillStyle = '#ffe2a0';
        g.fillRect(140, top, 200, 30);
        g.fillStyle = '#f4f2ee';
        g.fillRect(132, top + 30, 216, 5);
      }
    } else windows(g, 140, top + 6, 200, groundY - top - 30, 6, Math.max(2, Math.floor(tall * 0.9)), 16, 14, lit, conv ? '#2a2a2a' : '#e8e4dc');
    g.fillStyle = '#1a1a1e';
    g.fillRect(226, groundY - 30, 28, 30);
    // The one that's for sale, picked out.
    g.strokeStyle = '#ffd23d';
    g.lineWidth = 3;
    g.strokeRect(166 + Math.floor(r() * 4) * 34, top + 20 + Math.floor(r() * 3) * 20, 26, 22);
  } else {
    // Houses: terrace, semi, detached and the big ones.
    const big = d.id === 'h_ashcombe_beeches' || d.id === 'h_ashcombe_linden';
    const modern = d.id === 'h_ashcombe_linden';
    const w = d.id === 'h_tanner_9' || d.id === 'f_kirkgate_58b' ? 130 : big ? 260 : 200;
    const x0 = (W - w) / 2;
    const top = big ? 70 : 100;
    g.fillStyle = modern ? '#eeece6' : d.id === 'h_hollins_27' || d.id === 'h_parkside_6' ? render : brick;
    g.fillRect(x0, top, w, groundY - top);
    if (modern) {
      g.fillStyle = '#2a2c30';
      g.fillRect(x0 - 8, top - 8, w + 16, 8);
      g.fillStyle = '#ffd890';
      g.fillRect(x0 + 14, top + 70, w - 28, 60);
      g.fillStyle = '#7a9ab8';
      g.fillRect(x0 + 40, top + 14, w - 80, 40);
    } else {
      roof(g, x0, top, w, big ? 40 : 30, '#3a3e46');
      windows(g, x0, top + 8, w, groundY - top - 50, big ? 4 : 2, 2, 22, 26, lit);
      if (d.id === 'h_hollins_27' || d.id === 'h_parkside_6' || big) {
        // Bay window.
        g.fillStyle = '#f0ece2';
        g.fillRect(x0 + 16, groundY - 58, 50, 50);
        g.fillStyle = lit() ? '#ffd890' : '#2a3448';
        g.fillRect(x0 + 22, groundY - 52, 38, 34);
      }
      g.fillStyle = ['#1d3a2a', '#7a1414', '#1d2a5a', '#1a1a1a'][Math.floor(r() * 4)];
      g.fillRect(x0 + w - 48, groundY - 48, 24, 48);
    }
    if (d.garden) {
      g.fillStyle = '#5a7a3a';
      g.beginPath();
      g.arc(x0 - 26, groundY - 30, 26, 0, Math.PI * 2);
      g.arc(x0 + w + 26, groundY - 36, 30, 0, Math.PI * 2);
      g.fill();
    }
    if (d.id === 'f_kirkgate_58b') {
      g.strokeStyle = '#ffd23d';
      g.lineWidth = 3;
      g.strokeRect(x0 + 20, top + 14, w - 40, 50);
    }
  }
  // Vignette and an agent's corner flash.
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c.toDataURL('image/png');
}

/** The painted picture, made once per property; null if the canvas isn't available. */
function painted(d: PropertyDef): string | null {
  let url = cache.get(d.id);
  if (!url) {
    try {
      url = paint(d);
      cache.set(d.id, url);
    } catch {
      return null;
    }
  }
  return url;
}

/** Photos that failed to load: these go straight to the painted picture next time. */
const missing = new Set<string>();

/**
 * The listing photo for a property, as an <img>: the render of the real house in public/art/property,
 * or the painted picture if that can't be loaded.
 */
export function propertyPhoto(id: string, cls = 'rt-photo'): HTMLImageElement {
  const d = PROPERTIES[id];
  const img = document.createElement('img');
  img.className = cls;
  img.alt = d ? `Outside ${d.name}` : '';
  img.draggable = false;
  if (!d || typeof document === 'undefined') return img;
  const fallback = () => {
    const url = painted(d);
    if (url) img.src = url;
  };
  if (missing.has(id)) {
    fallback();
    return img;
  }
  img.onerror = () => {
    img.onerror = null;
    missing.add(id);
    fallback();
  };
  img.src = `/art/property/${id}.webp`;
  return img;
}
