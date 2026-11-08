import * as THREE from 'three';
import type { CharacterAppearance } from '../character/Appearance';
import { Fighter } from '../fighter/Fighter';
import { getStyle } from '../data/styles';
import { defaultAttributes } from '../stats/Stats';
import { FighterView } from '../render/FighterView';

/**
 * Character portraits for the profile and crew screens: one live turntable
 * (the selected fighter, full body, in their guard) and small head-and-
 * shoulders snapshots for the crew list, cached by look. Uses the same
 * character rig as the game, so what you see is what fights.
 */

function stage(): { scene: THREE.Scene; holder: THREE.Group } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121418);
  scene.add(new THREE.HemisphereLight(0xdfe4ee, 0x2a2420, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(2.5, 4, 4);
  const rim = new THREE.DirectionalLight(0xd23a3a, 1.2);
  rim.position.set(-3, 2.5, -3);
  scene.add(key, rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshStandardMaterial({ color: 0x1e2127, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  scene.add(floor, holder);
  return { scene, holder };
}

function viewFor(appearance: CharacterAppearance, weapon?: Fighter['weapon']): { view: FighterView; fighter: Fighter } {
  const fighter = new Fighter({ id: 0, name: '', team: 'player', attributes: defaultAttributes(5), style: getStyle('street'), x: 0, z: 0, appearance });
  if (weapon) fighter.equipWeapon(weapon.data.id, weapon.hits, weapon.mods);
  fighter.facing = 1;
  const view = new FighterView(fighter, appearance);
  view.update(1 / 60, 0);
  return { view, fighter };
}

class Turntable {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private s = stage();
  private camera = new THREE.PerspectiveCamera(30, 3 / 4, 0.05, 30);
  private view: FighterView | null = null;
  private key = '';
  private running = false;
  private last = performance.now();
  private t = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'portrait-live';
    this.canvas.width = 420;
    this.canvas.height = 560;
    this.camera.position.set(0, 1.05, 4.1);
    this.camera.lookAt(0, 0.92, 0);
  }

  show(key: string, appearance: CharacterAppearance, weapon?: Fighter['weapon']): void {
    if (key === this.key) return;
    this.key = key;
    this.s.holder.clear();
    this.view = viewFor(appearance, weapon).view;
    this.s.holder.add(this.view.root);
    this.start();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.canvas.isConnected) {
        this.running = false;
        return;
      }
      try {
        if (!this.renderer) {
          this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
          this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
          this.renderer.outputColorSpace = THREE.SRGBColorSpace;
          this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        }
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.t += dt;
        this.view?.update(dt, this.t);
        this.s.holder.rotation.y = -0.9 + Math.sin(this.t * 0.4) * 0.5;
        this.renderer.render(this.s.scene, this.camera);
      } catch {
        this.running = false;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

let live: Turntable | null = null;

/** The big live portrait (one at a time). */
export function livePortrait(key: string, appearance: CharacterAppearance, weapon?: Fighter['weapon']): HTMLCanvasElement {
  live ??= new Turntable();
  live.show(key, appearance, weapon);
  return live.canvas;
}

// ---- snapshots for lists ----

let snapRenderer: THREE.WebGLRenderer | null = null;
let snapCanvas: HTMLCanvasElement | null = null;
const snapCache = new Map<string, string>();

/** A head-and-shoulders picture (data URL), or '' if WebGL isn't available. */
export function portraitImage(key: string, appearance: CharacterAppearance): string {
  const hit = snapCache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    if (!snapRenderer) {
      snapCanvas = document.createElement('canvas');
      snapCanvas.width = 160;
      snapCanvas.height = 160;
      snapRenderer = new THREE.WebGLRenderer({ canvas: snapCanvas, antialias: true, preserveDrawingBuffer: true });
      snapRenderer.outputColorSpace = THREE.SRGBColorSpace;
      snapRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    }
    const s = stage();
    const { view } = viewFor(appearance);
    view.root.rotation.y = -0.35;
    s.holder.add(view.root);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
    cam.position.set(0, 1.5, 1.55);
    cam.lookAt(0, 1.42, 0);
    snapRenderer.render(s.scene, cam);
    url = snapCanvas!.toDataURL('image/png');
  } catch {
    url = '';
  }
  snapCache.set(key, url);
  return url;
}
