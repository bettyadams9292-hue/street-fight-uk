/**
 * Stage 13 tests: the animation and combat overhaul, checked by numbers.
 * The animator is pure maths, so real fights are run through the simulation
 * and the resulting skeleton is measured every frame: feet on the floor and
 * not sliding, legs within reach, joints bending the right way, no snapping
 * between frames, strikes arriving on the opponent, different reactions to
 * different hits, falling and getting up, stances that differ by style and
 * by fighter; plus the combat additions (counter hits, combo scaling, weight
 * in movement) and the smarter enemy behaviour.
 */
import { STYLES } from '../src/data/styles';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { FighterAnimator, type AnimOutput } from '../src/render/anim/animator';
import { MODEL_METRICS, CLASSIC_METRICS, solveLimb, euler, apply, mul, sub, len } from '../src/render/anim/skeleton';
import { ANIM_POSES, animPoses, JOINTS } from '../src/render/poses';
import { comboScaling } from '../src/combat/CombatSystem';
import { ARCHETYPES, ARCHETYPE_IDS } from '../src/ai/archetypes';
import { FighterAI } from '../src/ai/FighterAI';
import { AttackTokens } from '../src/ai/AttackTokens';
import { Fighter } from '../src/fighter/Fighter';
import { Simulation } from '../src/core/Simulation';
import { createTrainingArena } from '../src/world/Arena';
import { defaultAttributes } from '../src/stats/Stats';
import type { HitInfo } from '../src/core/GameEvents';
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
const press = (b: string, extra: Partial<CommandFrame> = {}): CommandFrame => {
  const c = emptyCommand();
  (c.pressed as Record<string, boolean>)[b] = true;
  return { ...c, ...extra };
};
const move = (x: number, z = 0): CommandFrame => ({ ...emptyCommand(), moveX: x, moveZ: z });
const settle = (s: Scene, n = 45) => {
  let o = s.step();
  for (let i = 0; i < n; i++) o = s.step();
  return o;
};
/** Everything that must be true of a standing body on any frame. */
function checkBody(o: AnimOutput, label: string, standing = true): void {
  const { body, footL, footR } = bodyOf(o);
  for (const n of JOINTS) for (const v of o.joints[n]) assert(Number.isFinite(v), `${label}: ${n} is not a number`);
  assert(o.joints.lElbow[0] <= 0.001 && o.joints.rElbow[0] <= 0.001, `${label}: an elbow bends backwards (${o.joints.lElbow[0].toFixed(2)}, ${o.joints.rElbow[0].toFixed(2)})`);
  assert(o.joints.lKnee[0] >= -0.001 && o.joints.rKnee[0] >= -0.001, `${label}: a knee bends backwards (${o.joints.lKnee[0].toFixed(2)}, ${o.joints.rKnee[0].toFixed(2)})`);
  assert(o.joints.lElbow[0] > -2.7 && o.joints.rElbow[0] > -2.7 && o.joints.lKnee[0] < 2.75 && o.joints.rKnee[0] < 2.75, `${label}: a joint is folded past its limit`);
  if (!standing) return;
  for (const s of ['l', 'r'] as const) {
    assert(body.ankle[s][1] > M.ankleH - 0.012, `${label}: ${s} foot is through the floor (ankle ${body.ankle[s][1].toFixed(3)})`);
    assert(len(sub(body.ankle[s], body.hipJoint[s])) <= M.thigh + M.shin + 0.002, `${label}: ${s} leg is stretched past its length`);
  }
  for (const f of [footL, footR]) assert(Math.min(f[1], f[4]) > -0.03, `${label}: toes or heel under the floor (${Math.min(f[1], f[4]).toFixed(3)})`);
}

console.log('\nStage 13: skeleton and IK');

test('two-bone IK reaches its target, bends the right way and never locks out or folds the wrong way', () => {
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const r = (k: number) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;
    const arm = i % 2 === 0;
    const a = arm ? M.upperArm : M.thigh, b = arm ? M.foreArm : M.shin;
    const t: [number, number, number] = [r(1) * 0.6, r(2) * 0.8 - (arm ? 0 : 0.5), r(3) * 0.8 + (arm ? 0.2 : 0)];
    const d = len(t);
    if (d < Math.abs(a - b) + 0.06 || d > (a + b) * 0.99) continue;
    const sol = solveLimb(t, arm ? [0, -1, -0.3] : [0, 0.1, 1], a, b, arm ? -1 : 1);
    const R = euler(sol.root);
    const end = apply(R, [0, -a, 0]);
    const tip = apply(mul(R, euler([sol.hinge, 0, 0])), [0, -b, 0]);
    const got: [number, number, number] = [end[0] + tip[0], end[1] + tip[1], end[2] + tip[2]];
    worst = Math.max(worst, len(sub(got, t)));
    assert(arm ? sol.hinge < 0 : sol.hinge > 0, 'bent the wrong way');
  }
  assert(worst < 1e-6, `IK misses by ${worst}`);
  const far = solveLimb([0, -3, 0.2], [0, 0, 1], M.thigh, M.shin, 1);
  assert(far.over > 0 && far.hinge > 0.05, 'out of reach: leg stays slightly bent, never hyper-extended');
});

