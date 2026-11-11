import * as THREE from 'three';
import { themeProfile } from './themes';
import type { Simulation } from '../core/Simulation';
import { HitboxView } from '../debug/HitboxView';
import type { Fighter } from '../fighter/Fighter';
import type { Quality } from '../save/Settings';
import { ArenaView } from './ArenaView';
import { CameraRig } from './CameraRig';
import { FighterView } from './FighterView';
import { HitFX } from './HitFX';
import { HouseFX } from './HouseFX';
import { FRAMING, StudioView, type StudioFraming } from './StudioView';
import type { CharacterAppearance } from '../character/Appearance';
import type { World } from '../world/World';
import { LevelView } from './LevelView';
import { resolveLook, type Look } from './look/looks';
import { PostFX } from './look/PostFX';

const BG = 0x0a0c12;

/** Owns the Three.js renderer and every view of the current simulation. */
export class GameRenderer {
  /** Update everything but don't draw. The visual tests fast-forward with this; only the last frames are drawn. */
  skipDraw = false;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cameraRig: CameraRig;
  readonly fx = new HitFX();
  /** The house's activity effects (fridge door, steam, shower water). */
  readonly house = new HouseFX();
  readonly hitboxes = new HitboxView();
  private arenaView: ArenaView | null = null;
  private levelView: LevelView | null = null;
  private world: World | null = null;
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
  /** The look the scene is drawn through (`?look=`), or null for the plain picture. */
  private postfx: PostFX | null = null;

  constructor(private readonly container: HTMLElement, quality: Quality, lighting = true) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.FogExp2(BG, 0.028);
    this.scene.add(this.fx.points, this.hitboxes.group, this.house.group);

    this.cameraRig = new CameraRig(1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.applyQuality(quality);
    this.lighting = lighting;
    this.setLook(resolveLook(window.location.search, lighting));
  }

  /** Draw through a look, or pass null for the plain picture. Low quality never uses one: it is the fallback for weak devices. */
  setLook(look: Look | null): void {
    this.wantedLook = look;
    this.postfx?.dispose();
    this.postfx = null;
    if (look && this.quality !== 'low' && !this.lookDropped) {
      // Multisampling through the look is the dearest part; only high quality pays for it.
      this.postfx = new PostFX(this.renderer, this.scene, this.cameraRig.camera, look, this.quality === 'high');
      this.postfx.setInterior(this.interior);
      this.resize();
    }
  }

  get look(): Look | null {
    return this.postfx?.look ?? null;
  }

  private interior = false;
  private wantedLook: Look | null = null;
  private lighting = true;
  /** Set when a device proved too slow for the look even at the lowest resolution; it stays off until reload. */
  private lookDropped = false;

  /** The player's Display setting: lighting and glow on or off. */
  setLighting(on: boolean): void {
    if (on === this.lighting) return;
    this.lighting = on;
    this.lookDropped = false;
    this.setLook(resolveLook(window.location.search, on));
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.postfx?.setSize(w, h, this.renderer.getPixelRatio());
    this.cameraRig.setAspect(w / h);
    this.cameraRig.compact = Math.min(w, h) < 520;
  }

