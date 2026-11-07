import * as THREE from 'three';
import type { CharacterAppearance, TattooSlot } from '../character/Appearance';
import type { JointName } from './poses';
import { characterModelsReady, cloneCharacterModel } from './characterModels';
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
  if (characterModelsReady(a.body === 'female' ? 'female' : 'male')) {
    const modelRig = buildModelRig(a);
    if (modelRig) return modelRig;
  }
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
  const topRough: Partial<Record<CharacterAppearance['top'], number>> = { bomber: 0.45, tracksuit: 0.55, leather: 0.32, puffer: 0.4, football: 0.5, workwear: 0.6 };
  const topMat = std({ color: a.topColour, roughness: topRough[a.top] ?? 0.9, metalness: a.top === 'leather' ? 0.05 : 0 });
  const bottomsMat = std({ color: a.bottomsColour, roughness: a.bottoms === 'jeans' ? 0.95 : 0.85 });
  const trimMat = std({ color: darken(a.topColour, 0.25), roughness: 0.8 });
  const reflectMat = std({ color: '#d8dcd8', roughness: 0.3, metalness: 0.4, emissive: '#3a3a3a' });
  const shoeMat = std({ color: a.shoesColour, roughness: 0.6 });
  const soleMat = std({ color: a.shoes === 'boots' ? '#151515' : '#efefea', roughness: 0.7 });
  const hairMat = std({ color: hairCol, roughness: 0.9 });
  const wrapsMat = std({ color: '#e2ddd2', roughness: 0.85 });
  const darkMat = std({ color: '#101012', roughness: 0.4 });
  const lipMat = std({ color: darken(tone, 0.25), roughness: 0.5 });
  const metal = std({ color: a.chainColour === 'gold' ? '#d4af37' : '#c9ccd2', roughness: 0.25, metalness: 0.9 });

  const sleevesLong = ['hoodie', 'designer_hoodie', 'tracksuit', 'bomber', 'puffer', 'leather', 'denim', 'coat', 'workwear'].includes(a.top);
  const sleevesShort = a.top === 'tshirt' || a.top === 'football';
  /** Padded tops make the arms and torso bigger. */
  const bulk = a.top === 'puffer' ? 1.22 : a.top === 'coat' || a.top === 'leather' ? 1.06 : 1;
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
  const armR = 0.052 * (1 + 0.35 * mu + 0.25 * wt) * (female ? 0.9 : 1) * bulk;
  const foreR = 0.046 * (1 + 0.3 * mu + 0.2 * wt) * (female ? 0.9 : 1) * (bulk > 1.1 ? 1.15 : 1);
  const thighR = 0.072 * (1 + 0.25 * mu + 0.3 * wt) * (female ? 1.04 : 1);
  const shinR = 0.06 * (1 + 0.2 * mu + 0.2 * wt);
  const torsoSX = (female ? 1.0 : 1.12) * (1 + 0.15 * mu + 0.22 * wt) * (bulk > 1.1 ? 1.1 : 1);
  const torsoSZ = (female ? 0.8 : 0.78) * (1 + 0.08 * mu + 0.35 * wt) * (bulk > 1.1 ? 1.18 : 1);
  const front = 0.155 * torsoSZ / 0.78;

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
  if (a.top === 'hoodie' || a.top === 'designer_hoodie') {
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
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = false) => {
    const m = mesh(geo, mat, shadow);
    m.position.set(x, y, z);
    spine.add(m);
    return m;
  };
  if (a.top === 'designer_hoodie') {
    // Big chest logo and drawstrings.
    add(new THREE.BoxGeometry(0.11, 0.05, 0.006), std({ color: '#f0ece0', roughness: 0.5 }), 0, 0.36, front + 0.004);
    add(new THREE.BoxGeometry(0.06, 0.012, 0.007), std({ color: '#c8102e', roughness: 0.5 }), 0, 0.36, front + 0.008);
    for (const sx of [0.03, -0.03]) add(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), soleMat, sx, 0.45, front + 0.01);
  }
  if (a.top === 'football') {
    // V-neck collar, side panels and a number on the back.
    const collar = add(new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI), trimMat, 0, 0.535, 0.03);
    collar.rotation.set(Math.PI / 2, 0, Math.PI);
    for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.02, 0.36, 0.2 * torsoSZ / 0.78), trimMat, sx * 0.16 * torsoSX, 0.26, 0);
    add(new THREE.BoxGeometry(0.08, 0.1, 0.005), soleMat, 0, 0.35, -front - 0.004);
    add(new THREE.BoxGeometry(0.05, 0.03, 0.005), std({ color: '#d4af37', roughness: 0.4, metalness: 0.5 }), 0.07, 0.42, front + 0.004);
  }
  if (a.top === 'puffer') {
    // Quilted bands and a high zipped collar.
    for (let i = 0; i < 4; i++) {
      const band = add(new THREE.TorusGeometry(0.16, 0.012, 6, 20), trimMat, 0, 0.1 + i * 0.12, 0);
      band.rotation.x = Math.PI / 2;
      band.scale.set(torsoSX, torsoSZ, 1);
    }
    const collar = add(new THREE.CylinderGeometry(0.085, 0.1, 0.09, 14, 1, true), topMat, 0, 0.55, 0, true);
    collar.material = topMat;
    add(new THREE.BoxGeometry(0.012, 0.46, 0.01), metal, 0, 0.3, front + 0.02);
  }
  if (a.top === 'leather' || a.top === 'denim' || a.top === 'coat') {
    // Lapels / collar and a zip or buttons.
    for (const sx of [1, -1]) {
      const lapel = add(new THREE.BoxGeometry(0.06, 0.16, 0.012), a.top === 'denim' ? trimMat : topMat, sx * 0.045, 0.47, front + 0.01);
      lapel.rotation.z = sx * 0.35;
    }
    if (a.top === 'leather') add(new THREE.BoxGeometry(0.01, 0.42, 0.008), metal, 0.03, 0.27, front + 0.012);
    else for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.008, 6, 4), a.top === 'denim' ? metal : darkMat, 0, 0.08 + i * 0.08, front + 0.012);
    if (a.top === 'denim') for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.06, 0.05, 0.008), trimMat, sx * 0.07, 0.38, front + 0.006);
    if (a.top === 'coat') {
      // The skirt of the coat hangs over the hips.
      const skirt = mesh(new THREE.CylinderGeometry(0.17 * torsoSX, 0.2 * torsoSX, 0.32, 16, 1, true), topMat);
      skirt.scale.z = torsoSZ / torsoSX * 1.1;
      skirt.position.y = -0.1;
      hips.add(skirt);
    }
  }
  if (a.top === 'workwear') {
    // Hi-vis: two reflective hoops and shoulder bands.
    for (const y of [0.14, 0.26]) {
      const band = add(new THREE.TorusGeometry(0.162, 0.014, 4, 22), reflectMat, 0, y, 0);
      band.rotation.x = Math.PI / 2;
      band.scale.set(torsoSX, torsoSZ, 1);
    }
    for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.03, 0.012, 0.32 * torsoSZ / 0.78), reflectMat, sx * 0.09, 0.52, 0);
  }
  if (a.accessories.includes('belt') && a.top !== 'coat') {
    const belt = mesh(new THREE.TorusGeometry(0.155, 0.014, 4, 22), std({ color: '#2a1a10', roughness: 0.5 }));
    belt.rotation.x = Math.PI / 2;
    belt.scale.set((female ? 1.1 : 1.0) * (1 + 0.2 * wt), 0.66 * (1 + 0.3 * wt), 1);
    belt.position.y = 0.06;
    hips.add(belt);
    const buckle = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.01), metal, false);
    buckle.position.set(0, 0.06, 0.105 * (1 + 0.3 * wt));
    hips.add(buckle);
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
    if (sleevesLong) {
      // Ribbed cuff where the sleeve ends.
      const cuff = mesh(new THREE.CylinderGeometry(foreR * 1.02, foreR * 1.05, 0.035, 12), a.top === 'workwear' ? reflectMat : trimMat, false);
      cuff.position.y = -0.235;
      elbow.add(cuff);
    }
    if (sleevesShort && a.top === 'football') {
      const hem = mesh(new THREE.CylinderGeometry(armR * 1.08, armR * 1.1, 0.025, 12), trimMat, false);
      hem.position.y = -0.2;
      shoulder.add(hem);
    }
    const wrapped = a.accessories.includes('wraps');
    elbow.add(buildFist(side, wrapped ? wrapsMat : plainSkin, wrapped ? wrapsMat : plainSkin, mesh, 1 + 0.15 * mu, left && a.accessories.includes('ring') ? metal : null));
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
    if (a.bottoms === 'cargos') {
      // Side cargo pocket with a flap.
      const pocket = mesh(new THREE.BoxGeometry(0.02, 0.1, 0.09), std({ color: darken(a.bottomsColour, 0.12), roughness: 0.9 }), false);
      pocket.position.set(thighR * 1.02 * side, -0.26, 0);
      hip.add(pocket);
    }
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(capsule(shinR, 0.26, shinMat, -0.2));
    if (a.bottoms === 'joggers') {
      const cuff = mesh(new THREE.CylinderGeometry(shinR * 0.9, shinR * 0.95, 0.04, 12), std({ color: darken(a.bottomsColour, 0.2), roughness: 0.9 }), false);
      cuff.position.y = -0.33;
      knee.add(cuff);
    }
    if (a.bottoms === 'workwear') {
      const pad = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), std({ color: '#1a1a1a', roughness: 0.7 }), false);
      pad.position.set(0, -0.02, shinR + 0.01);
      knee.add(pad);
      const strip = mesh(new THREE.CylinderGeometry(shinR * 1.03, shinR * 1.03, 0.02, 12), reflectMat, false);
      strip.position.y = -0.22;
      knee.add(strip);
    }
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

