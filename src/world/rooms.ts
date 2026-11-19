/**
 * Rooms at their real size.
 *
 * Every interior used to be the same thin strip as the street outside: a back wall 3.5 m from the front edge,
 * everything lined up against it. Now a room carries on forward towards the camera by `ROOM_EXTRA`, so it is
 * about 8 m deep and a boxing ring, a pool, a bar with tables in front of it fits at true size. Everything
 * already placed keeps its spot (it all hangs off the back wall); the new depth is open floor in front.
 *
 * Rooms side by side keep their doorway where it always was (the walkway, `WALKWAY`), and the walls between
 * them now carry on to the front, so each room reads as a room. The indoor camera (CameraRig) looks down into
 * the whole depth.
 */
import type { LevelDef } from './LevelTypes';

/** How much deeper every room is than the old strip (metres, towards the camera). */
export const ROOM_EXTRA = 4.4;

/** The front edge of every interior before rooms were deepened: the walkway between rooms runs up to here. */
export const OLD_FRONT = 1.4;

/** Deepen an interior: front edge forward, room dividers carried on to it (keeping the doorway), lights moved into the room. */
export function deepRoom<T extends LevelDef>(level: T, extra = ROOM_EXTRA): T {
  const oldFront = level.bounds.maxZ;
  const front = oldFront + extra;
  const back = level.bounds.minZ;
  const walls = (level.walls ?? []).flatMap((w) =>
    // A divider from the back wall that stops short of the old front edge leaves a doorway there; carry it on past.
    w.minZ <= back + 0.1 && w.maxZ < oldFront - 0.3 && w.maxZ - w.minZ > 1 ? [w, { ...w, minZ: oldFront, maxZ: front + 0.3 }] : [w],
  );
  const lights = (level.lights ?? []).map((l) => ({ ...l, z: l.z + extra * 0.5, range: (l.range ?? 8) + extra, intensity: l.intensity * 1.25 }));
  return { ...level, bounds: { ...level.bounds, maxZ: front }, walls, lights, deep: true };
}

/** Is this level a deepened room (the indoor camera and the partition walls go with it)? */
export function isDeepRoom(level: LevelDef): boolean {
  return !!level.deep;
}
