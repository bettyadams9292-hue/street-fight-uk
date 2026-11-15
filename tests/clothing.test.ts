/**
 * The clothing overhaul: every style the game offers builds into something worn on the body,
 * the cut edges are straight, shoes are shaped like shoes with a sole under the whole foot, hats
 * have their brims, everything Threads sells exists, and anything bought can be worn and is kept
 * in the save.
 */
import { readFileSync } from 'fs';
import { BodyData, DEFAULT_SHAPE, morph, type BodyMeta } from '../src/characters/human/body';
import { cutGarment, GARMENTS, type GarmentKind } from '../src/characters/human/garments';
import { appearanceToHuman } from '../src/characters/human/fromAppearance';
import { ACCESSORIES, BOTTOM_STYLES, SHOE_STYLES, TOP_STYLES, defaultAppearance, LABELS, type CharacterAppearance } from '../src/character/Appearance';
import { ITEMS } from '../src/items/items';
import { SHOP_STOCK, buyItem } from '../src/items/shops';
import { Progress, newSave, sanitiseSave } from '../src/progress/Progress';
import { createCharacter, emptyAllocation } from '../src/character/Character';

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
const pos = morph(body, DEFAULT_SHAPE);
// Smooth vertex normals for the morphed body (as the builder makes them).
const normals = new Float32Array(pos.length);
for (let i = 0; i < body.index.length; i += 3) {
  const [a, b, c] = [body.renderBase[body.index[i]], body.renderBase[body.index[i + 1]], body.renderBase[body.index[i + 2]]];
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const v of [a, b, c]) {
    normals[v * 3] += nx;
    normals[v * 3 + 1] += ny;
    normals[v * 3 + 2] += nz;
  }
}
for (let v = 0; v < normals.length / 3; v++) {
  const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1;
  for (let k = 0; k < 3; k++) normals[v * 3 + k] /= l;
}

// Vertices the body actually draws (the base mesh also carries hidden helper geometry).
const drawn = new Uint8Array(body.meta.baseCount);
for (const r of body.index) drawn[body.renderBase[r]] = 1;

const boneNames = ((body.meta as unknown as { bones?: (string | { name: string })[] }).bones ?? []).map((b) => (typeof b === 'string' ? b : b.name));
/** Driven mostly by a foot or toe bone. */
const footBone = (v: number) => /^(foot|toe)/.test(boneNames[body.skinIndex[v * 4]] ?? '');

const look = (over: Partial<CharacterAppearance>): CharacterAppearance => ({ ...defaultAppearance('male'), ...over });
const ids = (a: CharacterAppearance) => {
  const h = appearanceToHuman(a, skins as never);
  return { items: h.items.map((i) => i.id), garments: h.garments.map((g) => g.kind as string) };
};

test('every top, bottoms and shoe style builds into something worn', () => {
  const base = ids(look({ top: 'none', accessories: [] }));
  for (const top of TOP_STYLES) {
    if (top === 'none') continue;
    const got = ids(look({ top }));
    const added = [...got.garments, ...got.items].filter((x) => ![...base.garments, ...base.items].includes(x));
    assert(added.length > 0, `top ${top} adds nothing to the body`);
  }
  for (const bottoms of BOTTOM_STYLES) {
    const got = ids(look({ bottoms }));
    assert(got.garments.length + got.items.length > 0, `bottoms ${bottoms} adds nothing`);
  }
  for (const shoes of SHOE_STYLES) {
    const got = ids(look({ shoes }));
    assert(got.garments.includes(shoes) || got.items.some((i) => i.includes('boots')), `shoes ${shoes} are not built`);
  }
});

test('every accessory and style has a name in the creator', () => {
  for (const x of [...TOP_STYLES, ...BOTTOM_STYLES, ...SHOE_STYLES, ...ACCESSORIES]) assert(LABELS[x], `no label for ${x}`);
});

test('hats are cut from the scalp, and short hair goes under them', () => {
  for (const hat of ['cap', 'beanie', 'bucket_hat'] as const) {
    const got = ids(look({ accessories: [hat], hair: 'crop' }));
    assert(got.garments.includes(hat), `${hat} not built`);
    assert(!got.items.some((i) => i.startsWith('hair') || i.includes('short') || i.includes('crop')), `${hat}: short hair still drawn over it (${got.items.join(', ')})`);
  }
  const long = ids(look({ accessories: ['beanie'], hair: 'long' }));
  assert(long.items.length > ids(look({ accessories: ['beanie'], hair: 'crop' })).items.length, 'long hair should still hang under a beanie');
  assert(ids(look({ accessories: ['flat_cap'] })).items.includes('flat_cap'), 'flat cap missing');
  assert(ids(look({ accessories: ['glasses'] })).items.includes('glasses_library'), 'glasses missing');
});

