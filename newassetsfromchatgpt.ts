/**
 * Street Fight UK — isolated procedural street furniture asset library.
 * NOT imported, registered or placed anywhere in the game.
 * Three.js compatible. Units approximate metres. Y is up.
 * Usage (later, deliberately): import { createStreetAsset } from './newassetsfromchatgpt';
 * const prop = createStreetAsset('pillarPostBox'); scene.add(prop);
 */
import * as THREE from 'three';

export type StreetAssetName =
  | 'pillarPostBox' | 'wallPostBox' | 'busStopPole' | 'busShelter'
  | 'busBench' | 'timetableBoard' | 'streetLamp' | 'bollard'
  | 'railings' | 'litterBin' | 'recyclingBin' | 'telephoneBox'
  | 'electricalCabinet' | 'streetNameSign' | 'pedestrianCrossing'
  | 'roadSign';

const C = {
  red: 0xb61d29, darkRed: 0x801521, charcoal: 0x262b31,
  steel: 0x727b83, silver: 0xc6cbd0, glass: 0x9ec7d3,
  cream: 0xece8d9, white: 0xf7f5ee, yellow: 0xf5c934,
  blue: 0x245d91, green: 0x237453, asphalt: 0x3e4145,
};
function mat(color: number, metalness = 0, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, color: number, metalness = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, metalness));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function cylinder(g: THREE.Group, r: number, h: number, x: number, y: number, z: number, color: number, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 12), mat(color, 0.3));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function group(name: string) { const g = new THREE.Group(); g.name = 'SFUK_' + name; return g; }
function panel(g: THREE.Group, w: number, h: number, x: number, y: number, z: number, color: number) {
  return box(g, w, h, 0.025, x, y, z, color);
}
function pole(g: THREE.Group, x: number, y: number, z: number, height: number, color = C.charcoal) {
  return cylinder(g, 0.045, height, x, y + height / 2, z, color);
}
function sign(g: THREE.Group, text: string, w: number, h: number, x: number, y: number, z: number, bg: number, fg: number) {
  // Canvas-free, bundler-safe placeholder geometry: text label in userData for later typography.
  const m = panel(g, w, h, x, y, z, bg);
  m.userData = { signText: text, textColor: fg, note: 'Apply font/texture during integration' };
  return m;
}
export function createStreetAsset(name: StreetAssetName): THREE.Group {
  const g = group(name);
  switch (name) {
    case 'pillarPostBox':
      cylinder(g, .24, 1.22, 0, .65, 0, C.red);
      cylinder(g, .275, .12, 0, 1.30, 0, C.darkRed);
      cylinder(g, .27, .08, 0, .06, 0, C.darkRed);
      box(g, .35, .065, .055, 0, 1.01, .235, C.charcoal);
      panel(g, .25, .22, 0, .77, .251, C.cream);
      break;
    case 'wallPostBox':
      box(g, .46, .68, .24, 0, .58, 0, C.red);
      box(g, .49, .09, .27, 0, .96, 0, C.darkRed);
      box(g, .32, .05, .04, 0, .72, .141, C.charcoal);
      panel(g, .30, .19, 0, .47, .141, C.cream);
      break;
    case 'busStopPole':
      pole(g, 0, 0, 0, 2.65);
      cylinder(g, .21, .055, 0, 2.60, 0, C.red);
      sign(g, 'BUS STOP', .35, .40, 0, 2.25, .06, C.white, C.red);
      sign(g, 'ROUTES', .35, .45, 0, 1.74, .06, C.cream, C.charcoal);
      break;
    case 'busShelter':
      for (const x of [-1.45, 1.45]) for (const z of [-.43, .43]) pole(g, x, 0, z, 2.25, C.steel);
      box(g, 3.15, .11, 1.20, 0, 2.32, 0, C.charcoal, .3);
      box(g, 3.00, .055, .92, 0, 2.26, 0, C.blue);
      for (const x of [-.73, .73]) panel(g, 1.35, 1.72, x, 1.18, -.46, C.glass);
      box(g, 2.4, .09, .43, 0, .61, -.25, C.steel, .4);
      for (const x of [-.96, .96]) box(g, .07, .58, .07, x, .29, -.25, C.charcoal);
      break;
    case 'busBench':
      box(g, 1.65, .09, .46, 0, .51, 0, C.steel, .5);
      box(g, 1.65, .42, .07, 0, .82, -.22, C.steel, .5);
      for (const x of [-.69, .69]) box(g, .08, .50, .08, x, .25, 0, C.charcoal);
      break;
    case 'timetableBoard':
      pole(g, 0, 0, 0, 1.9);
      box(g, .65, .93, .12, 0, 1.50, .02, C.charcoal);
      sign(g, 'TIMETABLE', .56, .81, 0, 1.51, .09, C.cream, C.charcoal);
      break;
    case 'streetLamp':
      pole(g, 0, 0, 0, 4.4);
      box(g, 1.15, .075, .09, .53, 4.34, 0, C.charcoal);
      box(g, .39, .10, .26, 1.02, 4.25, 0, C.silver, .3);
      box(g, .34, .025, .22, 1.02, 4.19, 0, C.cream);
      break;
    case 'bollard':
      cylinder(g, .105, .88, 0, .44, 0, C.charcoal);
      cylinder(g, .111, .11, 0, .68, 0, C.silver);
      cylinder(g, .125, .07, 0, .91, 0, C.charcoal);
      break;
    case 'railings':
      for (let i = 0; i < 6; i++) pole(g, -1.25 + i * .5, 0, 0, 1.08);
      for (const y of [.28, .89]) box(g, 2.65, .055, .055, 0, y, 0, C.charcoal);
      break;
    case 'litterBin':
    case 'recyclingBin': {
      const color = name === 'recyclingBin' ? C.green : C.charcoal;
      box(g, .52, .94, .46, 0, .49, 0, color);
      box(g, .57, .10, .51, 0, .98, 0, C.charcoal);
      box(g, .31, .09, .03, 0, .79, .247, C.charcoal);
      panel(g, .28, .23, 0, .48, .246, name === 'recyclingBin' ? C.white : C.silver);
      break;
    }
    case 'telephoneBox':
      for (const x of [-.42, .42]) for (const z of [-.42, .42])
        box(g, .10, 2.28, .10, x, 1.14, z, C.red);
      box(g, 1.03, .23, 1.03, 0, 2.37, 0, C.red);
      for (const z of [-.43, .43]) {
        for (const x of [-.22, .22]) panel(g, .34, 1.73, x, 1.16, z, C.glass);
      }
      box(g, 1.02, .09, 1.02, 0, .05, 0, C.darkRed);
      sign(g, 'TELEPHONE', .79, .14, 0, 2.32, .53, C.cream, C.red);
      break;
    case 'electricalCabinet':
      box(g, .90, 1.45, .46, 0, .75, 0, C.green);
      panel(g, .79, 1.29, 0, .76, .242, C.steel);
      box(g, .04, .13, .035, .31, .75, .266, C.charcoal);
      break;
    case 'streetNameSign':
      for (const x of [-.69, .69]) pole(g, x, 0, 0, 1.85, C.steel);
      sign(g, 'HIGH STREET', 1.65, .34, 0, 1.72, .05, C.white, C.charcoal);
      break;
    case 'pedestrianCrossing':
      box(g, 3.0, .025, 3.2, 0, .012, 0, C.asphalt);
      for (let i = 0; i < 5; i++) box(g, 2.7, .008, .31, 0, .03, -1.2 + i * .6, C.white);
      break;
    case 'roadSign':
      pole(g, 0, 0, 0, 2.30, C.steel);
      sign(g, 'TOWN CENTRE', 1.18, .52, 0, 2.10, .055, C.blue, C.white);
      break;
    default: {
      const exhaustive: never = name;
      throw new Error('Unknown street asset: ' + exhaustive);
    }
  }
  g.userData = { collection: 'newassetsfromchatgpt', standalone: true, units: 'metres', assetName: name };
  return g;
}
export const STREET_ASSET_NAMES: readonly StreetAssetName[] = [
  'pillarPostBox', 'wallPostBox', 'busStopPole', 'busShelter', 'busBench',
  'timetableBoard', 'streetLamp', 'bollard', 'railings', 'litterBin',
  'recyclingBin', 'telephoneBox', 'electricalCabinet', 'streetNameSign',
  'pedestrianCrossing', 'roadSign',
] as const;