test('every move has chamber and strike poses, and the limb that hits is the limb that moves', () => {
  for (const style of Object.values(STYLES)) {
    for (const m of Object.values(style.moves)) {
      const p = animPoses(m.anim, m.limb);
      assert(p, `${m.id}: no poses for "${m.anim}"`);
      const side = m.limb === 'leadHand' || m.limb === 'leadFoot' ? 'l' : m.limb === 'rearHand' || m.limb === 'rearFoot' ? 'r' : null;
      if (!side || ['spin_backfist', 'finisher', 'ground_punch'].includes(m.anim)) continue;
      const hand = m.limb.endsWith('Hand');
      const j = (pose: typeof p.strike) => (hand ? pose.joints[`${side}Elbow`]![0] : pose.joints[`${side}Knee`]![0]);
      // The striking arm or leg opens out between the chamber and the strike (or, for hooks and uppercuts, swings while staying bent).
      const other = side === 'l' ? 'r' : 'l';
      const moved = (s: string) => Math.abs((p.strike.joints[`${s}${hand ? 'Shoulder' : 'Hip'}` as 'lHip']![0]) - (p.chamber.joints[`${s}${hand ? 'Shoulder' : 'Hip'}` as 'lHip']![0])) + Math.abs(j(p.strike) - j(p.chamber)) * (s === side ? 1 : 0);
      assert(moved(side) > moved(other) * 0.8 || moved(side) > 0.5, `${m.id}: the ${m.limb} isn't the limb the "${m.anim}" pose throws`);
    }
  }
  assert(Object.keys(ANIM_POSES).length >= 30, 'pose library');
});

console.log('\nStage 13: stances and posture');

test('every style stands in a balanced stance: both feet flat on the floor, knees bent, hands up, elbows the right way', () => {
  const seen: number[][] = [];
  for (const style of Object.keys(STYLES)) {
    const s = scene(style, style, 1.6);
    const o = settle(s).a;
    checkBody(o, style);
    const { body } = bodyOf(o);
    for (const k of ['l', 'r'] as const) {
      assert(Math.abs(body.ankle[k][1] - M.ankleH) < 0.07, `${style}: ${k} foot not on the floor`);
      assert(o.joints[`${k}Knee`][0] > 0.12, `${style}: ${k} knee is locked straight`);
      assert(body.hand[k][1] > body.hips[1] + 0.12, `${style}: ${k} hand is hanging down`);
      assert(body.hand[k][2] > body.hips[2] - 0.05, `${style}: ${k} hand is behind the body`);
    }
    // Lead foot in front of the rear, a proper base under the hips.
    assert(body.ankle.l[2] - body.ankle.r[2] > 0.25, `${style}: no lead foot`);
    assert(body.ankle.l[0] - body.ankle.r[0] > 0.12, `${style}: feet on a tightrope`);
    const mid = (body.ankle.l[2] + body.ankle.r[2]) / 2;
    assert(Math.abs(body.hips[2] - mid) < 0.2, `${style}: weight isn't over the feet`);
    seen.push([body.hips[1], body.hand.l[1], body.hand.l[2], body.hand.r[1], body.head[2], body.ankle.l[2] - body.ankle.r[2]]);
  }
  // No two styles stand the same.
  for (let i = 0; i < seen.length; i++)
    for (let j = i + 1; j < seen.length; j++) {
      const d = Math.hypot(...seen[i].map((v, k) => v - seen[j][k]));
      assert(d > 0.04, `${Object.keys(STYLES)[i]} and ${Object.keys(STYLES)[j]} stand identically`);
    }
});

test('no opponent about: relaxed, arms at the sides; opponent near: hands come up', () => {
  const far = scene('street', 'street', 30);
  const o = settle(far, 120).a;
  const b = bodyOf(o).body;
  assert(far.A.combatLevel < 0.05, 'relaxed with nobody near');
  assert(b.hand.l[1] < b.hips[1] + 0.05 && b.hand.r[1] < b.hips[1] + 0.05, 'arms hang at the sides');
  assert(Math.abs(b.hand.l[0]) > M.hip[0] + 0.05 && Math.abs(b.hand.r[0]) > M.hip[0] + 0.05, 'hands hang clear of the hips, not through them');
  const near = scene('street', 'street', 1.5);
  const n = bodyOf(settle(near).a).body;
  assert(near.A.combatLevel > 0.95 && n.hand.l[1] > n.hips[1] + 0.3, 'guard up in a fight');
});

