/**
 * The 30 approved bikes and scooters (assets/streetassettesting/bikes-scooters-30.ts) as the game draws them.
 *
 * - `parkedBike`: a parked bike, merged into a few meshes (prototype), painted in its owner's colour.
 * - `riddenBike`: the bike you're on, with each wheel its own mesh about its hub so it turns with the road.
 * - `bikeFit`: where a rider goes on it (seat, bars, pedals or pegs or deck), read from the model itself.
 *
 * The models are built side-on along x, nose +x, wheels on the ground.
 */
import * as THREE from 'three';
import { BIKES } from '../../property/catalogue';
import { mergeGroup, prototype, repaint } from '../approved/prototype';
import { BIKE_ASSETS, createBikeAsset } from '../approved/sources/bikes';

const SPEC = new Map((BIKE_ASSETS as readonly { id: string; kind: string; wheel?: number }[]).map((b) => [b.id, b]));

/** Where a rider sits, holds on and puts their feet, in the model's own metres (x along, y up). */
export interface BikeFit {
  /** Top of the seat (the rider's backside), or the deck for a stand-up scooter. */
  seat: { x: number; y: number };
  bars: { x: number; y: number };
  /** Pedalled: the crank centre and crank length; otherwise where the feet rest. */
  pedal: { x: number; y: number; crank: number } | null;
  feet: { x: number; y: number };
  wheels: { x: number; r: number }[];
  ride: 'pedal' | 'kick' | 'step' | 'astride';
}

const fits = new Map<string, BikeFit>();
const hex = (m: THREE.Material | THREE.Material[]) => ((Array.isArray(m) ? m[0] : m) as THREE.MeshStandardMaterial).color?.getHexString();

export function bikeFit(id: string): BikeFit {
  const hit = fits.get(id);
  if (hit) return hit;
  const spec = SPEC.get(id)!;
  const def = BIKES[id];
  const g = createBikeAsset(id);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3();
  // The seat: the highest of the saddle-coloured pieces. The bars: the highest piece running across (z) the bike.
  let seat = { x: -0.2, y: 0.9 };
  let bars = { x: 0.35, y: 1.15 };
  let seatTop = -1;
  let barsTop = -1;
  g.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    box.setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    if (hex(m.material) === '181a1c' && box.max.y > seatTop && box.max.x - box.min.x > 0.12) {
      seatTop = box.max.y;
      seat = { x: c.x, y: box.max.y };
    }
    if (box.max.z - box.min.z > 0.38 && box.max.y - box.min.y < 0.12 && c.y > barsTop && c.y > 0.6) {
      barsTop = c.y;
      bars = { x: c.x, y: c.y };
    }
  });
  const kind = spec.kind;
  const motor = ['surron', 'dirt', 'supermoto', 'sport', 'cruiser', 'moped', 'scooter'].includes(kind);
  const R = spec.wheel ?? (motor ? 0.35 : 0.34);
  const tandem = kind === 'tandem';
  const cargo = kind === 'cargo';
  const bmx = kind === 'bmx';
  const rear = tandem ? -1.1 : cargo ? -0.8 : bmx ? -0.43 : motor ? -0.65 : -0.58;
  const front = tandem ? 0.94 : cargo ? 0.8 : bmx ? 0.43 : motor ? 0.68 : 0.58;
  const ride = def?.ride ?? 'astride';
  let pedal: BikeFit['pedal'] = null;
  let feet = { x: seat.x + 0.3, y: 0.36 };
  if (ride === 'pedal') {
    // The front seat and its cranks on a tandem; the BMX sits low.
    const bbX = tandem ? -0.12 : bmx ? -0.12 : -0.12;
    pedal = { x: bbX, y: bmx ? 0.37 : 0.45, crank: 0.17 };
    feet = { x: pedal.x, y: pedal.y };
    if (tandem) seat = { x: -0.18, y: 1.13 };
  } else if (ride === 'kick') {
    seat = { x: -0.04, y: 0.24 };
    feet = { x: -0.04, y: 0.24 };
  } else if (ride === 'step') {
    feet = { x: seat.x + 0.42, y: Math.max(0.22, R * 0.9) };
  } else {
    // A long sportbike seat: the rider sits up at the tank, not on the pillion.
    if (bars.x - seat.x > 0.86) seat = { x: bars.x - 0.86, y: seat.y };
    feet = { x: seat.x + 0.28, y: R + 0.02 };
  }
  const fit: BikeFit = { seat, bars, pedal, feet, wheels: [{ x: rear, r: R }, { x: front, r: R }], ride };
  fits.set(id, fit);
  return fit;
}

const paintPairs = (id: string, colour?: string): [string, string][] => {
  const own = BIKES[id]?.colours[0];
  return own && colour && colour.toLowerCase() !== own.toLowerCase() ? [[own, colour]] : [];
};

function meshesOf(parts: ReturnType<typeof mergeGroup>, pairs: [string, string][], name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  for (const part of parts) {
    let geo = part.geometry;
    if (pairs.length && geo.getAttribute('color')) {
      geo = geo.clone();
      repaint(geo, pairs);
    }
    const m = new THREE.Mesh(geo, part.material);
    m.castShadow = !(part.material as THREE.Material).transparent;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/** A parked bike in its owner's colour: a handful of meshes, the model's geometry shared. */
export function parkedBike(id: string, colour?: string): THREE.Group {
  const proto = prototype(id);
  return meshesOf(proto.parts, paintPairs(id, colour), `bike:${id}`);
}

/** The bike you ride: body, and each wheel as its own piece turning about its hub (`spin(distance)`). */
export function riddenBike(id: string, colour?: string): { group: THREE.Group; spin(distance: number): void } {
  const fit = bikeFit(id);
  const pairs = paintPairs(id, colour);
  const near = (m: THREE.Mesh, w: { x: number; r: number }) => {
    const b = new THREE.Box3().setFromObject(m);
    const reach = w.r + 0.05;
    return b.min.x > w.x - reach && b.max.x < w.x + reach && b.min.y > -0.02 && b.max.y < 2 * w.r + 0.05;
  };
  const whole = createBikeAsset(id);
  const group = new THREE.Group();
  group.name = `ridden:${id}`;
  group.add(meshesOf(mergeGroup(whole, (m) => !fit.wheels.some((w) => near(m, w))), pairs, 'body'));
  const wheels: THREE.Group[] = [];
  for (const w of fit.wheels) {
    const hub = new THREE.Group();
    hub.position.set(w.x, w.r, 0);
    const parts = mergeGroup(createBikeAsset(id), (m) => near(m, w));
    const mesh = meshesOf(parts, pairs, 'wheel');
    mesh.position.set(-w.x, -w.r, 0);
    hub.add(mesh);
    group.add(hub);
    wheels.push(hub);
  }
  return {
    group,
    spin(distance: number) {
      for (let i = 0; i < wheels.length; i++) wheels[i].rotation.z = -distance / fit.wheels[i].r;
    },
  };
}
