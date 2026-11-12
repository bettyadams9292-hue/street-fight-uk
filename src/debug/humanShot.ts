/**
 * `?shot=humans`: a line-up of characters built from the MakeHuman packs, on a
 * plain stage, for checking the character builder by eye and in the visual tests.
 * Runs instead of the game.
 */
import * as THREE from 'three';
import { DEFAULT_SHAPE, type BodyShape } from '../characters/human/body';
import { buildHuman, loadHumanAssets, preloadHuman, preloadAllHumans, type HumanSpec } from '../render/human/HumanBuilder';
import { buildHumanRig } from '../render/human/HumanRig';
import { araPose, loadAraMocap } from '../render/anim/araPose';
import { JOINTS } from '../render/poses';
import { randomAppearance } from '../character/Appearance';
import { npc } from '../characters/npcs';

const shape = (s: Partial<BodyShape>): BodyShape => ({ ...DEFAULT_SHAPE, ...s, sliders: { ...(s.sliders ?? {}) } });

export const LINEUP: HumanSpec[] = [
  {
    shape: shape({ gender: 1, age: 0.12, muscle: 0.75, weight: 0.45, height: 0.6 }),
    skin: 'm_light',
    eyeColour: '#5a7da0',
    garments: [{ kind: 'hoodie', colour: '#2b2e35' }, { kind: 'trackies', colour: '#1b1d22' }],
    items: [{ id: 'plimsolls' }, { id: 'fight_gloves', colour: '#a01818' }, { id: 'hair_crop', colour: '#3a2a1c' }],
  },
  {
    shape: shape({ gender: 0, age: 0.1, muscle: 0.5, weight: 0.4, height: 0.45, caucasian: 0.3, african: 0, asian: 0.7 }),
    skin: 'f_eurasian_young',
    items: [{ id: 'tee_female', colour: '#2a4d7a' }, { id: 'denim_shorts' }, { id: 'socks_high' }, { id: 'plimsolls' }, { id: 'hair_bob_bangs', colour: '#151210' }],
  },
  {
    shape: shape({ gender: 1, age: 0.2, muscle: 0.6, weight: 0.65, height: 0.55, african: 1, caucasian: 0 }),
    skin: 'm_african',
    eyeColour: '#3a2414',
    garments: [{ kind: 'puffer', colour: '#1f2a44' }, { kind: 'jeans', colour: '#2a3d5c' }],
    items: [ { id: 'ankle_boots_m' }, { id: 'beard_scruffy' }, { id: 'hair_short_messy', colour: '#121010' }],
  },
  {
    shape: shape({ gender: 0, age: 0.45, muscle: 0.4, weight: 0.7, height: 0.4, african: 0, asian: 0, caucasian: 0.4 }),
    skin: 'f_indian',
    items: [{ id: 'jumper_fisherman', colour: '#7a2a3a' }, { id: 'wool_trousers', colour: '#2b2b33' }, { id: 't_bars' }, { id: 'glasses_frames' }, { id: 'hair_bun', colour: '#1c1612' }],
  },
  {
    shape: shape({ gender: 1, age: 0.8, muscle: 0.4, weight: 0.6, height: 0.45 }),
    skin: 'm_eurasian_old',
    items: [{ id: 'jumper_fisherman', colour: '#4a5a44' }, { id: 'wool_trousers', colour: '#3b3328' }, { id: 'ankle_boots_m' }, { id: 'flat_cap', colour: '#5a4c3c' }, { id: 'moustache_viking' }],
  },
  {
    shape: shape({ gender: 1, age: 0.15, muscle: 0.9, weight: 0.85, height: 0.75 }),
    skin: 'm_tattooed',
    garments: [{ kind: 'tracksuit_top', colour: '#7d1a1a' }, { kind: 'trackies', colour: '#7d1a1a' }],
    items: [ { id: 'ankle_boots_m' }, { id: 'beard_viking' }, { id: 'hair_swept', colour: '#6a4a2c' }],
  },
  {
    shape: shape({ gender: 0, age: 0.15, muscle: 0.55, weight: 0.5, height: 0.6 }),
    skin: 'f_redhead',
    garments: [{ kind: 'vest', colour: '#7d1a1a' }, { kind: 'work_trousers', colour: '#2b2e35' }],
    items: [ { id: 'hair_braid', colour: '#9a4a1e' }],
  },
];

interface ShotState {
  ready: boolean;
  scene: string;
  error?: string;
}