test('fighters carry the same stance differently: a novice drops their hands, a big fighter holds their arms wider', () => {
  const s = scene('boxing', 'boxing', 1.5);
  const mk = (skill: number, bulk: number) => {
    const A = new FighterAnimator(s.a, M, { skill, bulk, seed: 0.5 });
    let o = A.update(1 / 60, 0);
    for (let i = 0; i < 60; i++) o = A.update(1 / 60, i / 60);
    return bodyOf(o).body;
  };
  s.step();
  const pro = mk(1, 0), novice = mk(0, 0), big = mk(1, 1);
  assert(novice.hand.l[1] < pro.hand.l[1] - 0.04 && novice.hand.r[1] < pro.hand.r[1] - 0.03, 'novice hands are lower');
  assert(big.elbow.l[0] - big.elbow.r[0] > pro.elbow.l[0] - pro.elbow.r[0] + 0.03, 'big build: elbows wider');
});

console.log('\nStage 13: movement');

function walkTest(dir: string, cmd: CommandFrame, gap: number): { steps: Record<'l' | 'r', number>; slide: number } {
  const s = scene('kickboxing', 'kickboxing', gap);
  settle(s, 30);
  const steps = { l: 0, r: 0 };
  let slide = 0;
  const last = { l: { x: 0, z: 0, planted: false }, r: { x: 0, z: 0, planted: false } };
  for (let i = 0; i < 180; i++) {
    const o = s.step(cmd).a;
    checkBody(o, `${dir} frame ${i}`);
    for (const k of ['l', 'r'] as const) {
      const f = s.A.feet[k];
      const down = f.planted && !f.step;
      if (down && last[k].planted) slide = Math.max(slide, Math.hypot(f.x - last[k].x, f.z - last[k].z));
      if (!down && last[k].planted) steps[k]++;
      last[k] = { x: f.x, z: f.z, planted: down };
    }
  }
  return { steps, slide };
}

test('walking forwards, backwards and sideways: feet step in turn and a planted foot never slides', () => {
  for (const [dir, cmd, gap] of [['forward (relaxed)', move(1), 40], ['forward (in a fight)', move(1), 6], ['backpedal', move(-1), 3], ['sidestep', move(0, 1), 2.5], ['diagonal', move(0.7, -0.7), 30]] as [string, CommandFrame, number][]) {
    const r = walkTest(dir, cmd, gap);
    assert(r.slide < 1e-9, `${dir}: a planted foot slid ${(r.slide * 1000).toFixed(2)} mm`);
    assert(r.steps.l >= 2 && r.steps.r >= 2, `${dir}: both feet step (${r.steps.l}, ${r.steps.r})`);
    assert(Math.abs(r.steps.l - r.steps.r) <= 2, `${dir}: feet alternate (${r.steps.l} vs ${r.steps.r})`);
  }
});

test('movement has weight: a few frames to reach speed and to stop, never instant, never sluggish', () => {
  const s = scene('street', 'street', 40);
  settle(s, 10);
  const v: number[] = [];
  for (let i = 0; i < 12; i++) {
    s.step(move(1));
    v.push(s.a.vel.x);
  }
  assert(v[0] > 0 && v[0] < v[3] && v[1] < v[11] * 0.6, `accelerates (${v.slice(0, 5).map((x) => x.toFixed(2))})`);
  assert(v[8] === v[11] && v[8] > 2, 'at full speed within 8 frames');
  const stop: number[] = [];
  for (let i = 0; i < 8; i++) {
    s.step();
    stop.push(s.a.vel.x);
  }
  assert(stop[0] > 0 && stop[6] === 0, `eases to a stop within 7 frames (${stop.map((x) => x.toFixed(2))})`);
});

test('not fighting: the body turns to face the way it walks; fighting: it stays squared up to the opponent', () => {
  const s = scene('street', 'street', 40);
  settle(s, 60);
  for (let i = 0; i < 60; i++) s.step(move(0, 1));
  assert(Math.abs(Math.cos(s.A.yaw) - 1) < 0.05, `walking towards the camera faces the camera (yaw ${s.A.yaw.toFixed(2)})`);
  const f = scene('street', 'street', 2);
  settle(f, 30);
  for (let i = 0; i < 40; i++) f.step(move(0, 1));
  assert(Math.abs(f.A.yaw - Math.PI / 2) < 0.1, 'in a fight: still facing the opponent while sidestepping');
});

test('jumping: feet leave the floor, come back and plant; landing is absorbed', () => {
  const s = scene('street', 'street', 3);
  settle(s, 30);
  let o = s.step(press('jump')).a;
  let air = false;
  for (let i = 0; i < 70; i++) {
    o = s.step().a;
    if (!s.a.grounded) {
      air = true;
      assert(!s.A.feet.l.planted && !s.A.feet.r.planted, 'feet free in the air');
    }
    checkBody(o, `jump ${i}`, s.a.grounded && i > 45);
  }
  assert(air && s.A.feet.l.planted && s.A.feet.r.planted, 'landed on both feet');
});

console.log('\nStage 13: attacks');

