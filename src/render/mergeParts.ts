import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merge plain parts (`box` / `cyl` meshes) that share a parent, a material and shadow settings into one mesh in
 * that parent. Parts something else changes later (scaled, hidden, swapped material) are left alone: only
 * visible meshes with one material and their parent's default render order are merged.
 */
export function mergeParts(parts: Set<THREE.Mesh>): void {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const m of parts) {
    if (!m.parent || !m.visible || Array.isArray(m.material) || m.renderOrder !== 0 || m.userData.keep) continue;
    const mat = m.material as THREE.Material;
    if (mat.transparent) continue;
    const key = `${m.parent.id}|${mat.id}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    b.push(m);
  }
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const parent = list[0].parent!;
    parent.updateMatrixWorld(true);
    inv.copy(parent.matrixWorld).invert();
    const geos: THREE.BufferGeometry[] = [];
    for (const m of list) {
      m.updateMatrixWorld(true);
      rel.multiplyMatrices(inv, m.matrixWorld);
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      g.clearGroups();
      g.applyMatrix4(rel);
      geos.push(g);
    }
    if (geos.some((g) => !g.getAttribute('normal') || !g.getAttribute('uv'))) {
      for (const g of geos) g.dispose();
      continue;
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    // Its UVs were already fitted part by part (fitUVs): don't fit them again as one.
    merged.userData.fitted = true;
    const out = new THREE.Mesh(merged, list[0].material);
    out.castShadow = list[0].castShadow;
    out.receiveShadow = list[0].receiveShadow;
    parent.add(out);
    for (const m of list) {
      parent.remove(m);
      m.geometry.dispose();
      parts.delete(m);
    }
    parts.add(out);
  }
}

