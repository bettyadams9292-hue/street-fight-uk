/**
 * Pose sheet of any move by id, played in a real exchange (IK aim, foot planting, the opponent
 * reacting). Prints frames for tools/posesheet.py.
 *   tsx tools/move_sheet.ts boxing_hook,muay_thai_knee [frames per move]
 */
import { readFileSync } from 'node:fs';
import { STYLES } from '../src/data/styles';
import { registerMocap } from '../src/render/anim/araPose';
import { markRokokoReady } from '../src/render/anim/rokoko';
import { bodyOf, scene } from './sheet_sim';

registerMocap(JSON.parse(readFileSync('public/anim/rokoko_mocap.json', 'utf8')));
markRokokoReady();
const ids = (process.argv[2] ?? '').split(',').filter(Boolean);
const per = Number(process.argv[3] ?? 6);
const frames: unknown[] = [];
for (const id of ids) {
  const style = Object.keys(STYLES).find((k) => STYLES[k as keyof typeof STYLES].moves[id])!;
  const d = STYLES[style as keyof typeof STYLES].moves[id];
  const s = scene(style, style, Math.max(0.75, d.reach + 0.2));
  for (let i = 0; i < 40; i++) s.step();
  s.a.startMoveById(id, s.sim.frame, s.sim.bus);
  const total = d.startup + d.active + d.recovery;
  const want = new Set(Array.from({ length: per }, (_, k) => Math.round((k * (total + 6)) / (per - 1))));
  for (let f = 0; f <= total + 6; f++) {
    const o = s.step();
    if (want.has(f)) frames.push({ name: `${id} f${f}${f === d.startup ? ' HIT' : ''}`, pitch: o.a.pitch, ...bodyOf(o.a) });
  }
}
console.log(JSON.stringify(frames));
