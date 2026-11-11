/**
 * A fighter rig made from a MakeHuman character. The animator drives the
 * game's 13 joints (poses.ts): here they're plain Object3Ds laid out at the
 * character's own joints, and sync() copies their rotations onto the 67-bone
 * skeleton every frame: spine and neck bend spread over several vertebrae,
 * limbs are corrected from the rest A-pose to the game's arms-down rest, and
 * the fingers are closed into fists.
 */
import * as THREE from 'three';
import type { CharacterAppearance } from '../../character/Appearance';
import { appearanceToHuman } from '../../characters/human/fromAppearance';
import { JOINTS, type JointName } from '../poses';
import { MODEL_METRICS, type Metrics } from '../anim/skeleton';
import type { Rig } from '../CharacterRig';
import { buildHuman, humanAssets, humansReady, type HumanSpec } from './HumanBuilder';

const DOWN = new THREE.Vector3(0, -1, 0);
const I = new THREE.Quaternion();

/** The game joint each mapped bone follows, and how much of that joint's own turn it takes. */
interface Follow {
  bone: string;
  joint: JointName;
  /** Fraction of the joint's local rotation applied (spine and neck spread). */
  share: number;
  /** Rest correction: rotate the bone's rest direction to straight down. */
  limb?: string;
}

export function humanSpecFor(a: CharacterAppearance): HumanSpec | null {
  const assets = humanAssets();
  if (!assets) return null;
  const d = appearanceToHuman(a, assets.skins);
  return { shape: d.shape, skin: d.skin, skinColour: d.skinColour, items: d.items, garments: d.garments };
}

