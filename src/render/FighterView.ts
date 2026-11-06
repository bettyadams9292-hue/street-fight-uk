import * as THREE from 'three';
import type { Fighter } from '../fighter/Fighter';
import {
  BLOCK,
  GUARD,
  GUARD_BREAK,
  HITSTUN,
  JOINTS,
  JUMP,
  LYING,
  MOVE_POSES,
  STAGGER,
  easeInOut,
  lerpPose,
  type JointName,
  type Pose,
} from './poses';

/** Colour schemes for the temporary rig. Stage 2 replaces this with full character appearance. */
const LOOKS: Record<string, { top: number; legs: number; shoes: number; skin: number; hands: number; hair: number; headgear?: number }> = {
  player: { top: 0x2b2e35, legs: 0x1b1e25, shoes: 0xe6e6e6, skin: 0xc68e6b, hands: 0xe2ddd2, hair: 0x1a1410 },
  dummy: { top: 0x7d1a1a, legs: 0x111111, shoes: 0x2a2a2a, skin: 0x8d5a3b, hands: 0x9b1c1c, hair: 0x0e0b09, headgear: 0x9b1c1c },
};

interface Rig {
  root: THREE.Group;
  pitch: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  materials: THREE.MeshStandardMaterial[];
}

function limb(radius: number, length: number, mat: THREE.Material, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  m.position.y = y;
  m.castShadow = true;
  return m;
}

/** TEMPORARY procedural humanoid made of capsules, posed in code. */
function buildRig(lookKey: string): Rig {
  const look = LOOKS[lookKey] ?? LOOKS.player;
  const mat = (color: number, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  const top = mat(look.top, 0.9);
  const legs = mat(look.legs, 0.85);
  const shoes = mat(look.shoes, 0.6);
  const skin = mat(look.skin, 0.6);
  const hands = mat(look.hands, 0.7);
  const hair = mat(look.hair, 0.9);
  const materials = [top, legs, shoes, skin, hands, hair];

  const root = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(pitch);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  pitch.add(hips);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.2), legs);
  pelvis.castShadow = true;
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.08;
  hips.add(spine);
  const torso = limb(0.16, 0.3, top, 0.25);
  torso.scale.set(1.15, 1, 0.78);
  spine.add(torso);

  const head = new THREE.Group();
  head.position.y = 0.55;
  spine.add(head);
  const neck = limb(0.05, 0.06, skin, 0.03);
  head.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  skull.scale.set(0.9, 1.08, 1);
  skull.position.y = 0.13;
  skull.castShadow = true;
  head.add(skull);
  if (look.headgear !== undefined) {
    const gearMat = mat(look.headgear, 0.5);
    materials.push(gearMat);
    const gear = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), gearMat);
    gear.position.y = 0.14;
    gear.castShadow = true;
    head.add(gear);
  } else {
    const cut = new THREE.Mesh(new THREE.SphereGeometry(0.113, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hair);
    cut.position.set(0, 0.145, -0.008);
    head.add(cut);
  }
  // A nose so you can tell which way the head faces.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), skin);
  nose.position.set(0, 0.12, 0.105);
  head.add(nose);

  const makeArm = (side: 1 | -1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.2 * side, 0.44, 0);
    spine.add(shoulder);
    shoulder.add(limb(0.055, 0.17, top, -0.13));
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);
    elbow.add(limb(0.048, 0.16, top, -0.12));
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), hands);
    fist.scale.set(0.9, 1.1, 1);
    fist.position.y = -0.28;
    fist.castShadow = true;
    elbow.add(fist);
    return { shoulder, elbow };
  };

  const makeLeg = (side: 1 | -1) => {
    const hip = new THREE.Group();
    hip.position.set(0.1 * side, -0.06, 0);
    hips.add(hip);
    hip.add(limb(0.075, 0.27, legs, -0.21));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(limb(0.062, 0.26, legs, -0.2));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.25), shoes);
    foot.position.set(0, -0.41, 0.06);
    foot.castShadow = true;
    knee.add(foot);
    return { hip, knee };
  };

  const lArm = makeArm(1);
  const rArm = makeArm(-1);
  const lLeg = makeLeg(1);
  const rLeg = makeLeg(-1);

  return {
    root,
    pitch,
    materials,
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
  };
}

/**
 * Draws one Fighter from the simulation. Reads state only; never changes it.
 */
export class FighterView {
  readonly root: THREE.Group;
  private rig: Rig;
  private current: Record<JointName, THREE.Vector3>;
  private currentDrop = 0;
  private currentPitch = 0;
  private yaw: number;
  private walkPhase = 0;
  private lastX: number;
  private lastZ: number;
  private flashTime = 0;
  /** Fires when a foot hits the ground while walking (for footstep audio). */
  onStep: (() => void) | null = null;

  constructor(readonly fighter: Fighter) {
    this.rig = buildRig(fighter.look);
    this.root = this.rig.root;
    this.current = Object.fromEntries(JOINTS.map((j) => [j, new THREE.Vector3()])) as Record<JointName, THREE.Vector3>;
    this.yaw = (fighter.facing * Math.PI) / 2;
    this.lastX = fighter.pos.x;
    this.lastZ = fighter.pos.z;
    this.applyPose(GUARD, 1);
  }

  /** Brief white flash when hit. */
  flash(): void {
    this.flashTime = 0.09;
  }

