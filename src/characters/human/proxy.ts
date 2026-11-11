/**
 * Fitting clothes, hair, eyes and accessories to a body. Each item vertex is
 * pinned to a triangle of body vertices with weights plus an offset that
 * scales with the body's own proportions, so one garment fits every shape.
 * Pure maths over the packs from tools/makehuman/convert_proxies.py.
 */
import type { BodyData } from './body';

export interface ProxyMeta {
  slot: string;
  name: string;
  tags: string[];
  count: number;
  renderCount: number;
  indexCount: number;
  index32: boolean;
  deleteCount: number;
  scales: Partial<Record<'x_scale' | 'y_scale' | 'z_scale', [number, number, number]>>;
  layout: Record<'refs' | 'w' | 'off' | 'renderProxy' | 'uv' | 'index' | 'delete', number>;
  material: { diffuse: string | null; normal: string | null; colour: number[]; alpha: boolean; tint: boolean };
  zDepth: number;
  source: string;
}

export class ProxyData {
  readonly refs: Uint16Array;
  readonly w: Float32Array;
  readonly off: Float32Array;
  readonly renderProxy: Uint16Array;
  readonly uv: Float32Array;
  readonly index: Uint16Array | Uint32Array;
  /** Body vertices this item covers; the body hides them. */
  readonly hides: Uint16Array;

  constructor(
    readonly id: string,
    readonly meta: ProxyMeta,
    bin: ArrayBuffer,
  ) {
    const L = meta.layout;
    this.refs = new Uint16Array(bin, L.refs, meta.count * 3);
    this.w = new Float32Array(bin, L.w, meta.count * 3);
    this.off = new Float32Array(bin, L.off, meta.count * 3);
    this.renderProxy = new Uint16Array(bin, L.renderProxy, meta.renderCount);
    this.uv = new Float32Array(bin, L.uv, meta.renderCount * 2);
    this.index = meta.index32 ? new Uint32Array(bin, L.index, meta.indexCount) : new Uint16Array(bin, L.index, meta.indexCount);
    this.hides = new Uint16Array(bin, L.delete, meta.deleteCount);
  }
}

/** The body's scale along each axis relative to the item's reference body. */
function axisScale(pos: Float32Array, s: [number, number, number] | undefined, axis: 0 | 1 | 2, unit: number): number {
  if (!s) return 1;
  const d = Math.abs(pos[s[0] * 3 + axis] - pos[s[1] * 3 + axis]);
  return s[2] > 0 ? d / (s[2] * unit) : 1;
}

/** Item vertex positions (metres) on a morphed body. `unit` converts MakeHuman units to metres. */
export function fitProxy(p: ProxyData, pos: Float32Array, unit: number, out = new Float32Array(p.meta.count * 3)): Float32Array {
  const sx = axisScale(pos, p.meta.scales.x_scale, 0, unit);
  const sy = axisScale(pos, p.meta.scales.y_scale, 1, unit);
  const sz = axisScale(pos, p.meta.scales.z_scale, 2, unit);
  for (let i = 0; i < p.meta.count; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      const r = p.refs[i * 3 + k] * 3;
      const w = p.w[i * 3 + k];
      x += pos[r] * w;
      y += pos[r + 1] * w;
      z += pos[r + 2] * w;
    }
    out[i * 3] = x + p.off[i * 3] * sx * unit;
    out[i * 3 + 1] = y + p.off[i * 3 + 1] * sy * unit;
    out[i * 3 + 2] = z + p.off[i * 3 + 2] * sz * unit;
  }
  return out;
}

/** Skin weights for each item vertex, blended from the body vertices it hangs on (top four bones). */
export function proxySkin(p: ProxyData, body: BodyData): { index: Uint8Array; weight: Uint8Array } {
  const n = p.meta.count;
  const index = new Uint8Array(n * 4);
  const weight = new Uint8Array(n * 4);
  const acc = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    acc.clear();
    for (let k = 0; k < 3; k++) {
      const v = p.refs[i * 3 + k];
      const w = p.w[i * 3 + k];
      if (w <= 0) continue;
      for (let j = 0; j < 4; j++) {
        const bw = body.skinWeight[v * 4 + j];
        if (!bw) continue;
        const b = body.skinIndex[v * 4 + j];
        acc.set(b, (acc.get(b) ?? 0) + bw * w);
      }
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    let used = 0;
    top.forEach(([b, w], j) => {
      index[i * 4 + j] = b;
      const q = Math.round((w / sum) * 255);
      weight[i * 4 + j] = q;
      used += q;
    });
    if (top.length) weight[i * 4] += 255 - used;
    else weight[i * 4] = 255;
  }
  return { index, weight };
}
