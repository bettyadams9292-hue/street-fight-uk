/**
 * The UAL clips (Quaternius' Universal Animation Library, CC0): every clip the game names is in
 * the JSON, decodes into a sensible body (no NaN, no T-pose, feet on the floor when standing),
 * and every activity with a clip plays it, while one without keeps its keyed pose.
 */
import { readFileSync } from 'node:fs';
import { activityPose } from '../src/render/activityPoses';
import { mocapClip, registerMocap } from '../src/render/anim/araPose';
import { MODEL_METRICS, solveBody } from '../src/render/anim/skeleton';
import { ACTIVITY_CLIPS, STATE_CLIPS, STRIKE_CLIPS, activityClipPose, lowestPoint, markUalReady, ualDuration, ualPose, ualStrikeClip } from '../src/render/anim/ual';
import { JOINTS } from '../src/render/poses';

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

const m = MODEL_METRICS;
test('nothing plays before the clips are loaded (the keyed poses carry on)', () => {
  assert(activityClipPose('arms', 1, m, activityPose('arms', 1)) === null, 'activity before load');
  assert(ualPose(STATE_CLIPS.RELAXED, 1, m) === null, 'state before load');
});

registerMocap(JSON.parse(readFileSync('public/anim/ual_mocap.json', 'utf8')));
markUalReady();

const named = new Set<string>([
  ...Object.values(ACTIVITY_CLIPS).flatMap((a) => [a.clip, ...(a.upper ? [a.upper] : [])]),
  ...Object.values(STRIKE_CLIPS),
  ...Object.values(STATE_CLIPS),
]);

test('every clip the game names is in ual_mocap.json', () => {
  for (const id of named) assert(mocapClip(id), `missing ${id}`);
});

test('every clip decodes into a finite body with the arms off the T', () => {
  for (const id of named) {
    const c = mocapClip(id)!;
    for (let k = 0; k <= 8; k++) {
      const p = ualPose(id, (c.duration * k) / 8, m)!;
      for (const j of JOINTS) for (const v of p.joints[j] ?? [0, 0, 0]) assert(Number.isFinite(v), `${id} ${j} not finite`);
      const b = solveBody(p, m);
      // A T-pose has both hands out at shoulder height, a full arm's length to the side.
      const tpose = (['l', 'r'] as const).every((s) => Math.abs(b.hand[s][0]) > m.shoulder[0] + 0.4 && Math.abs(b.hand[s][1] - b.shoulder[s][1]) < 0.08);
      assert(!tpose, `${id} at ${k}/8 is a T-pose`);
      // Limbs keep their lengths (nothing stretched or broken).
      const arm = Math.hypot(...([0, 1, 2].map((i) => b.hand.l[i] - b.elbow.l[i])) as [number, number, number]);
      assert(Math.abs(arm - m.foreArm) < 1e-3, `${id} forearm ${arm}`);
    }
  }
});

test('standing clips keep a foot on the floor and the head up', () => {
  for (const id of [STATE_CLIPS.RELAXED, 'ual_fold_arms', 'ual_talk', 'ual_phone', 'ual_cross', STATE_CLIPS.GUARD_BREAK]) {
    const p = ualPose(id, 0.4, m)!;
    const b = solveBody(p, m);
    const low = Math.min(b.ankle.l[1], b.ankle.r[1]);
    assert(Math.abs(low - m.ankleH) < 0.02, `${id} lowest ankle at ${low.toFixed(3)}`);
    assert(b.head[1] > 1.4, `${id} head at ${b.head[1].toFixed(2)}`);
  }
});

test('the fall ends lying down and the get-up ends standing', () => {
  const lying = solveBody(ualPose(STATE_CLIPS.FALL_BACK, 99, m)!, m);
  assert(lying.head[1] < 0.5, `lying head at ${lying.head[1].toFixed(2)}`);
  const up = solveBody(ualPose(STATE_CLIPS.GETUP_BACK, 99, m)!, m);
  assert(up.head[1] > 1.4, `stood-up head at ${up.head[1].toFixed(2)}`);
});

test('every activity with a clip plays it; others keep the keyed pose', () => {
  for (const act of Object.keys(ACTIVITY_CLIPS)) assert(activityClipPose(act, 1.3, m, activityPose(act, 1.3)), `${act} has no pose`);
  assert(activityClipPose('curl', 1, m, activityPose('curl', 1)) === null, 'curl should stay keyed');
});

test('sitting activities sit (hips near seat height), standing ones stand', () => {
  for (const act of ['sit_edge', 'sit_talk', 'sit_arms', 'sit_phone', 'sit_drink', 'eat']) {
    const p = activityClipPose(act, 0.7, m, activityPose(act, 0.7))!;
    const hips = m.hipsY - (p.drop ?? 0);
    assert(hips > 0.3 && hips < 0.7, `${act} hips at ${hips.toFixed(2)}`);
  }
  for (const act of ['arms', 'talk', 'lean', 'reach', 'plate', 'bag']) {
    const p = activityClipPose(act, 0.7, m, activityPose(act, 0.7))!;
    assert(m.hipsY - (p.drop ?? 0) > 0.75, `${act} not standing`);
  }
});

test('the finisher has a take, and the cross lands at its hit time', () => {
  assert(ualStrikeClip('finisher', 'rearHand') === 'ual_cross', 'finisher');
  assert(ualStrikeClip('hook', 'rearHand') === null, 'hook should stay keyed');
  const c = mocapClip('ual_cross')!;
  const b = solveBody(ualPose('ual_cross', c.hit!, m)!, m);
  const b0 = solveBody(ualPose('ual_cross', 0, m)!, m);
  assert(b.hand.r[2] - b0.hand.r[2] > 0.25, `right hand only ${(b.hand.r[2] - b0.hand.r[2]).toFixed(2)} m forward at impact`);
});

test('falls, lying and the get-up rest on the floor: never below it, and lying flat touches it', () => {
  for (const id of [STATE_CLIPS.FALL_BACK, STATE_CLIPS.GETUP_BACK, STATE_CLIPS.GUARD_BREAK, STATE_CLIPS.PARRIED]) {
    const d = ualDuration(id);
    let lo = Infinity;
    for (let k = 0; k <= 60; k++) lo = Math.min(lo, lowestPoint(ualPose(id, (d * k) / 60, m)!, m));
    assert(lo > -0.001, `${id}: lowest point ${lo.toFixed(3)} m below the floor`);
  }
  // LYING (ground_bottom) is the knockback's last frame: the back on the floor, hips low.
  const lying = ualPose(STATE_CLIPS.FALL_BACK, 99, m)!;
  const lo = lowestPoint(lying, m);
  assert(Math.abs(lo) < 0.005, `lying: lowest point at ${lo.toFixed(3)} m, should touch the floor`);
  const hips = m.hipsY - (lying.drop ?? 0);
  assert(hips > 0.05 && hips < 0.2, `lying: hips at ${hips.toFixed(3)} m`);
  // The start of the get-up lies the same way.
  assert(Math.abs(lowestPoint(ualPose(STATE_CLIPS.GETUP_BACK, 0, m)!, m)) < 0.005, 'get-up starts off the floor');
});

console.log(`ual: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
