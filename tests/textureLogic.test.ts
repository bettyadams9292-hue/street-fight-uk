const g = globalThis as any;
g.window = g; g.devicePixelRatio = 1; g.innerWidth = 800; g.innerHeight = 600; g.addEventListener = () => {}; g.matchMedia = () => ({ matches: false, addEventListener() {} });
const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} }) : k === 'getImageData' || k === 'createImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)), width: w, height: h }) : () => {}), set: () => true });
g.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }), createElement: () => ({ getContext: () => ctx, width: 0, height: 0, style: {}, toDataURL: () => '' }), body: { appendChild() {} }, fonts: { ready: Promise.resolve() } };
g.location = { search: '', href: 'http://x/' }; g.fetch = () => Promise.reject(new Error('offline'));
g.Image = class { set src(_v: string) {} };
/**
 * Every surface the level builder textures, in every level, gets a set that makes sense for what it is:
 * porcelain only on baths, toilets and basins; concrete only on buildings and grounds; no wood on
 * painted orange, yellow or gold; felt and canvas, not leather or planks, on baize and awnings;
 * fridges and cookers in white painted metal. (The owner's review of #25 found a black bath and
 * fridge, and brick awnings.)
 */
import { Color, MeshStandardMaterial as MSM, SRGBColorSpace } from 'three';
import { LEVELS } from '../src/world/levels';
import { LevelView } from '../src/render/LevelView';
import * as A from '../src/render/materials/assign';
import { Progress, newSave } from '../src/progress/Progress';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
const seen = new Map<string, string>();
const orig = A.guess;
(LevelView.prototype as any).mat = function (colour: any, rough = 0.8, metal = 0, extra: any = {}) {
  const lib = Object.keys(extra).length === 0 ? orig(colour, rough, metal, this.building, 1) : null;
  const k = `${this.building || '(room)'}\t${colour}\t${rough}\t${metal}`;
  if (lib) seen.set(k, lib.set + (lib.plain ? ' (paint)' : ''));
  return new MSM({ color: colour });
};
const p = new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
let ok = 0, bad = 0;
for (const lvl of Object.values(LEVELS)) {
  try { new LevelView(lvl as any, p); ok++; } catch (e) { bad++; if (bad < 3) console.error((e as Error).stack?.split("\n").slice(0, 4).join(" | ")); }
}
let failed = 0;
const check = (c: boolean, msg: string) => { if (!c) { failed++; console.log(`  FAIL ${msg}`); } };
check(ok === Object.keys(LEVELS).length && bad === 0, `built ${ok} levels, ${bad} failed`);
const rows = [...seen].map(([k, set]) => { const [kind, colour, rough, metal] = k.split('\t'); return { kind, colour, rough: +rough, metal: +metal, set }; });
const hsl = { h: 0, s: 0, l: 0 };
for (const r of rows) {
  const what = `${r.kind} ${r.colour} → ${r.set}`;
  if (r.set.startsWith('Porcelain')) check(/^(bath|toilet|basin|pool_basin)$/.test(r.kind), `porcelain off the bathroom: ${what}`);
  if (r.set.startsWith('Concrete')) check(!/^(shop_rail|shop_shelf|boxing_ring|market_stall|dumpster|skip|junk|fridge|bed|sofa|desk|counter|bar)$/.test(r.kind), `concrete on furniture: ${what}`);
  if (/^(Wood|Planks)/.test(r.set)) {
    new Color(r.colour).getHSL(hsl, SRGBColorSpace);
    check(!(hsl.s > 0.62 && hsl.l >= 0.25), `wood on bright paint: ${what}`);
  }
  if (/^(fridge|cooker)$/.test(r.kind) && r.metal < 0.5) check(r.set === 'Metal050C (paint)', `white goods not painted metal: ${what}`);
  if (/^(roulette_table|blackjack_table|pool_table)$/.test(r.kind) && r.set.startsWith('Leather')) check(false, `leather baize: ${what}`);
}
check(rows.some((r) => r.kind === 'shop' && r.set === 'Fabric081A'), 'shop awnings are canvas');
console.log(`textureLogic: ${rows.length} surfaces checked, ${failed} failed`);
if (failed) process.exit(1);
