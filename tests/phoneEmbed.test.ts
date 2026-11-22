/**
 * The phone's hosted apps (Me, Crew, Settings) lay out as on an upright phone on every screen
 * (src/ui/phone/embedCss.ts): each size-based media rule is either copied into the phone or kept out of it,
 * judged against an upright phone, never against the real screen. And every media query the game's CSS uses
 * gets a definite answer, so none is silently left to the real screen.
 */
import { readFileSync } from 'node:fs';
import { keepOutOfPhone, matchesPhone, PHONE, splitTop } from '../src/ui/phone/embedCss';

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

test('an upright phone takes the upright-phone rules', () => {
  assert(matchesPhone('(orientation: portrait) and (max-width: 700px)') === true, 'portrait ≤700');
  assert(matchesPhone('(max-width: 720px)') === true, '≤720');
  assert(matchesPhone('(max-width: 1000px)') === true, '≤1000');
  assert(matchesPhone('(max-width: 760px), (max-height: 520px)') === true, 'either');
  assert(matchesPhone('screen and (max-width: 700px)') === true, 'media type');
});

test('and none of the big-screen or sideways ones', () => {
  assert(matchesPhone('(max-height: 520px) and (orientation: landscape)') === false, 'sideways');
  assert(matchesPhone('(max-height: 460px)') === false, 'short');
  assert(matchesPhone('(min-width: 760px), (orientation: landscape) and (max-height: 520px)') === false, 'wide or sideways');
  assert(matchesPhone('not ((orientation: portrait) and (max-width: 700px))') === false, 'not an upright phone');
  assert(matchesPhone('not all and (max-width: 700px)') === false, 'not, as a query prefix');
});

test('rules about the device, not its size, are left alone', () => {
  assert(matchesPhone('(prefers-reduced-motion: reduce)') === null, 'reduced motion');
  assert(matchesPhone('(hover: hover)') === null, 'hover');
  assert(matchesPhone('(pointer: coarse) and (max-width: 700px)') === null, 'mixed');
});

test('the same answer whatever the real screen (it is judged against PHONE only)', () => {
  assert(PHONE.width === 390 && PHONE.height === 700, 'the repo checks UI at 390 × 700');
  assert(matchesPhone('(max-width: 700px)', { width: 1920, height: 1080 }) === false, 'a desktop is not a phone');
  assert(matchesPhone('(max-width: 700px)') === true, 'the default is the phone');
});

test('kept-out selectors keep their pseudo-elements last and gain no specificity', () => {
  const k = ':where(:not(.ph-narrow *))';
  assert(keepOutOfPhone('.a .b') === `.a .b${k}`, keepOutOfPhone('.a .b'));
  assert(keepOutOfPhone('.a, .b::before') === `.a${k}, .b${k}::before`, keepOutOfPhone('.a, .b::before'));
  assert(keepOutOfPhone('.a:hover:after') === `.a:hover${k}:after`, keepOutOfPhone('.a:hover:after'));
  assert(keepOutOfPhone('.a:is(.b, .c)') === `.a:is(.b, .c)${k}`, 'commas in brackets are not a list');
  assert(keepOutOfPhone('.x::-webkit-scrollbar') === `.x${k}::-webkit-scrollbar`, 'vendor pseudo-element');
  assert(keepOutOfPhone(`.a${k}`) === `.a${k}`, 'only once');
});

test('every media query in the game CSS gets a definite answer or is about the device', () => {
  const css = ['src/ui/styles.css', 'src/ui/theme.css'].map((f) => readFileSync(f, 'utf8')).join('\n');
  const queries = new Set([...css.matchAll(/@media([^{]+)\{/g)].map((m) => m[1].trim()));
  assert(queries.size > 5, `found ${queries.size} queries`);
  const device = /prefers-|hover|pointer/;
  for (const q of queries) {
    const r = matchesPhone(q);
    if (r === null) assert(device.test(q), `"${q}" is about size but got no answer`);
  }
  // The upright-phone layout the iPhone uses is one of them, and it reaches the phone.
  assert([...queries].some((q) => /orientation:\s*portrait/.test(q) && matchesPhone(q) === true), 'portrait rules copied');
});

test('splitTop ignores commas inside brackets', () => {
  assert(splitTop('a, b(c, d), e', ',').length === 3, 'three parts');
});

console.log(`\nphone embed: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
