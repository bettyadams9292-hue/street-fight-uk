/**
 * The biscuit tin (your savings) on the bedroom desk: one of the three approved ornate tins
 * (`approved/sources/biscuitTins.ts`), pink, navy or aged red. Its printed panels are drawn on canvases, so each
 * style is built once and copied (the copies share the textures).
 */
import * as THREE from 'three';
import { BISCUIT_TIN_ASSETS, createBiscuitTinAsset } from '../approved/sources/biscuitTins';

export const TIN_STYLES: { id: string; name: string }[] = BISCUIT_TIN_ASSETS.map((a: { id: string; label: string }) => {
  const n = a.label.replace(/ biscuit tin$/i, '').replace(/^Ornate /, '');
  return { id: a.id, name: n[0].toUpperCase() + n.slice(1) };
});
export const DEFAULT_TIN = 'biscuitTinNavy';

const built = new Map<string, THREE.Group>();

/** A copy of the tin in this style, base on the floor of the group, about 34 × 31 cm and 18 cm tall. */
export function biscuitTin(style: string | undefined): THREE.Group | null {
  const id = TIN_STYLES.some((t) => t.id === style) ? style! : DEFAULT_TIN;
  let tin = built.get(id);
  if (!tin) {
    try {
      tin = createBiscuitTinAsset(id);
    } catch {
      return null;
    }
    tin.traverse((o: THREE.Object3D) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    built.set(id, tin);
  }
  return tin.clone();
}
