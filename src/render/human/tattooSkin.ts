/**
 * Tattoos on the MakeHuman bodies: the skin texture with the designs inked on, for anyone whose look has tattoos
 * (the player from the tattoo studio or the creator, bosses, some passers-by).
 *
 * Every skin in the pack shares one UV layout (MakeHuman's default), so each slot is a place on that layout:
 * `SLOT_UV`, measured from the body's own UVs and skin weights (the arm strips run along u, the torso stands
 * upright). Each design is drawn on a small canvas of its own, turned to run up the limb, and laid on the skin
 * with a multiply, so the skin's grain shows through the ink.
 *
 * Textures are cached by skin, ink and designs: a crowd with the same look shares one. The cache is small; past
 * it, the oldest goes (and is disposed when nothing has used it for a while).
 */
import * as THREE from 'three';
import type { TattooDesign, TattooSlot } from '../../character/Appearance';
import { drawDesign } from '../skinPainter';

export interface InkSpot {
  slot: TattooSlot;
  design: TattooDesign;
}

interface SlotPlace {
  /** Centre on the texture, as a share of its width and height (top-left origin). */
  x: number;
  y: number;
  /** Across (round the limb) and along it, as a share of the texture's width. */
  across: number;
  along: number;
  /** Turn (radians) so the design's top points up the body: towards the shoulder on an arm. */
  turn: number;
}

/** In 1024ths of the texture. */
const px = (v: number) => v / 1024;
export const SLOT_UV: Record<TattooSlot, SlotPlace> = {
  rightUpperArm: { x: px(178), y: px(178), across: px(138), along: px(118), turn: Math.PI / 2 },
  leftUpperArm: { x: px(598), y: px(178), across: px(138), along: px(118), turn: -Math.PI / 2 },
  rightForearm: { x: px(62), y: px(175), across: px(108), along: px(96), turn: Math.PI / 2 },
  leftForearm: { x: px(716), y: px(175), across: px(108), along: px(96), turn: -Math.PI / 2 },
  chest: { x: px(390), y: px(296), across: px(236), along: px(150), turn: 0 },
  neck: { x: px(390), y: px(84), across: px(112), along: px(46), turn: 0 },
};

const CACHE_MAX = 16;
const cache = new Map<string, THREE.CanvasTexture>();

export function inkKey(skin: string, ink: string, spots: readonly InkSpot[]): string {
  return `${skin}|${ink}|${spots.map((s) => `${s.slot}:${s.design}`).join(',')}`;
}

/** One design on its own canvas, `w` across by `h` along, its top towards the canvas's top. */
function slotCanvas(design: TattooDesign, w: number, h: number, ink: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(w));
  c.height = Math.max(8, Math.round(h));
  const g = c.getContext('2d')!;
  if (design === 'sleeve') drawDesign(g, 'sleeve', 0, 0, c.width, c.height, ink);
  else {
    // Designs are about 90 units across at H = 128: fit the smaller side.
    const scale = Math.min(c.width, c.height) / 92;
    drawDesign(g, design, c.width / 2, c.height / 2, c.width, scale * 128, ink);
  }
  return c;
}

/** Paint the designs onto a copy of the skin image. Null if the image isn't drawable (yet). */
export function inkCanvas(image: CanvasImageSource & { width: number; height: number }, ink: string, spots: readonly InkSpot[]): HTMLCanvasElement | null {
  const W = image.width;
  const H = image.height;
  if (!W || !H || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(image, 0, 0, W, H);
  for (const s of spots) {
    if (s.design === 'none') continue;
    const at = SLOT_UV[s.slot];
    const layer = slotCanvas(s.design, at.across * W, at.along * W, ink);
    g.save();
    g.translate(at.x * W, at.y * H);
    g.rotate(at.turn);
    // Ink sits in the skin: multiplied, slightly soft.
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.92;
    g.drawImage(layer, -layer.width / 2, -layer.height / 2);
    g.restore();
  }
  return c;
}

/**
 * The skin with the tattoos on, shared between everyone with the same skin, ink and designs. Falls back to the
 * plain skin texture when the image can't be drawn.
 */
export function inkedSkin(base: THREE.Texture, skinId: string, ink: string, spots: readonly InkSpot[]): THREE.Texture {
  if (!spots.some((s) => s.design !== 'none')) return base;
  const key = inkKey(skinId, ink, spots);
  const hit = cache.get(key);
  if (hit) {
    // Most recently used goes to the back of the queue.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const img = base.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  const canvas = img ? inkCanvas(img, ink, spots) : null;
  if (!canvas) return base;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = base.colorSpace;
  t.anisotropy = base.anisotropy;
  t.flipY = base.flipY;
  t.wrapS = base.wrapS;
  t.wrapT = base.wrapT;
  cache.set(key, t);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string;
    const old = cache.get(oldest)!;
    cache.delete(oldest);
    // Anyone still drawn with it keeps a working texture: three re-uploads on next use if needed.
    old.dispose();
  }
  return t;
}
