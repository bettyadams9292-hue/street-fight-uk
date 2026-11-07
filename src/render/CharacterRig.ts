import * as THREE from 'three';
import type { CharacterAppearance, TattooSlot } from '../character/Appearance';
import type { JointName } from './poses';
import { paintedSkinMaterial } from './skinPainter';

/**
 * Builds a fighter model from CharacterAppearance (TEMPORARY procedural
 * model: replaced by skinned Blender GLB characters, which will read the same
 * appearance data). Joint names and axes match poses.ts.
 */
export interface Rig {
  /** Holds the whole body; scaled for height. */
  root: THREE.Group;
  /** Rotated around the feet for knockdowns. */
  pitch: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  /** Materials that flash white when hit. */
  flashMaterials: THREE.MeshStandardMaterial[];
  dispose(): void;
}

const GREY = new THREE.Color('#bdb9b2');

function mixHair(a: CharacterAppearance): THREE.Color {
  return new THREE.Color(a.hairColour).lerp(GREY, a.greying);
}

function darken(hex: string, amount: number): string {
  return '#' + new THREE.Color(hex).multiplyScalar(1 - amount).getHexString();
}

export function buildCharacterRig(a: CharacterAppearance): Rig {
  const disposables: { dispose(): void }[] = [];
  const flashMaterials: THREE.MeshStandardMaterial[] = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const std = (params: THREE.MeshStandardMaterialParameters) => {
    const m = track(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...params }));
    flashMaterials.push(m);
    return m;
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
    track(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    return m;
  };
  const capsule = (r: number, len: number, mat: THREE.Material, y: number) => {
    const m = mesh(new THREE.CapsuleGeometry(r, len, 4, 12), mat);
    m.position.y = y;
    return m;
  };

  const female = a.body === 'female';
  const mu = a.muscle;
  const wt = a.weight;
  const tone = a.skinTone;
  const ink = a.inkColour;
  const hairCol = mixHair(a);
  const hairHex = '#' + hairCol.getHexString();

  // ---- materials -----------------------------------------------------------------
  const skin = (slot?: TattooSlot, extra?: Parameters<typeof paintedSkinMaterial>[0]) => {
    const design = slot ? a.tattoos[slot] : 'none';
    const m = track(
      paintedSkinMaterial(
        extra ?? {
          tone,
          tattoo: design,
          ink,
          tattooAt: slot === 'chest' ? [0, 0.5] : slot === 'neck' ? [0, 0.5] : [0.25, 0.75],
        },
      ),
    );
    flashMaterials.push(m);
    return m;
  };
  const plainSkin = skin();
  const topRough = a.top === 'bomber' ? 0.45 : a.top === 'tracksuit' ? 0.55 : 0.9;
  const topMat = std({ color: a.topColour, roughness: topRough });
  const bottomsMat = std({ color: a.bottomsColour, roughness: a.bottoms === 'jeans' ? 0.95 : 0.85 });
  const shoeMat = std({ color: a.shoesColour, roughness: 0.6 });
  const soleMat = std({ color: a.shoes === 'boots' ? '#151515' : '#efefea', roughness: 0.7 });
  const hairMat = std({ color: hairCol, roughness: 0.9 });
  const wrapsMat = std({ color: '#e2ddd2', roughness: 0.85 });
  const darkMat = std({ color: '#101012', roughness: 0.4 });
  const lipMat = std({ color: darken(tone, 0.25), roughness: 0.5 });
  const metal = std({ color: a.chainColour === 'gold' ? '#d4af37' : '#c9ccd2', roughness: 0.25, metalness: 0.9 });

  const sleevesLong = a.top === 'hoodie' || a.top === 'tracksuit' || a.top === 'bomber';
  const sleevesShort = a.top === 'tshirt';
  const armScarL = a.armScar === 'left' || a.armScar === 'both';
  const armScarR = a.armScar === 'right' || a.armScar === 'both';
  const scarred = (slot: TattooSlot, scar: boolean) =>
    skin(slot, {
      tone,
      tattoo: a.tattoos[slot],
      ink,
      tattooAt: [0.25, 0.75],
      scars: scar ? [{ u: 0.25, v: 0.45, length: 0.18, angle: 0.5 }, { u: 0.75, v: 0.45, length: 0.18, angle: -0.5 }] : undefined,
    });

  const torsoMat = a.top === 'none' ? skin('chest') : topMat;
  const upperArmMat = (slot: TattooSlot) => (sleevesLong || sleevesShort ? topMat : skin(slot));
  const forearmMat = (slot: TattooSlot, scar: boolean) => (sleevesLong ? topMat : scarred(slot, scar));
  const thighMat = bottomsMat;
  const shinMat = a.bottoms === 'shorts' ? plainSkin : bottomsMat;

  // ---- proportions -----------------------------------------------------------------
  const shoulderX = female ? 0.175 : 0.2;
  const hipX = female ? 0.108 : 0.1;
  const armR = 0.052 * (1 + 0.35 * mu + 0.25 * wt) * (female ? 0.9 : 1);
  const foreR = 0.046 * (1 + 0.3 * mu + 0.2 * wt) * (female ? 0.9 : 1);
  const thighR = 0.072 * (1 + 0.25 * mu + 0.3 * wt) * (female ? 1.04 : 1);
  const shinR = 0.06 * (1 + 0.2 * mu + 0.2 * wt);
  const torsoSX = (female ? 1.0 : 1.12) * (1 + 0.15 * mu + 0.22 * wt);
  const torsoSZ = (female ? 0.8 : 0.78) * (1 + 0.08 * mu + 0.35 * wt);

  const root = new THREE.Group();
  root.scale.setScalar(a.height);
  const pitch = new THREE.Group();
  root.add(pitch);

  // ---- hips and torso ---------------------------------------------------------
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  pitch.add(hips);
  const pelvis = mesh(new THREE.BoxGeometry((female ? 0.34 : 0.31) * (1 + 0.2 * wt), 0.2, 0.2 * (1 + 0.3 * wt)), bottomsMat);
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.08;
  hips.add(spine);
  const torso = capsule(0.16, 0.3, torsoMat, 0.25);
  torso.scale.set(torsoSX, 1, torsoSZ);
  spine.add(torso);
  if (female) {
    const chest = mesh(new THREE.SphereGeometry(0.11, 14, 10), torsoMat);
    chest.scale.set(1.45 * (1 + 0.1 * wt), 0.6, 0.55);
    chest.position.set(0, 0.36, 0.08 * torsoSZ / 0.8);
    spine.add(chest);
  }

  // Clothing details on the torso.
  if (a.top === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16, Math.PI), topMat);
    hood.rotation.set(-0.3, 0, Math.PI);
    hood.position.set(0, 0.55, -0.06);
    spine.add(hood);
    const pocket = mesh(new THREE.BoxGeometry(0.2 * torsoSX, 0.08, 0.02), std({ color: darken(a.topColour, 0.15), roughness: 0.9 }), false);
    pocket.position.set(0, 0.12, 0.15 * torsoSZ / 0.78);
    spine.add(pocket);
  }
  if (a.top === 'tracksuit' || a.top === 'bomber') {
    const collar = mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 16), a.top === 'bomber' ? darkMat : topMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.54;
    spine.add(collar);
    const zip = mesh(new THREE.BoxGeometry(0.012, 0.42, 0.01), a.top === 'bomber' ? metal : soleMat, false);
    zip.position.set(0, 0.3, 0.155 * torsoSZ / 0.78 + 0.01);
    spine.add(zip);
  }
  if (a.top === 'vest') {
    // Straps over the shoulders.
    for (const side of [1, -1]) {
      const strap = mesh(new THREE.BoxGeometry(0.05, 0.06, 0.2 * torsoSZ / 0.78), topMat, false);
      strap.position.set(0.1 * side, 0.52, 0);
      spine.add(strap);
    }
  }

  // ---- head -----------------------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = 0.55;
  spine.add(head);
  const neckR = 0.05 * (1 + 0.4 * mu + 0.2 * wt) * (female ? 0.85 : 1);
  head.add(capsule(neckR, 0.05, skin('neck'), 0.02));
  buildHead(head, a, { std, mesh, skin: (p) => { const m = track(paintedSkinMaterial(p)); flashMaterials.push(m); return m; }, hairMat, lipMat, darkMat, metal, topMat, hairHex });

  // ---- arms --------------------------------------------------------------------------
  const makeArm = (side: 1 | -1) => {
    const left = side === 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(shoulderX * side * (1 + 0.12 * wt), 0.44, 0);
    spine.add(shoulder);
    shoulder.add(capsule(armR, 0.17, upperArmMat(left ? 'leftUpperArm' : 'rightUpperArm'), -0.13));
    if (a.top === 'tracksuit') {
      const stripe = mesh(new THREE.BoxGeometry(0.008, 0.24, 0.008), soleMat, false);
      stripe.position.set(armR * 0.92 * side, -0.13, 0);
      shoulder.add(stripe);
    }
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);
    elbow.add(capsule(foreR, 0.16, forearmMat(left ? 'leftForearm' : 'rightForearm', left ? armScarL : armScarR), -0.12));
    if (a.top === 'tracksuit') {
      const stripe = mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), soleMat, false);
      stripe.position.set(foreR * 0.92 * side, -0.12, 0);
      elbow.add(stripe);
    }
    const wrapped = a.accessories.includes('wraps');
    const fist = mesh(new THREE.SphereGeometry(0.047 * (1 + 0.15 * mu), 12, 10), wrapped ? wrapsMat : plainSkin);
    fist.scale.set(0.85, 1.15, 1.05);
    fist.position.y = -0.28;
    elbow.add(fist);
    if (left && a.accessories.includes('watch')) {
      const watch = mesh(new THREE.BoxGeometry(foreR * 2.3, 0.03, foreR * 2.3), darkMat, false);
      watch.position.y = -0.2;
      const face = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 12), metal, false);
      face.position.set(foreR * 1.1, -0.2, 0);
      face.rotation.z = Math.PI / 2;
      elbow.add(watch, face);
    }
    return { shoulder, elbow };
  };

  // ---- legs ---------------------------------------------------------------------------
  const makeLeg = (side: 1 | -1) => {
    const hip = new THREE.Group();
    hip.position.set(hipX * side * (1 + 0.15 * wt), -0.06, 0);
    hips.add(hip);
    const thigh = capsule(thighR * (a.bottoms === 'shorts' ? 1.12 : 1), 0.27, thighMat, -0.21);
    hip.add(thigh);
    if (a.bottoms === 'trackies') {
      const stripe = mesh(new THREE.BoxGeometry(0.008, 0.34, 0.008), soleMat, false);
      stripe.position.set(thighR * 0.92 * side, -0.21, 0);
      hip.add(stripe);
    }
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(capsule(shinR, 0.26, shinMat, -0.2));
    buildShoe(knee, a, mesh, shoeMat, soleMat);
    return { hip, knee };
  };

  const lArm = makeArm(1);
  const rArm = makeArm(-1);
  const lLeg = makeLeg(1);
  const rLeg = makeLeg(-1);

  return {
    root,
    pitch,
    flashMaterials,
    joints: {
      hips,
      spine,
      head,
      lShoulder: lArm.shoulder,
      lElbow: lArm.elbow,
      rShoulder: rArm.shoulder,
      rElbow: rArm.elbow,
      lHip: lLeg.hip,
      lKnee: lLeg.knee,
      rHip: rLeg.hip,
      rKnee: rLeg.knee,
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

type MeshFn = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow?: boolean) => THREE.Mesh;

function buildShoe(knee: THREE.Group, a: CharacterAppearance, mesh: MeshFn, shoeMat: THREE.Material, soleMat: THREE.Material): void {
  const boots = a.shoes === 'boots';
  const upper = mesh(new THREE.BoxGeometry(0.1, boots ? 0.1 : 0.07, 0.24), shoeMat);
  upper.position.set(0, boots ? -0.395 : -0.405, 0.06);
  knee.add(upper);
  const sole = mesh(new THREE.BoxGeometry(0.105, 0.025, 0.25), soleMat);
  sole.position.set(0, -0.44, 0.06);
  knee.add(sole);
  if (a.shoes !== 'trainers') {
    const collar = mesh(new THREE.CylinderGeometry(0.066, 0.07, boots ? 0.14 : 0.1, 12), shoeMat);
    collar.position.set(0, boots ? -0.34 : -0.36, 0);
    knee.add(collar);
  }
}

interface HeadKit {
  std: (p: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  mesh: MeshFn;
  skin: (p: Parameters<typeof paintedSkinMaterial>[0]) => THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  lipMat: THREE.MeshStandardMaterial;
  darkMat: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  topMat: THREE.MeshStandardMaterial;
  hairHex: string;
}

function buildHead(head: THREE.Group, a: CharacterAppearance, k: HeadKit): void {
  const f = a.face;
  const female = a.body === 'female';
  const cy = 0.13; // skull centre above the neck joint
  const hw = 1 + 0.1 * f.headWidth;

  // Skull with face scars painted on (u 0.25 = front).
  const faceScars: { u: number; v: number; length: number; angle: number }[] = [];
  if (a.faceScar === 'brow') faceScars.push({ u: 0.21, v: 0.4, length: 0.05, angle: 1.3 });
  if (a.faceScar === 'cheek') faceScars.push({ u: 0.3, v: 0.56, length: 0.07, angle: 0.9 });
  const stubble = a.facialHair === 'stubble' ? { colour: k.hairHex, fromV: 0.58, toV: 0.95, u: 0.25, width: 0.32 } : undefined;
  const skullMat = k.skin({ tone: a.skinTone, scars: faceScars, stubble });
  const skull = k.mesh(new THREE.SphereGeometry(0.11, 20, 14), skullMat);
  skull.scale.set(0.9 * hw, 1.08, 1);
  skull.position.y = cy;
  head.add(skull);

  // Jaw.
  const jawScars = a.faceScar === 'chin' ? [{ u: 0.27, v: 0.62, length: 0.05, angle: 0.2 }] : [];
  const jawStubble = a.facialHair === 'stubble' ? { colour: k.hairHex, fromV: 0.2, toV: 1, u: 0.25, width: 0.5 } : undefined;
  const jaw = k.mesh(new THREE.SphereGeometry(0.085, 16, 12), k.skin({ tone: a.skinTone, scars: jawScars, stubble: jawStubble }));
  const jawW = (female ? 0.92 : 1) * (1 + 0.22 * f.jaw);
  jaw.scale.set(jawW * hw, 0.72, 0.95);
  jaw.position.set(0, cy - 0.065, 0.015);
  head.add(jaw);

  // Brow, nose, eyes, mouth, ears.
  const browMat = k.skin({ tone: a.skinTone });
  const brow = k.mesh(new THREE.BoxGeometry(0.13 * hw, 0.014 * (1 + 0.5 * Math.max(0, f.brow)), 0.02 * (1 + 0.4 * f.brow)), browMat, false);
  brow.position.set(0, cy + 0.035, 0.083 + 0.004 * f.brow);
  head.add(brow);
  const brows = k.std({ color: new THREE.Color(k.hairHex).multiplyScalar(0.6), roughness: 0.9 });
  for (const s of [1, -1]) {
    const b = k.mesh(new THREE.BoxGeometry(0.034, 0.006, 0.006), brows, false);
    b.position.set(0.034 * s * (1 + 0.15 * f.eyeSpacing), cy + 0.042, 0.096 + 0.004 * f.brow);
    b.rotation.z = -0.15 * s;
    head.add(b);
  }
  const nose = k.mesh(new THREE.BoxGeometry(0.028 * (1 + 0.35 * f.nose), 0.045 * (1 + 0.25 * f.nose), 0.035 * (1 + 0.5 * f.nose)), browMat, false);
  nose.position.set(0, cy - 0.01, 0.1 + 0.008 * f.nose);
  head.add(nose);
  for (const s of [1, -1]) {
    const eye = k.mesh(new THREE.SphereGeometry(0.012, 8, 6), k.darkMat, false);
    eye.position.set(0.034 * s * (1 + 0.2 * f.eyeSpacing), cy + 0.015, 0.093);
    head.add(eye);
    const ear = k.mesh(new THREE.SphereGeometry(0.026 * (1 + 0.35 * f.ears), 10, 8), browMat, false);
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(0.1 * hw * s, cy, -0.005);
    head.add(ear);
    if (s === 1 && a.accessories.includes('earring')) {
      const ring = k.mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 12), k.metal, false);
      ring.position.set(0.103 * hw, cy - 0.03, 0);
      head.add(ring);
    }
  }
  const mouth = k.mesh(new THREE.BoxGeometry(0.045, 0.01, 0.01), k.lipMat, false);
  mouth.position.set(0, cy - 0.055, 0.092);
  head.add(mouth);

  buildFacialHair(head, a, k, cy, jawW * hw);
  if (a.accessories.includes('headguard')) buildHeadguard(head, k, cy);
  else buildHair(head, a, k, cy, hw);
  if (a.accessories.includes('cap') && !a.accessories.includes('headguard')) {
    const capMat = k.std({ color: darken(a.topColour, 0.1), roughness: 0.8 });
    const cap = k.mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    cap.scale.set(hw, 1, 1);
    cap.position.y = cy + 0.035;
    const brim = k.mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1), capMat);
    brim.position.set(0, cy + 0.04, 0.14);
    brim.rotation.x = 0.12;
    head.add(cap, brim);
  }
  if (a.accessories.includes('chain')) {
    const chain = k.mesh(new THREE.TorusGeometry(0.085, 0.006, 6, 24), k.metal, false);
    chain.rotation.x = Math.PI / 2 - 0.35;
    chain.position.set(0, -0.04, 0.02);
    head.add(chain);
  }
}