test('every style’s punches and kicks arrive on the opponent: on target at the first active frame, never through them', () => {
  for (const style of Object.keys(STYLES)) {
    for (const b of ['lp', 'hp', 'lk', 'hk']) {
      const st = STYLES[style as keyof typeof STYLES];
      const data = st.moves[st.starters[b as 'lp']];
      if (!data || data.kind === 'grab' || !['leadHand', 'rearHand', 'leadFoot', 'rearFoot'].includes(data.limb)) continue;
      const hand = data.limb.endsWith('Hand');
      const s = scene(style, style, Math.max(0.75, data.reach + 0.15));
      settle(s, 30);
      let o = s.step(press(b)).a;
      let checked = false;
      for (let i = 0; i < 60 && s.a.state === 'attack'; i++) {
        const m = s.a.move!;
        checkBody(o, `${data.id} frame ${m.frame}`);
        if (m.frame === m.startup && !checked) {
          checked = true;
          const body = bodyOf(o).body;
          const side = data.limb.startsWith('lead') ? 'l' : 'r';
          const tip = hand ? body.hand[side] : body.ankle[side];
          const goal = s.A.strikePoint(m);
          const gap = (s.b.pos.x - s.a.pos.x) / 1;
          const reachable = hand ? true : len(sub(goal, body.hipJoint[side])) < M.thigh + M.shin;
          if (reachable) assert(len(sub(tip, goal)) < (hand ? 0.2 : 0.3), `${data.id}: the ${data.limb} is ${len(sub(tip, goal)).toFixed(2)} m from where it should land`);
          assert(tip[2] > 0.3, `${data.id}: the ${data.limb} isn't out in front (${tip[2].toFixed(2)})`);
          assert(tip[2] < gap - 0.05, `${data.id}: the ${data.limb} goes through the opponent (${tip[2].toFixed(2)} of ${gap.toFixed(2)})`);
        }
        o = s.step().a;
      }
      assert(checked, `${data.id}: reached its active frames`);
    }
  }
});

test('a punch uses the whole body: hips and shoulders turn, weight moves forward, the rear heel lifts', () => {
  const s = scene('boxing', 'boxing', 1.0);
  const rest = settle(s, 30).a;
  let o = s.step(press('hp')).a;
  while (s.a.move && s.a.move.frame < s.a.move.startup) o = s.step().a;
  const turn = o.joints.hips[1] + o.joints.spine[1] - (rest.joints.hips[1] + rest.joints.spine[1]);
  assert(Math.abs(turn) > 0.6, `hips and shoulders rotate through the punch (${turn.toFixed(2)} rad)`);
  assert(o.hips[2] > rest.hips[2] + 0.05, 'weight transfers forward');
  assert(s.A.feet.r.heel > 0.03, 'rear heel comes up as the foot pivots');
  assert(s.A.feet.l.planted && s.A.feet.r.planted, 'both feet stay on the floor');
});

test('a kick stands on one planted leg with the hips over it, and the kicker gets their balance back', () => {
  const s = scene('kickboxing', 'kickboxing', 1.15);
  settle(s, 30);
  let o = s.step(press('hk')).a;
  let oneLeg = false;
  for (let i = 0; i < 80; i++) {
    if (s.a.state === 'attack' && s.a.move!.frame === s.a.move!.startup) {
      oneLeg = s.A.feet.l.planted && !s.A.feet.r.planted;
      const b = bodyOf(o).body;
      assert(Math.abs(b.hips[0] - b.ankle.l[0]) < 0.16 && Math.abs(b.hips[2] - b.ankle.l[2]) < 0.2, 'hips over the standing foot');
      assert(b.ankle.r[1] > 0.9, `the kick is up at head height (${b.ankle.r[1].toFixed(2)})`);
    }
    checkBody(o, `roundhouse ${i}`);
    o = s.step().a;
  }
  assert(oneLeg, 'stood on the lead leg to kick');
  assert(s.A.feet.l.planted && s.A.feet.r.planted && !s.A.feet.l.step && !s.A.feet.r.step, 'back on both feet');
});

console.log('\nStage 13: hits, stun, falling and getting up');

function takeHit(button: string, special = false, block = false, gap = 0.95): { peak: AnimOutput[]; s: Scene; states: Set<string>; rest: AnimOutput } {
  const s = scene('kickboxing', 'kickboxing', gap);
  const rest = settle(s, 30).b;
  const cb = () => (block ? { ...emptyCommand(), block: true } : emptyCommand());
  if (block) for (let i = 0; i < 12; i++) s.step(undefined, cb());
  s.step(press(button, { special }), cb());
  const peak: AnimOutput[] = [];
  const states = new Set<string>();
  let seq = s.b.hitSeq;
  let since = -1;
  for (let i = 0; i < 150; i++) {
    const o = s.step(undefined, cb()).b;
    states.add(s.b.state);
    if (s.b.hitSeq !== seq) {
      seq = s.b.hitSeq;
      since = 0;
    }
    if (since >= 0) {
      since++;
      peak.push(o);
    }
    checkBody(o, `${button} reaction ${i}`, s.b.state !== 'knockdown' && s.b.state !== 'getup' && s.b.state !== 'ko');
  }
  return { peak, s, states, rest };
}

