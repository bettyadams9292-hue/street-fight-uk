/**
 * The background body (tools/human/lod.mjs → public/models/human/body_lod.bin): a valid lighter index over the
 * full body's own vertices, a quarter or so of its triangles.
 */
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed++;
};
const dir = new URL('../public/models/human/', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('body.json', dir), 'utf8')) as { renderCount: number; indexCount: number };
const lod = new Uint16Array(new Uint8Array(readFileSync(new URL('body_lod.bin', dir))).buffer);
check(lod.length > 0 && lod.length % 3 === 0, `whole triangles (${lod.length / 3})`);
let max = 0;
for (const v of lod) max = Math.max(max, v);
check(max < meta.renderCount, 'every corner is one of the body’s own vertices');
const share = lod.length / meta.indexCount;
check(share > 0.15 && share < 0.4, `about a quarter of the full body’s triangles (${(share * 100).toFixed(0)}%)`);
let degenerate = 0;
for (let i = 0; i < lod.length; i += 3) if (lod[i] === lod[i + 1] || lod[i + 1] === lod[i + 2] || lod[i] === lod[i + 2]) degenerate++;
check(degenerate === 0, 'no collapsed triangles');
console.log(failed ? `\n${failed} failed` : '\nall passed');
if (failed) process.exit(1);
