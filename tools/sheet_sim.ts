/**
 * Dev tool: runs real fights through the simulation and the animator and dumps frames
 * for tools/posesheet.py. Usage: tsx tools/sheet_sim.ts <scenario> > /tmp/p.json
 */
import { Simulation } from '../src/core/Simulation';
import { STYLES } from '../src/data/styles';
import { Fighter } from '../src/fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { defaultAttributes } from '../src/stats/Stats';
import { createTrainingArena } from '../src/world/Arena';
import { FighterAnimator, type AnimOutput } from '../src/render/anim/animator';
import { MODEL_METRICS, solveBody, apply, add, euler, mul, type Body } from '../src/render/anim/skeleton';
import type { Pose } from '../src/render/poses';

export function bodyOf(o: AnimOutput): { body: Body; footL: number[]; footR: number[] } {
  const m = MODEL_METRICS;
  const pose: Pose = { joints: o.joints };
  const body = solveBody(pose, m, o.hips);
  const foot = (s: 'l' | 'r') => {
    const R = mul(body.shinR[s], euler(o.joints[`${s}Foot`]));
    const a = add(body.ankle[s], apply(R, [0, -m.ankleH, 0]));
    return [...add(a, apply(R, [0, 0, m.footFwd])), ...add(a, apply(R, [0, 0, -m.footBack]))];
  };
  return { body, footL: foot('l'), footR: foot('r') };
}

export interface Scene { sim: Simulation; a: Fighter; b: Fighter; A: FighterAnimator; B: FighterAnimator; step: (ca?: CommandFrame, cb?: CommandFrame) => { a: AnimOutput; b: AnimOutput } }
export function scene(styleA = 'kickboxing', styleB = 'kickboxing', gap = 1.0, tech = 8): Scene {
  const sim = new Simulation(createTrainingArena(), 7);
  const a = sim.add(new Fighter({ id: 1, name: 'A', team: 'player', attributes: { ...defaultAttributes(5), technique: tech }, style: STYLES[styleA as keyof typeof STYLES], x: 0, z: 0 }));
  const b = sim.add(new Fighter({ id: 2, name: 'B', team: 'enemy', attributes: { ...defaultAttributes(5), technique: tech }, style: STYLES[styleB as keyof typeof STYLES], x: gap, z: 0 }));
  const A = new FighterAnimator(a, MODEL_METRICS, { skill: 0.8, bulk: 0.2, seed: 0.5 });
  const B = new FighterAnimator(b, MODEL_METRICS, { skill: 0.8, bulk: 0.2, seed: 0.5 });
  let t = 0;
  const step = (ca?: CommandFrame, cb?: CommandFrame) => {
    const cmds = new Map<number, CommandFrame>();
    cmds.set(1, ca ?? emptyCommand());
    cmds.set(2, cb ?? emptyCommand());
    sim.step(cmds);
    t += 1 / 60;
    return { a: A.update(1 / 60, t), b: B.update(1 / 60, t) };
  };
  return { sim, a, b, A, B, step };
}
const press = (b: string, extra: Partial<CommandFrame> = {}): CommandFrame => {
  const c = emptyCommand();
  (c.pressed as Record<string, boolean>)[b] = true;
  return { ...c, ...extra };
};

if (process.argv[1]?.endsWith('sheet_sim.ts')) {
  const what = process.argv[2] ?? 'stances';
  const frames: unknown[] = [];
  const snap = (name: string, o: AnimOutput) => frames.push({ name, pitch: o.pitch, ...bodyOf(o) });
  if (what === 'stances') {
    for (const st of Object.keys(STYLES)) {
      const s = scene(st, st, 1.6);
      let o = s.step();
      for (let i = 0; i < 40; i++) o = s.step();
      snap(st, o.a);
    }
    const s = scene('street', 'street', 30);
    let o = s.step();
    for (let i = 0; i < 90; i++) o = s.step();
    snap('relaxed', o.a);
    const n = scene('street', 'street', 1.6, 0);
    const N = new FighterAnimator(n.a, MODEL_METRICS, { skill: 0, bulk: 0.9, seed: 0.2 });
    let on = N.update(1 / 60, 0);
    for (let i = 0; i < 60; i++) { n.step(); on = N.update(1 / 60, i / 60); }
    snap('street novice, big', on);
  } else if (what === 'move') {
    // tsx tools/sheet_sim.ts move <style> <button> [special] [gap]
    const [style, button, special, gap] = [process.argv[3], process.argv[4], process.argv[5] === '1', Number(process.argv[6] ?? 1.0)];
    const s = scene(style, style, gap);
    for (let i = 0; i < 30; i++) s.step();
    let o = s.step(press(button, { special }));
    const name = s.a.move?.data.name ?? '?';
    for (let i = 0; i < 46; i++) {
      if (i % 3 === 0) snap(`${name} f${s.a.move?.frame ?? '-'} ${s.a.state} | B ${s.b.state}`, o.a);
      o = s.step();
    }
  } else if (what === 'walk') {
    const s = scene('kickboxing', 'kickboxing', Number(process.argv[4] ?? 30));
    const dir = process.argv[3] ?? 'fwd';
    const cmd = () => ({ ...emptyCommand(), moveX: dir === 'back' ? -1 : dir === 'side' ? 0 : 1, moveZ: dir === 'side' ? 1 : 0 });
    for (let i = 0; i < 30; i++) s.step();
    for (let i = 0; i < 66; i++) {
      const o = s.step(cmd());
      if (i >= 30 && i % 3 === 0) snap(`${dir} t${i}`, o.a);
    }
  } else if (what === 'hit') {
    // tsx tools/sheet_sim.ts hit <button> [special]: B takes it
    const s = scene('kickboxing', 'kickboxing', 1.0);
    for (let i = 0; i < 30; i++) s.step();
    let o = s.step(press(process.argv[3] ?? 'lp', { special: process.argv[4] === '1' }));
    for (let i = 0; i < 110; i++) {
      if (i % (process.argv[5] ? Number(process.argv[5]) : 4) === 0) snap(`B ${s.b.state} ${s.b.stateFrame}`, o.b);
      o = s.step();
    }
  }
  console.log(JSON.stringify(frames));
}