/** Which garment meshes in character_*.glb each clothing style uses. */
const TOP_MESHES: Record<CharacterAppearance['top'], string[]> = {
  none: [],
  vest: ['top_vest'],
  tshirt: ['top_short'],
  football: ['top_short', 'collar'],
  hoodie: ['top_long', 'hood'],
  designer_hoodie: ['top_long', 'hood'],
  tracksuit: ['top_long', 'collar'],
  bomber: ['top_long', 'collar'],
  puffer: ['top_puffer', 'collar'],
  leather: ['top_long', 'collar'],
  denim: ['top_long', 'collar'],
  coat: ['top_long', 'coat_skirt', 'collar'],
  workwear: ['top_long'],
};

/** Which pack hairstyle stands in for each of the game's styles. */
const HAIR_MESH: Record<CharacterAppearance['hair'], { male: string; female: string } | null> = {
  bald: null,
  buzz: { male: 'hair_buzz', female: 'hair_buzz_f' },
  crop: { male: 'hair_buzz', female: 'hair_buzz_f' },
  cornrows: { male: 'hair_buzz', female: 'hair_buzz_f' },
  mohawk: { male: 'hair_buzz', female: 'hair_buzz_f' },
  quiff: { male: 'hair_parted', female: 'hair_parted' },
  curly: { male: 'hair_parted', female: 'hair_parted' },
  afro: { male: 'hair_parted', female: 'hair_parted' },
  bob: { male: 'hair_parted', female: 'hair_long' },
  bun: { male: 'hair_buns', female: 'hair_buns' },
  ponytail: { male: 'hair_buns', female: 'hair_buns' },
  long: { male: 'hair_long', female: 'hair_long' },
};