export function buildHumanRig(a: CharacterAppearance): Rig | null {
  if (!humansReady()) return null;
  const spec = humanSpecFor(a);
  if (!spec) return null;
  const built = buildHuman(spec);
  if (!built) return null;
  const bones = built.bones;
  const B = (n: string) => bones.get(n)!;
  const need = ['root', 'spine03', 'spine02', 'spine01', 'neck01', 'head', 'upperarm01.L', 'lowerarm01.L', 'wrist.L', 'upperleg01.L', 'lowerleg01.L', 'foot.L'];
  if (need.some((n) => !bones.get(n))) return null;
  built.root.updateMatrixWorld(true);
  const restPos = (n: string) => new THREE.Vector3().setFromMatrixPosition(B(n).matrixWorld);
  // The game's left (lead) side is +x. MakeHuman's .L is the character's left: check rather than assume.
  const leftIsL = restPos('upperarm01.L').x > 0;
  const side = (s: 'l' | 'r') => ((s === 'l') === leftIsL ? 'L' : 'R');

  // ---- the game joints ----
  const make = (name: string) => {
    const o = new THREE.Object3D();
    o.name = name;
    return o;
  };
  const J = Object.fromEntries(JOINTS.map((n) => [n, make(n)])) as Record<JointName, THREE.Object3D>;
  const container = new THREE.Group();
  const hipsAt = restPos('root');
  const spineAt = restPos('spine03');
  const headAt = restPos('neck01');
  container.add(J.hips);
  J.hips.position.copy(hipsAt);
  J.hips.add(J.spine);
  J.spine.position.copy(spineAt).sub(hipsAt);
  J.spine.add(J.head);
  J.head.position.copy(headAt).sub(spineAt);
  for (const s of ['l', 'r'] as const) {
    const S = side(s);
    const sh = restPos(`upperarm01.${S}`);
    const el = restPos(`lowerarm01.${S}`);
    const hp = restPos(`upperleg01.${S}`);
    const kn = restPos(`lowerleg01.${S}`);
    const ft = restPos(`foot.${S}`);
    const shJ = J[`${s}Shoulder` as JointName];
    const elJ = J[`${s}Elbow` as JointName];
    const hpJ = J[`${s}Hip` as JointName];
    const knJ = J[`${s}Knee` as JointName];
    const ftJ = J[`${s}Foot` as JointName];
    J.spine.add(shJ);
    shJ.position.copy(sh).sub(spineAt);
    // The game's arm hangs straight down from the shoulder: put the elbow (and so the weapon) where that arm's elbow is.
    shJ.add(elJ);
    elJ.position.set(0, -sh.distanceTo(el), 0);
    J.hips.add(hpJ);
    hpJ.position.copy(hp).sub(hipsAt);
    hpJ.add(knJ);
    knJ.position.set(0, -hp.distanceTo(kn), 0);
    knJ.add(ftJ);
    ftJ.position.set(0, -kn.distanceTo(ft), 0);
  }

  // ---- which bones follow which joints ----
  const follows: Follow[] = [
    { bone: 'root', joint: 'hips', share: 1 },
    { bone: 'spine03', joint: 'spine', share: 0.35 },
    { bone: 'spine02', joint: 'spine', share: 0.7 },
    { bone: 'spine01', joint: 'spine', share: 1 },
    { bone: 'neck01', joint: 'head', share: 0.5 },
    { bone: 'head', joint: 'head', share: 1 },
  ];
  for (const s of ['l', 'r'] as const) {
    const S = side(s);
    follows.push(
      { bone: `upperarm01.${S}`, joint: `${s}Shoulder` as JointName, share: 1, limb: `lowerarm01.${S}` },
      { bone: `lowerarm01.${S}`, joint: `${s}Elbow` as JointName, share: 1, limb: `wrist.${S}` },
      { bone: `upperleg01.${S}`, joint: `${s}Hip` as JointName, share: 1, limb: `lowerleg01.${S}` },
      { bone: `lowerleg01.${S}`, joint: `${s}Knee` as JointName, share: 1, limb: `foot.${S}` },
      { bone: `foot.${S}`, joint: `${s}Foot` as JointName, share: 1 },
    );
  }
  const correction = new Map<string, THREE.Quaternion>();
  for (const f of follows) {
    if (!f.limb) continue;
    const dir = restPos(f.limb).sub(restPos(f.bone)).normalize();
    correction.set(f.bone, new THREE.Quaternion().setFromUnitVectors(dir, DOWN));
  }
  const byBone = new Map(follows.map((f) => [f.bone, f]));

  // ---- fists: curl each finger towards the palm (rest frames are world-aligned, so axes are too) ----
  for (const S of ['L', 'R']) {
    const wrist = restPos(`wrist.${S}`);
    const index = bones.get(`finger2-1.${S}`) ? restPos(`finger2-1.${S}`) : null;
    const pinky = bones.get(`finger5-1.${S}`) ? restPos(`finger5-1.${S}`) : null;
    if (!index || !pinky) continue;
    const across = pinky.clone().sub(index).normalize();
    for (let f = 1; f <= 5; f++) {
      const b1 = bones.get(`finger${f}-1.${S}`);
      const b2 = bones.get(`finger${f}-2.${S}`);
      if (!b1 || !b2) continue;
      const along = restPos(`finger${f}-2.${S}`).sub(restPos(`finger${f}-1.${S}`)).normalize();
      // Palm faces the side the fingers close to: away from the back of the hand (up, in the A-pose).
      let palm = new THREE.Vector3().crossVectors(along, across).normalize();
      if (palm.y > 0) palm.negate();
      const axis = new THREE.Vector3().crossVectors(along, palm).normalize();
      const angles = f === 1 ? [0.35, 0.5, 0.4] : [1.25, 1.45, 1.0];
      for (let k = 1; k <= 3; k++) {
        const bone = bones.get(`finger${f}-${k}.${S}`);
        if (bone) bone.quaternion.setFromAxisAngle(axis, angles[k - 1]);
      }
    }
    void wrist;
  }

  // ---- per-frame: game joints onto the skeleton ----
  const order = built.skeleton.bones;
  const parentIdx = order.map((b: THREE.Bone) => order.indexOf(b.parent as THREE.Bone));
  const world = order.map(() => new THREE.Quaternion());
  const jointWorld = new Map<JointName, THREE.Quaternion>();
  const jointParentWorld = new Map<JointName, THREE.Quaternion>();
  const tmp = new THREE.Quaternion();
  const tmp2 = new THREE.Quaternion();
  const fixed = new Set(order.filter((b: THREE.Bone) => b.name.startsWith('finger')).map((b: THREE.Bone) => b.name));
  const rootBone = B('root');
  const sync = () => {
    // Joint rotations relative to the container, top down.
    for (const n of JOINTS) {
      const j = J[n];
      const p = j.parent && j.parent !== container ? jointWorld.get(j.parent.name as JointName)! : I;
      jointParentWorld.set(n, p);
      const w = jointWorld.get(n) ?? new THREE.Quaternion();
      w.copy(p).multiply(j.quaternion);
      jointWorld.set(n, w);
    }
    for (let i = 0; i < order.length; i++) {
      const b = order[i];
      const pw = parentIdx[i] >= 0 ? world[parentIdx[i]] : I;
      const f = byBone.get(b.name);
      if (!f) {
        if (!fixed.has(b.name)) b.quaternion.identity();
        world[i].copy(pw).multiply(b.quaternion);
        continue;
      }
      // Wanted rotation relative to the container.
      if (f.share >= 1) tmp.copy(jointWorld.get(f.joint)!);
      else tmp.copy(jointParentWorld.get(f.joint)!).multiply(tmp2.copy(I).slerp(J[f.joint].quaternion, f.share));
      const c = correction.get(b.name);
      if (c) tmp.multiply(c);
      world[i].copy(tmp);
      // Local = parent⁻¹ · wanted.
      b.quaternion.copy(tmp2.copy(pw).invert()).multiply(tmp);
    }
    rootBone.position.copy(J.hips.position);
  };

  const root = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(pitch);
  pitch.add(container);
  container.add(built.root);
  // The hips bone is driven from the hips joint, which lives in the container.
  sync();

  const P = (n: JointName) => J[n].position;
  const v3 = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
  const fist = restPos(`wrist.${side('l')}`).distanceTo(restPos(`lowerarm01.${side('l')}`)) + 0.08;
  const metrics: Metrics = {
    ...MODEL_METRICS,
    hipsY: P('hips').y,
    spine: v3(P('spine')),
    head: v3(P('head')),
    shoulder: v3(P('lShoulder')),
    upperArm: P('lElbow').length(),
    foreArm: fist,
    hip: v3(P('lHip')),
    thigh: P('lKnee').length(),
    shin: P('lFoot').length(),
    ankleH: Math.max(0.05, restPos(`foot.${side('l')}`).y),
  };
  const flashMaterials: THREE.MeshStandardMaterial[] = [];
  built.root.traverse((o: THREE.Object3D) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial && o.name !== 'eyes') flashMaterials.push(m);
  });
  return {
    root,
    pitch,
    joints: J,
    metrics,
    hipsRest: J.hips.position.clone(),
    flashMaterials,
    sync,
    dispose: () => built.dispose(),
  };
}
