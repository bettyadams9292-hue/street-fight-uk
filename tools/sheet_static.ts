import * as P from '../src/render/poses';
import { frameOf } from './posesheet';
const which = process.argv[2] ?? 'base';
const frames = [];
if (which === 'base') {
  for (const [n, p] of Object.entries({ GUARD: P.GUARD, BLOCK: P.BLOCK, HITSTUN: P.HITSTUN, STAGGER: P.STAGGER, GUARD_BREAK: P.GUARD_BREAK, JUMP: P.JUMP })) frames.push(frameOf(n, p as P.Pose));
  for (const [n, p] of Object.entries(P.STANCES)) frames.push(frameOf('stance ' + n, p));
} else if (which === 'moves') {
  for (const [n, p] of Object.entries(P.ANIM_POSES)) { frames.push(frameOf(n + ' chamber', p.chamber)); frames.push(frameOf(n + ' strike', p.strike)); }
} else {
  const extra = P as unknown as Record<string, P.Pose>;
  for (const n of which.split(',')) if (extra[n]) frames.push(frameOf(n, extra[n]));
}
console.log(JSON.stringify(frames));