/** Average colour (linear) of the pack's light skin texture and its grey hair texture, so tints land on the chosen colour. */
const SKIN_TEX_AVG = new THREE.Color().setRGB(166 / 255, 120 / 255, 88 / 255, THREE.SRGBColorSpace);
const HAIR_TEX_AVG = new THREE.Color().setRGB(142 / 255, 142 / 255, 140 / 255, THREE.SRGBColorSpace);
function tintFor(target: THREE.Color, avg: THREE.Color): THREE.Color {
  return new THREE.Color(target.r / Math.max(0.02, avg.r), target.g / Math.max(0.02, avg.g), target.b / Math.max(0.02, avg.b));
}

/**
 * Quaternius "Universal Base Characters" (CC0), converted for the game's
 * 11-joint skeleton, with the game's clothing as skinned garments. Headwear is
 * the shared procedural headwear, lined up on the model's eyes. Returns null if
 * the model isn't available.
 */
function buildModelRig(a: CharacterAppearance): Rig | null {
  const female = a.body === 'female';
  const model = cloneCharacterModel(female ? 'female' : 'male');
  if (!model) return null;
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
  const hairCol = mixHair(a);
  const topRough: Partial<Record<CharacterAppearance['top'], number>> = { bomber: 0.45, tracksuit: 0.55, leather: 0.32, puffer: 0.4, football: 0.5, workwear: 0.6 };
  const topMat = std({ color: a.topColour, roughness: topRough[a.top] ?? 0.9, metalness: a.top === 'leather' ? 0.05 : 0, side: THREE.DoubleSide });
  const bottomsMat = std({ color: a.bottomsColour, roughness: a.bottoms === 'jeans' ? 0.95 : 0.85, side: THREE.DoubleSide });
  const shoeMat = std({ color: a.shoesColour, roughness: 0.55 });
  const trimMat = std({ color: darken(a.topColour, 0.3), roughness: 0.8, side: THREE.DoubleSide });
  const flat: Record<string, THREE.MeshStandardMaterial> = { Top: topMat, Bottoms: bottomsMat, Shoes: shoeMat, Trim: trimMat };
  const skinTint = tintFor(new THREE.Color(a.skinTone), SKIN_TEX_AVG);
  const hairTint = tintFor(hairCol, HAIR_TEX_AVG);

  const wanted = new Set<string>(['Body', 'eyes', 'shoes', female ? 'brows_f' : 'brows', a.bottoms === 'shorts' ? 'bottoms_shorts' : 'bottoms_long']);
  for (const m of TOP_MESHES[a.top]) wanted.add(m);
  const hair = HAIR_MESH[a.hair];
  if (hair && !a.accessories.includes('headguard')) wanted.add(female ? hair.female : hair.male);
  if (!female && ['moustache', 'goatee', 'short_beard', 'full_beard'].includes(a.facialHair)) wanted.add('beard');

  const bones: Record<string, THREE.Object3D> = {};
  const unwanted: THREE.Object3D[] = [];
  model.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o;
    const sm = o as THREE.SkinnedMesh;
    if (!(o as THREE.Mesh).isMesh) return;
    if (!wanted.has(o.name)) {
      unwanted.push(o);
      return;
    }
    const src = sm.material as THREE.MeshStandardMaterial;
    const name = src.name.replace(/\.\d+$/, '');
    if (flat[name]) sm.material = flat[name];
    else {
      // Textured pack materials: per-fighter copy so skin and hair can be tinted.
      const m = track(src.clone());
      if (name === 'Skin') m.color.copy(skinTint);
      else if (name.startsWith('Hair')) m.color.copy(hairTint);
      flashMaterials.push(m);
      sm.material = m;
    }
    sm.castShadow = true;
    // Skinned meshes move away from their bind-pose bounds; don't let them get culled.
    sm.frustumCulled = false;
    const dict = sm.morphTargetDictionary;
    const inf = sm.morphTargetInfluences;
    if (dict && inf) {
      if (dict.muscle !== undefined) inf[dict.muscle] = Math.max(0, Math.min(1, (a.muscle - 0.3) / 0.6));
      if (dict.weight !== undefined) inf[dict.weight] = Math.max(0, Math.min(1, (a.weight - 0.2) / 0.6));
    }
  });
  for (const o of unwanted) o.removeFromParent();
  const need = ['hips', 'spine', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'] as const;
  if (need.some((n) => !bones[n])) return null;
  // One skeleton for the whole fighter: every part is bound to the same bones with the same bind pose,
  // so sharing it means the bone matrices are worked out once per frame instead of once per part.
  let shared: THREE.Skeleton | null = null;
  model.traverse((o: THREE.Object3D) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    if (!shared) shared = sm.skeleton;
    else if (sm.skeleton.bones.length === shared.bones.length && sm.skeleton.bones.every((b: THREE.Bone, i: number) => b === shared!.bones[i])) sm.skeleton = shared;
    // Small parts don't need to cast shadows.
    if (!['Body', 'top_long', 'top_short', 'top_vest', 'top_puffer', 'bottoms_long', 'bottoms_shorts', 'coat_skirt', 'hair_long', 'hair_buns'].includes(o.name)) sm.castShadow = false;
    sm.receiveShadow = false;
  });

  const root = new THREE.Group();
  // The pack characters are 1.78 m (male) and 1.72 m (female); the creator's height slider scales around that.
  root.scale.setScalar(a.height);
  const pitch = new THREE.Group();
  root.add(pitch);
  pitch.add(model);

  // Headwear on the head bone, lined up with the model's eyes (classic head: eyes 0.145 up, 0.093 forward).
  const wear = new THREE.Group();
  const s = female ? 0.9 : 0.96;
  wear.position.set(0, (female ? 0.172 : 0.178) - 0.145 * s, (female ? 0.105 : 0.111) - 0.093 * s);
  wear.scale.setScalar(s);
  bones.head.add(wear);
  const kit: HeadKit = {
    std,
    mesh,
    skin: (p) => {
      const m = track(paintedSkinMaterial(p));
      flashMaterials.push(m);
      return m;
    },
    hairMat: std({ color: hairCol, roughness: 0.9 }),
    lipMat: std({ color: darken(a.skinTone, 0.25), roughness: 0.5 }),
    darkMat: std({ color: '#101012', roughness: 0.4 }),
    metal: std({ color: a.chainColour === 'gold' ? '#d4af37' : '#c9ccd2', roughness: 0.25, metalness: 0.9 }),
    topMat,
    hairHex: '#' + hairCol.getHexString(),
  };
  if (a.accessories.includes('headguard')) buildHeadguard(wear, kit, 0.13);
  buildHeadwear(wear, a, kit, 0.13, 1);
  if (a.accessories.includes('earring')) {
    const ring = mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 12), kit.metal, false);
    ring.position.set(0.075, 0.1, -0.005);
    wear.add(ring);
  }

  const joints = Object.fromEntries(need.map((n) => [n, bones[n]])) as Record<JointName, THREE.Object3D>;
  return {
    root,
    pitch,
    flashMaterials,
    joints,
    dispose() {
      // Geometry and textures are shared with the loaded template; only per-fighter materials and headwear are freed.
      for (const d of disposables) d.dispose();
    },
  };
}

