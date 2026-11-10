import * as THREE from 'three';
import type { CharacterAppearance } from '../character/Appearance';
import type { Fighter } from '../fighter/Fighter';
import { buildCharacterRig, type Rig } from './CharacterRig';
import { buildWeaponMesh, disposeGroup } from './weaponMesh';
import { FighterAnimator, type Traits } from './anim/animator';
import { JOINTS, type Pose } from './poses';

export { activityPose } from './activityPoses';

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


function traitsOf(f: Fighter, a: CharacterAppearance): Traits {
  return {
    skill: Math.max(0, Math.min(1, (f.stats.attr('technique') - 2) / 7)),
    bulk: Math.max(0, Math.min(1, (a.weight ?? 0) * 0.7 + (a.muscle ?? 0) * 0.5)),
    seed: ((f.id * 2654435761) >>> 0) / 4294967296,
  };
}

/**
 * Draws one Fighter from the simulation. Reads state only; never changes it.
 * The pose comes from the animator (anim/animator.ts); this puts it on the rig.
 */
export class FighterView {
  readonly root: THREE.Group;
  private rig: Rig;
  readonly animator: FighterAnimator;
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
    this.animator = new FighterAnimator(fighter, this.rig.metrics, traitsOf(fighter, appearance), appearance.height ?? 1);
    this.animator.onStep = () => this.onStep?.();
    this.update(1 / 60, 0);
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
    this.animator.setMetrics(this.rig.metrics, traitsOf(this.fighter, appearance), appearance.height ?? 1);
    this.update(1 / 60, 0);
  }

  /** Brief white flash when hit. */
  flash(): void {
    this.flashTime = 0.09;
  }

  update(dt: number, time: number): void {
    const f = this.fighter;
    this.root.position.set(f.pos.x, f.pos.y, f.pos.z);

    let riding: Pose | null = null;
    if (this.mount) {
      // Riding: sat on the bike, leaning into it with speed.
      const lean = Math.min(0.2, Math.abs(f.vel.x) * 0.02);
      riding = { ...RIDING, joints: { ...RIDING.joints, spine: [0.45 + lean, 0, 0] } };
    }
    const out = this.animator.update(Number.isFinite(dt) ? dt : 1 / 60, time, riding);
    this.root.rotation.y = out.yaw + this.extraYaw;
    const rig = this.rig;
    for (const j of JOINTS) {
      const v = out.joints[j];
      rig.joints[j].rotation.set(v[0], v[1], v[2]);
    }
    // Hips: the rig's own rest position, moved by however far the animator has shifted and lowered them.
    const rest = rig.hipsRest;
    rig.joints.hips.position.set(rest.x + out.hips[0], rest.y + (out.hips[1] - rig.metrics.hipsY), rest.z + out.hips[2]);
    rig.pitch.rotation.x = out.pitch;
    // Lift slightly when lying down so limbs don't sink into the ground.
    rig.pitch.position.y = Math.abs(out.pitch) > 0.3 ? 0.12 * Math.min(1, Math.abs(out.pitch) / (Math.PI / 2)) : 0;

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


  dispose(): void {
    if (this.weaponMesh) disposeGroup(this.weaponMesh);
    this.root.remove(this.rig.root);
    this.rig.dispose();
  }
}
