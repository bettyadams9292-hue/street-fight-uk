/**
 * Skinned character models made in Blender (assets-src/sfuk_characters.blend,
 * exported to public/models/characters.glb).
 *
 * The skeleton uses exactly the game's 11 joint names and positions, with
 * identity rest rotations, so the pose code in FighterView drives the bones
 * the same way it drove the old procedural groups. If the file fails to load,
 * or `?classic` is in the URL, fighters fall back to the procedural rig.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

let template: THREE.Object3D | null = null;
let loading: Promise<void> | null = null;

/** Starts loading once; resolves when ready (or failed, which falls back). */
export function loadCharacterModels(url = '/models/characters.glb'): Promise<void> {
  if (loading) return loading;
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('classic')) {
    loading = Promise.resolve();
    return loading;
  }
  loading = new GLTFLoader()
    .loadAsync(url)
    .then((gltf) => {
      template = gltf.scene;
    })
    .catch((e: unknown) => {
      console.warn('Character models failed to load; using the classic rig.', e);
    });
  return loading;
}

export function characterModelsReady(): boolean {
  return template !== null;
}

/** A fresh, independent copy of the rigged model (own skeleton, shared geometry). */
export function cloneCharacterModel(): THREE.Object3D | null {
  return template ? cloneSkinned(template) : null;
}
