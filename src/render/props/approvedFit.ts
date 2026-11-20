/**
 * An approved model as a live object, centred on its footprint and standing on the floor, at a given scale: the
 * way props drawn one at a time (gym kit, the ring, the stash safe, what you hold) use the approved sets.
 */
import * as THREE from 'three';
import { approvedObject, prototype } from '../approved/prototype';

/** Real size (scale 1), or `fit` to a footprint (full width x, depth z; keeps its proportions unless `stretch`). */
export function approvedAt(id: string, opts: { scale?: number; fit?: [number, number]; max?: number; stretch?: boolean } = {}): THREE.Group | null {
  let proto;
  try {
    proto = prototype(id);
  } catch {
    return null;
  }
  const size = proto.box.getSize(new THREE.Vector3());
  const centre = proto.box.getCenter(new THREE.Vector3());
  let s: [number, number, number] = [opts.scale ?? 1, opts.scale ?? 1, opts.scale ?? 1];
  if (opts.fit) {
    const kx = opts.fit[0] / size.x;
    const kz = opts.fit[1] / size.z;
    if (opts.stretch) s = [kx, Math.sqrt(kx * kz), kz];
    else {
      const k = Math.min(opts.max ?? 1, kx, kz);
      s = [k, k, k];
    }
  }
  const inner = approvedObject(id);
  inner.scale.set(...s);
  inner.position.set(-centre.x * s[0], -proto.box.min.y * s[1], -centre.z * s[2]);
  const g = new THREE.Group();
  g.name = `approved:${id}`;
  g.add(inner);
  return g;
}
