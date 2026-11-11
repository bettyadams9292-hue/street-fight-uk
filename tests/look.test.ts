/** Art-direction tests: every look is well formed, and the default can always be turned off. */
import { DEFAULT_LOOK_ID, LOOKS, LOOK_BY_ID, resolveLook, type EnvSpec, type RGB } from '../src/render/look/looks';

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
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
const rgbOk = (c: RGB, hi = 1) => c.length === 3 && c.every((v) => inRange(v, 0, hi));

console.log('Looks');

test('the signed-off look is the default, and can always be turned off', () => {
  assert(DEFAULT_LOOK_ID === 'sodium' && LOOK_BY_ID[DEFAULT_LOOK_ID], 'the default look does not exist');
  assert(resolveLook('', true)?.id === 'sodium', 'default look not used');
  assert(resolveLook('?debug&shot=menu', true)?.id === 'sodium', 'other switches changed the look');
  assert(resolveLook('', false) === null, 'the setting did not turn the look off');
  assert(resolveLook('?look=off', true) === null, '?look=off did not give the plain picture');
  assert(resolveLook('?look=ink', false)?.id === 'ink', '?look=<id> should work for comparisons');
  assert(resolveLook('?look=nonsense', true)?.id === 'sodium', 'an unknown look should fall back to the default');
  assert(resolveLook('?look=nonsense', false) === null, 'an unknown look turned a look on');
});

test('there are three distinct looks with file-safe ids', () => {
  assert(LOOKS.length === 3, `expected 3 looks, found ${LOOKS.length}`);
  assert(new Set(LOOKS.map((l) => l.id)).size === LOOKS.length, 'duplicate id');
  for (const l of LOOKS) {
    assert(/^[a-z0-9_]+$/.test(l.id), `${l.id} is not file-safe`);
    assert(LOOK_BY_ID[l.id] === l, `${l.id} missing from lookup`);
    assert(l.name.length > 0 && l.intent.length > 20, `${l.id} has no stated intent`);
  }
});

test('grades stay inside safe limits (nothing blown out, crushed or unreadable)', () => {
  for (const l of LOOKS) {
    const g = l.grade;
    assert(inRange(g.exposure, 0.7, 1.6), `${l.id} exposure ${g.exposure}`);
    assert(inRange(g.contrast, 0.8, 1.35), `${l.id} contrast ${g.contrast}`);
    assert(inRange(g.saturation, 0.4, 1.4), `${l.id} saturation ${g.saturation}`);
    assert(inRange(g.tintAmount, 0, 0.35), `${l.id} tint ${g.tintAmount}`);
    assert(inRange(g.vignette, 0, 0.5), `${l.id} vignette ${g.vignette}`);
    assert(inRange(g.grain, 0, 0.1), `${l.id} grain ${g.grain}`);
    assert(inRange(g.edges, 0, 1), `${l.id} edges ${g.edges}`);
    assert(g.posterize === 0 || inRange(g.posterize, 4, 16), `${l.id} posterize ${g.posterize}`);
    assert(rgbOk(g.shadowTint) && rgbOk(g.highlightTint), `${l.id} tint colours`);
    assert(rgbOk(g.lift, 0.08), `${l.id} lift would fog the blacks`);
  }
});

test('bloom only catches bright things', () => {
  for (const l of LOOKS) {
    assert(inRange(l.bloom.threshold, 0.75, 1), `${l.id} bloom threshold ${l.bloom.threshold} would make the whole picture glow`);
    assert(inRange(l.bloom.strength, 0, 0.8), `${l.id} bloom strength ${l.bloom.strength}`);
    assert(inRange(l.bloom.radius, 0, 1), `${l.id} bloom radius`);
  }
});

test('every look has a lit environment for streets and for rooms', () => {
  const check = (id: string, where: string, e: EnvSpec) => {
    assert(rgbOk(e.sky) && rgbOk(e.horizon) && rgbOk(e.ground), `${id} ${where}: sky colours`);
    assert(inRange(e.intensity, 0.1, 1.2), `${id} ${where}: intensity ${e.intensity}`);
    assert(e.panels.length >= 1 && e.panels.length <= 6, `${id} ${where}: needs 1 to 6 lights`);
    for (const p of e.panels) {
      assert(rgbOk(p.color) && inRange(p.power, 0.1, 12), `${id} ${where}: a light is out of range`);
      assert(p.pos[1] > 0, `${id} ${where}: a light is below the floor`);
      assert(p.size[0] > 0 && p.size[1] > 0, `${id} ${where}: a light has no size`);
    }
  };
  for (const l of LOOKS) {
    check(l.id, 'outdoors', l.outdoors);
    check(l.id, 'indoors', l.indoors);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
