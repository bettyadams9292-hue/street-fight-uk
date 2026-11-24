/// <reference lib="webworker" />
/**
 * Builds people off the main thread. Morphing the body and cutting a person's clothes takes tens of milliseconds
 * (more on a phone): done on the main thread, every new face walking on was a visible stall. Here it runs beside
 * the game; HumanBuilder wraps the arrays it sends back in meshes and materials, which is quick.
 *
 * Loads its own copy of the body pack and each item it's asked for (from the browser's cache: the main thread
 * fetched them first).
 */
import { BodyData, type BodyMeta } from '../../characters/human/body';
import { ProxyData, type ProxyMeta } from '../../characters/human/proxy';
import { computeHuman, transferables, type HumanSpec } from '../../characters/human/compute';
import { fetchBinary } from '../../core/fetchBinary';

const BASE = '/models/human/';
const scope = self as unknown as DedicatedWorkerGlobalScope;

interface Pack {
  body: BodyData;
  lite: BodyData;
  catalogue: Record<string, ProxyMeta>;
}
let pack: Promise<Pack> | null = null;
const proxies = new Map<string, Promise<ProxyData | null>>();
const ready = new Map<string, ProxyData>();

function loadPack(): Promise<Pack> {
  pack ??= (async () => {
    const [meta, bin, catalogue, lod] = await Promise.all([
      fetch(BASE + 'body.json').then((r) => r.json() as Promise<BodyMeta>),
      fetchBinary(BASE + 'body.bin'),
      fetch(BASE + 'proxies/catalogue.json').then((r) => r.json() as Promise<Record<string, ProxyMeta>>),
      fetch(BASE + 'body_lod.bin').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
    ]);
    const body = new BodyData(meta, bin);
    return { body, lite: lod ? body.withIndex(new Uint32Array(new Uint16Array(lod))) : body, catalogue };
  })();
  return pack;
}

function loadProxy(id: string, catalogue: Record<string, ProxyMeta>): Promise<ProxyData | null> {
  let p = proxies.get(id);
  if (!p) {
    p = (async () => {
      const meta = catalogue[id];
      if (!meta) return null;
      const bin = await fetch(`${BASE}proxies/${id}.bin`).then((r) => r.arrayBuffer());
      const d = new ProxyData(id, meta, bin);
      ready.set(id, d);
      return d;
    })().catch(() => null);
    proxies.set(id, p);
  }
  return p;
}

scope.onmessage = async (e: MessageEvent<{ id: number; spec: HumanSpec }>) => {
  const { id, spec } = e.data;
  try {
    const p = await loadPack();
    await Promise.all(['eyes', ...spec.items.map((it) => it.id)].map((i) => loadProxy(i, p.catalogue)));
    const data = computeHuman(spec, { body: p.body, lite: p.lite, proxy: (i) => ready.get(i) });
    scope.postMessage({ id, data }, transferables(data));
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