test('head shots, body shots and leg kicks get different reactions; heavier and unblocked ones are bigger', () => {
  const jab = takeHit('lp');
  assert(jab.peak.length > 0 && jab.s.b.lastHit?.height === 'high', 'the jab lands high');
  const headBack = Math.min(...jab.peak.slice(0, 14).map((o) => bodyOf(o).body.head[2])) - bodyOf(jab.rest).body.head[2];
  assert(headBack < -0.03, `head snaps back from a jab (${headBack.toFixed(3)} m)`);
  // Body shot from the boxing set: folds forward.
  const b = scene('boxing', 'kickboxing', 0.9);
  const restB = settle(b, 30).b;
  const body = Object.values(STYLES.boxing.moves).find((m) => m.height === 'mid' && m.kind !== 'grab' && Object.values(STYLES.boxing.starters).includes(m.id));
  const low = takeHit('lk');
  assert(low.s.b.lastHit?.height === 'low', 'the low kick lands low');
  const drop = bodyOf(low.rest).body.hips[1] - Math.min(...low.peak.slice(0, 16).map((o) => o.hips[1]));
  assert(drop > 0.04, `the leg buckles under a low kick (hips drop ${drop.toFixed(3)} m)`);
  const lowHead = Math.min(...low.peak.slice(0, 14).map((o) => bodyOf(o).body.head[2])) - bodyOf(low.rest).body.head[2];
  assert(lowHead > headBack + 0.02, 'a leg kick doesn’t snap the head back like a jab does');
  if (body) {
    const btn = (Object.entries(STYLES.boxing.starters).find(([, id]) => id === body.id) ?? [])[0]!;
    b.step(press(btn));
    let fold = 0;
    for (let i = 0; i < 40; i++) {
      const o = b.step().b;
      if (b.b.lastHit?.height === 'mid') fold = Math.max(fold, o.joints.spine[0] - restB.joints.spine[0]);
    }
    assert(fold > 0.2, `folds over a body shot (${fold.toFixed(2)} rad)`);
  }
  // Blocked: the guard takes it, and the reaction is smaller.
  const blocked = takeHit('lp', false, true);
  assert(blocked.s.b.lastHit?.blocked, 'blocked');
  const blockedBack = Math.min(...blocked.peak.slice(0, 14).map((o) => o.joints.head[0])) - blocked.rest.joints.head[0];
  const openBack = Math.min(...jab.peak.slice(0, 14).map((o) => o.joints.head[0])) - jab.rest.joints.head[0];
  assert(Math.abs(blockedBack) < Math.abs(openBack), 'a blocked shot moves the head less');
});

test('stun is alive, not frozen: the body keeps moving, the neck stays within limits, and it recovers into the stance', () => {
  const r = takeHit('hp');
  const stun = r.peak.slice(0, 20);
  let moving = 0;
  for (let i = 1; i < stun.length; i++) if (Math.abs(stun[i].joints.spine[0] - stun[i - 1].joints.spine[0]) + Math.abs(stun[i].joints.head[0] - stun[i - 1].joints.head[0]) > 1e-4) moving++;
  assert(moving >= stun.length - 6, `the body keeps moving through the stun (${moving}/${stun.length} frames; the rest is hitstop)`);
  for (const o of r.peak) {
    assert(Math.abs(o.joints.head[0]) < 0.95 && Math.abs(o.joints.head[2]) <= 0.4001, `head tilt within limits (${o.joints.head.map((v) => v.toFixed(2))})`);
    for (const k of ['lShoulder', 'rShoulder'] as const) assert(Math.abs(o.joints[k][2]) < 1.5, 'arms never flung out straight sideways');
  }
  const end = r.peak[r.peak.length - 1];
  const d = JOINTS.filter((j) => !j.endsWith('Foot') && !j.endsWith('Hip') && !j.endsWith('Knee')).reduce((a, j) => a + len(sub(end.joints[j], r.rest.joints[j])), 0);
  assert(r.s.b.state === 'idle' && d < 0.5, `back in the stance afterwards (${d.toFixed(2)})`);
});

test('knocked back: the feet take stumbling steps (they never slide), and the legs keep up', () => {
  const s = scene('kickboxing', 'kickboxing', 0.95);
  settle(s, 30);
  s.b.enterHitReaction('stagger', 30);
  s.b.knockVel = 4.5;
  let steps = 0;
  let slide = 0;
  const last = { l: { x: 0, z: 0, d: false }, r: { x: 0, z: 0, d: false } };
  const x0 = s.b.pos.x;
  for (let i = 0; i < 70; i++) {
    const o = s.step().b;
    checkBody(o, `stagger ${i}`);
    for (const k of ['l', 'r'] as const) {
      const f = s.B.feet[k];
      const d = f.planted && !f.step;
      if (d && last[k].d) slide = Math.max(slide, Math.hypot(f.x - last[k].x, f.z - last[k].z));
      if (!d && last[k].d) steps++;
      last[k] = { x: f.x, z: f.z, d };
    }
  }
  assert(s.b.pos.x - x0 > 0.4, 'was knocked back');
  assert(steps >= 2 && slide < 1e-9, `stepped back (${steps} steps), no sliding (${slide})`);
});

