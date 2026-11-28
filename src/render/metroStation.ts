/**
 * A Brack Metro station (world/metroLevels.ts), built from the London Underground's look: one model, dressed per
 * station (its band colour, its name, its tile).
 *
 * - The stairs up to the street at the left, tiled, with a yellow WAY OUT sign over them.
 * - The ticket hall: granite floor, cream tiles with the station's band, ticket machines, the line map, a help
 *   point, and an open hall straight through to the platform.
 * - The platform: the edge coping, a yellow line and MIND THE GAP, then the drop to the track (ballast, sleepers,
 *   running rails and the two conductor rails on their pots), and the tunnel's far wall: cream tiles, the band,
 *   the name frieze, roundels and posters, curving up into the vault. Tunnel mouths at both ends.
 * - The train, when one's in: three silver cars with red doors (open), lit inside, seats and yellow poles, the cab
 *   at the east end. Off a train, it closes its doors and pulls out into the tunnel a few seconds later.
 *
 * Surfaces are the texture library's (render/materials/library.ts): Tiles011 walls, Tiles050 hall floor,
 * Concrete042A platform, Rocks022 ballast, Metal061A stainless and car bodies.
 */
import * as THREE from 'three';
import { surface } from './materials/library';
import { mergeParts } from './mergeParts';
import { STATION_LOOK, GATE_X, PLATFORM_X0, PLATFORM_X1, STAIRS_X, TRAIN_CARS, TRAIN_DOORS, METRO_LENGTH } from '../world/metroLevels';
import { STATIONS, stationOf, type StationId } from '../travel/subway';
import { boardWhen, HEADWAY, metroVisit, trainAt } from '../travel/metro';

const EDGE_Z = -1.95;
const FAR_Z = -5.0;
const PIT_Y = -1.15;
const VAULT_TOP = 4.6;
const HALL_CEIL = 3.4;

export interface MetroView {
  group: THREE.Group;
  update(dt: number): void;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

const tex = (c: HTMLCanvasElement): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const FONT = "'Inter Display', 'Inter', 'Helvetica Neue', Arial, sans-serif";

/** The Brack Metro roundel: an orange ring with a charcoal bar carrying the name (the line's own mark). */
function roundelTexture(name: string): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = '#e8601c';
  g.lineWidth = 64;
  g.beginPath();
  g.arc(256, 256, 192, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#1d2230';
  g.fillRect(16, 206, 480, 100);
  g.fillStyle = '#ffffff';
  let size = 64;
  g.font = `800 ${size}px ${FONT}`;
  while (g.measureText(name).width > 440 && size > 26) g.font = `800 ${(size -= 2)}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 256, 258);
  return tex(c);
}

/** A tiled frieze with the station's name in it (the platform walls carry it at intervals). */
function friezeTexture(name: string, band: string): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 160);
  g.fillStyle = band;
  g.fillRect(0, 0, 1024, 160);
  g.fillStyle = 'rgba(255,255,255,0.16)';
  for (let x = 0; x < 1024; x += 32) g.fillRect(x, 0, 1, 160);
  g.fillRect(0, 79, 1024, 1);
  g.fillStyle = '#f7f2e6';
  g.font = `800 92px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), 512, 84);
  return tex(c);
}

/** The line map strip: every station on the one line, this one ringed. */
function lineMapTexture(here: StationId): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 300);
  g.fillStyle = '#f8f6f0';
  g.fillRect(0, 0, 1024, 300);
  g.fillStyle = '#1d2230';
  g.font = `800 34px ${FONT}`;
  g.fillText('Brack Metro', 36, 56);
  g.font = `600 22px ${FONT}`;
  g.fillStyle = '#5a5f6a';
  g.fillText('One line, west to east. Fares by zone.', 36, 90);
  const x0 = 70;
  const x1 = 960;
  const y = 180;
  g.strokeStyle = '#e8601c';
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  STATIONS.forEach((st, i) => {
    const x = x0 + ((x1 - x0) * i) / (STATIONS.length - 1);
    const me = st.id === here;
    g.fillStyle = '#ffffff';
    g.strokeStyle = me ? '#c4202b' : '#1d2230';
    g.lineWidth = me ? 8 : 5;
    g.beginPath();
    g.arc(x, y, me ? 17 : 12, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#1d2230';
    g.font = `${me ? 800 : 600} 21px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(st.name, x, i % 2 ? y + 52 : y - 34);
    g.font = `600 16px ${FONT}`;
    g.fillStyle = '#7a7f8a';
    g.fillText(`Zone ${st.zone}`, x, i % 2 ? y + 74 : y - 56);
  });
  return tex(c);
}

/** Set the largest font, up to `max` px, at which `text` fits `width` (never clipped at the board's edge). */
function fitFont(g: CanvasRenderingContext2D, text: string, width: number, max: number, font: string): void {
  let px = max;
  g.font = font.replace('{px}', String(px));
  while (px > 18 && g.measureText(text).width > width) {
    px -= 2;
    g.font = font.replace('{px}', String(px));
  }
}

/** WAY OUT, and other wayfinding: black on yellow, or white on the line's charcoal. */
function signTex(text: string, bg: string, fg: string, arrow: '' | '←' | '→' | '↑' = ''): THREE.CanvasTexture {
  const [c, g] = canvas(768, 160);
  g.fillStyle = bg;
  g.fillRect(0, 0, 768, 160);
  g.fillStyle = fg;
  g.font = `800 78px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const t = arrow ? `${arrow}  ${text}` : text;
  fitFont(g, t, 768 - 80, 78, `800 {px}px ${FONT}`);
  g.fillText(t, 40, 84);
  return tex(c);
}

/** The departure board: orange dot-matrix lettering on black. */
function boardTexture(lines: string[]): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#060606';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#ffa31a';
  g.textBaseline = 'middle';
  const longest = lines.slice(0, 2).reduce((a, b) => (b.length > a.length ? b : a), '');
  fitFont(g, longest, 1024 - 72, 64, `700 {px}px 'Courier New', monospace`);
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 36, 72 + i * 112));
  // The dot grid over the top.
  g.fillStyle = 'rgba(0,0,0,0.55)';
  for (let x = 0; x < 1024; x += 6) g.fillRect(x, 0, 2, 256);
  for (let y = 0; y < 256; y += 6) g.fillRect(0, y, 1024, 2);
  return tex(c);
}