test('every garment cuts a clean mesh (no NaNs, nothing left floating)', () => {
  for (const kind of Object.keys(GARMENTS) as GarmentKind[]) {
    const g = cutGarment(body, pos, normals, kind, { main: [0.3, 0.3, 0.3] });
    assert(g.index.length >= 300, `${kind}: only ${g.index.length / 3} triangles`);
    for (const x of g.position) assert(Number.isFinite(x), `${kind}: NaN in positions`);
    for (const e of g.extra ?? []) for (const x of e.position) assert(Number.isFinite(x), `${kind}: NaN in ${e.bone} part`);
    // Every triangle uses vertices of this mesh.
    const m = g.position.length / 3;
    for (const i of g.index) assert(i < m, `${kind}: index out of range`);
  }
});

test('hems, cuffs and necklines are straight lines, not saw teeth', () => {
  for (const kind of ['tee', 'polo', 'shirt', 'hoodie', 'jeans', 'chinos', 'jumper', 'gilet', 'beanie'] as GarmentKind[]) {
    const g = cutGarment(body, pos, normals, kind, { main: [0.3, 0.3, 0.3] });
    // Open edges of the garment, by position (render copies at UV seams share a position).
    const keyOf = (l: number) => `${g.position[l * 3].toFixed(5)},${g.position[l * 3 + 1].toFixed(5)},${g.position[l * 3 + 2].toFixed(5)}`;
    const count = new Map<string, number>();
    const ends = new Map<string, [string, string]>();
    for (let i = 0; i < g.index.length; i += 3)
      for (let e = 0; e < 3; e++) {
        const a = keyOf(g.index[i + e]), b = keyOf(g.index[i + ((e + 1) % 3)]);
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        count.set(k, (count.get(k) ?? 0) + 1);
        ends.set(k, [a, b]);
      }
    const nb = new Map<string, string[]>();
    for (const [k, c] of count) {
      if (c !== 1) continue;
      const [a, b] = ends.get(k)!;
      (nb.get(a) ?? nb.set(a, []).get(a)!).push(b);
      (nb.get(b) ?? nb.set(b, []).get(b)!).push(a);
    }
    const p = (s: string) => s.split(',').map(Number);
    // Walk each loop. Teeth make the offset from the neighbours' midpoint flip side from one vertex
    // to the next; a smooth curve (a narrow ankle hem) keeps it on the same side.
    const off = (v: string, a: string, b: string) => {
      const [x, pa, pb] = [p(v), p(a), p(b)];
      return [x[0] - (pa[0] + pb[0]) / 2, x[1] - (pa[1] + pb[1]) / 2, x[2] - (pa[2] + pb[2]) / 2];
    };
    const seen = new Set<string>();
    let sum = 0;
    let n = 0;
    for (const [start, l0] of nb) {
      if (seen.has(start) || l0.length !== 2) continue;
      const loop: string[] = [start];
      seen.add(start);
      let prev = start;
      let cur = l0[0];
      while (cur !== start && !seen.has(cur) && nb.get(cur)?.length === 2) {
        loop.push(cur);
        seen.add(cur);
        const nx = nb.get(cur)!.find((x) => x !== prev)!;
        prev = cur;
        cur = nx;
      }
      if (cur !== start || loop.length < 6) continue;
      // A shoe's underside is open, but the cupsole covers it: judge only edges you can see.
      if (loop.reduce((t, v) => t + p(v)[1], 0) / loop.length < 0.03) continue;
      const L = loop.length;
      const d = loop.map((v, i) => off(v, loop[(i + L - 1) % L], loop[(i + 1) % L]));
      for (let i = 0; i < L; i++) {
        const a = d[i], b = d[(i + 1) % L];
        sum += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2;
        n++;
      }
    }
    const zig = sum / Math.max(1, n);
    // A shoe's visible edge is its collar, which meets the leg at junctions (checked in renders).
    if (GARMENTS[kind].part === 'feet') continue;
    assert(n > 20, `${kind}: no open edge found`);
    assert(zig < 0.003, `${kind}: edge zig-zags ${(zig * 1000).toFixed(1)} mm on average`);
  }
});

