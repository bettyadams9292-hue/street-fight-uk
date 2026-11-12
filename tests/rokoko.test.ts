/**
 * The Rokoko motion capture: the clips decode into sensible bodies, every
 * fighter leads with the left, strikes reach out at their impact time and
 * still land on the opponent at the move's first active frame, and falls end
 * on the floor.
 */
import { readFileSync } from 'node:fs';
import { STYLES } from '../src/data/styles';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import type { AnimOutput } from '../src/render/anim/animator';
import { araMocapPose, mocapClip, registerMocap } from '../src/render/anim/araPose';
import { GUARD_CLIPS, REACTIONS, STRIKE_CLIPS, markRokokoReady, strikeClip, strikeTime } from '../src/render/anim/rokoko';
import { MODEL_METRICS, len, solveBody, sub } from '../src/render/anim/skeleton';
import { JOINTS } from '../src/render/poses';
import { bodyOf, scene, type Scene } from '../tools/sheet_sim';

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

const M = MODEL_METRICS;
const data = JSON.parse(readFileSync('public/anim/rokoko_mocap.json', 'utf8')) as Record<string, { duration: number; hit?: number; loop: boolean }>;
registerMocap(data as never);
markRokokoReady();
const body = (id: string, t: number) => solveBody(araMocapPose(id, t, M)!, M);
const press = (b: string): CommandFrame => {
  const c = emptyCommand();
  (c.pressed as Record<string, boolean>)[b] = true;
  return c;
};
const settle = (s: Scene, n = 45) => {
  let o = s.step();
  for (let i = 0; i < n; i++) o = s.step();
  return o;
};

console.log('Rokoko motion capture');

test('every clip the game asks for is in the file, and every frame of every clip is a whole, upright-sized body', () => {
  const wanted = new Set([...Object.values(STRIKE_CLIPS).flat(), ...GUARD_CLIPS, ...Object.values(REACTIONS).flat()]);
  for (const id of wanted) assert(mocapClip(id), `${id} is missing`);
  for (const id of Object.keys(data)) {
    const c = mocapClip(id)!;
    for (let i = 0; i <= 12; i++) {
      const t = (c.duration * i) / 12;
      const p = araMocapPose(id, t, M)!;
      for (const j of JOINTS) for (const v of p.joints[j] ?? [0, 0, 0]) assert(Number.isFinite(v), `${id} at ${t.toFixed(2)} s: ${j} is not a number`);
      const b = solveBody(p, M);
      const tall = b.head[1] - Math.min(b.ankle.l[1], b.ankle.r[1]);
      assert(tall < 1.9, `${id} at ${t.toFixed(2)} s: ${tall.toFixed(2)} m from feet to head`);
    }
  }
});

test('guards are orthodox, hands up, and loop without a jump', () => {
  for (const id of GUARD_CLIPS) {
    const c = mocapClip(id)!;
    let lead = 0;
    for (let i = 0; i < 10; i++) {
      const b = body(id, (c.duration * i) / 10);
      lead += b.ankle.l[2] - b.ankle.r[2] > 0 ? 1 : 0;
      assert(b.hand.l[1] > b.hips[1] + 0.25 && b.hand.r[1] > b.hips[1] + 0.25, `${id}: hands down at frame ${i}`);
      assert(b.hand.l[2] > b.chest[2] && b.hand.r[2] > b.chest[2] - 0.05, `${id}: hands not in front at frame ${i}`);
    }
    assert(lead >= 9, `${id}: the left foot leads in only ${lead} of 10 frames`);
    const a = araMocapPose(id, 0, M)!;
    const z = araMocapPose(id, c.duration - 1e-4, M)!;
    let worst = 0;
    for (const j of JOINTS) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs((a.joints[j]![k] ?? 0) - (z.joints[j]![k] ?? 0)));
    assert(worst < 0.3, `${id}: the loop jumps ${worst.toFixed(2)} rad where it joins`);
  }
});

test('each strike reaches out with the right limb at its impact time', () => {
  for (const [key, ids] of Object.entries(STRIKE_CLIPS)) {
    const limb = key.split(':')[1];
    const side = limb.startsWith('lead') ? 'l' : 'r';
    const hand = limb.endsWith('Hand');
    for (const id of ids) {
      const c = mocapClip(id)!;
      assert(c.hit !== null && c.hit > 0.1 && c.hit < c.duration - 0.15, `${id}: impact at ${c.hit}`);
      const at = body(id, c.hit!);
      const start = body(id, 0);
      if (hand) {
        const reach = at.hand[side][2] - at.chest[2];
        assert(reach > 0.35, `${id} (${key}): the ${side} hand is only ${reach.toFixed(2)} m in front at impact`);
        assert(reach > start.hand[side][2] - start.chest[2] + 0.12, `${id} (${key}): the ${side} hand barely moves out`);
        const other = side === 'l' ? 'r' : 'l';
        assert(at.hand[side][2] > at.hand[other][2], `${id} (${key}): the wrong hand is the one out in front`);
      } else {
        const up = at.ankle[side][1] - at.ankle[side === 'l' ? 'r' : 'l'][1];
        assert(up > 0.45, `${id} (${key}): the ${side} foot is only ${up.toFixed(2)} m up at impact`);
      }
    }
  }
});

test('falls end on the floor and the get-up ends standing', () => {
  for (const id of [REACTIONS.knockdown, ...REACTIONS.ko]) {
    const c = mocapClip(id)!;
    const b = body(id, c.duration);
    assert(b.head[1] < 0.55, `${id}: the head ends ${b.head[1].toFixed(2)} m up`);
  }
  const g = mocapClip(REACTIONS.getup)!;
  assert(body(REACTIONS.getup, 0).head[1] < 1.25, 'the get-up starts low');
  assert(body(REACTIONS.getup, g.duration).head[1] > 1.45, 'the get-up ends standing');
});