  update(dt: number, time: number): void {
    const f = this.fighter;
    this.root.position.set(f.pos.x, f.pos.y, f.pos.z);

    // Turn smoothly to face left/right.
    const targetYaw = (f.facing * Math.PI) / 2;
    this.yaw += (targetYaw - this.yaw) * (1 - Math.exp(-28 * dt));
    this.root.rotation.y = this.yaw;

    const moved = Math.hypot(f.pos.x - this.lastX, f.pos.z - this.lastZ);
    this.lastX = f.pos.x;
    this.lastZ = f.pos.z;

    const { pose, speed } = this.targetPose(moved, time);
    this.applyPose(pose, 1 - Math.exp(-speed * dt));

    // Hit flash.
    this.flashTime = Math.max(0, this.flashTime - dt);
    const e = this.flashTime > 0 ? 0.6 : 0;
    for (const m of this.rig.materials) m.emissive.setScalar(e);
  }

  private targetPose(moved: number, time: number): { pose: Pose; speed: number } {
    const f = this.fighter;
    switch (f.state) {
      case 'attack': {
        const m = f.move!;
        const poses = MOVE_POSES[m.data.id] ?? { chamber: GUARD, strike: GUARD };
        if (m.frame < m.startup) {
          const t = m.frame / m.startup;
          if (t < 0.6) return { pose: lerpPose(GUARD, poses.chamber, easeInOut(t / 0.6)), speed: 30 };
          return { pose: lerpPose(poses.chamber, poses.strike, ((t - 0.6) / 0.4) * 0.75), speed: 40 };
        }
        if (m.frame < m.startup + m.active) return { pose: poses.strike, speed: 55 };
        const t = (m.frame - m.startup - m.active) / Math.max(1, m.recovery);
        return { pose: lerpPose(poses.strike, GUARD, easeInOut(Math.min(1, t))), speed: 30 };
      }
      case 'block':
      case 'blockstun':
        return { pose: BLOCK, speed: 30 };
      case 'hitstun':
        return { pose: HITSTUN, speed: 35 };
      case 'stagger':
        return { pose: STAGGER, speed: 18 };
      case 'guardbreak':
        return { pose: GUARD_BREAK, speed: 22 };
      case 'knockdown':
      case 'ko':
        return { pose: LYING, speed: 9 };
      case 'getup':
        return { pose: lerpPose(LYING, GUARD, easeInOut(Math.min(1, f.stateFrame / Math.max(1, f.stateDuration)))), speed: 25 };
      case 'jump':
        return { pose: JUMP, speed: 16 };
      case 'walk': {
        const prev = this.walkPhase;
        this.walkPhase += moved * 7.5;
        if (Math.floor(prev / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) this.onStep?.();
        const s = Math.sin(this.walkPhase);
        const pose = lerpPose(GUARD, GUARD, 0);
        const j = pose.joints;
        j.lHip = [-0.3 + 0.45 * s, 0, 0.06];
        j.rHip = [0.3 - 0.45 * s, 0, -0.06];
        j.lKnee = [0.35 + 0.5 * Math.max(0, -s), 0, 0];
        j.rKnee = [0.45 + 0.5 * Math.max(0, s), 0, 0];
        pose.drop = 0.05 + 0.025 * Math.abs(Math.cos(this.walkPhase));
        return { pose, speed: 18 };
      }
      default: {
        // Idle: breathing; exhausted fighters drop their hands and heave.
        const exhausted = f.stats.hasTag('state.exhausted');
        const tired = exhausted || f.stats.hasTag('state.tired');
        const rate = exhausted ? 5.5 : tired ? 4 : 2.4;
        const depth = exhausted ? 0.09 : tired ? 0.05 : 0.025;
        const b = Math.sin(time * rate) * depth;
        const pose = lerpPose(GUARD, GUARD, 0);
        const j = pose.joints;
        j.spine = [0.1 + b + (exhausted ? 0.25 : 0), -0.45, 0];
        if (exhausted) {
          j.lShoulder = [-0.35, 0, 0.2];
          j.lElbow = [-1.3, 0, 0];
          j.rShoulder = [-0.25, 0, -0.25];
          j.rElbow = [-1.2, 0, 0];
        }
        pose.drop = 0.05 + b * 0.3 + (exhausted ? 0.06 : 0);
        return { pose, speed: 12 };
      }
    }
  }

  private applyPose(pose: Pose, alpha: number): void {
    for (const j of JOINTS) {
      const target = pose.joints[j] ?? [0, 0, 0];
      const cur = this.current[j];
      cur.x += (target[0] - cur.x) * alpha;
      cur.y += (target[1] - cur.y) * alpha;
      cur.z += (target[2] - cur.z) * alpha;
      this.rig.joints[j].rotation.set(cur.x, cur.y, cur.z);
    }
    this.currentDrop += ((pose.drop ?? 0) - this.currentDrop) * alpha;
    this.currentPitch += ((pose.pitch ?? 0) - this.currentPitch) * alpha;
    this.rig.joints.hips.position.y = 0.95 - this.currentDrop;
    this.rig.pitch.rotation.x = this.currentPitch;
    // Lift slightly when lying down so limbs don't sink into the ground.
    this.rig.pitch.position.y = Math.abs(this.currentPitch) > 0.3 ? 0.12 * (Math.abs(this.currentPitch) / (Math.PI / 2)) : 0;
  }

  dispose(): void {
    this.root.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.rig.materials) m.dispose();
  }
}
