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
