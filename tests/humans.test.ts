/**
 * Characters: MakeHuman bodies, clothes cut from them, the NPC generator, the
 * appearance mapping, and Ara's animation clips on our rig.
 */
import { readFileSync } from 'fs';
import { BodyData, DEFAULT_SHAPE, morph, standingHeight, type BodyMeta } from '../src/characters/human/body';
import { cutGarment, GARMENTS, type GarmentKind } from '../src/characters/human/garments';
import { appearanceToHuman, toneOf } from '../src/characters/human/fromAppearance';
import { npc, clearNpcCache, DISTRICT_LOOKS, lookSignature } from '../src/characters/npcs';
import { randomAppearance, defaultAppearance } from '../src/character/Appearance';
import { Rng } from '../src/core/Rng';
import { ARA_CLIPS, araPose, registerMocap } from '../src/render/anim/araPose';
import { MODEL_METRICS, solveBody } from '../src/render/anim/skeleton';

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

const root = new URL('..', import.meta.url).pathname;
const meta = JSON.parse(readFileSync(root + 'public/models/human/body.json', 'utf8')) as BodyMeta;
const bin = readFileSync(root + 'public/models/human/body.bin');
const body = new BodyData(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const catalogue = JSON.parse(readFileSync(root + 'public/models/human/proxies/catalogue.json', 'utf8')) as Record<string, unknown>;
const skins = JSON.parse(readFileSync(root + 'public/models/human/skins.json', 'utf8')) as { id: string; gender: string; tone: number }[];
registerMocap(JSON.parse(readFileSync(root + 'public/anim/ara_mocap.json', 'utf8')));

console.log('Bodies');
test('an average man and woman stand at believable heights', () => {
  const man = standingHeight(body, morph(body, DEFAULT_SHAPE));
  const woman = standingHeight(body, morph(body, { ...DEFAULT_SHAPE, gender: 0 }));
  assert(man > 1.68 && man < 1.85, `man ${man.toFixed(3)} m`);
  assert(woman > 1.55 && woman < 1.72, `woman ${woman.toFixed(3)} m`);
  assert(man > woman, 'men should be taller on average');
});
test('the height slider spans short to tall', () => {
  const lo = standingHeight(body, morph(body, { ...DEFAULT_SHAPE, height: 0 }));
  const hi = standingHeight(body, morph(body, { ...DEFAULT_SHAPE, height: 1 }));
  assert(hi - lo > 0.15, `range only ${(hi - lo).toFixed(3)} m`);
});

console.log('Clothes cut from the body');
const pos = morph(body, DEFAULT_SHAPE);
const normals = new Float32Array(pos.length);
for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
for (const kind of Object.keys(GARMENTS) as GarmentKind[]) {
  test(`${kind}: has a surface and covers skin`, () => {
    const g = cutGarment(body, pos, normals, kind, { main: [0.2, 0.2, 0.2] });
    assert(g.index.length / 3 > 300, `${g.index.length / 3} triangles`);
    let covered = 0;
    for (const c of g.covers) covered += c;
    assert(covered > 300, `covers ${covered} vertices`);
    for (const v of g.position) assert(Number.isFinite(v), 'non-finite position');
  });
}
test('a hoodie covers the arms to the wrist, a vest leaves them bare', () => {
  const hoodie = cutGarment(body, pos, normals, 'hoodie', { main: [0, 0, 0] });
  const vest = cutGarment(body, pos, normals, 'vest', { main: [0, 0, 0] });
  let h = 0;
  let v = 0;
  for (let i = 0; i < hoodie.covers.length; i++) {
    h += hoodie.covers[i];
    v += vest.covers[i];
  }
  assert(h > v * 1.6, `hoodie ${h} vs vest ${v}`);
});

console.log('Appearance to character');
test('every item an appearance asks for exists in the packs', () => {
  const rng = new Rng(5);
  for (let i = 0; i < 300; i++) {
    const a = randomAppearance(() => rng.next());
    const spec = appearanceToHuman(a, skins);
    for (const it of spec.items) assert(it.id in catalogue, `missing item ${it.id}`);
    assert(skins.some((s) => s.id === spec.skin), `missing skin ${spec.skin}`);
    for (const g of spec.garments) assert(g.kind in GARMENTS, `missing garment ${g.kind}`);
  }
});
test('darker skin tones choose darker skin textures', () => {
  const light = appearanceToHuman({ ...defaultAppearance('male'), skinTone: '#f6d7c3' }, skins);
  const dark = appearanceToHuman({ ...defaultAppearance('male'), skinTone: '#3a2416' }, skins);
  const tone = (id: string) => skins.find((s) => s.id === id)!.tone;
  assert(tone(dark.skin) > tone(light.skin) + 0.3, `${light.skin} vs ${dark.skin}`);
  assert(toneOf('#3a2416') > toneOf('#f6d7c3'), 'tone order');
});

console.log('NPC generator');
test('the same id always gives the same person (120 people)', () => {
  const a: string[] = [];
  const districts = Object.keys(DISTRICT_LOOKS);
  for (let i = 0; i < 120; i++) a.push(JSON.stringify(npc(districts[i % districts.length], i).appearance));
  clearNpcCache();
  for (let i = 0; i < 120; i++) assert(JSON.stringify(npc(districts[i % districts.length], i).appearance) === a[i], `person ${i} changed`);
});
test('people are varied: at least 95% of 200 look distinct', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(lookSignature(npc('high_street', 1000 + i).appearance));
  assert(seen.size >= 190, `${seen.size} distinct of 200`);
});
test('districts dress differently: hi-vis on the docks, coats in the City', () => {
  const share = (d: string, top: string) => {
    let n = 0;
    for (let i = 0; i < 200; i++) if (npc(d, 5000 + i).appearance.top === top) n++;
    return n / 200;
  };
  assert(share('docks', 'workwear') > 0.3, `docks hi-vis ${share('docks', 'workwear')}`);
  assert(share('city', 'workwear') < 0.05, 'hi-vis in the City');
  assert(share('city', 'coat') > share('estate', 'coat') + 0.2, 'City should wear more coats than the estate');
  assert(share('estate', 'hoodie') + share('estate', 'tracksuit') > 0.4, 'estate should be hoodies and tracksuits');
});
test('every generated person maps to a buildable character', () => {
  for (let i = 0; i < 150; i++) {
    const spec = appearanceToHuman(npc(Object.keys(DISTRICT_LOOKS)[i % 16], 9000 + i).appearance, skins);
    for (const it of spec.items) assert(it.id in catalogue, `missing ${it.id}`);
  }
});

