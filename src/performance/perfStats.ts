/**
 * Development performance numbers, kept as the game runs and read from the browser console (`__perf()`) or a
 * test script: frame times (average, 95th percentile and worst over the last two seconds), the background
 * budget used and any step that ran past it, draw calls, triangles, geometries and textures held on the GPU,
 * JavaScript heap where the browser reports it, people in the scene and background jobs waiting. Never drawn in
 * the game (the owner's rule: no FPS counter or overlay); exposed only on development builds and `?perf` pages.
 */
import type * as THREE from 'three';
import { backgroundJobs, takeStepStats } from './scheduler';

const WINDOW = 120;

export interface PerfReport {
  frameAvgMs: number;
  frameP95Ms: number;
  frameWorstMs: number;
  backgroundMs: number;
  longestBackgroundStepMs: number;
  backgroundOverrunMs: number;
  backgroundJobs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  people: number;
  heapMB: number | null;
}

export class PerfStats {
  private times: number[] = [];
  private bg: number[] = [];
  private calls = 0;
  private tris = 0;
  private geos = 0;
  private tex = 0;
  private people = 0;
  private step = { longestStep: 0, overrun: 0 };

  frame(dt: number, backgroundMs: number, info: THREE.WebGLInfo, people: number): void {
    if (dt <= 0 || dt > 0.5) return;
    this.times.push(dt * 1000);
    this.bg.push(backgroundMs);
    if (this.times.length > WINDOW) {
      this.times.shift();
      this.bg.shift();
    }
    this.calls = info.render.calls;
    this.tris = info.render.triangles;
    this.geos = info.memory.geometries;
    this.tex = info.memory.textures;
    this.people = people;
    const s = takeStepStats();
    this.step = { longestStep: Math.max(this.step.longestStep * 0.98, s.longestStep), overrun: Math.max(this.step.overrun * 0.98, s.overrun) };
  }

  report(): PerfReport {
    const sorted = [...this.times].sort((a, b) => a - b);
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const mem = (globalThis as { performance?: { memory?: { usedJSHeapSize: number } } }).performance?.memory;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return {
      frameAvgMs: r1(avg(this.times)),
      frameP95Ms: r1(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
      frameWorstMs: r1(sorted[sorted.length - 1] ?? 0),
      backgroundMs: r1(avg(this.bg)),
      longestBackgroundStepMs: r1(this.step.longestStep),
      backgroundOverrunMs: r1(this.step.overrun),
      backgroundJobs: backgroundJobs(),
      drawCalls: this.calls,
      triangles: this.tris,
      geometries: this.geos,
      textures: this.tex,
      people: this.people,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    };
  }
}
