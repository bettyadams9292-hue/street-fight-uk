/**
 * A Brack Metro station (world/metroLevels.ts), built from the London Underground's look: one model, dressed per
 * station (its band colour, its name, its tile).
 *
 * - The stairs up to the street at the left, tiled, with a yellow WAY OUT sign over them.
 * - The ticket hall: granite floor, cream tiles with the station's band, ticket machines, the line map, a help
 *   point, and the gate line: stainless cabinets with readers on top and paddles that open once you're through.
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
import { STATION_LOOK, GATE_X, PLATFORM_X0, PLATFORM_X1, STAIRS_X, TRAIN_DOORS, METRO_LENGTH } from '../world/metroLevels';
import { STATIONS, stationOf, type StationId } from '../travel/subway';
import { metroVisit } from '../travel/metro';

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
  g.fillText(t, 40, 84);
  return tex(c);
}

/** The departure board: orange dot-matrix lettering on black. */
function boardTexture(lines: string[]): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#060606';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#ffa31a';
  g.font = `700 64px 'Courier New', monospace`;
  g.textBaseline = 'middle';
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
  const visit = metroVisit();
  const trainIn = !!visit?.train && visit.station === id;

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
  const tile = look.tile;

  // ---- floors -------------------------------------------------------------------------------------------------
  // Ticket hall and passage: granite.
  plane(PLATFORM_X0 - 0.1, front - back, (PLATFORM_X0 - 0.1) / 2, 0.001, (front + back) / 2, lib('Tiles050', PLATFORM_X0, front - back, '#8f8a80'), 0, -Math.PI / 2);
  // Platform: sealed concrete, to the edge.
  plane(METRO_LENGTH - PLATFORM_X0 + 0.1, front - EDGE_Z, (PLATFORM_X0 + METRO_LENGTH) / 2, 0.001, (front + EDGE_Z) / 2, lib('Concrete042A', METRO_LENGTH - PLATFORM_X0, front - EDGE_Z, '#77756f'), 0, -Math.PI / 2);
  // Edge coping (pale), the yellow line, and MIND THE GAP between them.
  const coping = flat('#d9d4c6', 0.7);
  box(PLATFORM_X1 - PLATFORM_X0, 0.06, 0.32, (PLATFORM_X0 + PLATFORM_X1) / 2, 0.0, EDGE_Z + 0.16, coping);
  box(PLATFORM_X1 - PLATFORM_X0, 0.01, 0.09, (PLATFORM_X0 + PLATFORM_X1) / 2, 0.034, EDGE_Z + 0.46, flat('#f2c200', 0.5));
  const gap = new THREE.MeshStandardMaterial({ map: gapTexture(), transparent: true, roughness: 0.6 });
  for (let x = PLATFORM_X0 + 4; x < PLATFORM_X1 - 2; x += 9) plane(2.2, 0.28, x, 0.036, EDGE_Z + 0.27, gap, 0, -Math.PI / 2);

  // ---- the track ----------------------------------------------------------------------------------------------
  const pitX0 = PLATFORM_X0 - 2;
  const pitX1 = METRO_LENGTH + 2;
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
  for (const [x, dir] of [[PLATFORM_X0 - 1.6, 1], [PLATFORM_X1 + 1.4, -1]] as const) {
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
  // The gate line: cabinets across the hall, readers on top, paddles between.
  const paddles: THREE.Mesh[] = [];
  // Brushed stainless: a flat light grey reads truer than the metal set with nothing to reflect down here.
  const cab = flat('#b4b9c0', 0.35, 0.25);
  const zs = [-1.75, -0.95, -0.15, 0.65, 1.45];
  for (const z of zs) {
    box(1.25, 1.0, 0.22, GATE_X, 0.5, z, cab, group, true);
    box(0.24, 0.04, 0.16, GATE_X - 0.4, 1.02, z, flat('#f2c200', 0.4, 0, 0xffd400, 0.4));
    box(1.25, 0.06, 0.22, GATE_X, 1.03, z, flat('#1d2230', 0.5));
  }
  for (let i = 0; i < zs.length - 1; i++) {
    const zc = (zs[i] + zs[i + 1]) / 2;
    for (const s of [-1, 1]) {
      const p = box(0.04, 0.62, 0.3, GATE_X + 0.1, 0.72, zc + s * 0.18, new THREE.MeshStandardMaterial({ color: 0xc4202b, roughness: 0.3, transparent: true, opacity: 0.85 }));
      p.userData.closedZ = zc + s * 0.18;
      p.userData.side = s;
      paddles.push(p);
    }
  }
  plane(3.0, 0.42, GATE_X, 2.95, -2.0 + 0.4, lit(signTex('Way out', '#f2c200', '#111111', '←'), 0.08), 0);
  plane(3.0, 0.42, GATE_X + 3.1, 2.95, -2.0 + 0.4, lit(signTex(`Trains  →  ${eastOf(id)}`, '#1d2230', '#ffffff'), 0.1), 0);
  // The passage to the platform: the hall wall ends in a tiled pier.
  box(0.5, HALL_CEIL, 0.6, PLATFORM_X0 - 1.2, HALL_CEIL / 2, back + 0.1, hallTile);
  box(0.5, VAULT_TOP + 0.4, front - back, PLATFORM_X0 - 1.2, VAULT_TOP + 0.2 + HALL_CEIL / 2 - 1.7, (front + back) / 2 - 0.2, flat('#cfcac0', 0.9));

  // ---- platform fittings ---------------------------------------------------------------------------------------
  // Strip lights down the platform, under the crown.
  for (let x = PLATFORM_X0 + 2; x < PLATFORM_X1; x += 4) box(1.6, 0.05, 0.14, x, 2.3 + R - 0.06, -1.2, flat('#ffffff', 0.4, 0, 0xf4f8ff, 0.8));
  // The departure board, hung from the crown.
  const lines = trainIn
    ? [`1 ${eastOf(id)}`.padEnd(18) + 'Now', 'Stand clear of the doors']
    : [`1 ${eastOf(id)}`.padEnd(18) + `${visit?.minutes ?? 4} min`, `2 ${westOf(id)}`.padEnd(18) + `${(visit?.minutes ?? 4) + 5} min`];
  const boardZ = -1.0;
  box(2.7, 0.62, 0.16, 34.8, 2.95, boardZ, flat('#15171b', 0.5, 0.3));
  plane(2.55, 0.5, 34.8, 2.95, boardZ + 0.09, new THREE.MeshStandardMaterial({ map: boardTexture(lines), emissive: 0xffffff, emissiveMap: boardTexture(lines), emissiveIntensity: 0.9 }));
  for (const dx of [-1.1, 1.1]) box(0.03, 2.3 + R - 3.26, 0.03, 34.8 + dx, (2.3 + R + 3.26) / 2, boardZ, flat('#2a2c30', 0.5, 0.5));

  // ---- the train -----------------------------------------------------------------------------------------------
  let train: THREE.Group | null = null;
  const leaves: THREE.Mesh[] = [];
  if (trainIn) {
    train = buildTrain(trackZ, PIT_Y, box, plane, flat, lib, leaves);
    group.add(train);
  }

  // ---- behaviour ----------------------------------------------------------------------------------------------
  let t = 0;
  let speed = 0;
  return {
    group,
    update(dt: number): void {
      t += dt;
      const v = metroVisit();
      // The gates open once you're through.
      const open = !!v?.through;
      for (const p of paddles) {
        const want = open ? p.userData.closedZ + p.userData.side * 0.16 : p.userData.closedZ;
        p.position.z += (want - p.position.z) * Math.min(1, dt * 8);
      }
      if (!train) return;
      // Off a train: the doors close after a few seconds and it pulls out east into the tunnel.
      if (v?.arrived) {
        const shut = Math.min(1, Math.max(0, (t - 3.5) / 0.8));
        for (const l of leaves) l.position.x = l.userData.openX + (l.userData.shutX - l.userData.openX) * shut;
        if (t > 4.6) {
          speed = Math.min(14, speed + dt * 2.4);
          train.position.x += speed * dt;
          if (train.position.x > 60) {
            group.remove(train);
            train = null;
            if (v) v.train = false;
          }
        }
      }
    },
  };
}

