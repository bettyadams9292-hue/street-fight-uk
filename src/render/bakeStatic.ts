/**
 * Bake a group of still, ordinary meshes into one mesh per material, in world space under the group's parent.
 * Used for shop stock seen through the windows: dozens of small pieces per shop become a few draws.
 * Anything that isn't a plain mesh (skinned, instanced, several materials, lights) is kept as it is.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** `shadows: false` for things that never need to cast (stock behind shop glass), saving the shadow pass its draws. */
export function bakeStatic(root: THREE.Group, shadows = true): THREE.Group {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  out.name = root.name;
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean }>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (o === root) return;
    if (!mesh.isMesh) {
      // Lights and other non-meshes keep their place in the world.
      if ((o as THREE.Light).isLight) keep.push(o);
      return;
    }
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material) || !mesh.visible) {
      keep.push(mesh);
      return;
    }
    const src = mesh.geometry;
    if (!src.getAttribute('position')) return;
    let geo = src.index ? src.toNonIndexed() : src.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    // Every piece in a bucket must carry the same attributes: position, normal, uv (and colour where the material uses it).
    const mat = mesh.material as THREE.Material & { vertexColors?: boolean };
    const wantColour = !!mat.vertexColors;
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    const n = geo.getAttribute('position').count;
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (wantColour && !geo.getAttribute('color')) geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv' && !(wantColour && name === 'color')) geo.deleteAttribute(name);
    if (geo.getAttribute('color')?.itemSize === 4) {
      const c4 = geo.getAttribute('color');
      const c3 = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c3[i * 3] = c4.getX(i); c3[i * 3 + 1] = c4.getY(i); c3[i * 3 + 2] = c4.getZ(i); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c3, 3));
    }
    geo.morphAttributes = {};
    geo.clearGroups();
    const key = `${mat.uuid}|${wantColour}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat, geos: [], shadow: false }));
    b.geos.push(geo);
    b.shadow ||= mesh.castShadow;
  });
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    for (const g of b.geos) if (g !== merged) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = shadows && b.shadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  // Kept pieces go across with their world placement.
  for (const o of keep) {
    const m = o.matrixWorld.clone();
    o.removeFromParent();
    m.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  return out;
}
