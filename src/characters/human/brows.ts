/**
 * Eyebrows, cut from the body's own brow skin: the patch of face over each eye
 * becomes a thin shell lifted a fraction off the skin, with texture coordinates
 * laid along the brow so a painted brow (hair strokes, soft edges) sits on it.
 * Needs no asset beyond the body, and moves with the face.
 */
import type { BodyData } from './body';

export interface BrowMesh {
  /** Body render vertices used (for skinning). */
  render: Uint32Array;
  position: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
}

/**
 * eyes: the two eyeball centres (left then right, metres, as fitted to this body).
 * thick: 0 fine .. 1 heavy, widens the band the texture is laid over.
 */
export function cutBrows(data: BodyData, pos: Float32Array, normals: Float32Array, eyes: [number, number, number][], thick = 0.5): BrowMesh {
  const n = data.meta.baseCount;
  const halfW = 0.034;
  const halfH = 0.011 + 0.004 * thick;
  // Per base vertex: which brow, and its (u, v) in that brow's frame.
  const side = new Int8Array(n).fill(-1);
  const U = new Float32Array(n);
  const V = new Float32Array(n);
  const lift = 0.0009;
  for (let v = 0; v < n; v++) {
    if (normals[v * 3 + 2] < 0.25) continue;
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    for (let s = 0; s < 2; s++) {
      const e = eyes[s];
      if (z < e[2] - 0.004) continue;
      // Across the brow, from the nose end (0) to the tail (1); the tail is outward.
      const out = s === 0 ? 1 : -1;
      const along = ((x - e[0]) * out + halfW - 0.004) / (2 * halfW);
      if (along < -0.08 || along > 1.08) continue;
      // The brow arches: highest a little past the middle, dropping at the tail.
      const arch = 0.0145 + 0.005 * (1 - Math.pow((along - 0.6) / 0.6, 2));
      const up = (y - (e[1] + arch)) / halfH;
      if (Math.abs(up) > 1.15) continue;
      side[v] = s;
      U[v] = along;
      V[v] = 0.5 + up * 0.5;
    }
  }
  const idx = data.index;
  const rb = data.renderBase;
  const used = new Map<number, number>();
  const render: number[] = [];
  const tris: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = rb[idx[i]];
    const b = rb[idx[i + 1]];
    const c = rb[idx[i + 2]];
    if (side[a] < 0 || side[a] !== side[b] || side[a] !== side[c]) continue;
    for (const r of [idx[i], idx[i + 1], idx[i + 2]]) {
      let l = used.get(r);
      if (l === undefined) {
        l = render.length;
        used.set(r, l);
        render.push(r);
      }
      tris.push(l);
    }
  }
  const P = new Float32Array(render.length * 3);
  const T = new Float32Array(render.length * 2);
  render.forEach((r, l) => {
    const v = rb[r];
    for (let k = 0; k < 3; k++) P[l * 3 + k] = pos[v * 3 + k] + normals[v * 3 + k] * lift;
    T[l * 2] = U[v];
    T[l * 2 + 1] = V[v];
  });
  return { render: Uint32Array.from(render), position: P, uv: T, index: Uint32Array.from(tris) };
}
