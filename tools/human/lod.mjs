// Makes the lighter body for people in the background: the MakeHuman body's triangles simplified with
// meshoptimizer (the same vertices, fewer triangles), saved as public/models/human/body_lod.bin (a Uint16 index
// over the body's render vertices). Clothes are cut from whichever body index a person gets, so they come out
// lighter too. Run: node tools/human/lod.mjs [ratio]   (default 0.3 of the triangles)
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const dir = new URL('../../public/models/human/', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('body.json', dir), 'utf8'));
const bin = readFileSync(new URL('body.bin', dir));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const L = meta.layout;
const base = new Float32Array(buf, L.base, meta.baseCount * 3);
const renderBase = new Uint32Array(buf, L.renderBase, meta.renderCount);
const index = new Uint32Array(buf, L.index, meta.indexCount);
// Render vertices at their base positions (seams are separate vertices: their edges stay locked).
const pos = new Float32Array(meta.renderCount * 3);
for (let r = 0; r < meta.renderCount; r++) for (let k = 0; k < 3; k++) pos[r * 3 + k] = base[renderBase[r] * 3 + k];

const ratio = Number(process.argv[2] ?? 0.3);
await MeshoptSimplifier.ready;
const target = Math.floor((index.length * ratio) / 3) * 3;
const [out, err] = MeshoptSimplifier.simplify(index, pos, 3, target, 0.01, ['LockBorder']);
const scale = MeshoptSimplifier.getScale(pos, 3);
const tris = out.length / 3;
writeFileSync(new URL('body_lod.bin', dir), Buffer.from(new Uint16Array(out).buffer));
console.log(`body ${index.length / 3} triangles -> ${tris} (${((tris / (index.length / 3)) * 100).toFixed(0)}%), error ${(err * scale * meta.scale * 1000).toFixed(1)} mm`);
