import * as THREE from 'three';
import { approvedAt } from './props/approvedFit';
import type { CharacterAppearance } from '../character/Appearance';
import type { Fighter } from '../fighter/Fighter';
import { buildCharacterRig, type Rig } from './CharacterRig';
import { buildWeaponMesh, disposeGroup } from './weaponMesh';
import { gymPiece, gymReady, loadGym } from './props/GymLibrary';
import { FighterAnimator, type Traits } from './anim/animator';
import { JOINTS, type Pose } from './poses';
import { ridePose } from './anim/ridePose';
import { bikeFit, riddenBike, type BikeFit } from './props/bikes';

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
    if (!obj) this.ride = null;
  }

  /** The bike being ridden: its model (wheels that turn), how the rider fits it, and the getting on and off. */
  private ride: { fit: BikeFit; spin(d: number): void; dist: number; on: number; leaving: (() => void) | null } | null = null;

  /** Get on this bike (already standing at it): the model goes under you and you swing a leg over. */
  rideBike(id: string, colour?: string): void {
    const fit = bikeFit(id);
    const bike = riddenBike(id, colour);
    const holder = new THREE.Group();
    // The model's nose is +x and the rider faces local +z; the seat goes under the hips.
    bike.group.position.x = -fit.seat.x;
    holder.add(bike.group);
    holder.rotation.y = -Math.PI / 2;
    this.setMount(holder);
    this.ride = { fit, spin: bike.spin, dist: 0, on: 0, leaving: null };
  }

  /** Already on (arrived riding): no getting-on swing. */
  skipMount(): void {
    if (this.ride) this.ride.on = 1;
  }

  /** Get off: the leg swings back over and you stand beside the bike; `done` once you're off (to park it). */
  leaveBike(done: () => void): void {
    if (!this.ride) return done();
    this.ride.leaving = done;
  }

  get mounted(): boolean {
    return this.mount !== null;
  }

  /**
   * Carry this view over to the same person in the next district of the street (a new Fighter object
   * standing a step over the seam): the model, weapon and animation carry on, nothing is rebuilt.
   */
  rebind(f: Fighter): void {
    this.animator.retarget(f);
    this.fighter = f;
  }

  constructor(public fighter: Fighter, appearance: CharacterAppearance = fighter.appearance) {
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
    let roll = 0;
    const r = this.ride;
    if (r) {
      const step = Number.isFinite(dt) ? Math.min(0.05, dt) : 1 / 60;
      // Wheels and cranks turn with the ground covered; getting on takes half a second, getting off a little less.
      r.dist += Math.abs(f.vel.x) * step;
      r.spin(r.dist);
      if (r.leaving) {
        r.on = Math.max(0, r.on - step / 0.4);
        if (r.on === 0) {
          const done = r.leaving;
          this.setMount(null);
          done();
        }
      } else r.on = Math.min(1, r.on + step / 0.5);
      if (this.ride) {
        const gear = r.fit.ride === 'pedal' ? 2.4 : 1;
        riding = ridePose(r.fit, this.rig.metrics, { crank: (r.dist / (r.fit.wheels[0].r * gear)) % (Math.PI * 2), speed: Math.abs(f.vel.x), on: r.on });
        // Leaning into a change of line, as a bike does.
        // Leaning into the turn: positive roll leans to the rider's right, which is +z riding right and -z riding left.
        roll = Math.max(-0.22, Math.min(0.22, f.vel.z * f.facing * 0.09 * Math.min(1, Math.abs(f.vel.x) / 3))) * r.on;
      }
    } else if (this.mount) {
      // Something else to sit on (not a bike): the old seated pose.
      const lean = Math.min(0.2, Math.abs(f.vel.x) * 0.02);
      riding = { ...RIDING, joints: { ...RIDING.joints, spine: [0.45 + lean, 0, 0] } };
    }
    const out = this.animator.update(Number.isFinite(dt) ? dt : 1 / 60, time, riding);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.y = out.yaw + this.extraYaw;
    this.root.rotation.z = roll;
    const rig = this.rig;
    for (const j of JOINTS) {
      const v = out.joints[j];
      rig.joints[j].rotation.set(v[0], v[1], v[2]);
    }
    // Hips: the rig's own rest position, moved by however far the animator has shifted and lowered them.
    const rest = rig.hipsRest;
    rig.joints.hips.position.set(rest.x + out.hips[0], rest.y + (out.hips[1] - rig.metrics.hipsY), rest.z + out.hips[2]);
    rig.pitch.rotation.x = out.pitch;
    // A body tipped over rests on whatever part of it is lowest (toes, then knees, hands and chest).
    rig.pitch.position.y = out.lift;
    rig.sync?.();

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
    this.syncGear();
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


  // ---- gym gear in the hands while training ----
  private gearKind: 'dumbbells' | 'barbell' | null = null;
  private gear: THREE.Object3D[] = [];
  /** Where each fist is: a point on each forearm, where the weapon grip sits. */
  private fists: [THREE.Object3D, THREE.Object3D] | null = null;

  /**
   * Curls and front raises hold a dumbbell in each fist; squats and presses hold the gym's barbell,
   * placed every frame between the fists and along them (on the shoulders in a squat, overhead in a
   * press). Both are the gym pack's own models (public/models/gym).
   */
  private syncGear(): void {
    const act = this.fighter.activity;
    const want = act === 'curl' || act === 'raises' ? 'dumbbells' : act === 'squat' || act === 'press' ? 'barbell' : null;
    if (want !== this.gearKind) {
      this.dropGear();
      if (want && this.buildGear(want)) this.gearKind = want;
    }
    if (this.gearKind !== 'barbell' || !this.fists) return;
    const bar = this.gear[0];
    this.root.updateMatrixWorld(true);
    const a = this.fists[0].getWorldPosition(new THREE.Vector3());
    const b = this.fists[1].getWorldPosition(new THREE.Vector3());
    this.root.worldToLocal(a);
    this.root.worldToLocal(b);
    bar.position.copy(a).add(b).multiplyScalar(0.5);
    const dir = b.sub(a);
    if (dir.lengthSq() > 1e-6) bar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  }

  private buildGear(kind: 'dumbbells' | 'barbell'): boolean {
    if (!gymReady()) void loadGym();
    if (!this.fists) {
      this.fists = [new THREE.Object3D(), new THREE.Object3D()];
      this.fists[0].position.set(0, -0.3, 0.02);
      this.fists[1].position.set(0, -0.3, 0.02);
      this.rig.joints.lElbow.add(this.fists[0]);
      this.rig.joints.rElbow.add(this.fists[1]);
    }
    if (kind === 'dumbbells') {
      for (const fist of this.fists) {
        // The approved 10 kg hex dumbbell: its handle (the long axis, x) across the fist, the heads either side.
        const hex = approvedAt('hexDumbbell10', { scale: 0.9 });
        const piece = hex ?? gymPiece('dumbbell_small', 0.17, 0.16, 0.19, { keepAspect: true });
        if (!piece) return this.dropGear(), false;
        const g = new THREE.Group();
        piece.position.y = -0.08 + (hex ? 0.02 : 0);
        g.add(piece);
        if (!hex) g.rotation.y = Math.PI / 2;
        fist.add(g);
        this.gear.push(g);
      }
      return true;
    }
    // The approved 60 kg Olympic barbell (the bar a little short of its 2.2 m, so it clears the walls), centred on its
    // own middle; the gym kit's bar if that isn't there.
    const piece = approvedAt('barbell60kg', { scale: 0.75 }) ?? gymPiece('barbell', 1.35, 0.44, 0.44, { keepAspect: true });
    if (!piece) return false;
    const box = new THREE.Box3().setFromObject(piece);
    piece.position.y -= (box.min.y + box.max.y) / 2;
    const g = new THREE.Group();
    g.add(piece);
    this.root.add(g);
    this.gear.push(g);
    return true;
  }

  private dropGear(): void {
    for (const g of this.gear) {
      g.parent?.remove(g);
      // The gym pack's meshes and materials are shared: only the wrappers go.
    }
    this.gear = [];
    this.gearKind = null;
  }

  dispose(): void {
    this.dropGear();
    if (this.weaponMesh) disposeGroup(this.weaponMesh);
    this.root.remove(this.rig.root);
    this.rig.dispose();
  }
}
