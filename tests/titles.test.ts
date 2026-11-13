/**
 * Title graphics: the list in src/ui/titles.ts matches public/art/titles, names
 * turn into the right file names, and every graphic the menus ask for exists.
 */
import { readdirSync } from 'fs';
import { TITLE_SLUGS, slugify, firstTitle, titleFor } from '../src/ui/titles';
import { BOSSES } from '../src/ai/bosses';
import { LEVELS } from '../src/world/levels';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}

const dir = new URL('../public/art/titles/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();

console.log('Title graphics');
test('the list matches the folder', () => {
  const listed = [...TITLE_SLUGS].sort();
  const missing = files.filter((f) => !TITLE_SLUGS.has(f));
  const extra = listed.filter((s) => !files.includes(s));
  assert(!missing.length && !extra.length, `not listed: ${missing.join(', ')}; listed but no file: ${extra.join(', ')}`);
});
test('names become file names', () => {
  assert(slugify('Tanner Road Estate') === 'tanner-road-estate', slugify('Tanner Road Estate'));
  assert(slugify('Pawn & Gold') === 'pawn-and-gold', slugify('Pawn & Gold'));
  assert(slugify('Gaz Mullins') === 'gaz-mullins', 'boss name');
  assert(slugify('The Gaffer') === 'the-gaffer', 'boss title');
  assert(slugify('Del’s Gym') === 'dels-gym', slugify('Del’s Gym'));
  assert(titleFor('The Neon Mile') === 'neon-mile', 'leading The');
  assert(titleFor('Nowhere In Particular') === null, 'no graphic gives null');
  assert(slugify('Dr. Imogen Vale') === 'dr-imogen-vale', slugify('Dr. Imogen Vale'));
});
test('every graphic the menus and call-outs ask for exists', () => {
  const wanted = [
    'menu-new-game', 'menu-continue', 'menu-settings', 'menu-controls', 'menu-character', 'menu-training-ground',
    'pause', 'resume', 'back', 'settings',
    'game', 'audio', 'display', 'training', 'difficulty', 'controls',
    'master-volume', 'effects-volume', 'ambience-volume', 'graphics-quality', 'lighting-and-glow', 'screen-shake', 'frame-rate-counter', 'touch-controls', 'show-hitboxes',
    'easy', 'normal', 'hard', 'low', 'medium', 'high', 'reset-to-defaults',
    'fight',
  ];
  const missing = wanted.filter((w) => !TITLE_SLUGS.has(w));
  assert(!missing.length, `missing: ${missing.join(', ')}`);
  assert(firstTitle('you-win', 'level-complete') === 'you-win', 'victory');
  assert(firstTitle('game-over', 'mission-failed') === 'game-over', 'defeat');
  assert(firstTitle('no-such-thing') === null, 'unknown should give null (text fallback)');
});
test('report: bosses and places with painted names', () => {
  const bosses = Object.values(BOSSES);
  const named = bosses.filter((b) => TITLE_SLUGS.has(slugify(b.name))).length;
  const titled = bosses.filter((b) => TITLE_SLUGS.has(slugify(b.title))).length;
  const places = Object.values(LEVELS);
  const placed = places.filter((l) => titleFor(l.name) || titleFor(l.district)).length;
  console.log(`       bosses: ${named}/${bosses.length} names, ${titled}/${bosses.length} titles; places: ${placed}/${places.length}`);
  assert(named > 0 && placed > 0, 'no boss or place graphics matched at all: slugs have probably drifted');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
