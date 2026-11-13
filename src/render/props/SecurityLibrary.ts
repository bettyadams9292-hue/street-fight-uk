/**
 * Security kit (public/models/security): "Security Set CCTV Low Poly" by MesXwi
 * (CC BY 4.0, credits in CREDITS.md there), split into pieces by
 * tools/models/split_security_pack.py: wall cameras, a dome camera, a wall lamp,
 * an alarm box, a keypad, a motion sensor, junction boxes and camera posts.
 *
 * Wall pieces have their origin where they meet the wall, front to +z. Posts stand on y = 0.
 * Until the files load, or if they can't, everything keeps its built-in look.
 */
import type * as THREE from 'three';
import { modelSet, type PieceOptions } from './modelSet';

export const SECURITY_MODELS = [
  'wall_camera', 'wall_dome', 'wall_lamp', 'alarm_box', 'keypad', 'motion_sensor', 'post_high', 'post_medium', 'post_short',
  'electric_box', 'electric_box_open', 'electric_box_broken',
] as const;
export type SecurityModelId = (typeof SECURITY_MODELS)[number];

const security = modelSet('security', '/models/security/', SECURITY_MODELS);

export function loadSecurity(): Promise<void> {
  return security.load();
}

/** A security piece at its real size (`scale` to suit where it goes), or null until loaded. */
export function securityPiece(id: SecurityModelId, scale = 1, o: PieceOptions = {}): THREE.Group | null {
  const p = security.piece(id, 0, 0, 0, { ...o, native: true });
  if (p) p.scale.setScalar(scale);
  return p;
}
