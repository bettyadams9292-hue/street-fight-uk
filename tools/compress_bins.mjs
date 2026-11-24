// Writes the gzipped copies of the big binary files that src/core/fetchBinary.ts fetches first (static hosts
// don't compress .bin). Run after changing any of them: node tools/compress_bins.mjs
// tests/compressedBins.test.ts fails if a copy no longer matches its file.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const BINS = ['public/models/human/body.bin', 'public/models/polyfork/kit.bin', 'public/models/city/kit.bin'];
for (const f of BINS) {
  const raw = readFileSync(f);
  const gz = gzipSync(raw, { level: 9 });
  writeFileSync(`${f}.gz`, gz);
  console.log(`${f}: ${(raw.length / 1e6).toFixed(2)} MB -> ${(gz.length / 1e6).toFixed(2)} MB`);
}