function buildFacialHair(head: THREE.Group, a: CharacterAppearance, k: HeadKit, cy: number, jawScale: number): void {
  const fh = a.facialHair;
  if (fh === 'none' || fh === 'stubble') return;
  const moustache = () => {
    const m = k.mesh(new THREE.BoxGeometry(0.065, 0.016, 0.02), k.hairMat, false);
    m.position.set(0, cy - 0.038, 0.098);
    head.add(m);
  };
  if (fh === 'moustache') return moustache();
  if (fh === 'goatee') {
    moustache();
    const g = k.mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03), k.hairMat, false);
    g.position.set(0, cy - 0.09, 0.085);
    head.add(g);
    return;
  }
  // Beards: a shell around the jaw, open at the mouth.
  const full = fh === 'full_beard';
  const beard = k.mesh(new THREE.SphereGeometry(0.092, 16, 10, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.35, Math.PI * 0.65), k.hairMat);
  // The shell covers the front half (phi 0.05..0.95 PI) and the lower part (theta 0.35..1 PI) of a sphere: cheeks and chin.
  beard.scale.set(jawScale * 1.05, full ? 0.95 : 0.78, 1.0);
  beard.position.set(0, cy - 0.06, 0.012);
  head.add(beard);
  const front = k.mesh(new THREE.SphereGeometry(0.06, 12, 8), k.hairMat);
  front.scale.set(1.1 * jawScale, full ? 0.75 : 0.5, 0.6);
  front.position.set(0, cy - (full ? 0.11 : 0.095), 0.07);
  head.add(front);
  moustache();
}