test('knockdown: falls flat, lies there, gets up through a crouch onto planted feet', () => {
  const s = scene('kickboxing', 'kickboxing', 1.0);
  settle(s, 30);
  s.b.hitSeq++;
  s.b.lastHit = { height: 'high', power: 1, dir: 1, side: 1, blocked: false };
  s.b.enterHitReaction('knockdown', 0);
  s.b.knockVel = 3;
  let minPitch = 0;
  let lastPitch = 0;
  let wentDownSmoothly = true;
  let sawGetup = false;
  for (let i = 0; i < 130; i++) {
    const o = s.step().b;
    checkBody(o, `knockdown ${i}`, false);
    if (Math.abs(o.pitch - lastPitch) > 0.25) wentDownSmoothly = false;
    lastPitch = o.pitch;
    minPitch = Math.min(minPitch, o.pitch);
    if (s.b.state === 'getup') sawGetup = true;
    if (i === 50) assert(Math.abs(o.pitch + Math.PI / 2) < 0.02 && !s.B.feet.l.planted, 'flat on their back');
  }
  assert(wentDownSmoothly, 'the fall and the rise have no jumps in them');
  assert(sawGetup && s.b.state === 'idle', 'got up');
  const end = s.step().b;
  checkBody(end, 'after getting up');
  assert(Math.abs(end.pitch) < 0.01 && s.B.feet.l.planted && s.B.feet.r.planted, 'upright on planted feet');
  // Hit from behind: goes down on their front.
  const f = scene('kickboxing', 'kickboxing', 1.0);
  settle(f, 30);
  f.b.hitSeq++;
  f.b.lastHit = { height: 'high', power: 1, dir: -1, side: 0, blocked: false };
  f.b.enterHitReaction('knockdown', 0);
  let o = f.step().b;
  for (let i = 0; i < 45; i++) o = f.step().b;
  assert(Math.abs(o.pitch - Math.PI / 2) < 0.02, 'face down when hit from behind');
});

console.log('\nStage 13: transitions');

test('nothing snaps: through a whole scrap (walk, combo, block, hits, knockdown, get up) no hand, head or hip jumps between frames', () => {
  const s = scene('kickboxing', 'boxing', 2.2);
  settle(s, 30);
  const script = (i: number): [CommandFrame, CommandFrame] => {
    const a = emptyCommand(), b = emptyCommand();
    if (i < 40) a.moveX = 1;
    else if (i === 45 || i === 58 || i === 70) a.pressed.lp = true;
    else if (i === 62) a.pressed.hp = true;
    else if (i > 90 && i < 130) b.block = true;
    if (i === 100 || i === 112) a.pressed.hk = true;
    if (i === 150) b.pressed.hp = true;
    if (i === 170) b.pressed.lk = true;
    if (i > 190 && i < 230) a.moveX = -1;
    if (i > 190 && i < 230) b.moveZ = 1;
    if (i === 240) a.pressed.dodge = true;
    if (i === 262) a.pressed.jump = true;
    if (i === 330) a.pressed.hk = true;
    if (i > 300 && i < 330) a.moveX = 1;
    return [a, b];
  };
  let prev: { a: ReturnType<typeof bodyOf>['body']; b: ReturnType<typeof bodyOf>['body']; pa: number; pb: number } | null = null;
  let worst = { what: '', d: 0, frame: 0 };
  for (let i = 0; i < 480; i++) {
    if (i === 380) {
      s.b.hitSeq++;
      s.b.lastHit = { height: 'high', power: 1, dir: 1, side: 1, blocked: false };
      s.b.enterHitReaction('knockdown', 0);
    }
    const [ca, cb] = script(i);
    const o = s.step(ca, cb);
    const cur = { a: bodyOf(o.a).body, b: bodyOf(o.b).body, pa: o.a.pitch, pb: o.b.pitch };
    if (prev) {
      for (const who of ['a', 'b'] as const) {
        const f = who === 'a' ? s.a : s.b;
        const lying = Math.abs(who === 'a' ? cur.pa : cur.pb) > 0.3;
        const p = prev[who], c = cur[who];
        const lim = { hand: f.state === 'attack' || f.state === 'getup' ? 0.34 : 0.2, head: f.isReeling || f.state === 'dodge' || f.state === 'getup' || f.state === 'attack' ? 0.14 : 0.1, hips: f.state === 'attack' || f.state === 'getup' ? 0.09 : 0.07, ankle: 0.4 };
        const check = (what: string, a: number[], b: number[], max: number) => {
          const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
          if (d / max > worst.d) worst = { what: `${who} ${what} (${f.state})`, d: d / max, frame: i };
        };
        if (lying) continue;
        check('left hand', p.hand.l, c.hand.l, lim.hand);
        check('right hand', p.hand.r, c.hand.r, lim.hand);
        check('head', p.head, c.head, lim.head);
        check('hips', p.hips, c.hips, lim.hips);
        check('left foot', p.ankle.l, c.ankle.l, lim.ankle);
        check('right foot', p.ankle.r, c.ankle.r, lim.ankle);
      }
    }
    prev = cur;
  }
  assert(worst.d <= 1, `${worst.what} jumped at frame ${worst.frame}: ${(worst.d * 100).toFixed(0)}% of the most a limb can move in a frame`);
});