/** Clips shown by `?shot=anims` (pick others with &clips=a,b,c and the time with &t=). */
const ANIM_CLIPS = ['walk', 'run', 'phone_call', 'texting', 'wave', 'cheer', 'point', 'talk_gestures', 'fight_idle', 'cry'];

export async function runHumanShot(root: HTMLElement, mode = 'humans'): Promise<void> {
  const out: ShotState = { ready: false, scene: mode };
  (window as unknown as { __shot: ShotState }).__shot = out;
  try {
    if (!(await loadHumanAssets())) throw new Error('character packs did not load');
    await Promise.all(LINEUP.map(preloadHuman));
    const w = root.clientWidth || innerWidth;
    const h = root.clientHeight || innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    root.innerHTML = '';
    root.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2a2c31');
    scene.add(new THREE.HemisphereLight('#dfe6f0', '#3a3530', 1.4));
    const key = new THREE.DirectionalLight('#fff2e0', 2.2);
    key.position.set(2.5, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 3, bottom: -1 });
    scene.add(key);
    const rim = new THREE.DirectionalLight('#9fb8ff', 1.0);
    rim.position.set(-3, 3, -4);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: '#45474c', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const gap = 0.78;
    const q = new URLSearchParams(location.search);
    const crowd = q.get('npcs');
    const clips = crowd ? Array.from({ length: 10 }, (_, i) => (i % 3 === 0 ? 'walk' : 'idle')) : q.get('clips')?.split(',') ?? ANIM_CLIPS;
    const count = mode === 'anims' ? clips.length : LINEUP.length;
    if (mode === 'anims') {
      // Each character plays one Ara clip, frozen at the same moment.
      await Promise.all([preloadAllHumans(), loadAraMocap()]);
      const t = Number(q.get('t') ?? 0.4);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const t0 = performance.now();
      clips.forEach((id, i) => {
        const rig = buildHumanRig(crowd ? npc(crowd, i).appearance : randomAppearance(rnd));
        if (!rig) throw new Error('could not build a rig');
        const pose = araPose(id, t, rig.metrics);
        if (!pose) throw new Error(`no clip ${id}`);
        for (const j of JOINTS) {
          const v = pose.joints[j] ?? [0, 0, 0];
          rig.joints[j].rotation.set(v[0], v[1], v[2]);
        }
        const r = rig.hipsRest;
        rig.joints.hips.position.set(r.x + (pose.shift?.[0] ?? 0), r.y - (pose.drop ?? 0), r.z + (pose.shift?.[1] ?? 0));
        rig.pitch.rotation.x = pose.pitch ?? 0;
        rig.sync?.();
        rig.root.position.x = (i - (count - 1) / 2) * 0.95;
        rig.root.rotation.y = q.get('side') ? Math.PI / 2 : 0;
        scene.add(rig.root);
      });
      (out as ShotState & { buildMs?: number }).buildMs = (performance.now() - t0) / clips.length;
    } else
      LINEUP.forEach((spec, i) => {
        const hum = buildHuman(spec);
        if (!hum) throw new Error(`could not build character ${i}`);
        hum.root.position.x = (i - (LINEUP.length - 1) / 2) * gap;
        scene.add(hum.root);
      });
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
    const view = new URLSearchParams(location.search).get('view');
    if (view) {
      // ?view=<index>:<face|body|back> for close inspection.
      const [i, part] = view.split(':');
      const x = (Number(i) - (count - 1) / 2) * (mode === 'anims' ? 0.95 : gap);
      const y = part === 'face' ? 1.6 : 0.95;
      const d = part === 'face' ? 1.2 : 3.6;
      cam.position.set(x, y, part === 'back' ? -d : d);
      cam.lookAt(x, y, 0);
    } else {
      cam.position.set(0, 1.0, mode === 'anims' ? 9.5 : 7.2);
      cam.lookAt(0, 0.9, 0);
    }
    await document.fonts.ready;
    renderer.render(scene, cam);
    // Close-up of the faces, inset at the top right.
    const close = new THREE.PerspectiveCamera(22, 2, 0.05, 20);
    close.position.set(-0.35, 1.62, 2.4);
    close.lookAt(-0.35, 1.58, 0);
    (window as unknown as { __humans: unknown }).__humans = { scene, renderer, cam, close };
  } catch (e) {
    out.error = (e as Error).message;
    console.error(e);
  }
  out.ready = true;
}
