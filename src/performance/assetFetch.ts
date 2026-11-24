/**
 * The game's asset downloads, all through the one request limit (`requests.ts`) and all with a timeout,
 * so a stalled download fails (the loader falls back to its built-in version) instead of holding up play.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PRIORITY, request, type Priority } from './requests';

/** Long enough for a slow phone connection on the biggest file; short enough that a dead one gives up. */
export const ASSET_TIMEOUT_MS = 30000;

/** The bytes of a file. Rejects on a bad status, a network failure or the timeout. */
export function fetchBytes(url: string, priority: Priority = PRIORITY.later, timeoutMs = ASSET_TIMEOUT_MS): Promise<ArrayBuffer> {
  return request(url, async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const r = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return await r.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  }, priority);
}

let gltf: GLTFLoader | null = null;
/** A .glb, downloaded through the limit and parsed (parsing isn't counted against the limit). */
export async function loadGlb(url: string, priority: Priority = PRIORITY.later): Promise<GLTF> {
  const data = await fetchBytes(url, priority);
  gltf ??= new GLTFLoader();
  return gltf.parseAsync(data, url.slice(0, url.lastIndexOf('/') + 1));
}

/** An image texture, through the limit, with the timeout. */
export function loadTextureFile(url: string, priority: Priority = PRIORITY.later, timeoutMs = ASSET_TIMEOUT_MS): Promise<THREE.Texture> {
  return request(url, () => new Promise<THREE.Texture>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`${url} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    new THREE.TextureLoader().load(
      url,
      (t) => { if (done) return; done = true; clearTimeout(timer); resolve(t); },
      undefined,
      (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); },
    );
  }), priority);
}

/** A JSON file through the limit, with the timeout. */
export async function fetchJson<T = unknown>(url: string, priority: Priority = PRIORITY.later): Promise<T> {
  const bytes = await fetchBytes(url, priority);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
