import * as THREE from 'three';
import type { Simulation } from '../core/Simulation';
import { HitboxView } from '../debug/HitboxView';
import type { Fighter } from '../fighter/Fighter';
import type { Quality } from '../save/Settings';
import { ArenaView } from './ArenaView';
import { CameraRig } from './CameraRig';
import { FighterView } from './FighterView';
import { HitFX } from './HitFX';
import { FRAMING, StudioView, type StudioFraming } from './StudioView';
import type { CharacterAppearance } from '../character/Appearance';

const BG = 0x0a0c12;

/** Owns the Three.js renderer and every view of the current simulation. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cameraRig: CameraRig;
  readonly fx = new HitFX();
  readonly hitboxes = new HitboxView();
  private arenaView: ArenaView | null = null;
  private views = new Map<number, FighterView>();
  private sim: Simulation | null = null;
  private quality: Quality;
  private studio: {
    view: StudioView;
    framing: StudioFraming;
    yaw: number;
    /** Where the menu panel sits, so the model is framed in the free space. */
    panel: 'left' | 'bottom' | 'none';
    camY: number;
    camDist: number;
  } | null = null;
  onFootstep: (() => void) | null = null;

  constructor(private readonly container: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.FogExp2(BG, 0.028);
    this.scene.add(this.fx.points, this.hitboxes.group);

    this.cameraRig = new CameraRig(1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.applyQuality(quality);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cameraRig.setAspect(w / h);
    this.cameraRig.compact = Math.min(w, h) < 520;
  }

  applyQuality(q: Quality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    this.renderer.shadowMap.enabled = q !== 'low';
    if (this.arenaView) {
      for (const l of this.arenaView.shadowLights) {
        l.castShadow = q !== 'low';
        l.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
        l.shadow.map?.dispose();
        l.shadow.map = null;
      }
    }
    this.resize();
  }

  /** Swap in a new simulation (e.g. starting a fight). */
  attach(sim: Simulation): void {
    this.detach();
    this.sim = sim;
    this.arenaView = new ArenaView(sim.arena);
    this.scene.add(this.arenaView.group);
    this.applyQuality(this.quality);
    for (const f of sim.fighters) this.addFighter(f);
  }

  /** Character creator / sheet: one fighter on the studio set. */
  attachStudio(sim: Simulation): void {
    this.detach();
    this.sim = sim;
    const view = new StudioView();
    this.scene.add(view.group);
    this.studio = { view, framing: 'full', yaw: 0.35, panel: 'left', camY: FRAMING.full.y, camDist: FRAMING.full.distance };
    for (const f of sim.fighters) this.addFighter(f);
    this.scene.fog = null;
  }

  setStudioFraming(framing: StudioFraming): void {
    if (this.studio) this.studio.framing = framing;
  }

  setStudioPanel(panel: 'left' | 'bottom' | 'none'): void {
    if (this.studio) this.studio.panel = panel;
  }

  /** Turntable rotation (radians). */
  rotateStudio(delta: number): void {
    if (this.studio) this.studio.yaw += delta;
  }

  setPreviewAppearance(f: Fighter, appearance: CharacterAppearance): void {
    this.views.get(f.id)?.setAppearance(appearance);
  }

  detach(): void {
    if (this.studio) {
      this.scene.remove(this.studio.view.group);
      this.studio.view.dispose();
      this.studio = null;
      this.scene.fog = new THREE.FogExp2(BG, 0.028);
    }
    if (this.arenaView) {
      this.scene.remove(this.arenaView.group);
      this.arenaView.group.traverse((o: THREE.Object3D) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            (m as THREE.MeshStandardMaterial).map?.dispose();
            (m as THREE.MeshStandardMaterial).emissiveMap?.dispose();
            m.dispose();
          }
        }
      });
      this.arenaView = null;
    }
    for (const v of this.views.values()) {
      this.scene.remove(v.root);
      v.dispose();
    }
    this.views.clear();
    this.sim = null;
  }

  private addFighter(f: Fighter): void {
    const v = new FighterView(f);
    if (f.team === 'player') v.onStep = () => this.onFootstep?.();
    this.views.set(f.id, v);
    this.scene.add(v.root);
  }

  viewOf(f: Fighter): FighterView | undefined {
    return this.views.get(f.id);
  }

  private updateStudioCamera(dt: number): void {
    const st = this.studio!;
    for (const v of this.views.values()) v.extraYaw = st.yaw - (v.fighter.facing * Math.PI) / 2;
    const target = FRAMING[st.framing];
    const k = 1 - Math.exp(-6 * dt);
    st.camY += (target.y - st.camY) * k;
    // Portrait phones show the model in the top half only, so step back further.
    const dist = target.distance * (st.panel === 'bottom' ? 1.4 : 1);
    st.camDist += (dist - st.camDist) * k;
    const cam = this.cameraRig.camera;
    // Shift the view so the model sits in the space not covered by the menu panel.
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * st.camDist;
    const halfW = halfH * cam.aspect;
    const offX = st.panel === 'left' ? -halfW * 0.38 : 0;
    const offY = st.panel === 'bottom' ? -halfH * 0.56 : 0;
    cam.position.set(offX, st.camY + 0.05 + offY, st.camDist);
    cam.lookAt(offX, st.camY + offY, 0);
  }

  /** @param focus the player fighter (camera follows), or null for the menu drift */
  render(dt: number, time: number, focus: Fighter | null): void {
    if (this.sim) {
      for (const f of this.sim.fighters) if (!this.views.has(f.id)) this.addFighter(f);
      for (const v of this.views.values()) v.update(dt, time);
      if (this.studio) {
        this.updateStudioCamera(dt);
      } else {
        this.hitboxes.update(this.sim.fighters);
        this.arenaView?.update(time);
        if (focus) this.cameraRig.update(dt, focus, focus.target, this.sim.arena.bounds);
        else this.cameraRig.attract(time);
      }
    }
    this.fx.update(dt);
    this.renderer.render(this.scene, this.cameraRig.camera);
  }
}
