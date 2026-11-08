import * as THREE from 'three';
import type { CharacterAppearance } from '../character/Appearance';
import type { Fighter } from '../fighter/Fighter';
import { buildCharacterRig, type Rig } from './CharacterRig';
import { buildWeaponMesh, disposeGroup } from './weaponMesh';

const BASE_GUARD = GUARD;
import {
  ANIM_POSES,
  BLOCK,
  CLINCHED,
  CLINCH_HOLD,
  DODGE_BACK,
  DODGE_SIDE,
  GUARD,
  GUARD_BREAK,
  HITSTUN,
  JOINTS,
  JUMP,
  LYING,
  MOUNT,
  PARRIED,
  SLIP,
  STAGGER,
  STANCES,
  easeInOut,
  lerpPose,
  type JointName,
  type Pose,
} from './poses';

/**
 * Draws one Fighter from the simulation. Reads state only; never changes it.
 */
/** Sat on a motorbike: thighs forward, knees bent to the pegs, arms out to the bars. */
const RIDING: Pose = {
  joints: {
    hips: [0, 0, 0],
    spine: [0.45, 0, 0],
    head: [-0.3, 0, 0],
    lShoulder: [-1.15, 0, -0.25],
    lElbow: [-0.55, 0, 0],
    rShoulder: [-1.15, 0, 0.25],
    rElbow: [-0.55, 0, 0],
    lHip: [-1.25, 0, 0.18],
    lKnee: [1.75, 0, 0],
    rHip: [-1.25, 0, -0.18],
    rKnee: [1.75, 0, 0],
  },
  drop: -0.02,
};