function buildHeadguard(head: THREE.Group, k: HeadKit, cy: number): void {
  const mat = k.std({ color: '#9b1c1c', roughness: 0.5 });
  // Shell open at the face (front = phi around PI/2).
  const shell = k.mesh(new THREE.SphereGeometry(0.13, 20, 12, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.68), mat);
  shell.position.y = cy + 0.005;
  head.add(shell);
  const bar = k.mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mat);
  bar.position.set(0, cy + 0.07, 0.1);
  head.add(bar);
}

/** Hair styles. phiStart/phiLength leave the face (+Z, phi = PI/2) open where needed. */
function buildHair(head: THREE.Group, a: CharacterAppearance, k: HeadKit, cy: number, hw: number): void {
  const m = k.hairMat;
  const cap = (r: number, theta: number, openFace = false, y = cy) => {
    const geo = openFace ? new THREE.SphereGeometry(r, 18, 12, Math.PI * 0.78, Math.PI * 1.44, 0, theta) : new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, theta);
    const c = k.mesh(geo, m);
    c.scale.set(0.9 * hw * 1.02, 1.08, 1.02);
    c.position.y = y;
    head.add(c);
    return c;
  };
  const blob = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const b = k.mesh(new THREE.SphereGeometry(r, 12, 10), m);
    b.position.set(x, y, z);
    b.scale.set(sx, sy, sz);
    head.add(b);
    return b;
  };

  switch (a.hair) {
    case 'bald':
      return;
    case 'buzz':
      cap(0.113, Math.PI * 0.42);
      return;
    case 'crop':
      cap(0.117, Math.PI * 0.46);
      blob(0.05, 0, cy + 0.075, 0.07, 1.6, 0.45, 0.6);
      return;
    case 'quiff':
      cap(0.116, Math.PI * 0.44);
      blob(0.06, 0, cy + 0.11, 0.06, 1.3, 0.8, 1.1);
      return;
    case 'curly':
      cap(0.12, Math.PI * 0.45);
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        blob(0.035, Math.cos(ang) * 0.06, cy + 0.1 + Math.sin(i * 1.7) * 0.01, Math.sin(ang) * 0.06);
      }
      return;
    case 'afro': {
      const afro = blob(0.165, 0, cy + 0.07, -0.02, hw, 0.9, 1);
      afro.scale.y = 0.85;
      cap(0.118, Math.PI * 0.55, true);
      return;
    }
    case 'cornrows':
      cap(0.112, Math.PI * 0.48);
      for (let i = -2; i <= 2; i++) {
        const row = k.mesh(new THREE.CapsuleGeometry(0.011, 0.16, 3, 6), m, false);
        row.rotation.x = Math.PI / 2;
        row.position.set(i * 0.03, cy + 0.105 - Math.abs(i) * 0.012, -0.01);
        head.add(row);
      }
      return;
    case 'mohawk':
      cap(0.112, Math.PI * 0.3);
      {
        const fin = k.mesh(new THREE.BoxGeometry(0.03, 0.07, 0.2), m);
        fin.position.set(0, cy + 0.13, -0.01);
        head.add(fin);
      }
      return;
    case 'bun':
      cap(0.117, Math.PI * 0.5);
      blob(0.045, 0, cy + 0.08, -0.1);
      return;
    case 'ponytail': {
      cap(0.117, Math.PI * 0.5);
      blob(0.025, 0, cy + 0.03, -0.11);
      const tail = k.mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8), m);
      tail.position.set(0, cy - 0.06, -0.13);
      tail.rotation.x = 0.3;
      head.add(tail);
      return;
    }
    case 'long': {
      cap(0.118, Math.PI * 0.5);
      cap(0.12, Math.PI * 0.68, true);
      const back = k.mesh(new THREE.BoxGeometry(0.2, 0.26, 0.05), m);
      back.position.set(0, cy - 0.12, -0.075);
      back.rotation.x = 0.12;
      head.add(back);
      return;
    }
    case 'bob':
      cap(0.12, Math.PI * 0.45);
      cap(0.124, Math.PI * 0.64, true);
      return;
  }
}