type MeshFn = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow?: boolean) => THREE.Mesh;

/**
 * A clenched fist with real fingers: palm, four curled fingers (two
 * segments each, knuckles forward), and a thumb wrapped across them.
 * Sits at the end of the forearm (elbow space, y = -0.28).
 */
function buildFist(side: 1 | -1, palmMat: THREE.Material, fingerMat: THREE.Material, mesh: MeshFn, size: number, ringMat: THREE.Material | null): THREE.Group {
  const g = new THREE.Group();
  g.position.y = -0.28;
  g.scale.setScalar(size);
  const palm = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.032), palmMat);
  palm.position.set(0, 0.008, -0.004);
  g.add(palm);
  const r = 0.0105;
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.0175;
    const len = i === 0 || i === 3 ? 0.016 : 0.02;
    // Proximal segment points forward from the knuckle line...
    const prox = mesh(new THREE.CapsuleGeometry(r, len, 3, 8), fingerMat, false);
    prox.rotation.x = Math.PI / 2;
    prox.position.set(x, -0.024, 0.02);
    g.add(prox);
    // ...and the tip curls back under into the palm.
    const tip = mesh(new THREE.CapsuleGeometry(r * 0.92, len * 0.8, 3, 8), fingerMat, false);
    tip.position.set(x, -0.038, 0.012);
    g.add(tip);
    if (ringMat && i === 2) {
      const ring = mesh(new THREE.TorusGeometry(r * 1.2, 0.003, 6, 12), ringMat, false);
      ring.position.set(x, -0.024, 0.016);
      g.add(ring);
    }
  }
  // Thumb across the front of the curled fingers.
  const thumb = mesh(new THREE.CapsuleGeometry(r * 1.1, 0.03, 3, 8), fingerMat, false);
  thumb.rotation.z = Math.PI / 2 - 0.3 * side;
  thumb.position.set(0.006 * side, -0.03, 0.034);
  g.add(thumb);
  return g;
}

