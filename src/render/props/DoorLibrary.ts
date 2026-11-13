/**
 * Doors (public/models/doors): "Low-Poly PSX Style Essential Doors Pack" by
 * vanillao03 (CC BY 4.0, credits in CREDITS.md there), split into one model per
 * door (frame, leaf, handle, glass) by tools/models/split_doors_pack.py.
 *
 * Every door in the city is one of these, picked per doorway (seeded, so a street
 * looks the same each visit) to suit the building, some in a painted colour.
 * Until the files load, or if they can't, the old doors stay.
 */
import type * as THREE from 'three';
import { modelSet } from './modelSet';

export const DOOR_MODELS = ['door_front', 'door_wooden', 'door_panel', 'door_worn', 'door_bathroom', 'door_closet'] as const;
export type DoorModelId = (typeof DOOR_MODELS)[number];

const doors = modelSet('doors', '/models/doors/', DOOR_MODELS);

export function loadDoors(): Promise<void> {
  return doors.load();
}

export function doorsReady(): boolean {
  return doors.ready();
}

/** What kind of building the door is on: it decides which doors and paints are likely. */
export type DoorStyle = 'house' | 'shop' | 'service' | 'interior' | 'stairs' | 'double';

// British front-door paints; the white panel door takes them best.
const PAINT = ['#7a1414', '#1d2a5a', '#1d4a2a', '#222326', '#3a6a6a', '#5a2a4a', '#f2f0ea'];
const CHOICES: Record<DoorStyle, { id: DoorModelId; paint?: boolean }[]> = {
  house: [{ id: 'door_bathroom', paint: true }, { id: 'door_bathroom', paint: true }, { id: 'door_panel' }, { id: 'door_wooden' }, { id: 'door_front' }],
  shop: [{ id: 'door_front' }, { id: 'door_front' }, { id: 'door_panel' }, { id: 'door_bathroom', paint: true }],
  service: [{ id: 'door_worn' }, { id: 'door_worn' }, { id: 'door_panel' }, { id: 'door_bathroom', paint: true }],
  interior: [{ id: 'door_wooden' }, { id: 'door_bathroom' }, { id: 'door_panel' }],
  stairs: [{ id: 'door_worn' }, { id: 'door_panel' }],
  double: [{ id: 'door_closet' }, { id: 'door_closet', paint: true }],
};

/** Pick a door for a doorway: the same seed always gives the same door. */
export function pickDoor(style: DoorStyle, seed: number): { id: DoorModelId; tint?: string } {
  const h = (n: number) => Math.abs(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1;
  const opts = CHOICES[style];
  const c = opts[Math.floor(h(1) * opts.length)];
  return { id: c.id, tint: c.paint ? PAINT[Math.floor(h(2) * PAINT.length)] : undefined };
}

/**
 * A door fitted to a doorway w × h metres, standing on y = 0, centred on x, its back at z = 0 and face to +z.
 * Null until the doors have loaded.
 */
export function doorPiece(style: DoorStyle, seed: number, w: number, h: number): THREE.Group | null {
  const d = pickDoor(style, seed);
  return doors.piece(d.id, w, h, 0.18, { tint: d.tint });
}