  applyQuality(q: Quality): void {
    const changed = q !== this.quality;
    this.quality = q;
    if (changed && this.wantedLook) this.setLook(this.wantedLook);
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio((q === 'low' ? Math.min(dpr, 1) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2)) * (this.resScale ?? 1));
    this.renderer.shadowMap.enabled = q !== 'low';
    const lights = [...(this.arenaView?.shadowLights ?? []), ...(this.levelView?.shadowLights ?? [])];
    if (lights.length) {
      for (const l of lights) {
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
    this.interior = false;
    this.postfx?.setInterior(false);
    this.arenaView = new ArenaView(sim.arena);
    this.scene.add(this.arenaView.group);
    this.applyQuality(this.quality);
    for (const f of sim.fighters) this.addFighter(f);
  }

  /** Story mode: an area of the neighbourhood. */
  attachWorld(world: World): void {
    this.detach();
    this.sim = world.sim;
    this.world = world;
    this.levelView = new LevelView(world.level, world.progress);
    this.scene.add(this.levelView.group);
    const prof = themeProfile(world.level.theme);
    const bg = prof.interior ? 0x07080b : prof.roofed ? prof.bg : world.level.theme === 'estate' || world.level.theme === 'high_street' ? BG : prof.bg;
    this.scene.background = new THREE.Color(bg);
    const mist = world.level.weather === 'mist' ? 1.8 : 1;
    this.scene.fog = prof.interior || !prof.fog ? null : new THREE.FogExp2(bg, prof.fog * mist);
    this.interior = !!prof.interior;
    this.postfx?.setInterior(this.interior);
    this.cameraRig.resetWorld();
    this.applyQuality(this.quality);
    for (const f of world.sim.fighters) this.addFighter(f);
    // Compile every shader the area needs now, during the fade, instead of mid-fight.
    this.renderer.compile(this.scene, this.cameraRig.camera);
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
    this.house.clear();
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
    if (this.levelView) {
      this.scene.remove(this.levelView.group);
      this.levelView.dispose();
      this.levelView = null;
      this.world = null;
      this.scene.background = new THREE.Color(BG);
      this.scene.fog = new THREE.FogExp2(BG, 0.028);
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
    v.telegraphs = f.team === 'enemy' && !!this.world;
    this.views.set(f.id, v);
    this.scene.add(v.root);
  }

  /** Add views for new fighters and drop views of fighters that left the simulation. */
  syncFighters(): void {
    if (!this.sim) return;
    const ids = new Set(this.sim.fighters.map((f) => f.id));
    for (const [id, v] of this.views) {
      if (!ids.has(id) || v.fighter !== this.sim.fighters.find((f) => f.id === id)) {
        this.scene.remove(v.root);
        v.dispose();
        this.views.delete(id);
      }
    }
    for (const f of this.sim.fighters) if (!this.views.has(f.id)) this.addFighter(f);
  }

  /** Props that come and go during a visit (a parked bike). */
  setDynamicProp(key: string, p: import('../world/LevelTypes').PropDef | null): void {
    if (p) this.levelView?.addDynamicProp(key, p);
    else this.levelView?.removeDynamicProp(key);
  }

  hideLevelProp(p: import('../world/LevelTypes').PropDef): void {
    this.levelView?.hideProp(p);
  }

  /** The home placement editor's preview piece. */
  setGhost(item: string | null, colour: string, at?: { x: number; z: number; rot: number }, ok = true): void {
    this.levelView?.setGhost(item, colour, at, ok);
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

  /** Where a point in the world is on screen (CSS pixels), or null if it's behind the camera. */
  screenOf(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = new THREE.Vector3(x, y, z).project(this.cameraRig.camera);
    if (v.z > 1) return null;
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** @param focus the player fighter (camera follows), or null for the menu drift */
  render(dt: number, time: number, focus: Fighter | null): void {
    if (this.sim) {
      if (this.world || this.views.size !== this.sim.fighters.length) this.syncFighters();
      for (const v of this.views.values()) v.update(dt, time);
      if (this.studio) {
        this.updateStudioCamera(dt);
      } else {
        this.hitboxes.update(this.sim.fighters);
        this.arenaView?.update(time);
        if (this.world && focus) {
          this.cameraRig.updateWorld(dt, focus, focus.target, this.sim.arena.bounds, this.sim.arena.lock);
          this.levelView?.update(dt, time, this.world, this.cameraRig.focusX);
        } else if (focus) this.cameraRig.update(dt, focus, focus.target, this.sim.arena.bounds);
        else this.cameraRig.attract(time);
      }
    }
    this.fx.update(dt);
    this.house.update(dt);
    if (!this.skipDraw) {
      if (this.postfx) this.postfx.render(this.cameraRig.camera, time);
      else this.renderer.render(this.scene, this.cameraRig.camera);
    }
    this.adaptResolution(dt);
  }

  // ---- dynamic resolution -------------------------------------------------------------
  /** 1 = the quality setting's pixel ratio; drops in steps when frames run long, recovers when there's headroom. */
  private resScale = 1;
  private slowTime = 0;
  private fastTime = 0;
  private frameAvg = 1 / 60;

  private adaptResolution(dt: number): void {
    if (dt <= 0 || dt > 0.25) return; // tab switches and pauses aren't lag
    this.frameAvg += (dt - this.frameAvg) * 0.05;
    if (this.frameAvg > 1 / 45) {
      this.slowTime += dt;
      this.fastTime = 0;
    } else if (this.frameAvg < 1 / 58) {
      this.fastTime += dt;
      this.slowTime = 0;
    } else {
      this.slowTime = 0;
      this.fastTime = 0;
    }
    if (this.slowTime > 1.5 && this.resScale > 0.55) {
      this.setResScale(this.resScale - 0.15);
      this.slowTime = 0;
    } else if (this.slowTime > 3 && this.postfx) {
      // Already at the lowest resolution and still slow: the look goes before the frame rate does.
      this.lookDropped = true;
      this.setLook(this.wantedLook);
      this.slowTime = 0;
    } else if (this.fastTime > 6 && this.resScale < 1) {
      this.setResScale(this.resScale + 0.1);
      this.fastTime = 0;
    }
  }

  private setResScale(v: number): void {
    this.resScale = Math.max(0.55, Math.min(1, v));
    this.renderer.setPixelRatio(this.basePixelRatio() * this.resScale);
    this.resize();
  }

  private basePixelRatio(): number {
    const dpr = window.devicePixelRatio || 1;
    return this.quality === 'low' ? Math.min(dpr, 1) : this.quality === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
  }
}
