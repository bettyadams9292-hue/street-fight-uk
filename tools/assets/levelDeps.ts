/**
 * Which models each level asks for, found by building every level in Node with the model sets recording
 * (`recorder` in src/render/props/modelSet.ts) and the street kits loaded from public/, as they are in
 * the browser. Written to src/performance/levelAssets.generated.ts, which the game uses to load a location's
 * models first and to hold a level back until they're in (src/performance/levelAssets.ts).
 *
 *   npx tsx tools/assets/levelDeps.ts          rewrite the file
 *   npx tsx tools/assets/levelDeps.ts --check  exit 1 if the file is out of date (tests/levelAssets.test.ts)
 *
 * Levels built from the save (home, basement, property, the estate with your car) are listed as their
 * plain definitions, which is what a district streamed in next door is built from; arriving in one, the
 * game records that visit's own version instead (levelAssets.ts recordLevel).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'src/performance/levelAssets.generated.ts');

const g = globalThis as any;
g.window = g; g.devicePixelRatio = 1; g.innerWidth = 800; g.innerHeight = 600; g.addEventListener = () => {};
g.matchMedia = () => ({ matches: false, addEventListener() {} });
const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} }) : k === 'getImageData' || k === 'createImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)), width: w, height: h }) : () => {}), set: () => true });
// Images (the city kit's textures) "load" at once, so the kit loads as it does in the browser.
const element = () => {
  const on: Record<string, () => void> = {};
  return { style: {}, width: 1, height: 1, addEventListener: (t: string, cb: () => void) => (on[t] = cb), removeEventListener() {}, set src(_v: string) { setTimeout(() => on.load?.(), 0); } };
};
g.document = { createElementNS: element, createElement: () => ({ getContext: () => ctx, width: 0, height: 0, style: {}, toDataURL: () => '' }), body: { appendChild() {} }, fonts: { ready: Promise.resolve() } };
g.location = { search: '', href: 'http://x/' };
g.Image = class { set src(_v: string) {} };
// The street kits come off the disk; nothing else is fetched (the model sets only record).
g.fetch = async (url: string) => {
  if (!/^\/models\/(polyfork|city)\/kit\.(json|bin)(\.gz)?$/.test(url)) throw new Error(`offline: ${url}`);
  const bytes = readFileSync(join(ROOT, 'public', url));
  return new Response(bytes);
};

export async function recordLevelDeps(): Promise<Record<string, Record<string, string[]>>> {
  const { recorder } = await import('../../src/render/props/modelSet');
  const { LEVELS } = await import('../../src/world/levels');
  const { LevelView } = await import('../../src/render/LevelView');
  const { loadPolyKit } = await import('../../src/render/kit/PolyKit');
  const { loadCityKit } = await import('../../src/render/city/CityKit');
  const { Progress, newSave } = await import('../../src/progress/Progress');
  const { createCharacter, emptyAllocation } = await import('../../src/character/Character');
  const { defaultAppearance } = await import('../../src/character/Appearance');
  // Every set registers itself when its library module loads.
  await Promise.all(['GymLibrary', 'ShopLibrary', 'HydroLibrary', 'SecurityLibrary', 'VehicleLibrary', 'PropertyLibrary', 'DoorLibrary'].map((m) => import(`../../src/render/props/${m}.ts`)));
  if (!(await loadPolyKit())) throw new Error('the street kit did not load');
  if (!(await loadCityKit())) throw new Error('the city kit did not load');
  const p = new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  const out: Record<string, Record<string, string[]>> = {};
  recorder.on = true;
  try {
    for (const id of Object.keys(LEVELS).sort()) {
      recorder.used.clear();
      const v = new LevelView(LEVELS[id as keyof typeof LEVELS] as any, p);
      v.dispose();
      const deps: Record<string, string[]> = {};
      for (const [set, ids] of [...recorder.used].sort(([a], [b]) => a.localeCompare(b))) deps[set] = [...ids].sort();
      out[id] = deps;
    }
  } finally {
    recorder.on = false;
  }
  return out;
}

const text = (deps: Record<string, Record<string, string[]>>): string =>
  '// Made by tools/assets/levelDeps.ts: do not edit. The models each level asks for, by model set.\n' +
  'export const LEVEL_MODELS: Record<string, Record<string, readonly string[]>> = ' + JSON.stringify(deps, null, 1) + ';\n';

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const deps = await recordLevelDeps();
  if (process.argv.includes('--check')) {
    const now = readFileSync(OUT, 'utf8');
    if (now !== text(deps)) {
      console.error('src/performance/levelAssets.generated.ts is out of date: run npx tsx tools/assets/levelDeps.ts');
      process.exit(1);
    }
    console.log(`levelAssets.generated.ts up to date (${Object.keys(deps).length} levels)`);
  } else {
    writeFileSync(OUT, text(deps));
    console.log(`wrote ${Object.keys(deps).length} levels to ${OUT}`);
  }
}