/** Where the trains from here are heading, east and west (the ends of the line). */
function eastOf(id: StationId): string {
  const i = STATIONS.findIndex((s) => s.id === id);
  return i === STATIONS.length - 1 ? STATIONS[0].name : STATIONS[STATIONS.length - 1].name;
}
function westOf(id: StationId): string {
  const i = STATIONS.findIndex((s) => s.id === id);
  return i === 0 ? STATIONS[STATIONS.length - 1].name : STATIONS[0].name;
}

type Box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent?: THREE.Object3D, cast?: boolean) => THREE.Mesh;
type Plane = (w: number, h: number, x: number, y: number, z: number, m: THREE.Material, ry?: number, rx?: number, parent?: THREE.Object3D) => THREE.Mesh;
type Flat = (colour: string, rough?: number, metal?: number, emissive?: number, ei?: number) => THREE.MeshStandardMaterial;
type Lib = (name: Parameters<typeof surface>[0], w: number, h: number, tint?: string, rough?: number) => THREE.MeshStandardMaterial;

/**
 * Three tube cars along the platform, doors at `TRAIN_DOORS`, open: silver bodies with a rounded roof, red doors
 * slid back, windows lit, and inside, seats in moquette and yellow poles. The cab's at the east end.
 */
function buildTrain(trackZ: number, pitY: number, box: Box, plane: Plane, flat: Flat, _lib: Lib, leaves: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const floorY = 0.05;
  const bodyBottom = pitY + 0.55;
  const roof = 2.55;
  const W = 2.5;
  const nearZ = trackZ + W / 2;
  const silver = flat('#c3c7cc', 0.35, 0.35);
  const red = flat('#c8102e', 0.45, 0.2);
  const glass = flat('#3a4048', 0.08, 0.3, 0xfff1d2, 0.55);
  const inside = flat('#e8e2d2', 0.7, 0, 0xfff1d0, 0.55);
  const seat = flat('#2a3f8a', 0.95);
  const pole = flat('#f2c200', 0.4, 0.5);
  const cars: [number, number][] = [[21.4, 32.4], [32.9, 43.9], [44.4, 55.6]];
  for (const [x0, x1] of cars) {
    const L = x1 - x0;
    const cx = (x0 + x1) / 2;
    const doors = TRAIN_DOORS.filter((d) => d > x0 && d < x1);
    // The body below and above the doors, the far side, the floor and the roof.
    box(L, floorY - bodyBottom, W, cx, (floorY + bodyBottom) / 2, trackZ, silver, g, true);
    box(L, 0.05, W - 0.1, cx, floorY, trackZ, flat('#5b5f66', 0.9), g);
    box(L, roof - floorY, 0.06, cx, (roof + floorY) / 2, trackZ - W / 2 + 0.03, silver, g);
    box(L, roof - floorY, 0.04, cx, (roof + floorY) / 2, trackZ - W / 2 + 0.1, inside, g);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, L, 24, 1, false, -Math.PI / 2, Math.PI), silver);
    top.rotation.z = Math.PI / 2;
    top.scale.set(1, 1, 0.34);
    top.position.set(cx, roof, trackZ);
    g.add(top);
    // The near side: panels between the doors with a lit window in each, and the door openings.
    const edges = [x0, ...doors.flatMap((d) => [d - 0.75, d + 0.75]), x1];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i];
      const b = edges[i + 1];
      if (b - a < 0.05) continue;
      const m = (a + b) / 2;
      box(b - a, 0.85, 0.06, m, floorY + 0.42, nearZ, silver, g);
      box(b - a, 0.42, 0.06, m, roof - 0.2, nearZ, silver, g);
      if (b - a > 0.5) {
        box(b - a - 0.3, roof - floorY - 1.27, 0.03, m, floorY + 0.85 + (roof - floorY - 1.27) / 2, nearZ + 0.02, glass, g);
        // Inside behind the window: a long seat and the lit wall.
        box(b - a - 0.2, 0.45, 0.5, m, floorY + 0.25, trackZ - W / 2 + 0.42, seat, g);
        box(b - a - 0.2, 0.5, 0.12, m, floorY + 0.72, trackZ - W / 2 + 0.2, seat, g);
      }
    }
    for (const d of doors) {
      // The opening: lit inside, a pole either side, the door leaves slid back over the body.
      box(1.5, roof - floorY - 0.35, 0.02, d, floorY + (roof - floorY - 0.35) / 2, trackZ - W / 2 + 0.15, inside, g);
      for (const s of [-1, 1]) box(0.05, roof - floorY - 0.3, 0.05, d + s * 0.55, floorY + (roof - floorY - 0.3) / 2, trackZ + 0.2, pole, g);
      for (const s of [-1, 1]) {
        const leaf = box(0.72, roof - floorY - 0.42, 0.05, d + s * 1.12, floorY + (roof - floorY - 0.42) / 2, nearZ + 0.05, red, g);
        box(0.36, 0.7, 0.02, 0, 0.35, 0.03, glass, leaf);
        leaf.userData.openX = d + s * 1.12;
        leaf.userData.shutX = d + s * 0.37;
        leaves.push(leaf);
      }
      box(1.6, 0.06, 0.08, d, roof - 0.42, nearZ + 0.04, red, g);
    }
    // The red band along the bottom and the car number.
    box(L, 0.18, 0.07, cx, floorY - 0.12, nearZ + 0.01, red, g);
  }
  // The cab at the east end: red front, windscreen, lights and the destination.
  const ex = 55.6;
  box(0.4, roof - bodyBottom + 0.2, W, ex + 0.2, (roof + bodyBottom) / 2, trackZ, red, g, true);
  box(0.05, 0.7, W - 0.6, ex + 0.42, 1.65, trackZ, flat('#101418', 0.1, 0.6), g);
  for (const dz of [-0.8, 0.8]) box(0.05, 0.12, 0.2, ex + 0.42, 0.3, trackZ + dz, flat('#ffffff', 0.3, 0, 0xfff6e0, 2), g);
  plane(1.3, 0.22, ex + 0.43, 2.25, trackZ, new THREE.MeshStandardMaterial({ map: boardTexture(['Brack Metro']), emissive: 0xffffff, emissiveMap: boardTexture(['Brack Metro']), emissiveIntensity: 0.8 }), Math.PI / 2, 0, g);
  return g;
}
