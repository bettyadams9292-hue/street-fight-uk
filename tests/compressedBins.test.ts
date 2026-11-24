/** Every gzipped copy (tools/compress_bins.mjs) unpacks to exactly its file, so the game never loads a stale one. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const BINS = ['public/models/human/body.bin', 'public/models/polyfork/kit.bin', 'public/models/city/kit.bin'];
let failed = 0;
for (const f of BINS) {
  const ok = gunzipSync(readFileSync(`${f}.gz`)).equals(readFileSync(f));
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${f}.gz matches ${f}${ok ? '' : ': run node tools/compress_bins.mjs'}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