console.log('Ara animation clips');
test('there are no firearm clips', () => {
  for (const id of Object.keys(ARA_CLIPS)) assert(!/gun|rifle|pistol|shoot|aim|reload/.test(id), `firearm clip ${id}`);
});
for (const id of ['walk', 'run', 'cry', 'sit_idle', ...Object.keys(ARA_CLIPS)]) {
  test(`${id}: finite pose with the feet near the floor`, () => {
    for (const t of [0, 0.25, 0.7]) {
      const p = araPose(id, t, MODEL_METRICS);
      assert(p, 'no pose');
      for (const v of Object.values(p.joints)) for (const x of v!) assert(Number.isFinite(x), 'non-finite joint');
      const b = solveBody(p, MODEL_METRICS);
      const low = Math.min(b.ankle.l[1], b.ankle.r[1]);
      // Lying, rolling and get-ups put the body on the floor; standing clips keep a foot down.
      if (!/death|knockdown|get_up|roll|sit|bow|hit_/.test(id)) assert(Math.abs(low - MODEL_METRICS.ankleH) < 0.06, `lowest ankle at ${low.toFixed(3)} m`);
    }
  });
}
test('the phone call puts a hand at the head', () => {
  const p = araPose('phone_call', 1, MODEL_METRICS)!;
  const b = solveBody(p, MODEL_METRICS);
  const near = Math.min(Math.hypot(...b.hand.l.map((v, i) => v - b.head[i])), Math.hypot(...b.hand.r.map((v, i) => v - b.head[i])));
  assert(near < 0.2, `hand ${near.toFixed(2)} m from the head`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