function buildShoe(knee: THREE.Group, a: CharacterAppearance, mesh: MeshFn, shoeMat: THREE.Material, soleMat: THREE.Material): void {
  const boots = a.shoes === 'boots';
  const upper = mesh(new THREE.BoxGeometry(0.1, boots ? 0.1 : 0.07, 0.24), shoeMat);
  upper.position.set(0, boots ? -0.395 : -0.405, 0.06);
  knee.add(upper);
  const sole = mesh(new THREE.BoxGeometry(0.105, 0.025, 0.25), soleMat);
  sole.position.set(0, -0.44, 0.06);
  knee.add(sole);
  if (a.shoes === 'runners') {
    // Swoosh-free side stripe and a chunky foam heel.
    for (const sx of [1, -1]) {
      const stripe = mesh(new THREE.BoxGeometry(0.004, 0.025, 0.12), soleMat, false);
      stripe.position.set(0.051 * sx, -0.4, 0.05);
      stripe.rotation.x = -0.2;
      knee.add(stripe);
    }
    const heel = mesh(new THREE.BoxGeometry(0.108, 0.04, 0.08), soleMat);
    heel.position.set(0, -0.43, -0.03);
    knee.add(heel);
  }
  if (a.shoes !== 'trainers' && a.shoes !== 'runners') {
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
  buildHeadwear(head, a, k, cy, hw);
}

/** Hats, glasses, snood, mouthguard and chain: shared by the classic head and the model heads. */
function buildHeadwear(head: THREE.Group, a: CharacterAppearance, k: HeadKit, cy: number, hw: number): void {
  const f = a.face;
  const hatMat = k.std({ color: a.headColour ?? darken(a.topColour, 0.1), roughness: 0.95 });
  if (a.accessories.includes('beanie') && !a.accessories.includes('headguard') && !a.accessories.includes('cap')) {
    const beanie = k.mesh(new THREE.SphereGeometry(0.124, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
    beanie.scale.set(hw, 1.12, 1.02);
    beanie.position.y = cy + 0.02;
    const fold = k.mesh(new THREE.CylinderGeometry(0.122 * hw, 0.124 * hw, 0.04, 18, 1, true), hatMat);
    fold.position.y = cy + 0.03;
    head.add(beanie, fold);
  }
  if (a.accessories.includes('sunglasses')) {
    const lens = k.std({ color: '#0a0a0c', roughness: 0.05, metalness: 0.8 });
    for (const s of [1, -1]) {
      const l = k.mesh(new THREE.BoxGeometry(0.036, 0.022, 0.006), lens, false);
      l.position.set(0.034 * s * (1 + 0.2 * f.eyeSpacing), cy + 0.016, 0.101);
      head.add(l);
    }
    const bridge = k.mesh(new THREE.BoxGeometry(0.11 * hw, 0.005, 0.006), k.darkMat, false);
    bridge.position.set(0, cy + 0.024, 0.1);
    head.add(bridge);
  }
  if (a.accessories.includes('snood')) {
    // Pulled up over the chin.
    const snood = k.mesh(new THREE.CylinderGeometry(0.075 * hw, 0.07, 0.11, 16, 1, true), hatMat);
    snood.position.set(0, cy - 0.085, 0.012);
    head.add(snood);
  }
  if (a.accessories.includes('mouthguard')) {
    const guard = k.mesh(new THREE.BoxGeometry(0.05, 0.016, 0.012), k.std({ color: '#2a6ad8', roughness: 0.3 }), false);
    guard.position.set(0, cy - 0.052, 0.094);
    head.add(guard);
  }
  if (a.accessories.includes('cap') && !a.accessories.includes('headguard')) {
    const capMat = k.std({ color: a.headColour ?? darken(a.topColour, 0.1), roughness: 0.8 });
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