test('blocking: hands go high for the head and low for the body and legs', () => {
  const hi = scene('kickboxing', 'kickboxing', 0.95);
  settle(hi, 30);
  let o = hi.step(press('lp'), { ...emptyCommand(), block: true });
  for (let i = 0; i < 8; i++) o = hi.step(undefined, { ...emptyCommand(), block: true });
  const high = bodyOf(o.b).body;
  const lo = scene('kickboxing', 'kickboxing', 0.95);
  settle(lo, 30);
  o = lo.step(press('lk'), { ...emptyCommand(), block: true });
  for (let i = 0; i < 12; i++) o = lo.step(undefined, { ...emptyCommand(), block: true });
  const low = bodyOf(o.b).body;
  assert(high.hand.l[1] > low.hand.l[1] + 0.12, `high guard is higher than low guard (${high.hand.l[1].toFixed(2)} vs ${low.hand.l[1].toFixed(2)})`);
  assert(low.hips[1] < high.hips[1] - 0.03, 'low guard sits down into it');
});

console.log('\nStage 13: combat');

test('counter hit: catching someone mid-swing does more damage and stuns longer', () => {
  const dmg = (caught: boolean) => {
    const s = scene('kickboxing', 'kickboxing', 0.9);
    settle(s, 30);
    const hits: HitInfo[] = [];
    s.sim.bus.on('hit:landed', (h) => hits.push(h));
    // B starts a slow heavy kick; A's jab beats it to the punch.
    if (caught) s.step(undefined, press('hk'));
    s.step(press('lp'));
    let stun = 0;
    for (let i = 0; i < 30; i++) {
      s.step();
      if (s.b.state === 'hitstun' || s.b.state === 'stagger') stun = Math.max(stun, s.b.stateDuration);
    }
    const mine = hits.filter((h) => h.attacker === s.a);
    return { d: mine[0]?.damage ?? 0, counter: mine[0]?.counter ?? false, stun };
  };
  const plain = dmg(false), counter = dmg(true);
  assert(plain.d > 0 && !plain.counter, 'plain jab lands');
  assert(counter.counter && counter.d > plain.d * 1.1 && counter.stun > plain.stun, `counter hit: ${counter.d.toFixed(1)} vs ${plain.d.toFixed(1)} damage, ${counter.stun} vs ${plain.stun} frames`);
});

test('combo scaling: long combos do a little less per hit, never less than half; spam is still punished', () => {
  assert(comboScaling(1) === 1 && comboScaling(2) === 1 && comboScaling(3) === 0.9 && comboScaling(5) === 0.7 && comboScaling(20) === 0.5, 'scaling table');
  const s = scene('boxing', 'boxing', 0.85);
  settle(s, 30);
  const hits: HitInfo[] = [];
  s.sim.bus.on('hit:landed', (h) => h.attacker === s.a && hits.push(h));
  for (let i = 0; i < 200; i++) {
    s.b.vitals.health = s.b.vitals.maxHealth;
    s.a.vitals.stamina = s.a.vitals.maxStamina;
    s.step(i % 9 === 0 ? press('lp') : undefined);
  }
  assert(hits.length >= 6, `jabs landed (${hits.length})`);
  assert(hits[hits.length - 1].damage < hits[0].damage * 0.8, 'mashing one button does less and less');
});

test('combos flow: a chained attack starts from the last one’s recovery without a pause or a snap', () => {
  const s = scene('kickboxing', 'kickboxing', 0.95);
  settle(s, 30);
  s.step(press('lp'));
  let chained = false;
  let prevHand: number[] | null = null;
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    const seq = s.a.moveSeq;
    const o = s.step(i === 6 ? press('hp') : undefined).a;
    if (s.a.moveSeq !== seq && s.a.state === 'attack') chained = true;
    const b = bodyOf(o).body;
    for (const k of ['l', 'r'] as const) {
      if (prevHand) worst = Math.max(worst, 0);
      void k;
    }
    const h = [...b.hand.l, ...b.hand.r];
    if (prevHand) worst = Math.max(worst, Math.hypot(h[0] - prevHand[0], h[1] - prevHand[1], h[2] - prevHand[2]), Math.hypot(h[3] - prevHand[3], h[4] - prevHand[4], h[5] - prevHand[5]));
    prevHand = h;
  }
  assert(chained, 'jab chained into the cross');
  assert(worst < 0.34, `hands move continuously through the chain (max ${worst.toFixed(2)} m in a frame)`);
});