export { activityPose } from './activityPoses';
import { activityPose } from './activityPoses';

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
  private zMotion = 0;
  private flashTime = 0;
  private weaponId: string | null = null;
  private weaponMesh: THREE.Group | null = null;
  /** Enemies glow red while winding up a heavy attack, so it can be read and avoided. */
  telegraphs = false;
  /** Extra rotation on top of facing (the character creator's turntable). */
  extraYaw = 0;
  /** Fires when a foot hits the ground while walking (for footstep audio). */
  onStep: (() => void) | null = null;
  /** Something you're sat on (a motorbike): drawn under you, and you sit rather than walk. */
  private mount: THREE.Object3D | null = null;

  /** Put the fighter on (or take them off) a ride. The mount's nose points along local +z. */
  setMount(obj: THREE.Object3D | null): void {
    if (this.mount) this.root.remove(this.mount);
    this.mount = obj;
    if (obj) this.root.add(obj);
  }

  get mounted(): boolean {
    return this.mount !== null;
  }

  constructor(readonly fighter: Fighter, appearance: CharacterAppearance = fighter.appearance) {
    this.root = new THREE.Group();
    this.rig = buildCharacterRig(appearance);
    this.root.add(this.rig.root);
    this.current = Object.fromEntries(JOINTS.map((j) => [j, new THREE.Vector3()])) as Record<JointName, THREE.Vector3>;
    this.yaw = (fighter.facing * Math.PI) / 2;
    this.lastX = fighter.pos.x;
    this.lastZ = fighter.pos.z;
    this.applyPose(GUARD, 1);
  }

  /** Rebuild the model with a new look (character creator, clothes changes). Keeps the current pose. */
  setAppearance(appearance: CharacterAppearance): void {
    if (this.weaponMesh) disposeGroup(this.weaponMesh);
    this.weaponMesh = null;
    this.weaponId = null;
    this.root.remove(this.rig.root);
    this.rig.dispose();
    this.rig = buildCharacterRig(appearance);
    this.root.add(this.rig.root);
    this.applyPose({ joints: {} }, 0);
  }

  /** Brief white flash when hit. */
  flash(): void {
    this.flashTime = 0.09;
  }

  update(dt: number, time: number): void {
    const f = this.fighter;
    this.root.position.set(f.pos.x, f.pos.y, f.pos.z);

    // Turn smoothly to face left/right (or the way they're sat, on furniture), the short way round.
    const targetYaw = f.yawOverride ?? (f.facing * Math.PI) / 2;
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    this.yaw += dy * (1 - Math.exp(-(f.yawOverride !== null ? 9 : 28) * dt));
    this.root.rotation.y = this.yaw + this.extraYaw;

    const moved = Math.hypot(f.pos.x - this.lastX, f.pos.z - this.lastZ);
    this.zMotion = Math.abs(f.pos.z - this.lastZ);
    this.lastX = f.pos.x;
    this.lastZ = f.pos.z;

    const { pose, speed } = this.targetPose(moved, time);
    this.applyPose(pose, 1 - Math.exp(-speed * dt));

    // Hit flash.
    this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.flashTime > 0) {
      for (const m of this.rig.flashMaterials) m.emissive.setScalar(0.6);
    } else if (this.telegraphs && this.isWindingUpHeavy()) {
      const pulse = 0.25 + 0.2 * Math.sin(time * 40);
      for (const m of this.rig.flashMaterials) m.emissive.setRGB(pulse * 1.6, pulse * 0.25, 0);
    } else {
      for (const m of this.rig.flashMaterials) m.emissive.setScalar(0);
    }
    this.syncWeapon();
  }

  private isWindingUpHeavy(): boolean {
    const f = this.fighter;
    const m = f.state === 'attack' ? f.move : null;
    if (!m || m.frame >= m.startup) return false;
    const d = m.data;
    return d.kind === 'heavy' || d.kind === 'special' || d.kind === 'grab' || d.reaction === 'knockdown';
  }

  /** Show whatever weapon the fighter is holding in the rear hand. */
  private syncWeapon(): void {
    const id = this.fighter.weapon?.data.id ?? null;
    if (id === this.weaponId) return;
    if (this.weaponMesh) {
      this.weaponMesh.parent?.remove(this.weaponMesh);
      disposeGroup(this.weaponMesh);
      this.weaponMesh = null;
    }
    this.weaponId = id;
    if (!id || !this.fighter.weapon) return;
    const mesh = buildWeaponMesh(this.fighter.weapon.data);
    // Grip in the fist, pointing forward out of it.
    mesh.position.set(0, -0.3, 0.02);
    mesh.rotation.x = Math.PI / 2;
    this.rig.joints.rElbow.add(mesh);
    this.weaponMesh = mesh;
  }

  private targetPose(moved: number, time: number): { pose: Pose; speed: number } {
    const f = this.fighter;
    const act = f.activity ?? (moved < 0.002 ? f.ambientPose : null);
    if (act) return { pose: activityPose(act, time), speed: act === 'speedball' || act === 'run' ? 22 : 14 };
    if (this.mount) {
      // Riding: sat on the seat, hands on the bars, a little lean when moving.
      const lean = Math.min(0.25, moved * 4);
      return { pose: { ...RIDING, joints: { ...RIDING.joints, spine: [0.45 + lean, 0, 0] } }, speed: 14 };
    }
    const GUARD = STANCES[f.style.id] ?? BASE_GUARD;
    switch (f.state) {
      case 'attack': {
        const m = f.move!;
        const poses = ANIM_POSES[m.data.anim] ?? { chamber: GUARD, strike: GUARD };
        // Clinch and ground moves return to their hold, not the stance.
        const rest = f.grapple ? (f.grapple.phase === 'ground' ? MOUNT : CLINCH_HOLD) : GUARD;
        if (m.frame < m.startup) {
          const t = m.frame / m.startup;
          if (t < 0.6) return { pose: lerpPose(GUARD, poses.chamber, easeInOut(t / 0.6)), speed: 30 };
          return { pose: lerpPose(poses.chamber, poses.strike, ((t - 0.6) / 0.4) * 0.75), speed: 40 };
        }
        if (m.frame < m.startup + m.active) return { pose: poses.strike, speed: 55 };
        const t = (m.frame - m.startup - m.active) / Math.max(1, m.recovery);
        return { pose: lerpPose(poses.strike, rest, easeInOut(Math.min(1, t))), speed: 30 };
      }
      case 'dodge': {
        const kind = f.style.defence === 'slip' ? SLIP : this.zMotion > 0.001 ? DODGE_SIDE : DODGE_BACK;
        return { pose: kind, speed: 30 };
      }
      case 'parried':
        return { pose: PARRIED, speed: 25 };
      case 'clinch_hold':
        return { pose: CLINCH_HOLD, speed: 18 };
      case 'clinched':
        return { pose: CLINCHED, speed: 18 };
      case 'ground_top':
        return { pose: MOUNT, speed: 12 };
      case 'ground_bottom':
        return { pose: LYING, speed: 10 };
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

  private applyPose(pose: Pose, alphaIn: number): void {
    // Never overshoot (a bad frame time would otherwise fling the limbs off to infinity).
    const alpha = Number.isFinite(alphaIn) ? Math.min(1, Math.max(0, alphaIn)) : 1;
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
    if (this.weaponMesh) disposeGroup(this.weaponMesh);
    this.root.remove(this.rig.root);
    this.rig.dispose();
  }
}
