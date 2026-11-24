/**
 * A big binary file, fetched gzipped where the browser can unpack it. Static hosts don't compress .bin files,
 * so the street kits and the body pack sit next to a `.gz` copy (tools/compress_bins.mjs): the street kit is a
 * third of the size that way. Falls back to the plain file if the browser can't unpack it or the copy's missing,
 * and copes with a host that unpacks the copy itself (its bytes then don't start with gzip's marker).
 */
export async function fetchBinary(url: string): Promise<ArrayBuffer> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const r = await fetch(`${url}.gz`);
      if (r.ok) {
        const raw = await r.arrayBuffer();
        const head = new Uint8Array(raw, 0, Math.min(2, raw.byteLength));
        if (head[0] !== 0x1f || head[1] !== 0x8b) return raw;
        return await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
    } catch {
      /* the plain file below */
    }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.arrayBuffer();
}