test('trainers have a sole under the whole foot, on the foot bones', () => {
  for (const kind of ['trainers', 'runners', 'hitops'] as GarmentKind[]) {
    const g = cutGarment(body, pos, normals, kind, { main: [0.3, 0.3, 0.3] });
    const soles = (g.extra ?? []).filter((e) => e.bone.startsWith('foot'));
    assert(soles.length === 2, `${kind}: ${soles.length} soles`);
    for (const sole of soles) {
      // The outline in plan: the first two rows of the cupsole ring.
      const pts: [number, number][] = [];
      let minY = Infinity;
      for (let i = 0; i < sole.position.length / 3; i++) minY = Math.min(minY, sole.position[i * 3 + 1]);
      for (let i = 0; i < sole.position.length / 3; i++) if (sole.position[i * 3 + 1] === minY) pts.push([sole.position[i * 3], sole.position[i * 3 + 2]]);
      pts.pop(); // the fan centre
      const inside = (x: number, z: number) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, zi] = pts[i], [xj, zj] = pts[j];
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
        }
        return c;
      };
      // Every bit of that foot near the ground is over the sole: no toes or heel poking out.
      const left = sole.bone === 'foot.L';
      let out = 0;
      let total = 0;
      for (let v = 0; v < body.meta.baseCount; v++) {
        if (!drawn[v] || pos[v * 3 + 1] > 0.025 || !footBone(v)) continue;
        const x = pos[v * 3];
        if (Math.abs(x) < 0.03 || (x > 0) !== (sole.position[0] > 0)) continue;
        total++;
        if (!inside(x, pos[v * 3 + 2])) out++;
      }
      assert(total > 10, `${kind} ${left ? 'L' : 'R'}: no foot found under the sole`);
      assert(out === 0, `${kind} ${left ? 'L' : 'R'}: ${out} of ${total} foot points stick out past the sole`);
      assert(minY >= -0.004 && minY <= 0.002, `${kind}: sole bottom at ${minY}`);
    }
  }
});

test('caps have a peak and bucket hats a brim, on the head bone', () => {
  for (const kind of ['cap', 'bucket_hat'] as GarmentKind[]) {
    const g = cutGarment(body, pos, normals, kind, { main: [0.3, 0.3, 0.3] });
    const brim = (g.extra ?? []).find((e) => e.bone === 'head');
    assert(brim && brim.index.length > 20, `${kind}: no brim`);
  }
  const beanie = cutGarment(body, pos, normals, 'beanie', { main: [0.3, 0.3, 0.3] });
  assert(!(beanie.extra ?? []).length, 'a beanie has no brim');
});

test('everything Threads sells exists and can be worn', () => {
  for (const id of SHOP_STOCK) {
    const d = ITEMS[id];
    assert(d, `${id} is in stock but not an item`);
    if (id.startsWith('bag_')) continue;
    assert(d.wear, `${id} can't be worn`);
    const w = d.wear;
    if (w.top) assert((TOP_STYLES as readonly string[]).includes(w.top), `${id}: unknown top ${w.top}`);
    if (w.bottoms) assert((BOTTOM_STYLES as readonly string[]).includes(w.bottoms), `${id}: unknown bottoms ${w.bottoms}`);
    if (w.shoes) assert((SHOE_STYLES as readonly string[]).includes(w.shoes), `${id}: unknown shoes ${w.shoes}`);
    if (w.accessory) assert((ACCESSORIES as readonly string[]).includes(w.accessory), `${id}: unknown accessory ${w.accessory}`);
  }
  assert(new Set(SHOP_STOCK).size === SHOP_STOCK.length, 'an item is stocked twice');
});

test('a bought polo, chinos, trainers and bucket hat are worn and kept in the save', () => {
  const p = new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.cash.pocket = 5000;
  for (const id of ['polo_bottle', 'chinos_stone', 'trainers_navy', 'bucket_hat', 'glasses']) {
    const r = buyItem(p, id, 1);
    assert(r.ok, `couldn't buy ${id}`);
    const st = p.save.inventory.find((s) => s.id === id) ?? p.save.storage.find((s) => s.id === id);
    assert(st, `${id} not given`);
    const w = p.wear(st.uid, !p.save.inventory.includes(st));
    assert(w.ok, `couldn't wear ${id}: ${'reason' in w ? w.reason : ''}`);
  }
  const check = (a: CharacterAppearance, when: string) => {
    assert(a.top === 'polo' && a.bottoms === 'chinos' && a.shoes === 'trainers', `${when}: wearing ${a.top}/${a.bottoms}/${a.shoes}`);
    assert(a.accessories.includes('bucket_hat') && a.accessories.includes('glasses'), `${when}: accessories ${a.accessories.join(',')}`);
    // The hat keeps its own colour: glasses (face slot) don't recolour it.
    assert(a.shoesColour === '#1f2a44' && a.headColour === '#5b5a3a', `${when}: colours ${a.shoesColour} ${a.headColour}`);
  };
  check(p.appearance(), 'after buying');
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)));
  assert(back, 'save did not load');
  check(new Progress(back).appearance(), 'after save and load');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