/** MIND THE GAP, painted on the platform edge. */
function gapTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 128);
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = '#f2f0ea';
  g.font = `800 84px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MIND THE GAP', 512, 68);
  return tex(c);
}

/** Posters on the platform wall: made-up adverts in the game's world. */
const ADS: [string, string, string][] = [
  ['DUBER', 'Get there. Mostly.', '#111111'],
  ['WRONGMOVE', 'Find your next mistake', '#00a37a'],
  ['JD STREETS', 'New season. Same you.', '#0b0b0b'],
  ['LADSBROKE', 'When the fun stops, stop', '#b8121b'],
  ['CALIFAX', 'Banking for the High Street', '#01196e'],
  ['PRIMEARK', 'Fast fashion, faster', '#0a6fb3'],
];

function posterTexture(i: number): THREE.CanvasTexture {
  const [title, line, bg] = ADS[i % ADS.length];
  const [c, g] = canvas(512, 360);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 360);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath();
  g.arc(420, 80, 160, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `900 64px ${FONT}`;
  g.fillText(title, 28, 150);
  g.font = `500 30px ${FONT}`;
  g.fillText(line, 30, 206);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = `600 18px ${FONT}`;
  g.fillText('Ad. Terms apply.', 30, 330);
  return tex(c);
}

export function buildMetroStation(id: StationId, back: number): MetroView {
  const group = new THREE.Group();
  const look = STATION_LOOK[id];
  const name = stationOf(id).name;

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const flat = (colour: string, rough = 0.6, metal = 0, emissive?: number, ei = 1): THREE.MeshStandardMaterial => {
    const k = `${colour}|${rough}|${metal}|${emissive ?? ''}|${ei}`;
    let m = mats.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal, ...(emissive !== undefined ? { emissive, emissiveIntensity: ei } : {}) });
      mats.set(k, m);
    }
    return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = group, cast = false): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    parent.add(mesh);
    return mesh;
  };
  const plane = (w: number, h: number, x: number, y: number, z: number, m: THREE.Material, ry = 0, rx = 0, parent: THREE.Object3D = group): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    parent.add(mesh);
    return mesh;
  };
  const lib = (name: Parameters<typeof surface>[0], w: number, h: number, tint?: string, rough?: number) => surface(name, { w, h, tint, rough });
  const lit = (t: THREE.Texture, glow = 0.35) => new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow, roughness: 0.5, transparent: true });

  const front = 2.6;
  /** Floors and ceilings carry on past the front of the room, so the camera never sees their cut edge. */
  const apron = front + 3;
  const tile = look.tile;

  // ---- floors -------------------------------------------------------------------------------------------------
  // Ticket hall and passage: granite.
  plane(PLATFORM_X0 + 0.1, apron - back, PLATFORM_X0 / 2 + 0.05, 0.001, (apron + back) / 2, lib('Tiles050', PLATFORM_X0, apron - back, '#8f8a80'), 0, -Math.PI / 2);
  // Platform: sealed concrete, to the edge.
  plane(METRO_LENGTH - PLATFORM_X0, apron - EDGE_Z, (PLATFORM_X0 + METRO_LENGTH) / 2, 0.002, (apron + EDGE_Z) / 2, lib('Concrete042A', METRO_LENGTH - PLATFORM_X0, apron - EDGE_Z, '#77756f'), 0, -Math.PI / 2);
  // Edge coping (pale), the yellow line, and MIND THE GAP between them.
  const coping = flat('#d9d4c6', 0.7);
  box(METRO_LENGTH - PLATFORM_X0, 0.06, 0.32, (PLATFORM_X0 + METRO_LENGTH) / 2, 0.0, EDGE_Z + 0.16, coping);
  box(METRO_LENGTH - PLATFORM_X0, 0.01, 0.09, (PLATFORM_X0 + METRO_LENGTH) / 2, 0.034, EDGE_Z + 0.46, flat('#f2c200', 0.5));
  const gap = new THREE.MeshStandardMaterial({ map: gapTexture(), transparent: true, roughness: 0.6 });
  for (let x = PLATFORM_X0 + 4; x < PLATFORM_X1 - 2; x += 9) plane(2.2, 0.28, x, 0.036, EDGE_Z + 0.27, gap, 0, -Math.PI / 2);

  // ---- the track ----------------------------------------------------------------------------------------------
  const pitX0 = PLATFORM_X0 - 2;
  const pitX1 = METRO_LENGTH + 1.5;
  const pitW = pitX1 - pitX0;
  const pitCx = (pitX0 + pitX1) / 2;
  // The platform wall down to the track, and the track bed.
  box(pitW, -PIT_Y, 0.1, pitCx, PIT_Y / 2, EDGE_Z - 0.05, lib('Concrete042A', pitW, 1.2, '#4b4a47'));
  plane(pitW, EDGE_Z - FAR_Z, pitCx, PIT_Y, (EDGE_Z + FAR_Z) / 2, lib('Rocks022', pitW, 3, '#3b3732'), 0, -Math.PI / 2);
  const trackZ = (EDGE_Z + FAR_Z) / 2;
  const sleeper = flat('#2c2621', 0.9);
  for (let x = pitX0 + 0.3; x < pitX1; x += 0.65) box(0.24, 0.12, 2.5, x, PIT_Y + 0.06, trackZ, sleeper);
  const steel = lib('Metal061A', 1, 1, '#9da2a8', 0.5);
  for (const dz of [-0.72, 0.72]) box(pitW, 0.14, 0.07, pitCx, PIT_Y + 0.19, trackZ + dz, steel);
  // Conductor rails: the centre one, and the outer one on white insulator pots.
  box(pitW, 0.1, 0.08, pitCx, PIT_Y + 0.17, trackZ, flat('#6d6a66', 0.6, 0.4));
  box(pitW, 0.1, 0.08, pitCx, PIT_Y + 0.25, trackZ - 1.12, flat('#6d6a66', 0.6, 0.4));
  for (let x = pitX0 + 0.5; x < pitX1; x += 2.6) box(0.1, 0.16, 0.1, x, PIT_Y + 0.12, trackZ - 1.12, flat('#e8e4da', 0.4));

  // ---- the tunnel wall and vault --------------------------------------------------------------------------------
  const wallH = 2.3 - PIT_Y;
  const wallTile = lib('Tiles011', PLATFORM_X1 - PLATFORM_X0 + 4, wallH, tile, 0.6);
  plane(pitW, wallH, pitCx, PIT_Y + wallH / 2, FAR_Z, wallTile);
  // The vault: a quarter of a tube from the top of the wall, curving up and over towards the platform.
  const R = 2.4;
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(R, R, pitW, 32, 1, true, Math.PI / 2, Math.PI / 2), lib('Tiles011', pitW, 4, tile, 0.6));
  (vault.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  vault.rotation.z = Math.PI / 2;
  vault.position.set(pitCx, 2.3, FAR_Z + R);
  group.add(vault);
  // Over the platform, the vault's crown carries on flat to the front.
  plane(METRO_LENGTH - PLATFORM_X0 + 2, front - (FAR_Z + R), (PLATFORM_X0 + METRO_LENGTH) / 2, 2.3 + R - 0.01, (front + FAR_Z + R) / 2, flat('#d8d2c2', 0.8), 0, Math.PI / 2);
  // The band, the name frieze, roundels and posters.
  box(pitW, 0.32, 0.04, pitCx, 0.62, FAR_Z + 0.03, lib('Tiles037', pitW, 0.32, look.band, 0.5));
  box(pitW, 0.1, 0.04, pitCx, 2.25, FAR_Z + 0.03, flat(look.band, 0.5));
  const frieze = lit(friezeTexture(name, look.band), 0.05);
  const roundel = lit(roundelTexture(name.toUpperCase()), 0.08);
  let ad = Object.keys(STATION_LOOK).indexOf(id);
  for (let x = PLATFORM_X0 + 3; x < PLATFORM_X1 - 2; x += 10) {
    plane(4.2, 0.62, x, 1.85, FAR_Z + 0.05, frieze);
    plane(1.45, 1.45, x + 5, 1.38, FAR_Z + 0.06, roundel);
    box(2.16, 1.46, 0.04, x + 2.2, 0.94 - 0.05, FAR_Z + 0.05, flat('#22262c', 0.5));
    plane(2.0, 1.32, x + 2.2, 0.89, FAR_Z + 0.08, new THREE.MeshStandardMaterial({ map: posterTexture(ad++), roughness: 0.6 }));
  }
  // Tunnel mouths at both ends of the platform: a dark ring in the end wall over the track.
  for (const [x, dir] of [[PLATFORM_X0 - 1.6, 1], [METRO_LENGTH, -1]] as const) {
    const wall = lib('Tiles011', 4, 6, tile, 0.6);
    const wallW = EDGE_Z - FAR_Z;
    box(0.3, VAULT_TOP - PIT_Y + 1, wallW, x, (VAULT_TOP + PIT_Y) / 2, (EDGE_Z + FAR_Z) / 2, wall);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), flat('#020203', 1));
    mouth.position.set(x + 0.16 * dir, PIT_Y + 1.3, trackZ);
    mouth.rotation.y = (Math.PI / 2) * dir;
    group.add(mouth);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.07, 8, 32), flat('#6a6862', 0.7, 0.3));
    rim.position.copy(mouth.position);
    rim.rotation.y = mouth.rotation.y;
    group.add(rim);
  }

  // ---- ticket hall and passage ------------------------------------------------------------------------------------
  const hallTile = lib('Tiles011', PLATFORM_X0, HALL_CEIL, tile, 0.6);
  // Back wall from the stairs to the platform, with the band.
  const wx0 = STAIRS_X + 1.6;
  const wx1 = PLATFORM_X0 - 1.45;
  plane(wx1 - wx0, HALL_CEIL, (wx0 + wx1) / 2, HALL_CEIL / 2, back, hallTile);
  box(wx1 - wx0, 0.22, 0.03, (wx0 + wx1) / 2, 1.2, back + 0.02, flat(look.band, 0.5));
  // Ceiling with strip lights.
  plane(PLATFORM_X0, front - back, PLATFORM_X0 / 2, HALL_CEIL, (front + back) / 2, flat('#a7a297', 0.9), 0, Math.PI / 2);
  for (let x = 2; x < PLATFORM_X0 - 1; x += 3) box(1.3, 0.05, 0.16, x, HALL_CEIL - 0.04, -0.6, flat('#ffffff', 0.4, 0, 0xf1f6ff, 0.8));
  // The stairs up to the street: steps rising back into the wall, tiled walls either side.
  const sx0 = STAIRS_X - 1.5;
  const sx1 = STAIRS_X + 1.5;
  const steps = 15;
  const stepMat = lib('Concrete042A', 2.8, 0.4, '#a5a29b');
  const nosing = flat('#d8b23a', 0.6);
  for (let i = 0; i < steps; i++) {
    const z = back - 0.15 - i * 0.32;
    const y = (i + 1) * 0.22;
    box(sx1 - sx0 - 0.1, y, 0.32, STAIRS_X, y / 2, z, stepMat);
    box(sx1 - sx0 - 0.1, 0.03, 0.05, STAIRS_X, y + 0.005, z + 0.14, nosing);
  }
  for (const x of [sx0, sx1]) {
    box(0.16, HALL_CEIL + 2.4, 5.6, x, (HALL_CEIL + 2.4) / 2 - 0.2, back - 2.6, hallTile);
    box(0.06, 0.06, 5.0, x + (x < STAIRS_X ? 0.14 : -0.14), 1.0, back - 2.6, lib('Metal048B', 1, 1, '#c8a24a', 0.4)).rotation.x = -0.6;
  }
  box(sx1 - sx0, 2.4, 0.2, STAIRS_X, HALL_CEIL + 1.2, back - 0.1, hallTile);
  box(sx1 - sx0, 1.2, 0.1, STAIRS_X, 3.3 + 1.3, back - 5.4, flat('#e9f0ff', 0.4, 0, 0xdfe8ff, 0.9));
  plane(2.4, 0.5, STAIRS_X, 2.85, back + 0.12, lit(signTex('Way out', '#f2c200', '#111111', '↑'), 0.08));
  // Ticket machines against the wall.
  for (const x of [5.2, 6.4, 7.6]) {
    box(0.95, 1.9, 0.5, x, 0.95, back + 0.27, lib('Metal061A', 1, 2, '#3d4450', 0.5), group, true);
    plane(0.62, 0.48, x, 1.32, back + 0.53, flat('#11335c', 0.3, 0, 0x2a6fd6, 0.7));
    box(0.16, 0.1, 0.06, x + 0.25, 1.0, back + 0.54, flat('#f2c200', 0.4));
    box(0.95, 0.18, 0.52, x, 1.98, back + 0.27, flat('#c4202b', 0.5));
  }
  plane(2.9, 0.85, 10.0, 1.75, back + 0.04, lit(lineMapTexture(id), 0.06));
  plane(1.3, 1.3, 12.6, 2.4, back + 0.05, roundel);
  // The help point and staff booth by the gates.
  box(1.4, 2.3, 0.9, 13.6, 1.15, back + 0.45, lib('Metal061A', 1, 2, '#2c3038', 0.5), group, true);
  box(1.2, 0.9, 0.04, 13.6, 1.55, back + 0.91, flat('#0c1218', 0.1, 0.5, 0x223344, 0.4));
  plane(1.2, 0.26, 13.6, 2.15, back + 0.92, lit(signTex('Help', '#1d2230', '#ffffff'), 0.3));
  // No gate line: the hall is open through to the platform (you pay as you board).
  // Hung clear of the pier where the hall meets the platform (it stood in front of the Trains sign).
  plane(2.6, 0.4, GATE_X - 8, 2.95, -2.0 + 0.4, lit(signTex('Way out', '#f2c200', '#111111', '←'), 0.08), 0);
  plane(3.2, 0.4, GATE_X + 1.1, 2.95, -2.0 + 0.4, lit(signTex(`Trains  →  ${eastOf(id)}`, '#1d2230', '#ffffff'), 0.1), 0);
  for (const sx of [GATE_X - 8, GATE_X + 1.1]) for (const dx of [-0.9, 0.9]) box(0.025, HALL_CEIL - 3.15, 0.025, sx + dx, (HALL_CEIL + 3.15) / 2, -1.6, flat('#2a2c30', 0.5, 0.5));
  // The passage to the platform: the hall wall ends in a tiled pier.
  box(0.5, HALL_CEIL, 0.6, PLATFORM_X0 - 1.2, HALL_CEIL / 2, back + 0.1, hallTile);
  box(0.5, VAULT_TOP + 0.4, front - back, PLATFORM_X0 - 1.2, VAULT_TOP + 0.2 + HALL_CEIL / 2 - 1.7, (front + back) / 2 - 0.2, flat('#cfcac0', 0.9));

  // ---- the ends of the station ----------------------------------------------------------------------------------
  // A tiled end wall beside the street stairs, and one at the far end of the platform, the full depth of the room:
  // the camera never looks past either into the dark.
  const endTile = lib('Tiles011', 8, 6, tile, 0.6);
  box(0.3, HALL_CEIL + 0.2, apron - back + 3, -0.15, (HALL_CEIL + 0.2) / 2, (apron + back - 3) / 2, endTile);
  box(0.3, 0.22, apron - back, 0.02, 1.2, (apron + back) / 2, flat(look.band, 0.5));
  box(0.3, VAULT_TOP + 0.5, apron - EDGE_Z, METRO_LENGTH + 0.15, (VAULT_TOP + 0.5) / 2, (apron + EDGE_Z) / 2, endTile);
  box(0.3, 0.22, apron - EDGE_Z, METRO_LENGTH - 0.02, 1.2, (apron + EDGE_Z) / 2, flat(look.band, 0.5));
  plane(2.2, 0.4, METRO_LENGTH - 0.18, 2.4, 0.2, lit(signTex('No entry', '#c8102e', '#ffffff'), 0.1), -Math.PI / 2);

  // ---- platform fittings ---------------------------------------------------------------------------------------
  // Strip lights down the platform, under the crown.
  for (let x = PLATFORM_X0 + 2; x < PLATFORM_X1; x += 4) box(1.6, 0.05, 0.14, x, 2.3 + R - 0.06, -1.2, flat('#ffffff', 0.4, 0, 0xf4f8ff, 0.8));
  // The departure board, hung from the crown: redrawn when what it says changes (once a second at most).
  const boardLines = (): string[] => {
    const st = trainAt(metroVisit());
    const when = boardWhen(st);
    const first = `1 ${eastOf(id)}`.padEnd(18) + when;
    if (st.phase === 'in' || st.phase === 'opening' || st.phase === 'closing') return [first, 'Stand clear of the doors'];
    const after = Math.ceil((st.eta + HEADWAY) / 60);
    return [first, `2 ${eastOf(id)}`.padEnd(18) + `${after} min`];
  };
  const boardZ = -1.0;
  let shown = boardLines();
  let boardMap = boardTexture(shown);
  const boardMat = new THREE.MeshStandardMaterial({ map: boardMap, emissive: 0xffffff, emissiveMap: boardMap, emissiveIntensity: 0.9 });
  box(2.7, 0.62, 0.16, 34.8, 2.95, boardZ, flat('#15171b', 0.5, 0.3));
  plane(2.55, 0.5, 34.8, 2.95, boardZ + 0.09, boardMat);
  for (const dx of [-1.1, 1.1]) box(0.03, 2.3 + R - 3.26, 0.03, 34.8 + dx, (2.3 + R + 3.26) / 2, boardZ, flat('#2a2c30', 0.5, 0.5));

  // ---- the train -----------------------------------------------------------------------------------------------
  // Always built, drawn only while it's at or near the platform; moved and its doors worked from the timetable
  // (travel/metro.ts trainAt) each frame, so what you see is what boarding checks.
  const leaves: THREE.Mesh[] = [];
  const train = buildTrain(trackZ, PIT_Y, box, plane, flat, lib, leaves);
  group.add(train);
  const place = (): void => {
    const st = trainAt(metroVisit());
    train.visible = st.x !== null;
    train.position.x = st.x ?? 0;
    for (const l of leaves) {
      const shut = 1 - st.doors;
      l.visible = shut > 0.001;
      l.position.x = l.userData.openX + (l.userData.shutX - l.userData.openX) * shut;
    }
  };
  place();

  // Merge the plain parts that share a parent and a material (the station's tiles, ribs and fittings; each car's
  // body pieces in the train's group, so the train still moves as one): the station was a few hundred separate
  // draws. The door leaves stay apart, as they slide.
  for (const l of leaves) l.traverse((o) => (o.userData.keep = true));
  const parts = new Set<THREE.Mesh>();
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.keep && o.parent && !o.parent.userData.keep) parts.add(o as THREE.Mesh);
  });
  mergeParts(parts);

  // ---- behaviour ----------------------------------------------------------------------------------------------
  let since = 0;
  return {
    group,
    update(dt: number): void {
      place();
      since += dt;
      if (since < 0.5) return;
      since = 0;
      const lines = boardLines();
      if (lines.join('|') === shown.join('|')) return;
      shown = lines;
      boardMap.dispose();
      boardMap = boardTexture(lines);
      boardMat.map = boardMap;
      boardMat.emissiveMap = boardMap;
      boardMat.needsUpdate = true;
    },
  };
}

/** Where the trains from here are heading (they run east, the length of the line). */
function eastOf(id: StationId): string {
  const i = STATIONS.findIndex((s) => s.id === id);
  return i === STATIONS.length - 1 ? STATIONS[0].name : STATIONS[STATIONS.length - 1].name;
}

type Box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent?: THREE.Object3D, cast?: boolean) => THREE.Mesh;
type Plane = (w: number, h: number, x: number, y: number, z: number, m: THREE.Material, ry?: number, rx?: number, parent?: THREE.Object3D) => THREE.Mesh;
type Flat = (colour: string, rough?: number, metal?: number, emissive?: number, ei?: number) => THREE.MeshStandardMaterial;
type Lib = (name: Parameters<typeof surface>[0], w: number, h: number, tint?: string, rough?: number) => THREE.MeshStandardMaterial;

/**
 * The train: three cars coupled into one unit, built as a vehicle rather than a stack of boxes.
 *
 * - Each car's side is one panel with its door openings and windows cut out of it (a shape with holes), so the
 *   body reads as one skin: silver, a blue skirt band, red doors, a roof that rounds over from the cantrail.
 * - Doors are pairs of leaves that slide inside the body. Open, they're tucked behind the panel either side of the
 *   opening; shut, they fill it. `leaves` carries each one's open and shut x for the station's animation.
 * - Underneath: two bogies a car (frame, springs, wheels on the rails) and the underframe boxes between them.
 * - Between cars a dark gangway bellows; at both ends a cab: red front, windscreen, destination blind, head and
 *   tail lights.
 * - Inside, seen through the doors and windows: floor, lengthwise moquette seats along the far side, yellow
 *   poles and grab rails, the far windows (black tunnel), and a lit ceiling.
 */
function buildTrain(trackZ: number, pitY: number, box: Box, plane: Plane, flat: Flat, _lib: Lib, leaves: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const floorY = 0.06; // just above the platform: level boarding
  const sill = pitY + 0.62; // bottom of the body side
  const eave = 2.3; // where the side meets the roof
  const crown = 2.78;
  const W = 2.6;
  const nearZ = trackZ + W / 2;
  const farZ = trackZ - W / 2;
  const doorW = 1.5;
  const doorH = 1.95;
  const silver = flat('#c9cdd2', 0.32, 0.45);
  const roofMat = flat('#9ea3a9', 0.55, 0.35);
  const red = flat('#c8102e', 0.42, 0.15);
  const blue = flat('#0f2b6b', 0.45, 0.1);
  const black = flat('#111317', 0.7, 0.2);
  const glass = new THREE.MeshStandardMaterial({ color: '#1b2026', roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.38 });
  const ceiling = flat('#f4f1e8', 0.6, 0, 0xfff6e2, 0.9);
  const wallIn = flat('#c9c4b8', 0.75, 0, 0xfff1d8, 0.1);
  const floorIn = flat('#4d5157', 0.9);
  const seat = flat('#24418f', 0.95);
  const seatFrame = flat('#7d828a', 0.4, 0.6);
  const pole = flat('#f2c200', 0.35, 0.5);
  const tunnel = flat('#050608', 1);
  const tunnelGlass = flat('#0a0c10', 0.1, 0.4);

  const cars = TRAIN_CARS;
  for (const [x0, x1] of cars) {
    const L = x1 - x0;
    const cx = (x0 + x1) / 2;
    const doors = TRAIN_DOORS.filter((d) => d > x0 && d < x1);
    // ---- the near side: one panel, door openings and windows cut out ----
    const shape = new THREE.Shape();
    shape.moveTo(-L / 2, sill);
    shape.lineTo(L / 2, sill);
    shape.lineTo(L / 2, eave);
    shape.lineTo(-L / 2, eave);
    shape.closePath();
    const hole = (a: number, b: number, y0: number, y1: number, r = 0.08) => {
      const h = new THREE.Path();
      h.moveTo(a + r, y0);
      h.lineTo(b - r, y0);
      h.quadraticCurveTo(b, y0, b, y0 + r);
      h.lineTo(b, y1 - r);
      h.quadraticCurveTo(b, y1, b - r, y1);
      h.lineTo(a + r, y1);
      h.quadraticCurveTo(a, y1, a, y1 - r);
      h.lineTo(a, y0 + r);
      h.quadraticCurveTo(a, y0, a + r, y0);
      shape.holes.push(h);
    };
    const winY0 = floorY + 0.85;
    const winY1 = eave - 0.28;
    const edges = [x0 + 0.35, ...doors.flatMap((d) => [d - doorW / 2 - 0.25, d + doorW / 2 + 0.25]), x1 - 0.35];
    const windows: [number, number][] = [];
    for (const d of doors) hole(d - doorW / 2 - cx, d + doorW / 2 - cx, floorY, floorY + doorH, 0.04);
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i];
      const b = edges[i + 1];
      if (b - a < 0.6) continue;
      // Long bays get two windows with a pillar between.
      const n = b - a > 2.6 ? 2 : 1;
      const step = (b - a) / n;
      for (let k = 0; k < n; k++) {
        const wa = a + k * step + (k ? 0.08 : 0);
        const wb = a + (k + 1) * step - (k < n - 1 ? 0.08 : 0);
        hole(wa - cx, wb - cx, winY0, winY1);
        windows.push([wa, wb]);
      }
    }
    const side = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false, curveSegments: 3 }), silver);
    side.position.set(cx, 0, nearZ - 0.07);
    side.castShadow = true;
    g.add(side);
    // Glazing in the window holes, and the blue skirt band and a thin red line along the body.
    for (const [a, b] of windows) plane(b - a, winY1 - winY0, (a + b) / 2, (winY0 + winY1) / 2, nearZ - 0.04, glass, 0, 0, g);
    box(L, 0.16, 0.02, cx, sill + 0.12, nearZ + 0.005, blue, g);
    box(L, 0.04, 0.02, cx, eave - 0.1, nearZ + 0.005, red, g);
    // ---- roof: rounds over from the eave to the crown ----
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-W / 2, 0);
    roofShape.quadraticCurveTo(-W / 2, crown - eave, 0, crown - eave);
    roofShape.quadraticCurveTo(W / 2, crown - eave, W / 2, 0);
    roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: L, bevelEnabled: false, curveSegments: 10 }), roofMat);
    roof.rotation.y = Math.PI / 2;
    roof.position.set(x0, eave, trackZ);
    g.add(roof);
    // ---- the far side, ends, underframe ----
    box(L, eave - sill, 0.06, cx, (eave + sill) / 2, farZ + 0.03, silver, g);
    for (const ex of [x0 + 0.03, x1 - 0.03]) box(0.06, eave - sill, W, ex, (eave + sill) / 2, trackZ, silver, g);
    box(L - 0.6, 0.32, W - 0.5, cx, sill - 0.16, trackZ, black, g);
    for (const bx of [x0 + 2.1, x1 - 2.1]) {
      box(2.4, 0.22, W - 0.7, bx, pitY + 0.42, trackZ, black, g);
      for (const wx of [-0.75, 0.75]) {
        for (const wz of [-0.72, 0.72]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 18), flat('#2b2c2f', 0.5, 0.7));
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(bx + wx, pitY + 0.55, trackZ + wz);
          g.add(wheel);
        }
      }
      for (const sx of [-0.45, 0.45]) box(0.14, 0.3, 0.14, bx + sx, pitY + 0.68, trackZ + 0.85, flat('#585b60', 0.5, 0.6), g);
    }
    // ---- inside ----
    box(L - 0.12, 0.05, W - 0.14, cx, floorY - 0.025, trackZ, floorIn, g);
    box(L - 0.12, 0.04, W - 0.14, cx, eave - 0.02, trackZ, ceiling, g);
    box(L - 0.12, eave - floorY, 0.03, cx, (eave + floorY) / 2, farZ + 0.08, wallIn, g);
    // The far windows look out on the tunnel wall.
    for (const [a, b] of windows) plane(b - a, winY1 - winY0, (a + b) / 2, (winY0 + winY1) / 2, farZ + 0.1, tunnel, 0, 0, g);
    // Seats run along the far side between the doorways.
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i] + 0.1;
      const b = edges[i + 1] - 0.1;
      if (b - a < 0.5) continue;
      box(b - a, 0.1, 0.5, (a + b) / 2, floorY + 0.45, farZ + 0.38, seat, g);
      box(b - a, 0.55, 0.1, (a + b) / 2, floorY + 0.78, farZ + 0.16, seat, g);
      box(b - a, 0.4, 0.04, (a + b) / 2, floorY + 0.2, farZ + 0.6, seatFrame, g);
    }
    // A grab rail the length of the car, and poles at every doorway.
    box(L - 0.4, 0.035, 0.035, cx, eave - 0.32, trackZ + 0.35, pole, g);
    for (const d of doors) {
      for (const s of [-1, 1]) box(0.04, eave - floorY, 0.04, d + s * 0.55, (eave + floorY) / 2, trackZ + 0.3, pole, g);
      // The doors: two leaves sliding inside the body.
      for (const s of [-1, 1]) {
        const shutX = d + (s * doorW) / 4;
        const openX = d + s * (doorW / 4 + doorW / 2 + 0.04);
        const leaf = box(doorW / 2 - 0.02, doorH - 0.02, 0.04, openX, floorY + doorH / 2, nearZ - 0.12, red, g);
        box(doorW / 2 - 0.26, 0.85, 0.01, 0, 0.32, 0.025, glass, leaf);
        box(0.02, doorH - 0.1, 0.012, (-s * (doorW / 2 - 0.02)) / 2, 0, 0.026, black, leaf);
        leaf.userData.openX = openX;
        leaf.userData.shutX = shutX;
        // Open, a leaf is tucked away inside the body: hidden, so it never shows red through the next window.
        leaf.visible = false;
        leaves.push(leaf);
      }
      // The doors on the far side, shut: seen through the open doorway instead of a blank wall.
      for (const s of [-1, 1]) {
        const far = box(doorW / 2 - 0.02, doorH - 0.02, 0.04, d + (s * doorW) / 4, floorY + doorH / 2, farZ + 0.12, red, g);
        box(doorW / 2 - 0.26, 0.85, 0.01, 0, 0.32, 0.025, tunnelGlass, far);
      }
      // Door surround: the red frame round the opening on the outside.
      box(doorW + 0.12, 0.06, 0.02, d, floorY + doorH + 0.03, nearZ + 0.01, red, g);
      for (const s of [-1, 1]) box(0.06, doorH, 0.02, d + s * (doorW / 2 + 0.03), floorY + doorH / 2, nearZ + 0.01, red, g);
    }
    // Car number by the first door.
    plane(0.5, 0.14, x0 + 1.0, floorY + 1.75, nearZ + 0.012, new THREE.MeshStandardMaterial({ map: carNumber(cars.findIndex((c) => c[0] === x0)), transparent: true }), 0, 0, g);
  }
  // Gangways between the cars.
  for (let i = 0; i < cars.length - 1; i++) {
    const gx = (cars[i][1] + cars[i + 1][0]) / 2;
    // Concertina rubber between the cars, set back from the sides so the body lines run on.
    const gw = cars[i + 1][0] - cars[i][1] + 0.1;
    box(gw, eave - floorY - 0.2, W - 0.7, gx, (eave + floorY) / 2, trackZ, flat('#2a2c30', 0.85), g);
    for (let k = 0; k < 4; k++) box(gw + 0.01, eave - floorY - 0.24, 0.02, gx, (eave + floorY) / 2, trackZ + W / 2 - 0.34 - k * 0.012, flat('#1a1b1e', 0.9), g);
  }
  // A cab at each end: the red front with a windscreen, the destination blind, and head and tail lights.
  for (const [ex, dir] of [[cars[0][0], -1], [cars[cars.length - 1][1], 1]] as const) {
    const fx = ex + dir * 0.2;
    box(0.4, crown - sill, W, fx, (crown + sill) / 2, trackZ, red, g, true);
    box(0.02, 0.75, W - 0.7, fx + dir * 0.21, 1.6, trackZ, flat('#0d1116', 0.08, 0.6), g);
    box(0.02, 0.18, 1.3, fx + dir * 0.21, 2.18, trackZ, flat('#0b0b0b', 0.5), g);
    plane(1.2, 0.15, fx + dir * 0.225, 2.18, trackZ, new THREE.MeshStandardMaterial({ map: boardTexture(['Brack Metro']), emissive: 0xffffff, emissiveMap: boardTexture(['Brack Metro']), emissiveIntensity: 0.8 }), (Math.PI / 2) * dir, 0, g);
    const lamp = dir > 0 ? flat('#ffffff', 0.3, 0, 0xfff6e0, 2) : flat('#ff3030', 0.3, 0, 0xff2020, 1.6);
    for (const dz of [-0.85, 0.85]) box(0.03, 0.12, 0.22, fx + dir * 0.21, 0.45, trackZ + dz, lamp, g);
    box(0.06, 0.2, W - 0.3, fx + dir * 0.18, sill + 0.05, trackZ, black, g);
  }
  return g;
}

/** The car's number, small, by its first door. */
function carNumber(i: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 72);
  g.clearRect(0, 0, 256, 72);
  g.fillStyle = '#20252c';
  g.font = `700 44px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText(`3${(4 + i * 7) % 10}${(i * 3 + 1) % 10}${i + 2}`, 8, 38);
  return tex(c);
}
