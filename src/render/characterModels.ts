/**
 * Skinned character models: Quaternius "Universal Base Characters" (CC0),
 * converted in Blender for this game (see assets/quaternius-ubc/README.md).
 *
 * Each skeleton has exactly the game's 11 joint names with identity rest
 * rotations, so the pose code in FighterView drives the bones the same way it
 * drove the old procedural groups. If a file fails to load, or `?classic` is in
 * the URL, fighters fall back to the procedural rig.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type ModelBody = 'male' | 'female';
const templates: Partial<Record<ModelBody, THREE.Object3D>> = {};
let loading: Promise<void> | null = null;

/** Starts loading once; resolves when both are ready (or failed, which falls back). */
export function loadCharacterModels(): Promise<void> {
  if (loading) return loading;
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('classic')) {
    loading = Promise.resolve();
    return loading;
  }
  const loader = new GLTFLoader();
  const one = (body: ModelBody) =>
    loader
      .loadAsync(`/models/character_${body}.glb`)
      .then((gltf) => {
        try {
          addFootBones(gltf.scene);
        } catch (e) {
          console.warn('Could not add foot bones; feet stay fixed to the shins.', e);
        }
        templates[body] = gltf.scene;
      })
      .catch((e: unknown) => console.warn(`The ${body} character model failed to load; using the classic rig.`, e));
  loading = Promise.all([one('male'), one('female')]).then(() => undefined);
  return loading;
}

export function characterModelsReady(body: ModelBody = 'male'): boolean {
  return !!templates[body];
}

/** A fresh, independent copy of the rigged model (own skeleton, shared geometry and textures). */
export function cloneCharacterModel(body: ModelBody): THREE.Object3D | null {
  const t = templates[body];
  return t ? cloneSkinned(t) : null;
}

/** Height of the ankle joint above the sole, and the band over which the skin blends from shin to foot. */
const ANKLE_Y = 0.09;
const BLEND_LO = 0.075;
const BLEND_HI = 0.15;

/**
 * The converted models have no ankle: the foot is skinned to the shin, so a
 * bent knee drives the toes into the floor. This adds a foot bone to each leg
 * and moves the foot's skin (and shoes, and trouser hems) onto it, once, on
 * the loaded template. Every fighter cloned from it gets working ankles.
 */
function addFootBones(scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  const bones: Record<string, THREE.Bone> = {};
  scene.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });
  if (!bones.lKnee || !bones.rKnee || bones.lFoot) return;
  const feet: THREE.Bone[] = [];
  for (const s of ['l', 'r']) {
    const knee = bones[`${s}Knee`];
    const at = new THREE.Vector3().setFromMatrixPosition(knee.matrixWorld);
    const foot = new THREE.Bone();
    foot.name = `${s}Foot`;
    foot.position.set(0, ANKLE_Y - at.y, 0);
    knee.add(foot);
    feet.push(foot);
  }
  scene.updateMatrixWorld(true);
  const done = new Set<THREE.BufferGeometry>();
  const v = new THREE.Vector3();
  scene.traverse((o: THREE.Object3D) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const sk = sm.skeleton;
    const kneeIdx = [sk.bones.indexOf(bones.lKnee), sk.bones.indexOf(bones.rKnee)];
    const footIdx = [sk.bones.length, sk.bones.length + 1];
    const g = sm.geometry;
    const pos = g.getAttribute('position');
    const si = g.getAttribute('skinIndex');
    const sw = g.getAttribute('skinWeight');
    if (!done.has(g) && pos && si && sw) {
      done.add(g);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(sm.bindMatrix);
        const t = Math.max(0, Math.min(1, (BLEND_HI - v.y) / (BLEND_HI - BLEND_LO)));
        if (t <= 0) continue;
        const idx = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
        const w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)];
        for (let k = 0; k < 4; k++) {
          const side = kneeIdx.indexOf(idx[k]);
          if (side < 0 || w[k] <= 0) continue;
          const free = t < 1 ? w.findIndex((x, q) => q !== k && x <= 0) : -1;
          if (free >= 0) {
            // In the blend band: share this vertex between the shin and the foot.
            idx[free] = footIdx[side];
            w[free] = w[k] * t;
            w[k] *= 1 - t;
          } else if (t >= 0.5) idx[k] = footIdx[side];
        }
        si.setXYZW(i, idx[0], idx[1], idx[2], idx[3]);
        sw.setXYZW(i, w[0], w[1], w[2], w[3]);
      }
      si.needsUpdate = true;
      sw.needsUpdate = true;
    }
    const inverses = [...sk.boneInverses, ...feet.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert())];
    sm.bind(new THREE.Skeleton([...sk.bones, ...feet], inverses), sm.bindMatrix);
  });
}