test('a strike clip is stretched to the move: impact on the first active frame, the end on the last recovery frame, never backwards', () => {
  for (const [startup, active, recovery] of [[5, 2, 10], [9, 3, 16], [14, 4, 22], [3, 1, 6]]) {
    for (const id of ['rk_jab', 'rk_cross', 'rk_front_kick']) {
      const c = mocapClip(id)!;
      let last = -1;
      for (let fr = 0; fr < startup + active + recovery + 3; fr++) {
        const t = strikeTime(id, fr, startup, active, recovery);
        assert(t >= last - 1e-9 && t >= 0 && t <= c.duration + 1e-9, `${id} ${startup}/${active}/${recovery}: time ${t} at frame ${fr}`);
        last = t;
      }
      assert(Math.abs(strikeTime(id, startup, startup, active, recovery) - c.hit!) < 1e-9, `${id}: not at impact on the first active frame`);
      assert(Math.abs(strikeTime(id, startup + active + recovery, startup, active, recovery) - c.duration) < 1e-9, `${id}: not finished at the end`);
      // A quick move doesn't race through the whole wind-up: it starts part-way in.
      assert(c.hit! - strikeTime(id, 0, startup, active, recovery) <= Math.max((startup / 60) * 1.6, 0.08) + 1e-9, `${id}: wind-up too long for ${startup} frames`);
    }
  }
  assert(strikeClip('jab', 'leadHand', 0) === 'rk_jab' && strikeClip('jab', 'leadHand', 1) === 'rk_jab_b', 'jabs take turns');
  assert(strikeClip('jab', 'rearHand', 0) === null && strikeClip('roundhouse', 'rearFoot', 0) === null, 'a strike with the other limb has no take');
});

console.log('In the game');

test('a striker stands in the captured guard: hands up, left hand and left foot forward', () => {
  for (const style of ['boxing', 'kickboxing', 'street']) {
    const s = scene(style, style, 1.5);
    const b = bodyOf(settle(s, 90).a).body;
    assert(s.A.combatLevel > 0.95, `${style}: not in a fight stance`);
    assert(b.hand.l[1] > b.hips[1] + 0.3 && b.hand.r[1] > b.hips[1] + 0.3, `${style}: guard down`);
    assert(b.hand.l[2] > b.hand.r[2] - 0.02, `${style}: the lead hand is behind the rear hand`);
    assert(b.ankle.l[2] > b.ankle.r[2], `${style}: the left foot isn't the lead foot`);
  }
});

function checkFrame(o: AnimOutput, label: string): void {
  const { body: b } = bodyOf(o);
  for (const n of JOINTS) for (const v of o.joints[n]) assert(Number.isFinite(v), `${label}: ${n} is not a number`);
  assert(o.joints.lElbow[0] <= 0.001 && o.joints.rElbow[0] <= 0.001, `${label}: an elbow bends backwards`);
  assert(o.joints.lKnee[0] >= -0.001 && o.joints.rKnee[0] >= -0.001, `${label}: a knee bends backwards`);
  for (const s of ['l', 'r'] as const) {
    assert(b.ankle[s][1] > M.ankleH - 0.012, `${label}: ${s} foot is through the floor`);
    assert(len(sub(b.ankle[s], b.hipJoint[s])) <= M.thigh + M.shin + 0.002, `${label}: ${s} leg is stretched past its length`);
  }
}

test('captured punches and kicks still land on the opponent at the first active frame, and never go through them', () => {
  let tried = 0;
  for (const style of Object.keys(STYLES)) {
    for (const b of ['lp', 'hp', 'lk', 'hk']) {
      const st = STYLES[style as keyof typeof STYLES];
      const d = st.moves[st.starters[b as 'lp']];
      if (!d || !STRIKE_CLIPS[`${d.anim}:${d.limb}`]) continue;
      tried++;
      const hand = d.limb.endsWith('Hand');
      const s = scene(style, style, Math.max(0.75, d.reach + 0.15));
      settle(s, 30);
      let o = s.step(press(b)).a;
      let checked = false;
      for (let i = 0; i < 70 && s.a.state === 'attack'; i++) {
        const m = s.a.move!;
        checkFrame(o, `${style} ${d.id} frame ${m.frame}`);
        if (m.frame === m.startup && !checked) {
          checked = true;
          const bd = bodyOf(o).body;
          const side = d.limb.startsWith('lead') ? 'l' : 'r';
          const tip = hand ? bd.hand[side] : bd.ankle[side];
          const goal = s.A.strikePoint(m);
          const gap = s.b.pos.x - s.a.pos.x;
          const reachable = hand ? true : len(sub(goal, bd.hipJoint[side])) < M.thigh + M.shin;
          if (reachable) assert(len(sub(tip, goal)) < (hand ? 0.2 : 0.3), `${style} ${d.id}: the ${d.limb} is ${len(sub(tip, goal)).toFixed(2)} m from where it should land`);
          assert(tip[2] > 0.3, `${style} ${d.id}: the ${d.limb} isn't out in front (${tip[2].toFixed(2)})`);
          assert(tip[2] < gap - 0.05, `${style} ${d.id}: the ${d.limb} goes through the opponent`);
        }
        o = s.step().a;
      }
      assert(checked, `${style} ${d.id}: never reached its active frames`);
    }
  }
  assert(tried >= 5, `only ${tried} captured strikes are starters`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