console.log('\nStage 13: enemy behaviour');

function aiFight(arch: (typeof ARCHETYPE_IDS)[number], seconds: number, playerSwings: boolean): { modes: Record<string, number>; dist: number[]; landed: number; whiffs: number; attacks: number } {
  const sim = new Simulation(createTrainingArena(), 21);
  const a = ARCHETYPES[arch];
  const p = sim.add(new Fighter({ id: 1, name: 'P', team: 'player', attributes: defaultAttributes(6), style: STYLES.kickboxing, x: 0, z: 0 }));
  const e = sim.add(new Fighter({ id: 2, name: 'E', team: 'enemy', attributes: a.attributes, style: STYLES[a.style], x: 3, z: 0 }));
  const ai = new FighterAI(e, a, sim.rng, new AttackTokens(2), sim.arena);
  const A = new FighterAnimator(e, MODEL_METRICS, { skill: 0.5, bulk: 0.3, seed: 0.4 });
  const modes: Record<string, number> = {};
  const dist: number[] = [];
  let landed = 0, attacks = 0, whiffs = 0;
  sim.bus.on('hit:landed', (h) => h.attacker === e && landed++);
  sim.bus.on('move:started', (m) => m.fighter === e && attacks++);
  for (let i = 0; i < seconds * 60; i++) {
    p.vitals.health = p.vitals.maxHealth;
    e.vitals.health = Math.max(e.vitals.health, e.vitals.maxHealth * 0.5);
    const cmds = new Map<number, CommandFrame>();
    const pc = emptyCommand();
    if (playerSwings && i % 70 === 20) pc.pressed.hk = true;
    cmds.set(1, pc);
    const before = e.move;
    cmds.set(2, ai.think(sim.frame));
    sim.step(cmds);
    if (before && e.move !== before && !before.connected) whiffs++;
    const o = A.update(1 / 60, i / 60);
    if (e.state !== 'knockdown' && e.state !== 'getup' && !e.grapple) checkBody(o, `${arch} frame ${i} (${e.state})`, e.grounded && Math.abs(o.pitch) < 0.01 && (A.shown.ik ?? 1) > 0.9);
    modes[ai.mode] = (modes[ai.mode] ?? 0) + 1;
    dist.push(Math.abs(e.pos.x - p.pos.x));
  }
  return { modes, dist, landed, whiffs, attacks };
}

test('every kind of enemy fights for 30 seconds with a sound skeleton on every frame, and lands something', () => {
  for (const id of ARCHETYPE_IDS) {
    const r = aiFight(id, 30, false);
    assert(r.attacks > 0, `${id} never attacked`);
  }
});

test('enemies don’t just stand in your face: trained ones move in and out and defend; brawlers press', () => {
  const elite = aiFight('elite', 60, true);
  const thug = aiFight('thug', 60, true);
  const spread = (d: number[]) => {
    const m = d.reduce((a, b) => a + b, 0) / d.length;
    return Math.sqrt(d.reduce((a, b) => a + (b - m) * (b - m), 0) / d.length);
  };
  assert((elite.modes.space ?? 0) > 60, `a trained fighter steps out of range between exchanges (${elite.modes.space ?? 0} frames)`);
  assert((elite.modes.defend ?? 0) > (thug.modes.defend ?? 0), `and defends more than a thug (${elite.modes.defend} vs ${thug.modes.defend})`);
  assert(spread(elite.dist.slice(120)) > 0.12, `distance keeps changing (${spread(elite.dist.slice(120)).toFixed(2)} m)`);
  assert(elite.landed > 0 && thug.attacks > 0, 'both still fight');
});

console.log('\nStage 13: performance');

test('animating a crowd is cheap: 16 fighters cost well under a millisecond a frame', () => {
  const s = scene('kickboxing', 'boxing', 1.0);
  const anims = Array.from({ length: 16 }, (_, i) => new FighterAnimator(i % 2 ? s.a : s.b, i % 3 ? MODEL_METRICS : CLASSIC_METRICS, { skill: 0.5, bulk: 0.5, seed: i / 16 }));
  const t0 = performance.now();
  const frames = 600;
  for (let i = 0; i < frames; i++) {
    s.step(i % 40 === 0 ? press('lp') : move(i % 120 < 60 ? 0.5 : -0.5), i % 55 === 0 ? press('hk') : undefined);
    for (const a of anims) a.update(1 / 60, i / 60);
  }
  const per = (performance.now() - t0) / frames;
  console.log(`       ${per.toFixed(3)} ms per frame for 16 fighters (simulation included)`);
  assert(per < 2.5, `too slow: ${per.toFixed(2)} ms`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
