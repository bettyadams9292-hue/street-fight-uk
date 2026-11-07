import * as THREE from 'three';
import type { Progress } from '../progress/Progress';
import type { ExitDef, FacadeDef, LevelDef, PropDef, Theme } from '../world/LevelTypes';
import { PROP_SIZE } from '../world/LevelTypes';
import { themeProfile } from './themes';
import { exitLocked, type World } from '../world/World';
import {
  concreteTexture,
  corrugatedTexture,
  graffitiTexture,
  markingsTexture,
  plasterTexture,
  posterTexture,
  seeded,
  signTexture,
  tileTexture,
  windowGridTexture,
  woodFloorTexture,
} from './levelTextures';
import { brickTexture, canvas, pavingTexture, roadTexture, shutterTexture, toTexture } from './textures';
import { buildWeaponMesh, disposeGroup } from './weaponMesh';
import { WEAPONS } from '../combat/Weapons';
import { RARITY_COLOURS, itemDef } from '../items/items';
import { itemIconUrl } from '../ui/itemIcons';

/** How far the scenery carries on past the playable ends, so the camera never sees past it. */
export const LEVEL_EXTENT = 16;

/** The back wall sits just behind the walkable band (body radius plus room for door frames and sills), so you can walk right up to it. */
export function backWallZ(level: LevelDef): number {
  return level.bounds.minZ - 0.55;
}

const STREET_THEMES: Theme[] = ['estate', 'high_street', 'city', 'residential', 'leisure', 'stadium', 'nightlife', 'ind_estate'];

/**
 * Builds an area of the world from its LevelDef: ground, building fronts,
 * street furniture (sized from the same table as collision), lights, doors,
 * gates, levers, and the live pickups and weapons lying about.
 */
export class LevelView {
  readonly group = new THREE.Group();
  readonly shadowLights: THREE.DirectionalLight[] = [];
  private readonly back: number;
  private readonly X0: number;
  private readonly X1: number;
  private readonly rnd: () => number;
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private pickupMeshes = new Map<string, THREE.Object3D>();
  private itemMeshes = new Map<string, THREE.Object3D>();
  private projMeshes = new Map<string, THREE.Object3D>();
  private breakMeshes = new Map<string, { whole: THREE.Object3D; debris: THREE.Object3D }>();
  private containerMarks = new Map<string, THREE.Object3D>();
  private gates = new Map<string, { mesh: THREE.Object3D; lift: number }>();
  private levers = new Map<string, { handle: THREE.Object3D; lamp: THREE.MeshStandardMaterial }>();
  private exitSigns: { exit: ExitDef; mat: THREE.MeshStandardMaterial; text: THREE.Mesh; locked: boolean | null }[] = [];
  private highlight: THREE.Mesh;
  private flicker: { light: THREE.PointLight; base: number }[] = [];
  private sun: THREE.DirectionalLight;
  private water: THREE.Mesh | null = null;
  private rain: THREE.LineSegments | null = null;
  private rainBase: Float32Array | null = null;

  constructor(readonly level: LevelDef, private readonly progress: Progress) {
    this.back = backWallZ(level);
    this.X0 = level.bounds.minX - LEVEL_EXTENT;
    this.X1 = level.bounds.maxX + LEVEL_EXTENT;
    this.rnd = seeded(hash(level.id));
    this.highlight = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.85 }));
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.visible = false;
    this.group.add(this.highlight);
    this.sun = new THREE.DirectionalLight(0x9fb0e0, 0.55);
    this.build();
  }

  // ---- helpers ------------------------------------------------------------------

  private mat(colour: string | number, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    const key = `${colour}|${rough}|${metal}|${JSON.stringify(extra)}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal, ...extra });
      this.mats.set(key, m);
    }
    return m;
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, cast = true, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private cyl(r0: number, r1: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 16, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** A flat panel on the back wall, slightly in front of it. */
  private panel(w: number, h: number, x: number, y: number, m: THREE.Material, dz = 0.02): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, this.back + dz);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private ground(x0: number, x1: number, z0: number, z1: number, m: THREE.Material, y = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  // ---- building the area -----------------------------------------------------------

  private build(): void {
    const lvl = this.level;
    this.buildGround();
    // Carry the end facades on past the edges so the camera never sees a gap.
    const fac = [...lvl.facades].sort((a, b) => a.x0 - b.x0);
    if (fac.length) {
      this.buildFacade({ ...fac[0], x0: this.X0, x1: fac[0].x0, label: undefined });
      for (const f of fac) this.buildFacade(f);
      const last = fac[fac.length - 1];
      this.buildFacade({ ...last, x0: last.x1, x1: this.X1, label: undefined });
    }
    if (themeProfile(lvl.theme).skyline !== 'none') this.buildSkyline();
    for (const w of lvl.walls ?? []) this.buildWall(w);
    for (const p of lvl.props) this.buildProp(p);
    for (const ex of lvl.exits) this.buildExit(ex);
    for (const g of lvl.gates ?? []) this.buildGate(g.id, g.x, g.z0, g.z1);
    for (const l of lvl.levers ?? []) this.buildLever(l.id, l.x);
    this.buildGraffiti();
    this.buildLights();
    this.buildWeather();
  }

  private buildGround(): void {
    const { minX, maxX, maxZ } = this.level.bounds;
    const X0 = this.X0;
    const X1 = this.X1;
    const W = X1 - X0;
    const front = maxZ + 0.4;
    const theme = this.level.theme;
    if (theme === 'home') {
      const floors: Record<string, THREE.Material> = {
        Bedroom: new THREE.MeshStandardMaterial({ color: 0x6d5a7a, roughness: 1 }),
        'Living room': new THREE.MeshStandardMaterial({ color: 0x7a3a2c, roughness: 1 }),
        Kitchen: new THREE.MeshStandardMaterial({ map: tileTexture('#d8d2c0', '#6f6a60', 6, 4, 64), roughness: 0.5 }),
        Gym: new THREE.MeshStandardMaterial({ color: 0x1d2a22, roughness: 0.95 }),
        Garage: new THREE.MeshStandardMaterial({ map: concreteTexture('#7a7874', 4, 2), roughness: 0.9 }),
      };
      for (const f of this.level.facades) this.ground(f.x0, f.x1, this.back, front, floors[f.label ?? ''] ?? new THREE.MeshStandardMaterial({ map: woodFloorTexture(4, 2) }));
      // Cutaway edge of the floor, and outside darkness beyond.
      this.box(maxX - minX, 0.3, 0.2, (minX + maxX) / 2, -0.15, front + 0.1, this.mat('#2a2522'), false);
      this.ground(X0, X1, front + 0.2, front + 20, this.mat('#07080b', 1), -0.3);
      // Outside walls at the ends.
      this.box(0.3, 3, front - this.back, minX - 0.15, 1.5, (front + this.back) / 2, this.mat('#4a4038'));
      this.box(0.3, 3, front - this.back, maxX + 0.15, 1.5, (front + this.back) / 2, this.mat('#4a4038'));
      return;
    }
    if (theme === 'subway') {
      this.ground(X0, X1, this.back, front + 3, new THREE.MeshStandardMaterial({ map: tileTexture('#8a8578', '#4a4740', W / 2, 3, 64), roughness: 0.55 }));
      // Ceiling with strip lights.
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, front - this.back + 2), new THREE.MeshStandardMaterial({ map: concreteTexture('#5a5a58', W / 4, 1), roughness: 1, side: THREE.DoubleSide }));
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set((X0 + X1) / 2, 3.3, (this.back + front) / 2 - 0.5);
      this.group.add(ceiling);
      for (let x = X0 + 4; x < X1; x += 8) this.box(1.6, 0.06, 0.18, x, 3.26, this.back + 1.2, this.mat('#ffffff', 0.4, 0, { emissive: 0xe8fff0, emissiveIntensity: 1.2 }), false);
      // Low tiled wall along the front.
      this.box(W, 0.5, 0.25, (X0 + X1) / 2, 0.25, front + 0.15, new THREE.MeshStandardMaterial({ map: tileTexture('#c9c2a8', '#5c574c', W / 2, 1), roughness: 0.4 }));
      return;
    }
    const prof = themeProfile(theme);
    if (prof.interior) return this.interiorGround(front);
    if (prof.roofed) return this.roofedGround(front);
    const depth = front - this.back;
    let groundMat: THREE.MeshStandardMaterial;
    switch (prof.ground) {
      case 'hard':
        groundMat = new THREE.MeshStandardMaterial({ map: markingsTexture(theme === 'territory' || theme === 'hq' ? '#3f3a35' : '#55524c', '#c9a227', W / 8), roughness: 0.9 });
        break;
      case 'concrete':
        groundMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#6e6c66', W / 4, depth / 4), roughness: 0.92 });
        break;
      case 'cobbles':
        groundMat = new THREE.MeshStandardMaterial({ map: tileTexture('#6a645a', '#2a2620', W / 0.9, depth / 0.9, 32), roughness: 0.75, color: theme === 'alleys' ? 0xb0aaa0 : 0xffffff });
        if (theme === 'alleys') groundMat = new THREE.MeshStandardMaterial({ map: pavingTexture(W / 2.4, depth / 2.4), roughness: 0.82, color: 0x8a8478 });
        break;
      default:
        groundMat = new THREE.MeshStandardMaterial({ map: pavingTexture(W / 2.4, depth / 2.4), roughness: 0.82, color: theme === 'precinct' ? 0xc8bfae : theme === 'residential' ? 0xe8e4dc : 0xffffff });
    }
    this.ground(X0, X1, this.back, front, groundMat);
    if (!prof.road && theme !== 'alleys') {
      if (theme === 'docks') {
        // Quay edge and black water beyond.
        this.box(W, 0.3, 0.4, (X0 + X1) / 2, -0.05, front + 0.2, new THREE.MeshStandardMaterial({ map: concreteTexture('#8a8780', W / 3, 1), roughness: 0.95 }), false);
        this.box(W, 0.08, 0.08, (X0 + X1) / 2, 0.14, front + 0.36, this.mat('#c9a227', 0.6), false);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(W, 40), this.mat('#0a1620', 0.08, 0.6, { emissive: 0x0a1a2a, emissiveIntensity: 0.4 }));
        water.rotation.x = -Math.PI / 2;
        water.position.set((X0 + X1) / 2, -0.9, front + 20.4);
        this.group.add(water);
        this.water = water;
        return;
      }
      // A forecourt or yard: kerb, then more of the same surface fading into the dark.
      this.box(W, 0.14, 0.2, (X0 + X1) / 2, 0.07, front + 0.1, this.mat('#77787c', 0.9), false);
      this.ground(X0, X1, front + 0.2, front + 14, new THREE.MeshStandardMaterial({ map: concreteTexture('#3a3a3c', W / 6, 3), roughness: 0.95 }), -0.01);
      return;
    }
    if (theme === 'alleys') {
      // Low back wall of the gardens opposite.
      this.ground(X0, X1, front, front + 12, new THREE.MeshStandardMaterial({ map: pavingTexture(W / 2.4, 5), color: 0x6a665e, roughness: 0.9 }));
      this.box(W, 0.6, 0.3, (X0 + X1) / 2, 0.3, front + 0.5, new THREE.MeshStandardMaterial({ map: brickTexture(W / 4, 0.3) }));
      return;
    }
    this.box(W, 0.12, 0.25, (X0 + X1) / 2, 0.06, front + 0.12, this.mat('#77787c', 0.9), false);
    this.ground(X0, X1, front + 0.25, front + 14, new THREE.MeshStandardMaterial({ map: roadTexture(W / 8), roughness: 0.55, metalness: 0.05 }), -0.02);
    // Puddles pick up the lamps.
    const puddle = this.mat('#2a2e36', 0.05, 0.4, { transparent: true, opacity: 0.55 });
    for (let i = 0; i < Math.floor(W / 12); i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 20), puddle);
      p.rotation.x = -Math.PI / 2;
      p.scale.set(0.4 + this.rnd() * 0.5, 0.2 + this.rnd() * 0.2, 1);
      p.position.set(X0 + this.rnd() * W, 0.004, this.back + 0.8 + this.rnd() * (front - this.back - 1));
      this.group.add(p);
    }
    // Pedestrian guard rails on the busy roads, with gaps.
    if (theme === 'high_street' || theme === 'city') {
      const rail = this.mat('#2b2e33', 0.4, 0.7);
      for (let x = X0 + 3; x < X1 - 3; x += 9) {
        this.box(3, 0.04, 0.04, x + 1.5, 0.7, front + 0.05, rail, false);
        this.box(3, 0.04, 0.04, x + 1.5, 0.15, front + 0.05, rail, false);
        for (let k = 0; k <= 3; k += 0.5) this.box(0.02, 0.55, 0.02, x + k, 0.42, front + 0.05, rail, false);
      }
    }
  }

  /** Shops, the pawn shop and the pub: a cutaway room like the flat, with the right floor. */
  private interiorGround(front: number): void {
    const { minX, maxX } = this.level.bounds;
    const theme = this.level.theme;
    const W = maxX - minX;
    const depth = front - this.back;
    const floor =
      theme === 'shop'
        ? new THREE.MeshStandardMaterial({ map: tileTexture('#e8e4dc', '#b8b4ac', W / 0.8, depth / 0.8, 64), roughness: 0.25, metalness: 0.05 })
        : theme === 'pawn'
          ? new THREE.MeshStandardMaterial({ map: tileTexture('#5a1e22', '#4a181c', W / 0.5, depth / 0.5, 32), roughness: 1 })
          : new THREE.MeshStandardMaterial({ map: woodFloorTexture(W / 2, depth / 2), roughness: 0.55, color: 0x9a7a5a });
    this.ground(minX, maxX, this.back, front, floor);
    this.box(W, 0.3, 0.2, (minX + maxX) / 2, -0.15, front + 0.1, this.mat('#2a2522'), false);
    this.ground(this.X0, this.X1, front + 0.2, front + 20, this.mat('#07080b', 1), -0.3);
    for (const x of [minX - 0.15, maxX + 0.15]) this.box(0.3, 3.2, depth, x, 1.6, (front + this.back) / 2, this.mat('#3a332c'));
  }

  /** Car park decks, the mall and the old tunnels: floor, ceiling, columns along the front. */
  private roofedGround(front: number): void {
    const theme = this.level.theme;
    const X0 = this.X0;
    const X1 = this.X1;
    const W = X1 - X0;
    const depth = front - this.back;
    const mall = theme === 'mall';
    const floor = mall
      ? new THREE.MeshStandardMaterial({ map: tileTexture('#d8d4cc', '#a8a49c', W / 1.2, depth / 1.2, 64), roughness: 0.18, metalness: 0.1 })
      : theme === 'car_park'
        ? new THREE.MeshStandardMaterial({ map: markingsTexture('#4a4a4c', '#e8e8e0', W / 5), roughness: 0.9 })
        : new THREE.MeshStandardMaterial({ map: concreteTexture('#4a4844', W / 4, depth / 4), roughness: 1 });
    this.ground(X0, X1, this.back, front + 3, floor);
    const ceilH = mall ? 4.2 : theme === 'car_park' ? 2.9 : 3.4;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, depth + 4), new THREE.MeshStandardMaterial({ map: concreteTexture(mall ? '#c8c4bc' : '#4a4a48', W / 4, 1), roughness: 1, side: THREE.DoubleSide }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((X0 + X1) / 2, ceilH, (this.back + front) / 2);
    this.group.add(ceiling);
    // Ceiling beams or light strips.
    for (let x = X0 + 3; x < X1; x += mall ? 5 : 7) {
      if (mall) this.box(2.4, 0.05, 0.5, x, ceilH - 0.03, this.back + 1.4, this.mat('#ffffff', 0.4, 0, { emissive: 0xfff8e8, emissiveIntensity: 1.1 }), false);
      else this.box(0.5, 0.45, depth + 3, x, ceilH - 0.22, (this.back + front) / 2, new THREE.MeshStandardMaterial({ map: concreteTexture('#5a5856', 1, 2), roughness: 1 }), false);
    }
    // Columns along the open front so it reads as a structure.
    for (let x = X0 + 2; x < X1; x += mall ? 10 : 8) {
      const col = mall ? this.mat('#e8e4dc', 0.3) : new THREE.MeshStandardMaterial({ map: concreteTexture('#7a7874', 1, 2), roughness: 0.95 });
      this.box(0.5, ceilH, 0.5, x, ceilH / 2, front + 1.6, col, true);
      if (theme === 'car_park') this.box(0.52, 0.5, 0.52, x, 0.6, front + 1.6, this.mat('#d8b018', 0.6), false);
    }
    if (theme === 'car_park') {
      // Open side onto the night: a low parapet.
      this.box(W, 1.0, 0.25, (X0 + X1) / 2, 0.5, front + 2.6, new THREE.MeshStandardMaterial({ map: concreteTexture('#6a6864', W / 3, 1) }), true);
    }
  }

  /** Rain streaks that follow the camera. */
  private buildWeather(): void {
    const weather = this.level.weather ?? (themeProfile(this.level.theme).interior ? 'indoors' : 'clear');
    if (weather !== 'rain' || themeProfile(this.level.theme).roofed) return;
    const N = 900;
    const pos = new Float32Array(N * 6);
    const base = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      base[i * 3] = (this.rnd() - 0.5) * 36;
      base[i * 3 + 1] = this.rnd() * 9;
      base[i * 3 + 2] = this.back + this.rnd() * 12;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9ab0d0, transparent: true, opacity: 0.32, depthWrite: false }));
    lines.frustumCulled = false;
    this.group.add(lines);
    this.rain = lines;
    this.rainBase = base;
  }

  private updateWeather(time: number, camX: number): void {
    if (this.water) (this.water.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + Math.sin(time * 0.8) * 0.08;
    if (!this.rain || !this.rainBase) return;
    const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    const b = this.rainBase;
    const n = b.length / 3;
    for (let i = 0; i < n; i++) {
      const x = camX + ((((b[i * 3] + 18) % 36) + 36) % 36) - 18;
      const y = 9 - ((((9 - b[i * 3 + 1]) + time * 14) % 9) + 9) % 9;
      const z = b[i * 3 + 2];
      a[i * 6] = x;
      a[i * 6 + 1] = y;
      a[i * 6 + 2] = z;
      a[i * 6 + 3] = x - 0.04;
      a[i * 6 + 4] = y - 0.35;
      a[i * 6 + 5] = z;
    }
    attr.needsUpdate = true;
  }

  private buildSkyline(): void {
    const theme = this.level.theme;
    const z = this.back - 14;
    const W = this.X1 - this.X0 + 40;
    let x = this.X0 - 20;
    while (x < this.X0 - 20 + W) {
      const w = 6 + this.rnd() * 10;
      const city = themeProfile(theme).skyline === 'city';
      const h = (city ? 18 : 10) + this.rnd() * (city ? 24 : 12);
      const tex = windowGridTexture(Math.max(2, Math.round(w / 1.5)), Math.max(3, Math.round(h / 2)), '#ffcf7a', '#14161c', '#1b1d24', 0.25);
      const m = new THREE.MeshStandardMaterial({ color: 0x1c1f27, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 1 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), m);
      b.position.set(x + w / 2, h / 2, z - this.rnd() * 10);
      this.group.add(b);
      x += w + this.rnd() * 3;
    }
  }

  // ---- facades -------------------------------------------------------------------

  private buildFacade(f: FacadeDef): void {
    if (f.x1 - f.x0 < 0.05) return;
    switch (f.kind) {
      case 'terrace':
        return this.terrace(f, f.label === 'back');
      case 'house_front':
        return this.terrace(f, false, f.label);
      case 'shop':
        return this.shop(f);
      case 'pub':
        return this.pub(f);
      case 'tower':
        return this.tower(f);
      case 'garages':
        return this.garages(f);
      case 'warehouse':
        return this.warehouse(f);
      case 'fence':
        return this.fence(f);
      case 'hoarding':
        return this.hoarding(f);
      case 'subway':
        return this.subwayWall(f);
      case 'office':
        return this.office(f);
      case 'club':
        return this.club(f);
      case 'room':
        return this.room(f);
      case 'semi':
        return this.semi(f);
      case 'precinct':
        return this.precinct(f);
      case 'mall':
        return this.mallFront(f);
      case 'stand':
        return this.stand(f);
      case 'leisure':
        return this.leisure(f);
      case 'dock':
        return this.dock(f);
      case 'containers':
        return this.containerStack(f);
      case 'market':
        return this.marketHall(f);
      case 'car_park':
        return this.carParkWall(f);
      case 'ruin':
        return this.ruin(f);
      case 'platform':
        return this.platform(f);
      case 'fortress':
        return this.fortress(f);
      case 'interior':
        return this.interior(f);
      default:
        // Never leave a hole: plain brick for anything without a builder yet.
        return this.brickWall(f.x0, f.x1, 6);
    }
  }

  /** 1930s semis: pebbledash, bay windows, hipped roofs, little front walls. */
  private semi(f: FacadeDef): void {
    const H = 6.6;
    const dash = new THREE.MeshStandardMaterial({ map: plasterTexture('#c8c0b0', (f.x1 - f.x0) / 3, 2), roughness: 1 });
    this.panel(f.x1 - f.x0, H, (f.x0 + f.x1) / 2, H / 2, dash, 0);
    const doorCols = ['#ffffff', '#1d3a2a', '#7a1414', '#1d2a5a', '#3a3a3a'];
    for (let x = f.x0 + 0.5; x + 7.5 <= f.x1 + 0.01; x += 8) {
      for (const [dx, door] of [[1.6, 3.4], [6.4, 4.6]] as const) {
        // Brick bay, two storeys, with white uPVC frames.
        this.box(2.2, 4.8, 0.5, x + dx, 2.4, this.back + 0.25, new THREE.MeshStandardMaterial({ map: brickTexture(0.6, 1.2), color: 0xd8b8a0 }));
        this.box(1.9, 1.3, 0.05, x + dx, 1.6, this.back + 0.52, this.windowMat(this.rnd() < 0.5 ? 0.5 : 0), false);
        this.box(1.9, 1.2, 0.05, x + dx, 4.0, this.back + 0.52, this.windowMat(this.rnd() < 0.35 ? 0.4 : 0), false);
        for (const y of [1.6, 4.0]) this.box(2.0, 0.07, 0.07, x + dx, y, this.back + 0.55, this.mat('#f4f4f0', 0.4), false);
        this.box(1.0, 2.1, 0.08, x + door, 1.05, this.back + 0.04, this.mat(doorCols[Math.floor(this.rnd() * doorCols.length)], 0.4));
        this.box(1.3, 0.1, 0.6, x + door, 2.3, this.back + 0.3, this.mat('#e8e4d8', 0.7), false);
      }
      // Hipped roof and chimney.
      const roof = this.box(8, 0.2, 3.2, x + 4, H + 0.6, this.back - 1.2, this.mat('#4a2e26', 0.8));
      roof.rotation.x = -0.45;
      this.box(0.8, 1.4, 0.6, x + 4, H + 1.2, this.back - 0.6, new THREE.MeshStandardMaterial({ map: brickTexture(0.3, 0.4) }));
      // Satellite dish.
      if (this.rnd() < 0.6) {
        const dish = this.cyl(0.32, 0.05, 0.12, x + 1.6, 5.6, this.back + 0.55, this.mat('#d8d8d4', 0.4, 0.3), 16);
        dish.rotation.x = Math.PI / 2.6;
      }
    }
    // Low garden wall in front.
    this.box(f.x1 - f.x0, 0.55, 0.22, (f.x0 + f.x1) / 2, 0.27, this.back + 0.95, new THREE.MeshStandardMaterial({ map: brickTexture((f.x1 - f.x0) / 4, 0.2) }), true);
  }

  /** 1960s shopping parade: concrete canopy over shopfronts, flats above. */
  private precinct(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 8;
    this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: concreteTexture('#9a968a', w / 3, 2), roughness: 1 }), 0);
    const tex = windowGridTexture(Math.max(2, Math.round(w / 2)), 2, '#ffd08a', '#1a1d24', '#7a766c', 0.3);
    this.panel(w - 0.6, 3, cx, 6, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 }), 0.03);
    const lit = f.label !== 'TO LET';
    const colour = f.colour ?? '#2a5a8a';
    this.box(w - 0.4, 2.6, 0.06, cx, 1.3, this.back + 0.08, this.mat('#0e1216', 0.05, 0.7, { emissive: 0xfff2d8, emissiveIntensity: lit ? 0.6 : 0.02 }), false);
    if (!lit || this.rnd() < 0.3) this.box(w - 0.4, lit ? 1 : 2.6, 0.05, cx, lit ? 2.1 : 1.3, this.back + 0.12, new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.5 }), false);
    // Deep concrete canopy along the whole parade.
    this.box(w, 0.35, 1.8, cx, 3.25, this.back + 0.9, new THREE.MeshStandardMaterial({ map: concreteTexture('#7a766c', w / 4, 1), roughness: 1 }));
    if (f.label) {
      const t = signTexture(f.label, colour, '#ffffff');
      this.box(w - 0.6, 0.55, 0.08, cx, 3.25, this.back + 1.82, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: lit ? 0.45 : 0.05 }), false);
    }
    // Underside downlights.
    for (let x = f.x0 + 1.5; x < f.x1 - 1; x += 3) this.box(0.3, 0.03, 0.3, x, 3.06, this.back + 1.2, this.mat('#ffffff', 0.4, 0, { emissive: 0xfff4d8, emissiveIntensity: lit ? 1 : 0.1 }), false);
  }

  /** Inside the shopping centre: glass shopfronts with backlit fascias. */
  private mallFront(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const colour = f.colour ?? '#3a3a40';
    this.panel(w, 4.2, cx, 2.1, this.mat('#d8d4cc', 0.5), 0);
    this.box(w - 0.6, 2.8, 0.05, cx, 1.4, this.back + 0.1, this.mat('#1a2026', 0.04, 0.8, { emissive: 0xfff8ec, emissiveIntensity: 0.7 }), false);
    for (let x = f.x0 + 0.3; x <= f.x1 - 0.2; x += 2.4) this.box(0.06, 2.8, 0.08, x, 1.4, this.back + 0.12, this.mat('#b8bcc4', 0.25, 0.9), false);
    // Displays behind the glass.
    for (let x = f.x0 + 1.4; x < f.x1 - 1; x += 2.4) {
      const h = 0.5 + this.rnd() * 0.9;
      this.box(1.4, h, 0.4, x, h / 2, this.back + 0.04, this.mat(['#e8e4dc', colour, '#202024'][Math.floor(this.rnd() * 3)], 0.5), false);
    }
    if (f.label) {
      const t = signTexture(f.label, colour, '#ffffff');
      this.box(Math.min(w - 1, 9), 0.7, 0.12, cx, 3.35, this.back + 0.14, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 }), false);
    }
  }

  /** The football ground: corrugated stand rising behind a turnstile wall. */
  private stand(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.box(w, 3.2, 0.3, cx, 1.6, this.back + 0.05, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 0.8), color: 0xc8a8a0 }));
    // Raked stand behind.
    for (let i = 0; i < 8; i++) this.box(w, 0.5, 1.2, cx, 3.5 + i * 0.55, this.back - 0.6 - i * 1.0, this.mat(i % 2 ? '#b3121b' : '#8a0e14', 0.8), false);
    const roof = this.box(w, 0.15, 10, cx, 8.8, this.back - 4, new THREE.MeshStandardMaterial({ map: corrugatedTexture('#c8ccd0', w / 3, 3), roughness: 0.5, metalness: 0.5 }), false);
    roof.rotation.x = 0.08;
    for (let x = f.x0 + 4; x < f.x1; x += 10) this.box(0.3, 9, 0.3, x, 4.5, this.back - 0.2, this.mat('#2a3a5a', 0.5, 0.6));
    // Turnstile doors.
    for (let x = f.x0 + 3; x < f.x1 - 2; x += 6) {
      this.box(1.0, 2.1, 0.05, x, 1.05, this.back + 0.22, this.mat('#2a3a5a', 0.4, 0.3), false);
      const t = signTexture(`TURNSTILES ${String.fromCharCode(65 + Math.floor((x - f.x0) / 6))}`, '#1a1a1a', '#ffd23d', { w: 512, h: 96 });
      this.box(1.4, 0.26, 0.04, x, 2.35, this.back + 0.22, new THREE.MeshStandardMaterial({ map: t }), false);
    }
    if (f.label) {
      const t = signTexture(f.label, '#b3121b', '#ffffff');
      this.box(Math.min(w - 2, 14), 1.0, 0.1, cx, 2.9, this.back + 0.25, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3 }), false);
    }
    // Floodlight pylon.
    this.box(0.3, 18, 0.3, f.x1 - 3, 9, this.back - 6, this.mat('#4a4d52', 0.5, 0.6));
    this.box(3, 1.4, 0.4, f.x1 - 3, 18, this.back - 6, this.mat('#ffffff', 0.3, 0, { emissive: 0xffffff, emissiveIntensity: 1.6 }), false);
  }

  /** Council leisure centre: brown brick, blue panels, big glazed entrance. */
  private leisure(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.panel(w, 7, cx, 3.5, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 1.8), color: 0xa88a70 }), 0);
    this.box(w, 1.2, 0.1, cx, 6.4, this.back + 0.06, this.mat('#1f5a9a', 0.5), false);
    this.box(w * 0.4, 3, 0.06, cx, 1.5, this.back + 0.1, this.mat('#0c1418', 0.05, 0.8, { emissive: 0xc8e8ff, emissiveIntensity: 0.5 }), false);
    for (let x = cx - w * 0.2; x <= cx + w * 0.2; x += 1.6) this.box(0.06, 3, 0.08, x, 1.5, this.back + 0.12, this.mat('#1f5a9a', 0.4), false);
    // High strip windows into the pool hall.
    this.box(w - 2, 0.9, 0.05, cx, 4.6, this.back + 0.04, this.mat('#0c1418', 0.05, 0.6, { emissive: 0x5ac8e8, emissiveIntensity: 0.55 }), false);
    if (f.label) {
      const t = signTexture(f.label, '#1f5a9a', '#ffffff');
      this.box(Math.min(w - 2, 12), 0.7, 0.08, cx, 3.5, this.back + 0.12, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 }), false);
    }
  }

  /** Dockside warehouse: tall brick, loading doors on every floor, a hoist beam. */
  private dock(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 13;
    this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, H / 4), color: 0x9a6a5a }), 0);
    for (let x = f.x0 + 2; x < f.x1 - 1; x += 4) {
      for (let y = 4.5; y < H - 1; y += 3) this.windowAt(x, y, 1.0, 1.6, this.windowMat(this.rnd() < 0.15 ? 0.3 : 0));
    }
    // Loading bays stacked up the middle with a hoist.
    for (let y = 1.4; y < H - 1; y += 3) this.box(2.2, 2.4, 0.08, cx, y, this.back + 0.05, this.mat('#2a3a3a', 0.8), false);
    this.box(0.25, 0.25, 1.8, cx, H - 0.4, this.back + 0.9, this.mat('#2a2a2a', 0.5, 0.7));
    this.cyl(0.015, 0.015, 3, cx, H - 2, this.back + 1.7, this.mat('#1a1a1a', 0.5, 0.8), 6);
    if (f.label) {
      const t = signTexture(f.label, '#e8e4d8', '#1a1a1a', { serif: true });
      this.panel(Math.min(w - 2, 14), 0.9, cx, H - 0.9, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), 0.04);
    }
  }

  /** Shipping containers stacked two and three high. */
  private containerStack(f: FacadeDef): void {
    const cols = ['#b3121b', '#1f5a9a', '#2a6a3a', '#c97a1a', '#5a5e64', '#d8d4cc'];
    for (let x = f.x0; x + 6 <= f.x1 + 0.5; x += 6.2) {
      const n = 2 + Math.floor(this.rnd() * 2);
      for (let i = 0; i < n; i++) {
        const c = cols[Math.floor(this.rnd() * cols.length)];
        const m = new THREE.MeshStandardMaterial({ map: corrugatedTexture(c, 6, 1), roughness: 0.6, metalness: 0.4 });
        this.box(6, 2.6, 2.4, x + 3, 1.3 + i * 2.6, this.back - 1.2 - (i % 2) * 0.1, m);
        this.box(0.08, 2.4, 0.06, x + 1.5, 1.3 + i * 2.6, this.back + 0.01, this.mat('#2a2a2a', 0.6, 0.6), false);
      }
    }
    // Gantry crane over the yard.
    const cx = (f.x0 + f.x1) / 2;
    this.box(0.6, 20, 0.6, f.x0 + 1, 10, this.back - 8, this.mat('#c9a227', 0.6, 0.4));
    this.box(0.6, 20, 0.6, f.x1 - 1, 10, this.back - 8, this.mat('#c9a227', 0.6, 0.4));
    this.box(f.x1 - f.x0, 1, 1, cx, 20, this.back - 8, this.mat('#c9a227', 0.6, 0.4));
  }

  /** Victorian market hall: cast iron and glass. */
  private marketHall(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.panel(w, 9, cx, 4.5, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 2.2), color: 0xd8a890 }), 0);
    for (let x = f.x0 + 3; x < f.x1 - 2; x += 6) {
      // Arched openings with iron gates half open.
      this.box(3.8, 4.2, 0.06, x, 2.1, this.back + 0.04, this.mat('#1a1410', 0.9, 0, { emissive: 0xffb050, emissiveIntensity: 0.12 }), false);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20, 0, Math.PI), this.mat('#1a1410', 0.9, 0, { emissive: 0xffb050, emissiveIntensity: 0.12 }));
      arch.position.set(x, 4.2, this.back + 0.05);
      this.group.add(arch);
      for (let k = -1.7; k <= -0.2; k += 0.15) this.box(0.025, 4, 0.025, x + k, 2, this.back + 0.1, this.mat('#1d3a2a', 0.5, 0.6), false);
      this.windowAt(x, 7.2, 2.4, 1.2, this.windowMat(0.2));
    }
    if (f.label) {
      const t = signTexture(f.label, '#1d3a2a', '#d9b65a', { serif: true });
      this.panel(Math.min(w - 4, 16), 1.0, cx, 8.4, new THREE.MeshStandardMaterial({ map: t }), 0.04);
    }
    // Clock.
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), this.mat('#f0ece0', 0.5, 0, { emissive: 0xfff0d0, emissiveIntensity: 0.4 }));
    clock.position.set(cx, 10.2, this.back + 0.05);
    this.group.add(clock);
    this.box(2, 2, 0.3, cx, 10.2, this.back - 0.1, new THREE.MeshStandardMaterial({ map: brickTexture(0.5, 0.5), color: 0xd8a890 }));
  }

  /** Back wall of a car park deck: painted concrete, bay numbers, pipes. */
  private carParkWall(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.panel(w, 3, cx, 1.5, new THREE.MeshStandardMaterial({ map: concreteTexture('#7a7874', w / 3, 1), roughness: 1 }), 0);
    this.box(w, 0.9, 0.03, cx, 0.45, this.back + 0.02, this.mat('#d8b018', 0.7), false);
    for (let x = f.x0 + 1.25; x < f.x1; x += 2.5) {
      const t = signTexture(`${Math.floor((x - f.x0) / 2.5) + 1}`, '#d8b018', '#1a1a1a', { w: 128, h: 128 });
      this.panel(0.4, 0.4, x, 1.6, new THREE.MeshStandardMaterial({ map: t }), 0.04);
    }
    this.cyl(0.08, 0.08, w, cx, 2.6, this.back + 0.2, this.mat('#9a4a1a', 0.6, 0.4), 8).rotation.z = Math.PI / 2;
    if (f.label) {
      const t = signTexture(f.label, '#1a3a6a', '#ffffff');
      for (let x = f.x0 + 8; x < f.x1; x += 24) this.panel(2.4, 0.6, x, 2.2, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3 }), 0.05);
    }
  }

  /** Derelict mill: broken windows, missing roof, buddleia growing out the brick. */
  private ruin(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 11;
    this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, H / 4), color: 0x8a6a5a }), 0);
    for (let x = f.x0 + 2; x < f.x1 - 1; x += 3.2) {
      for (let y = 2.2; y < H - 1; y += 3) {
        this.windowAt(x, y, 1.6, 2, this.mat('#050608', 1));
        // Shards left in the frames.
        if (this.rnd() < 0.6) this.box(0.6, 0.5, 0.02, x - 0.4, y + 0.6, this.back + 0.08, this.mat('#5a6a7a', 0.1, 0.4, { transparent: true, opacity: 0.6 }), false);
        if (this.rnd() < 0.3) this.box(1.8, 2.2, 0.05, x, y, this.back + 0.1, this.mat('#a88a5e', 0.95), false);
      }
    }
    // Jagged roofline and roof trusses open to the sky.
    for (let x = f.x0; x < f.x1; x += 1.2) this.box(1.2, 0.4 + this.rnd() * 1.4, 0.4, x + 0.6, H + 0.2, this.back - 0.2, new THREE.MeshStandardMaterial({ map: brickTexture(0.3, 0.3), color: 0x8a6a5a }), false);
    for (let x = f.x0 + 2; x < f.x1; x += 4) {
      const t = this.box(0.15, 0.15, 6, x, H + 0.8, this.back - 3, this.mat('#3a2a1a', 0.9), false);
      t.rotation.x = (this.rnd() - 0.5) * 0.3;
    }
    // Weeds.
    for (let i = 0; i < w / 4; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3 + this.rnd() * 0.3, 8, 6), this.mat(this.rnd() < 0.3 ? '#7a4a8a' : '#3a5a2a', 1));
      bush.position.set(f.x0 + this.rnd() * w, this.rnd() < 0.5 ? 0.2 : 2 + this.rnd() * 6, this.back + 0.2);
      this.group.add(bush);
    }
    if (f.label) {
      const t = signTexture(f.label, '#d8d0b8', '#3a2a1a', { serif: true });
      this.panel(Math.min(w - 2, 12), 0.9, cx, H - 0.6, new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: 0x9a9080 }), 0.04);
    }
  }

  /** Disused underground platform: curved tiled tunnel, roundel, track bed in front. */
  private platform(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.panel(w, 3.4, cx, 1.7, new THREE.MeshStandardMaterial({ map: tileTexture('#a8a088', '#3a3830', w / 2, 2), roughness: 0.6, color: 0x9a9480 }), 0);
    this.box(w, 0.2, 0.04, cx, 1.0, this.back + 0.03, this.mat('#6a1414', 0.5), false);
    for (let x = f.x0 + 6; x < f.x1 - 3; x += 14) {
      // Roundel.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 32), this.mat('#8a1a1a', 0.5));
      ring.position.set(x, 2.1, this.back + 0.06);
      this.group.add(ring);
      const t = signTexture(f.label ?? 'KIRKGATE', '#1a2a6a', '#ffffff', { w: 512, h: 96 });
      this.panel(1.6, 0.3, x, 2.1, new THREE.MeshStandardMaterial({ map: t }), 0.1);
      this.box(2.4, 1.4, 0.05, x + 5, 1.9, this.back + 0.04, this.mat('#222', 0.5), false);
      this.panel(2.2, 1.2, x + 5, 1.9, new THREE.MeshStandardMaterial({ map: posterTexture(this.rnd), roughness: 0.9, color: 0x8a8070 }), 0.08);
    }
  }

  /** The Boss's compound: high concrete wall, razor wire, cameras, a gate. */
  private fortress(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.panel(w, 4.5, cx, 2.25, new THREE.MeshStandardMaterial({ map: concreteTexture('#5a5854', w / 3, 1.5), roughness: 1 }), 0);
    for (let x = f.x0 + 0.5; x < f.x1; x += 3) this.box(0.35, 4.6, 0.3, x, 2.3, this.back + 0.1, this.mat('#4a4844', 1));
    // Razor wire coils.
    for (let x = f.x0 + 0.5; x < f.x1; x += 0.6) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.01, 4, 14), this.mat('#b8bcc4', 0.3, 0.9));
      c.position.set(x, 4.85, this.back + 0.05);
      c.rotation.y = Math.PI / 2.4;
      this.group.add(c);
    }
    for (let x = f.x0 + 5; x < f.x1; x += 12) {
      this.box(0.3, 0.2, 0.35, x, 4.2, this.back + 0.3, this.mat('#e8e8e4', 0.4));
      this.box(0.06, 0.06, 0.06, x, 4.2, this.back + 0.5, this.mat('#ff2020', 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 1.5 }), false);
    }
    // Glass tower beyond the wall.
    const tex = windowGridTexture(Math.max(3, Math.round(w / 2)), 10, '#ffd8a8', '#0a0c10', '#14161c', 0.25);
    const tower = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 22), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.6 }));
    tower.position.set(cx, 11, this.back - 8);
    this.group.add(tower);
    if (f.label) {
      const t = signTexture(f.label, '#0a0a0c', '#d9b65a', { serif: true });
      this.box(Math.min(w - 4, 10), 0.8, 0.08, cx, 3.2, this.back + 0.08, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }), false);
    }
  }

  /** The back wall of a shop or pub interior. */
  private interior(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const theme = this.level.theme;
    const H = 3.2;
    const colour = f.colour ?? '#8c7a5e';
    if (theme === 'pub') {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture('#6a2a1e', w / 3, 1), roughness: 0.9 }), 0);
      // Wood panelling to dado height, brass rail, framed pictures.
      this.box(w, 1.1, 0.04, cx, 0.55, this.back + 0.02, new THREE.MeshStandardMaterial({ map: woodFloorTexture(w / 2, 0.5), roughness: 0.5, color: 0x6a3a1a }), false);
      this.box(w, 0.05, 0.06, cx, 1.12, this.back + 0.05, this.mat('#c9a227', 0.2, 0.9), false);
      for (let x = f.x0 + 2; x < f.x1 - 1; x += 3.4) {
        this.box(0.7, 0.55, 0.03, x, 2.0, this.back + 0.03, this.mat('#2a1a0a', 0.5), false);
        this.panel(0.58, 0.43, x, 2.0, new THREE.MeshStandardMaterial({ map: posterTexture(this.rnd), color: 0xa89878, roughness: 0.9 }), 0.05);
      }
      // Optics and bottles behind the bar.
      for (const st of this.level.stations ?? []) {
        if (st.id !== 'bar') continue;
        this.box(3.6, 0.04, 0.25, st.x, 1.6, this.back + 0.12, this.mat('#3a2010', 0.5), false);
        this.box(3.6, 0.04, 0.25, st.x, 2.1, this.back + 0.12, this.mat('#3a2010', 0.5), false);
        for (let i = 0; i < 16; i++) {
          const b = this.cyl(0.035, 0.035, 0.28, st.x - 1.7 + (i % 8) * 0.48, i < 8 ? 1.76 : 2.26, this.back + 0.14, this.mat(['#2f6b3a', '#8a5a1a', '#d8d4c8', '#5a1a1a'][i % 4], 0.1, 0.1, { emissive: 0xffa040, emissiveIntensity: 0.15 }), 8);
          b.castShadow = false;
        }
        this.panel(3.8, 0.9, st.x, 1.85, this.mat('#a8b8c8', 0.05, 0.3, { emissive: 0x4a3020, emissiveIntensity: 0.3 }), 0.01);
      }
    } else if (theme === 'pawn') {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture(colour, w / 3, 1), roughness: 0.95 }), 0);
      // Barred window and a wall of guitars, tools and tellies for sale.
      const wx = f.x1 - 2.2;
      this.box(1.8, 1.2, 0.04, wx, 1.9, this.back + 0.02, this.mat('#0b1020', 0.1, 0.4, { emissive: 0x2a3a6a, emissiveIntensity: 0.5 }), false);
      for (let k = -0.8; k <= 0.8; k += 0.2) this.box(0.025, 1.2, 0.025, wx + k, 1.9, this.back + 0.06, this.mat('#1a1a1a', 0.5, 0.8), false);
      for (let x = f.x0 + 1; x < f.x1 - 4; x += 1.1) {
        if (this.rnd() < 0.5) {
          const body = this.box(0.32, 0.42, 0.06, x, 2.25, this.back + 0.05, this.mat(['#a0401a', '#1a1a1a', '#e8d8b0'][Math.floor(this.rnd() * 3)], 0.3), false);
          body.rotation.z = 0.08;
          this.box(0.05, 0.5, 0.03, x, 2.7, this.back + 0.05, this.mat('#3a2010', 0.5), false);
        } else {
          this.box(0.5, 0.35, 0.3, x, 2.55, this.back + 0.15, this.mat('#2a2a2a', 0.5), false);
        }
      }
      if (f.label) {
        const t = signTexture(f.label, '#1a1a1a', '#ffd23d', { w: 1024, h: 128 });
        this.panel(Math.min(w - 2, 7), 0.45, cx, 2.85, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6 }), 0.05);
      }
    } else {
      // Clothes shop: bright white walls, slatwall, a big backlit logo.
      this.panel(w, H, cx, H / 2, this.mat(colour, 0.7), 0);
      for (let y = 0.4; y < 2.6; y += 0.2) this.box(w, 0.02, 0.02, cx, y, this.back + 0.02, this.mat('#c8c4bc', 0.5), false);
      for (let x = f.x0 + 1.5; x < f.x1 - 1; x += 2.5) {
        // Folded tees and hats on the slatwall.
        for (let k = 0; k < 3; k++) this.box(0.4, 0.08, 0.25, x - 0.5 + k * 0.5, 1.5 + (k % 2) * 0.6, this.back + 0.14, this.mat(['#1a1a1a', '#e8e4dc', '#7a1414', '#1f2a44', '#3a5a3a'][Math.floor(this.rnd() * 5)], 0.9), false);
      }
      if (f.label) {
        const t = signTexture(f.label, '#101012', '#ffffff', { w: 512, h: 128 });
        this.panel(3.2, 0.8, cx, 2.6, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.8 }), 0.05);
      }
    }
    this.box(w, 0.12, 0.04, cx, 0.06, this.back + 0.03, this.mat('#2a2420', 0.6), false);
    this.box(w, 0.25, 0.6, cx, H + 0.12, this.back + 0.3, this.mat('#c8c4bc', 0.9), false);
  }

  /** Brick wall the full width of a facade. */
  private brickWall(x0: number, x1: number, h: number, tint = 0xffffff): void {
    const w = x1 - x0;
    const m = new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, h / 4), roughness: 0.95, color: tint });
    this.panel(w, h, (x0 + x1) / 2, h / 2, m, 0);
  }

  private terrace(f: FacadeDef, backs: boolean, number?: string): void {
    const H = 7.2;
    this.brickWall(f.x0, f.x1, H, backs ? 0xb0a8a0 : 0xffffff);
    const doorCols = ['#1d3a2a', '#7a1414', '#1d2a5a', '#2a2a2a', '#5a3a1a', '#3a6a6a'];
    const glass = this.windowMat(0.35);
    for (let x = f.x0 + 0.4; x + 4.6 <= f.x1 + 0.01; x += 5) {
      // Downstairs and upstairs bay windows.
      const lit = this.rnd() < 0.5;
      this.windowAt(x + 2.9, 1.7, 1.6, 1.4, lit ? glass : this.windowMat(0));
      this.windowAt(x + 2.9, 4.6, 1.6, 1.3, this.rnd() < 0.4 ? glass : this.windowMat(0));
      this.windowAt(x + 1.0, 4.6, 0.9, 1.3, this.windowMat(this.rnd() < 0.3 ? 0.3 : 0));
      if (backs) {
        // Back yards: a wall and a gate rather than front doors.
        this.box(4.9, 1.9, 0.12, x + 2.3, 0.95, this.back + 0.06, new THREE.MeshStandardMaterial({ map: brickTexture(1.2, 0.5) }));
        this.box(0.9, 1.6, 0.04, x + 1.0, 0.8, this.back + 0.14, this.mat('#4a3a2a', 0.9));
      } else {
        const col = doorCols[Math.floor(this.rnd() * doorCols.length)];
        this.box(0.95, 2.1, 0.08, x + 1.0, 1.05, this.back + 0.04, this.mat(col, 0.5));
        this.box(1.15, 0.12, 0.25, x + 1.0, 2.2, this.back + 0.1, this.mat('#d8d4c8', 0.7));
        this.box(0.05, 0.05, 0.05, x + 1.3, 1.0, this.back + 0.1, this.mat('#c9a227', 0.3, 0.8), false);
      }
      // Chimney stacks on the roofline.
      this.box(0.9, 1.0, 0.6, x + 4.8, H + 0.5, this.back - 0.2, new THREE.MeshStandardMaterial({ map: brickTexture(0.3, 0.3) }));
      this.cyl(0.08, 0.1, 0.4, x + 4.65, H + 1.2, this.back - 0.2, this.mat('#7a4a2a'));
      // Drainpipe.
      this.cyl(0.045, 0.045, H, x + 4.75, H / 2, this.back + 0.08, this.mat('#15161a', 0.5, 0.4), 8);
    }
    // Slate roof.
    this.box(f.x1 - f.x0, 0.2, 2.4, (f.x0 + f.x1) / 2, H + 0.1, this.back - 1.1, this.mat('#2a2d33', 0.7));
    if (number) {
      const plate = new THREE.MeshStandardMaterial({ map: signTexture(number, '#e8e4d8', '#111', { w: 128, h: 128, serif: true }) });
      const x = (f.x0 + f.x1) / 2;
      this.box(1.1, 2.1, 0.08, x, 1.05, this.back + 0.04, this.mat('#7a1414', 0.4));
      const n = this.panel(0.3, 0.3, x, 2.5, plate, 0.06);
      n.castShadow = false;
    }
  }

  private litWindows: THREE.MeshStandardMaterial[] = [];
  private pubGlassMat: THREE.MeshStandardMaterial | null = null;

  private pubGlass(): THREE.MeshStandardMaterial {
    if (!this.pubGlassMat) {
      const [c, g] = canvas(128, 128);
      const grad = g.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#5a2a0a');
      grad.addColorStop(0.5, '#e8902a');
      grad.addColorStop(1, '#7a3a10');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      // Silhouettes of drinkers at the bar.
      g.fillStyle = 'rgba(30,12,4,0.7)';
      for (let i = 0; i < 3; i++) {
        const x = 14 + i * 40 + this.rnd() * 10;
        g.beginPath();
        g.arc(x, 52, 9, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - 14, 62, 28, 66);
      }
      // Frosted lower half.
      g.fillStyle = 'rgba(255,230,190,0.35)';
      g.fillRect(0, 84, 128, 44);
      this.pubGlassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, emissive: 0xffffff, emissiveMap: toTexture(c), emissiveIntensity: 0.6 });
    }
    return this.pubGlassMat;
  }

  /** Dark glass, or a lit room behind net curtains. */
  private windowMat(lit: number): THREE.MeshStandardMaterial {
    if (lit <= 0.05) return this.mat('#0a0c12', 0.15, 0.6, { emissive: 0x3a4a6a, emissiveIntensity: 0.06 });
    if (this.litWindows.length < 4) {
      const tex = litWindowTexture(this.rnd);
      this.litWindows.push(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }));
    }
    return this.litWindows[Math.floor(this.rnd() * this.litWindows.length)];
  }

  private windowAt(x: number, y: number, w: number, h: number, m: THREE.Material): void {
    this.box(w + 0.16, h + 0.16, 0.06, x, y, this.back + 0.02, this.mat('#e8e4d8', 0.6), false);
    this.box(w, h, 0.07, x, y, this.back + 0.03, m, false);
    this.box(w + 0.3, 0.08, 0.18, x, y - h / 2 - 0.1, this.back + 0.08, this.mat('#bdb8aa', 0.8), false);
  }

  private shop(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.brickWall(f.x0, f.x1, 7.5);
    // Upstairs flats.
    for (let x = f.x0 + 1.5; x < f.x1 - 0.5; x += 3) this.windowAt(x, 5.2, 1.2, 1.4, this.windowMat(this.rnd() < 0.4 ? 0.4 : 0));
    // Shopfront: lit glass, part shuttered, fascia sign.
    const colour = f.colour ?? '#8a1a1a';
    this.box(w - 0.4, 3.1, 0.1, cx, 1.55, this.back + 0.05, this.mat('#1a1a1a', 0.5));
    const lit = f.label !== 'TO LET';
    const glass = this.mat('#101418', 0.05, 0.7, { emissive: 0xfff2d8, emissiveIntensity: lit ? 0.75 : 0.03 });
    this.box(w - 1.0, 2.2, 0.06, cx - 0.4, 1.3, this.back + 0.12, glass, false);
    if (this.rnd() < 0.5 || !lit) {
      const sh = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.5 });
      this.box(w - 1.0, lit ? 0.9 : 2.2, 0.05, cx - 0.4, lit ? 1.95 : 1.3, this.back + 0.16, sh, false);
    }
    this.box(0.9, 2.2, 0.06, f.x1 - 0.65, 1.1, this.back + 0.12, this.mat('#222', 0.5));
    if (f.label) {
      const sign = new THREE.MeshStandardMaterial({ map: signTexture(f.label, colour, '#ffffff'), emissive: 0xffffff, emissiveMap: signTexture(f.label, colour, '#ffffff'), emissiveIntensity: lit ? 0.35 : 0.05 });
      this.box(w - 0.4, 0.75, 0.15, cx, 3.5, this.back + 0.15, sign, false);
    } else {
      this.box(w - 0.4, 0.75, 0.15, cx, 3.5, this.back + 0.15, this.mat(colour, 0.6), false);
    }
    // Striped awning on some.
    if (lit && this.rnd() < 0.4) {
      const aw = this.box(w - 1, 0.06, 1.0, cx - 0.4, 2.9, this.back + 0.6, this.mat(colour, 0.9), false);
      aw.rotation.x = 0.35;
    }
  }

  private pub(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const colour = f.colour ?? '#1d3a2a';
    this.brickWall(f.x0, f.x1, 8);
    for (let x = f.x0 + 1.6; x < f.x1 - 0.5; x += 2.8) this.windowAt(x, 5.4, 1.3, 1.5, this.windowMat(this.rnd() < 0.5 ? 0.5 : 0.1));
    // Painted ground floor with frosted, glowing windows.
    this.box(w - 0.2, 3.3, 0.12, cx, 1.65, this.back + 0.06, this.mat(colour, 0.35));
    // Etched, glowing pub windows with glazing bars.
    for (let x = f.x0 + 1.6; x < f.x1 - 1.5; x += 2.6) {
      this.box(1.8, 1.6, 0.06, x, 1.5, this.back + 0.14, this.pubGlass(), false);
      this.box(0.05, 1.6, 0.08, x, 1.5, this.back + 0.16, this.mat(colour, 0.4), false);
      this.box(1.8, 0.05, 0.08, x, 1.9, this.back + 0.16, this.mat(colour, 0.4), false);
    }
    this.box(1.1, 2.3, 0.06, f.x1 - 1.2, 1.15, this.back + 0.14, this.mat('#2a1a0e', 0.4));
    if (f.label) {
      const tex = signTexture(f.label, colour, '#d9b65a', { serif: true });
      this.box(w - 0.4, 0.7, 0.16, cx, 3.65, this.back + 0.16, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }), false);
    }
    // Hanging sign on a bracket.
    this.box(0.06, 0.06, 1.0, f.x0 + 1.0, 4.6, this.back + 0.5, this.mat('#111', 0.4, 0.7), false);
    this.box(0.08, 0.9, 0.7, f.x0 + 1.0, 4.1, this.back + 0.75, this.mat(colour, 0.5));
    // Hanging baskets.
    for (const x of [f.x0 + 3, f.x1 - 3]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), this.mat('#3a6a2a', 0.9));
      b.position.set(x, 3.0, this.back + 0.45);
      this.group.add(b);
    }
  }

  private tower(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 16;
    const conc = new THREE.MeshStandardMaterial({ map: concreteTexture('#8a877e', w / 3, H / 3), roughness: 0.95 });
    this.panel(w, H, cx, H / 2, conc, 0);
    const tex = windowGridTexture(Math.round(w / 1.6), 6, '#ffd08a', '#20242c', '#8a877e', 0.4);
    const win = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.4 });
    this.panel(w - 0.8, H - 4.5, cx, 4 + (H - 4.5) / 2, win, 0.03);
    // Balconies.
    for (let y = 5; y < H; y += 2.1) this.box(w - 0.8, 0.12, 0.6, cx, y, this.back + 0.3, this.mat('#6a675e', 0.9), false);
    // Entrance with a security door.
    this.box(2.4, 2.6, 0.2, cx, 1.3, this.back + 0.1, this.mat('#2d3a4a', 0.4, 0.4));
    this.box(1.6, 2.2, 0.06, cx, 1.1, this.back + 0.22, this.mat('#0c0e12', 0.1, 0.6, { emissive: 0xc8e0ff, emissiveIntensity: 0.25 }), false);
    const sign = signTexture(f.label ?? 'TANNER HOUSE 1-48', '#1d3a6a', '#ffffff', { w: 512, h: 96 });
    this.box(2.4, 0.4, 0.06, cx, 2.85, this.back + 0.22, new THREE.MeshStandardMaterial({ map: sign }), false);
  }

  private garages(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    // Tower behind, set back.
    const conc = new THREE.MeshStandardMaterial({ map: concreteTexture('#5a5850', w / 3, 4), roughness: 1, color: 0x9a9890 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, 12), conc);
    back.position.set(cx, 6, this.back - 4);
    this.group.add(back);
    this.box(w, 2.7, 0.3, cx, 1.35, this.back - 0.1, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 0.7) }));
    this.box(w, 0.15, 3.5, cx, 2.75, this.back - 1.8, this.mat('#3a3a3a', 0.9));
    const doorCols = ['#5a6a5a', '#6a5a4a', '#4a5a6a', '#7a7a70'];
    for (let x = f.x0 + 0.3; x + 2.4 <= f.x1; x += 2.8) {
      const d = this.box(2.3, 2.1, 0.06, x + 1.15, 1.1, this.back + 0.08, new THREE.MeshStandardMaterial({ map: corrugatedTexture(doorCols[Math.floor(this.rnd() * 4)], 2, 1), roughness: 0.7, metalness: 0.4 }), false);
      d.rotation.x = 0;
    }
  }

  private warehouse(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 9;
    const theme = this.level.theme;
    const cladding = new THREE.MeshStandardMaterial({ map: corrugatedTexture(theme === 'territory' ? '#4a4038' : '#5f6a70', w / 3, 2), roughness: 0.6, metalness: 0.5 });
    this.panel(w, H, cx, H / 2, cladding, 0);
    this.box(w, 1.2, 0.12, cx, 0.6, this.back + 0.04, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 0.3) }));
    // Roller door and a lit office window.
    const rw = Math.min(5, w * 0.4);
    const sh = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.5 });
    this.box(rw, 4, 0.08, cx - w * 0.15, 2, this.back + 0.15, sh, false);
    this.box(rw + 0.3, 0.3, 0.3, cx - w * 0.15, 4.1, this.back + 0.2, this.mat('#2a2a2a', 0.5, 0.6), false);
    this.windowAt(cx + w * 0.3, 2.2, 1.6, 1.0, this.windowMat(0.6));
    // Security lamp.
    this.box(0.4, 0.2, 0.3, cx + w * 0.3, 4.2, this.back + 0.2, this.mat('#ffffff', 0.4, 0, { emissive: 0xe8ffe8, emissiveIntensity: 1.3 }), false);
    if (f.label) {
      const tex = signTexture(f.label, theme === 'territory' ? '#2a0e0a' : '#e8e4d8', theme === 'territory' ? '#ff4a2a' : '#1a1a1a', { neon: theme === 'territory' });
      this.box(Math.min(w - 1, 9), 1.0, 0.1, cx, 6.6, this.back + 0.08, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: theme === 'territory' ? 1.2 : 0.15 }), false);
    }
  }

  private fence(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    // House backs behind.
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 2), color: 0x9a928a }));
    backWall.position.set(cx, 4, this.back - 3.5);
    this.group.add(backWall);
    for (let x = f.x0 + 2; x < f.x1 - 1; x += 4) this.windowAt2(x, 4.5, this.back - 3.48);
    // Palisade fence.
    const steel = this.mat('#2d3a33', 0.5, 0.6);
    this.box(w, 0.08, 0.06, cx, 0.4, this.back + 0.05, steel, false);
    this.box(w, 0.08, 0.06, cx, 2.0, this.back + 0.05, steel, false);
    const n = Math.floor(w / 0.18);
    const geo = new THREE.BoxGeometry(0.07, 2.4, 0.03);
    const inst = new THREE.InstancedMesh(geo, steel, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(f.x0 + i * 0.18 + 0.09, 1.2, this.back + 0.08);
      inst.setMatrixAt(i, m);
    }
    inst.castShadow = true;
    this.group.add(inst);
  }

  private windowAt2(x: number, y: number, z: number): void {
    const m = this.windowMat(this.rnd() < 0.4 ? 0.45 : 0);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), m);
    w.position.set(x, y, z);
    this.group.add(w);
  }

  private hoarding(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    // Crane and half-built block behind.
    const site = new THREE.Mesh(new THREE.PlaneGeometry(w, 10), new THREE.MeshStandardMaterial({ map: concreteTexture('#6a6862', w / 4, 3), color: 0x8a8880 }));
    site.position.set(cx, 5, this.back - 5);
    this.group.add(site);
    this.box(0.4, 18, 0.4, cx + w * 0.2, 9, this.back - 6, this.mat('#c9a227', 0.6, 0.4));
    this.box(14, 0.4, 0.4, cx + w * 0.2 + 3, 18, this.back - 6, this.mat('#c9a227', 0.6, 0.4));
    // Plywood boards plastered in posters.
    this.box(w, 2.6, 0.08, cx, 1.3, this.back + 0.04, this.mat('#a88a5e', 0.95));
    for (let x = f.x0 + 0.6; x < f.x1 - 0.6; x += 0.8 + this.rnd() * 1.4) {
      const p = this.panel(0.62, 0.86, x, 1.0 + this.rnd() * 0.8, new THREE.MeshStandardMaterial({ map: posterTexture(this.rnd), roughness: 0.9 }), 0.1 + this.rnd() * 0.01);
      p.rotation.z = (this.rnd() - 0.5) * 0.08;
    }
  }

  private subwayWall(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const tiles = new THREE.MeshStandardMaterial({ map: tileTexture('#c9c2a8', '#5c574c', w / 2, 2), roughness: 0.35 });
    this.panel(w, 3.4, cx, 1.7, tiles, 0);
    // Dado stripe and advert frames.
    this.box(w, 0.18, 0.04, cx, 1.1, this.back + 0.03, this.mat('#1d4a7a', 0.4), false);
    for (let x = f.x0 + 3; x < f.x1 - 2; x += 7) {
      this.box(2.0, 1.3, 0.06, x, 1.95, this.back + 0.04, this.mat('#222', 0.4, 0.6), false);
      this.panel(1.85, 1.15, x, 1.95, new THREE.MeshStandardMaterial({ map: posterTexture(this.rnd), emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 }), 0.08);
    }
  }

  private office(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 20;
    const tex = windowGridTexture(Math.round(w / 1.2), 14, '#bfe0ff', '#0e1622', '#2a323e', 0.3);
    this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.6 }), 0);
    this.box(w, 3.2, 0.2, cx, 1.6, this.back + 0.1, this.mat('#1a1e26', 0.2, 0.7));
    this.box(w - 1, 2.6, 0.06, cx, 1.4, this.back + 0.22, this.mat('#0c1018', 0.05, 0.8, { emissive: 0xd8e8ff, emissiveIntensity: 0.4 }), false);
    if (f.label) {
      const t = signTexture(f.label, '#1a1e26', '#e8eef8', { w: 1024, h: 128 });
      this.box(Math.min(w - 1, 8), 0.5, 0.06, cx, 3.6, this.back + 0.2, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 }), false);
    }
  }

  private club(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.panel(w, 9, cx, 4.5, this.mat('#121216', 0.6), 0);
    for (let x = f.x0 + 2; x < f.x1 - 1; x += 3.5) this.windowAt(x, 6, 1.4, 1.6, this.windowMat(0.08));
    const neonCol = f.label === 'VELVET' ? '#ff4ac0' : '#a070ff';
    if (f.label) {
      const t = signTexture(f.label, '#060608', neonCol, { neon: true });
      this.box(Math.min(w - 2, 8), 1.2, 0.1, cx, 3.8, this.back + 0.1, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.6 }), false);
    }
    // Double doors with a glowing canopy.
    this.box(2.2, 2.4, 0.08, cx, 1.2, this.back + 0.06, this.mat('#1a0a14', 0.3));
    this.box(3.2, 0.15, 1.2, cx, 2.7, this.back + 0.6, this.mat('#0a0a0a', 0.3, 0, { emissive: new THREE.Color(neonCol).getHex(), emissiveIntensity: 0.6 }), false);
    // Rope line posts.
    for (const dx of [-1.8, 1.8]) this.cyl(0.04, 0.06, 0.9, cx + dx, 0.45, this.back + 0.12, this.mat('#c9a227', 0.2, 0.9), 8);
  }

  private room(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 3;
    const colour = f.colour ?? '#8c7a5e';
    const wall = new THREE.MeshStandardMaterial({ map: f.label === 'Garage' ? brickTexture(w / 4, 1) : f.label === 'Kitchen' ? tileTexture('#e8e2cc', '#9a9480', w / 1.5, 2, 48) : plasterTexture(colour, w / 3, 1), roughness: 0.9 });
    this.panel(w, H, cx, H / 2, wall, 0);
    // Skirting and a ceiling strip to sell the cutaway.
    this.box(w, 0.12, 0.04, cx, 0.06, this.back + 0.03, this.mat('#e8e4d8', 0.6), false);
    this.box(w, 0.25, 0.6, cx, H + 0.12, this.back + 0.3, this.mat('#d8d4c8', 0.9), false);
    // A window onto the night street.
    if (f.label !== 'Garage' && f.label !== 'Gym') {
      // Keep the window clear of any door and of the mirror.
      const busy = [...this.level.exits.filter((e) => e.kind === 'door').map((e) => e.x), ...(this.level.stations ?? []).filter((s) => s.id === 'mirror').map((s) => s.x)];
      let wx = cx + w * 0.15;
      if (busy.some((x) => Math.abs(x - wx) < 1.8)) wx = cx - w * 0.28;
      const win = this.mat('#0b1020', 0.1, 0.4, { emissive: 0x2a3a6a, emissiveIntensity: 0.5 });
      this.box(1.4, 1.1, 0.04, wx, 1.75, this.back + 0.02, this.mat('#f0eee6', 0.6), false);
      this.box(1.25, 0.95, 0.05, wx, 1.75, this.back + 0.03, win, false);
      // Curtains.
      this.box(0.3, 1.5, 0.05, wx - 0.8, 1.75, this.back + 0.06, this.mat(colour === '#6d7a8c' ? '#2a3a5a' : '#7a2a2a', 1), false);
      this.box(0.3, 1.5, 0.05, wx + 0.8, 1.75, this.back + 0.06, this.mat(colour === '#6d7a8c' ? '#2a3a5a' : '#7a2a2a', 1), false);
    }
    // Long mirror on the bedroom wall.
    for (const st of this.level.stations ?? []) {
      if (st.id !== 'mirror' || st.x < f.x0 || st.x > f.x1) continue;
      this.box(0.7, 1.7, 0.04, st.x, 1.15, this.back + 0.03, this.mat('#3a2a1a', 0.6), false);
      this.box(0.6, 1.6, 0.03, st.x, 1.15, this.back + 0.05, this.mat('#a8b8c8', 0.05, 0.2, { emissive: 0x6a7a8a, emissiveIntensity: 0.5 }), false);
    }
    if (f.label === 'Garage') {
      const sh = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.5 });
      this.box(3.2, 2.3, 0.05, cx - 1, 1.15, this.back + 0.04, sh, false);
    }
    if (f.label === 'Gym') {
      // Mirror wall.
      this.box(3, 1.6, 0.03, cx - 1.2, 1.4, this.back + 0.02, this.mat('#a8b8c8', 0.05, 0.2, { emissive: 0x5a6a7a, emissiveIntensity: 0.45 }), false);
    }
    // Room name, painted small above the door gap like a nameplate.
    if (f.label) {
      const t = signTexture(f.label.toUpperCase(), '#1a1a1a', '#e8e4d8', { w: 512, h: 96 });
      this.panel(1.4, 0.26, cx, 2.35, new THREE.MeshStandardMaterial({ map: t }), 0.04);
    }
  }

  private buildWall(w: { minX: number; maxX: number; minZ: number; maxZ: number; visual?: 'wall' | 'none' }): void {
    if (w.visual === 'none') return;
    const home = this.level.theme === 'home';
    const h = home ? 3 : 1.1;
    // Room dividers are see-through enough that you never lose yourself behind one.
    const m = home ? this.mat('#d8d0c0', 0.9, 0, { transparent: true, opacity: 0.45, depthWrite: false }) : this.mat('#3a3d42', 0.5, 0.6);
    this.box(w.maxX - w.minX, h, w.maxZ - w.minZ, (w.minX + w.maxX) / 2, h / 2, (w.minZ + w.maxZ) / 2, m);
    if (home) {
      // Door frame on the open end.
      this.box(w.maxX - w.minX + 0.12, 0.1, 0.12, (w.minX + w.maxX) / 2, 2.2, w.maxZ, this.mat('#f0ece0', 0.6), false);
    }
  }

  // ---- props --------------------------------------------------------------------

  private buildProp(p: PropDef): void {
    let [hx, hz] = PROP_SIZE[p.kind];
    if (p.turned) [hx, hz] = [hz, hx];
    const W = hx * 2;
    const D = hz * 2;
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    this.group.add(g);
    const c = p.colour;
    const B = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, cast = true) => this.box(w, h, d, x, y, z, m, cast, g);
    const C = (r0: number, r1: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 16) => this.cyl(r0, r1, h, x, y, z, m, seg, g);
    switch (p.kind) {
      case 'bin': {
        const m = this.mat(c ?? '#1b1d22', 0.55);
        B(W, 1.0, D, 0, 0.55, 0, m);
        B(W + 0.04, 0.06, D + 0.06, 0, 1.08, 0, m);
        break;
      }
      case 'skip': {
        const m = this.mat(c ?? '#d6a21a', 0.6, 0.3);
        const s = B(W, 1.1, D, 0, 0.55, 0, m);
        s.scale.set(1, 1, 1);
        B(W - 0.3, 0.3, D - 0.2, 0, 1.15, 0, this.mat('#4a4038', 1));
        break;
      }
      case 'car':
      case 'homecar':
        this.car(g, W, D, c ?? (p.kind === 'homecar' ? '#2a4a6a' : ['#1f2a44', '#6b6b70', '#2a2a2a', '#8a8a82'][Math.floor(this.rnd() * 4)]), p.kind === 'homecar');
        break;
      case 'van': {
        const paint = this.mat(c ?? '#e8e8e2', 0.35, 0.4);
        B(W, 1.9, D, 0, 1.25, 0, paint);
        B(0.9, 1.2, D - 0.1, W / 2 - 0.45, 1.0, 0, this.mat('#0a0d12', 0.1, 0.8), false);
        for (const dx of [-W / 2 + 0.8, W / 2 - 0.9]) for (const dz of [-D / 2 + 0.1, D / 2 - 0.1]) {
          const t = C(0.36, 0.36, 0.25, dx, 0.36, dz, this.mat('#0b0b0b', 0.9));
          t.rotation.x = Math.PI / 2;
        }
        break;
      }
      case 'phonebox': {
        const red = this.mat('#b3121b', 0.35, 0.1);
        B(W, 2.4, D, 0, 1.2, 0, red);
        B(W - 0.15, 1.6, D + 0.01, 0, 1.25, 0, this.mat('#1a1a1a', 0.1, 0.5, { emissive: 0xfff0c0, emissiveIntensity: 0.25 }), false);
        B(W + 0.06, 0.12, D + 0.06, 0, 2.46, 0, red);
        const t = signTexture('TELEPHONE', '#111', '#fff', { w: 512, h: 96 });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.15, 0.18), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6 }));
        sign.position.set(0, 2.25, D / 2 + 0.01);
        g.add(sign);
        break;
      }
      case 'busstop': {
        const steel = this.mat('#2b2e33', 0.4, 0.7);
        for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) B(0.08, 2.4, 0.08, dx, 1.2, 0, steel);
        B(W, 0.08, D + 0.5, 0, 2.42, 0.2, steel);
        const glass = new THREE.MeshStandardMaterial({ color: 0x9ab0c0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.25 });
        B(W - 0.1, 2.0, 0.03, 0, 1.2, -D / 2 + 0.05, glass, false);
        B(1.2, 1.7, 0.06, W / 2 - 0.7, 1.3, -D / 2 + 0.09, new THREE.MeshStandardMaterial({ map: posterTexture(this.rnd), emissive: 0xffffff, emissiveIntensity: 0.5 }), false);
        B(1.6, 0.06, 0.3, -0.4, 0.55, -D / 2 + 0.25, steel);
        break;
      }
      case 'bench': {
        const wood = this.mat('#6a4a2a', 0.8);
        B(W, 0.06, D, 0, 0.48, 0, wood);
        B(W, 0.4, 0.05, 0, 0.75, -D / 2 + 0.03, wood);
        for (const dx of [-W / 2 + 0.15, W / 2 - 0.15]) B(0.06, 0.48, D, dx, 0.24, 0, this.mat('#1a1a1a', 0.4, 0.7));
        break;
      }
      case 'barrier': {
        const steel = this.mat('#9aa0a6', 0.4, 0.8);
        B(W, 0.05, 0.05, 0, 1.05, 0, steel);
        B(W, 0.05, 0.05, 0, 0.2, 0, steel);
        for (let x = -W / 2 + 0.05; x <= W / 2; x += 0.15) B(0.025, 0.85, 0.025, x, 0.62, 0, steel, false);
        for (const dx of [-W / 2 + 0.1, W / 2 - 0.1]) B(0.05, 0.05, D * 2, dx, 0.03, 0, steel);
        break;
      }
      case 'pallets': {
        const wood = this.mat('#a8865a', 0.95);
        for (let i = 0; i < 4; i++) B(W, 0.14, D, 0, 0.07 + i * 0.15, 0, wood);
        break;
      }
      case 'crates': {
        const wood = this.mat(c ?? '#8a6a3a', 0.9);
        B(W, 0.9, D, 0, 0.45, 0, wood);
        B(W * 0.8, 0.6, D * 0.8, 0.05, 1.2, 0, wood);
        break;
      }
      case 'drum': {
        const m = this.mat(c ?? ['#2a4a7a', '#7a2a1a', '#3a5a3a'][Math.floor(this.rnd() * 3)], 0.5, 0.6);
        C(hx, hx, 0.9, 0, 0.45, 0, m);
        C(hx + 0.01, hx + 0.01, 0.04, 0, 0.3, 0, this.mat('#222', 0.5, 0.6));
        C(hx + 0.01, hx + 0.01, 0.04, 0, 0.6, 0, this.mat('#222', 0.5, 0.6));
        break;
      }
      case 'cone': {
        C(0.02, 0.17, 0.7, 0, 0.35, 0, this.mat('#ff5a1a', 0.6));
        C(0.09, 0.12, 0.12, 0, 0.4, 0, this.mat('#f0f0f0', 0.6));
        B(0.4, 0.04, 0.4, 0, 0.02, 0, this.mat('#1a1a1a', 0.8));
        break;
      }
      case 'trolley': {
        const wire = this.mat('#b0b4b8', 0.3, 0.9);
        // Basket: a grille of thin bars, with a handle and four legs on castors.
        for (let x = -W / 2; x <= W / 2 + 0.001; x += W / 6) {
          B(0.012, 0.45, 0.012, x, 0.8, -D / 2, wire, false);
          B(0.012, 0.45, 0.012, x, 0.8, D / 2, wire, false);
        }
        for (let z = -D / 2; z <= D / 2 + 0.001; z += D / 4) {
          B(0.012, 0.45, 0.012, -W / 2, 0.8, z, wire, false);
          B(0.012, 0.45, 0.012, W / 2, 0.8, z, wire, false);
        }
        for (const y of [0.58, 0.8, 1.02]) {
          B(W, 0.012, 0.012, 0, y, -D / 2, wire, false);
          B(W, 0.012, 0.012, 0, y, D / 2, wire, false);
          B(0.012, 0.012, D, -W / 2, y, 0, wire, false);
          B(0.012, 0.012, D, W / 2, y, 0, wire, false);
        }
        B(W, 0.012, D, 0, 0.58, 0, wire, false);
        B(0.05, 0.05, D + 0.1, -W / 2 - 0.08, 1.08, 0, this.mat('#2a5ad6', 0.5), false);
        for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) for (const dz of [-D / 2 + 0.05, D / 2 - 0.05]) {
          B(0.025, 0.5, 0.025, dx, 0.3, dz, wire, false);
          C(0.045, 0.045, 0.03, dx, 0.05, dz, this.mat('#111', 0.8), 10).rotation.x = Math.PI / 2;
        }
        break;
      }
      case 'postbox': {
        const red = this.mat('#b3121b', 0.35, 0.1);
        C(hx, hx, 1.25, 0, 0.77, 0, red, 20);
        C(hx + 0.03, hx + 0.03, 0.15, 0, 0.075, 0, this.mat('#0e0e0e', 0.6));
        const cap = new THREE.Mesh(new THREE.SphereGeometry(hx + 0.02, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
        cap.position.y = 1.4;
        g.add(cap);
        B(0.26, 0.04, 0.02, 0, 1.15, hx, this.mat('#0e0e0e', 0.6), false);
        break;
      }
      case 'bollard': {
        C(0.1, 0.12, 0.9, 0, 0.45, 0, this.mat('#111215', 0.4, 0.5));
        C(0.105, 0.105, 0.06, 0, 0.78, 0, this.mat('#d4af37', 0.4));
        break;
      }
      case 'planter': {
        B(W, 0.7, D, 0, 0.35, 0, this.mat('#6a6862', 0.95));
        const bush = new THREE.Mesh(new THREE.SphereGeometry(Math.min(hx, hz) * 1.1, 10, 8), this.mat('#2d5a2a', 0.9));
        bush.scale.set(hx / Math.min(hx, hz), 0.7, 1);
        bush.position.y = 0.85;
        bush.castShadow = true;
        g.add(bush);
        break;
      }
      case 'scrap': {
        const rust = this.mat('#6a3a1a', 0.8, 0.5);
        const steel = this.mat('#5a5e64', 0.6, 0.7);
        for (let i = 0; i < 9; i++) {
          const w = 0.4 + this.rnd() * 0.8;
          const h = 0.2 + this.rnd() * 0.5;
          const b = B(w, h, 0.3 + this.rnd() * 0.6, (this.rnd() - 0.5) * (W - w), h / 2 + (i > 5 ? 0.4 : 0), (this.rnd() - 0.5) * (D - 0.4), this.rnd() < 0.5 ? rust : steel);
          b.rotation.y = this.rnd() * 3;
        }
        // Old tyres.
        for (let i = 0; i < 2; i++) {
          const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 16), this.mat('#0b0b0b', 0.9));
          t.rotation.x = Math.PI / 2;
          t.position.set(-W / 2 + 0.4 + i * 0.6, 0.12, D / 2 - 0.35);
          g.add(t);
        }
        break;
      }
      // ---- home ----
      case 'bed': {
        B(W, 0.4, D, 0, 0.2, 0, this.mat('#4a3a2a', 0.8));
        B(W - 0.05, 0.2, D - 0.05, 0, 0.5, 0, this.mat('#e8e4d8', 1));
        B(W - 0.06, 0.08, D * 0.65, 0, 0.62, D * 0.15, this.mat('#2a4a7a', 1));
        B(W * 0.7, 0.12, 0.35, 0, 0.64, -D / 2 + 0.25, this.mat('#f4f0e8', 1));
        B(W, 0.9, 0.06, 0, 0.45, -D / 2, this.mat('#4a3a2a', 0.8));
        break;
      }
      case 'wardrobe': {
        const wood = this.mat('#7a5a3a', 0.7);
        B(W, 2.1, D, 0, 1.05, 0, wood);
        B(0.02, 1.9, 0.01, 0, 1.05, D / 2 + 0.005, this.mat('#2a1a0a'), false);
        for (const dx of [-0.08, 0.08]) B(0.03, 0.15, 0.04, dx, 1.1, D / 2 + 0.02, this.mat('#c9a227', 0.3, 0.8), false);
        break;
      }
      case 'desk': {
        const wood = this.mat('#9a7a5a', 0.7);
        B(W, 0.05, D, 0, 0.75, 0, wood);
        for (const dx of [-W / 2 + 0.04, W / 2 - 0.04]) B(0.05, 0.75, D, dx, 0.375, 0, wood);
        // Biscuit tin and lamp.
        C(0.13, 0.13, 0.12, -0.2, 0.84, 0.05, this.mat('#1d4a8a', 0.3, 0.6));
        B(0.05, 0.4, 0.05, 0.4, 0.97, -0.1, this.mat('#222', 0.5));
        B(0.2, 0.12, 0.2, 0.4, 1.2, -0.05, this.mat('#f0e0b0', 0.6, 0, { emissive: 0xffd080, emissiveIntensity: 0.8 }), false);
        break;
      }
      case 'sofa': {
        const fabric = this.mat(c ?? '#4a5a3a', 1);
        B(W, 0.42, D, 0, 0.21, 0, fabric);
        if (p.turned) {
          // Back against the wall on the left, arms at each end, facing into the room.
          B(0.22, 0.5, D, -W / 2 + 0.11, 0.6, 0, fabric);
          for (const dz of [-D / 2 + 0.1, D / 2 - 0.1]) B(W, 0.62, 0.2, 0, 0.31, dz, fabric);
          B(W * 0.5, 0.12, D * 0.35, 0.05, 0.48, -D * 0.2, this.mat('#c9a227', 1), false);
        } else {
          B(W, 0.5, 0.22, 0, 0.6, D / 2 - 0.11, fabric);
          for (const dx of [-W / 2 + 0.1, W / 2 - 0.1]) B(0.2, 0.62, D, dx, 0.31, 0, fabric);
        }
        break;
      }
      case 'tv': {
        B(W, 0.45, D, 0, 0.22, 0, this.mat('#2a2a2a', 0.6));
        B(W * 1.1, 0.7, 0.05, 0, 0.85, 0, this.mat('#0a0a0a', 0.2, 0.5));
        B(W * 1.05, 0.64, 0.01, 0, 0.85, 0.03, this.mat('#0a0e18', 0.1, 0, { emissive: 0x3a6aff, emissiveIntensity: 0.6 }), false);
        break;
      }
      case 'table': {
        const wood = this.mat('#8a6a4a', 0.7);
        B(W, 0.05, D, 0, 0.74, 0, wood);
        for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) for (const dz of [-D / 2 + 0.05, D / 2 - 0.05]) B(0.05, 0.74, 0.05, dx, 0.37, dz, wood, false);
        // Phone on the living room table, kettle on the kitchen one.
        B(0.08, 0.01, 0.15, 0.1, 0.77, 0, this.mat('#111', 0.2, 0, { emissive: 0x6aa0ff, emissiveIntensity: 0.8 }), false);
        break;
      }
      case 'fridge': {
        B(W, 1.8, D, 0, 0.9, 0, this.mat('#e8e8e4', 0.3, 0.1));
        B(0.03, 0.4, 0.04, W / 2 - 0.08, 1.2, D / 2 + 0.02, this.mat('#888', 0.3, 0.8), false);
        B(W - 0.02, 0.01, 0.01, 0, 1.15, D / 2 + 0.005, this.mat('#aaa'), false);
        break;
      }
      case 'cooker':
        B(W, 0.9, D, 0, 0.45, 0, this.mat('#e8e8e4', 0.3, 0.2));
        break;
      case 'counter': {
        B(W, 0.88, D, 0, 0.44, 0, this.mat('#e8e4d8', 0.6));
        B(W + 0.04, 0.05, D + 0.04, 0, 0.9, 0, this.mat('#3a3a38', 0.3));
        // Hob, sink, kettle.
        B(0.55, 0.01, 0.45, -W / 2 + 0.45, 0.93, 0, this.mat('#111', 0.2));
        B(0.5, 0.02, 0.38, W / 2 - 0.5, 0.92, 0, this.mat('#aab', 0.2, 0.9));
        C(0.09, 0.1, 0.22, 0.1, 1.03, -0.05, this.mat('#c0c0c0', 0.3, 0.8), 12);
        break;
      }
      case 'weights': {
        const steel = this.mat('#2a2a2a', 0.5, 0.7);
        B(W, 0.4, D, 0, 0.2, 0, this.mat('#1a1a1a', 0.8));
        for (const dx of [-W / 2 + 0.1, W / 2 - 0.1]) B(0.06, 1.2, 0.06, dx, 0.6, -D / 2 + 0.1, steel);
        const bar = C(0.02, 0.02, W + 0.4, 0, 1.15, -D / 2 + 0.1, this.mat('#c0c0c0', 0.2, 0.9), 8);
        bar.rotation.z = Math.PI / 2;
        for (const dx of [-W / 2 - 0.05, W / 2 + 0.05]) {
          const pl = C(0.22, 0.22, 0.06, dx, 1.15, -D / 2 + 0.1, steel);
          pl.rotation.z = Math.PI / 2;
        }
        break;
      }
      case 'bag': {
        C(hx, hx, 1.1, 0, 1.1, 0, this.mat('#7a1a1a', 0.7));
        C(0.01, 0.01, 0.9, 0, 2.1, 0, this.mat('#888', 0.3, 0.9), 6);
        break;
      }
      case 'rack': {
        B(W, 1.0, D, 0, 0.5, 0, this.mat('#2a2a2a', 0.6, 0.6));
        for (let i = 0; i < 5; i++) C(0.07, 0.07, 0.14, -W / 2 + 0.2 + i * 0.3, 0.75, 0, this.mat('#1a1a1a', 0.5, 0.7), 10).rotation.z = Math.PI / 2;
        break;
      }
      case 'workbench': {
        const wood = this.mat('#8a6a3a', 0.85);
        B(W, 0.08, D, 0, 0.9, 0, wood);
        for (const dx of [-W / 2 + 0.06, W / 2 - 0.06]) B(0.08, 0.9, D - 0.1, dx, 0.45, 0, wood);
        B(W, 1.0, 0.04, 0, 1.6, -D / 2, this.mat('#5a4a3a', 0.9)); // pegboard
        for (let i = 0; i < 5; i++) B(0.04, 0.25, 0.03, -W / 2 + 0.3 + i * 0.35, 1.6, -D / 2 + 0.04, this.mat('#9aa', 0.4, 0.8), false);
        break;
      }
      case 'shelves': {
        const m = this.mat('#5a5e64', 0.6, 0.6);
        for (let i = 0; i < 4; i++) B(W, 0.03, D, 0, 0.3 + i * 0.5, 0, m);
        for (const dx of [-W / 2, W / 2]) B(0.04, 1.9, D, dx, 0.95, 0, m);
        for (let i = 0; i < 6; i++) B(0.3, 0.25, 0.3, -W / 2 + 0.25 + (i % 3) * 0.5, 0.45 + Math.floor(i / 3) * 0.5, 0, this.mat(['#a87a4a', '#3a5a8a', '#8a2a2a'][i % 3], 0.9), false);
        break;
      }
      case 'chest': {
        // Ottoman storage chest: wood with iron straps and a brass lock.
        const wood = new THREE.MeshStandardMaterial({ map: woodFloorTexture(1, 0.5), color: 0x8a5a32, roughness: 0.6 });
        B(W, 0.55, D, 0, 0.3, 0, wood);
        const lid = B(W + 0.04, 0.12, D + 0.04, 0, 0.64, 0, wood);
        lid.castShadow = true;
        for (const dx of [-W / 3, W / 3]) B(0.06, 0.68, D + 0.06, dx, 0.34, 0, this.mat('#2a2a2a', 0.5, 0.7), false);
        B(0.12, 0.14, 0.03, 0, 0.5, D / 2 + 0.03, this.mat('#c9a227', 0.25, 0.9), false);
        break;
      }
      case 'dumpster': {
        const m = this.mat(c ?? '#2a5a3a', 0.6, 0.4);
        B(W, 1.2, D, 0, 0.7, 0, m);
        const lid = B(W, 0.06, D * 0.55, 0, 1.36, -D * 0.2, this.mat('#1a1a1a', 0.7));
        lid.rotation.x = -0.25;
        for (const dx of [-W / 2 + 0.15, W / 2 - 0.15]) for (const dz of [-D / 2 + 0.1, D / 2 - 0.1]) C(0.07, 0.07, 0.1, dx, 0.05, dz, this.mat('#111', 0.9), 10);
        B(W + 0.04, 0.06, 0.06, 0, 1.15, D / 2, this.mat('#555', 0.5, 0.6), false);
        break;
      }
      case 'rubbish_bags': {
        const m = this.mat('#111214', 0.25, 0.1);
        for (let i = 0; i < 4; i++) {
          const bag = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), m);
          bag.scale.set(1, 0.85 + this.rnd() * 0.3, 1);
          bag.position.set((i - 1.5) * 0.28, 0.24 + (i === 2 ? 0.3 : 0), (this.rnd() - 0.5) * 0.3);
          bag.castShadow = true;
          g.add(bag);
        }
        break;
      }
      case 'cardboard': {
        const m = this.mat('#a8865a', 0.95);
        B(W, 0.5, D, 0, 0.25, 0, m);
        B(W * 0.7, 0.35, D * 0.7, 0.1, 0.68, 0, m);
        const flap = B(W * 0.7, 0.02, 0.3, 0.1, 0.88, D * 0.35, m, false);
        flap.rotation.x = 0.8;
        break;
      }
      case 'abandoned_car': {
        this.car(g, W, D, c ?? '#5a3a2a', false);
        // Burnt out: dark, windows gone, on its rims.
        g.traverse((o: THREE.Object3D) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.metalness > 0.6) o.material = this.mat('#2a2420', 1, 0.3);
        });
        g.position.y = -0.12;
        break;
      }
      case 'container': {
        const m = new THREE.MeshStandardMaterial({ map: corrugatedTexture(c ?? ['#b3121b', '#1f5a9a', '#2a6a3a', '#c97a1a'][Math.floor(this.rnd() * 4)], 6, 1), roughness: 0.6, metalness: 0.4 });
        B(W, 2.6, D, 0, 1.3, 0, m);
        for (const dx of [W / 2 - 0.02]) for (const dz of [-0.4, 0.4]) B(0.04, 2.4, 0.04, dx, 1.3, dz, this.mat('#2a2a2a', 0.5, 0.7), false);
        break;
      }
      case 'market_stall': {
        const wood = this.mat('#7a5a32', 0.8);
        B(W, 0.08, D, 0, 0.9, 0, wood);
        for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) for (const dz of [-D / 2 + 0.05, D / 2 - 0.05]) B(0.05, 2.2, 0.05, dx, 1.1, dz, this.mat('#5a5e64', 0.5, 0.6), false);
        const stripes = ['#b3121b', '#f0ece0'];
        for (let i = 0; i < 8; i++) {
          const s2 = B(W / 8, 0.04, D + 0.3, -W / 2 + W / 16 + (i * W) / 8, 2.2, 0, this.mat(c && i % 2 === 0 ? c : stripes[i % 2], 0.9), false);
          s2.rotation.x = 0.15;
        }
        // Produce in crates.
        for (let i = 0; i < 4; i++) {
          B(W / 4.5, 0.15, D * 0.7, -W / 2 + W / 8 + (i * W) / 4, 1.02, 0, this.mat('#a8865a', 0.9), false);
          B(W / 5, 0.08, D * 0.6, -W / 2 + W / 8 + (i * W) / 4, 1.12, 0, this.mat(['#d84a1a', '#3a8a2a', '#e8c82a', '#7a1a4a'][i], 0.8), false);
        }
        break;
      }
      case 'turnstile': {
        B(W * 0.4, 1.0, D, -W * 0.3, 0.5, 0, this.mat('#9aa0a8', 0.3, 0.8));
        for (let i = 0; i < 3; i++) {
          const arm = B(0.5, 0.04, 0.04, 0.05, 0.9, 0, this.mat('#c8ccd0', 0.2, 0.9), false);
          arm.rotation.x = (i * Math.PI * 2) / 3;
          arm.position.x = 0.1;
        }
        break;
      }
      case 'pillar':
        B(W, 3.4, D, 0, 1.7, 0, new THREE.MeshStandardMaterial({ map: concreteTexture('#7a7874', 1, 3), roughness: 1 }));
        B(W + 0.02, 0.4, D + 0.02, 0, 0.8, 0, this.mat('#d8b018', 0.6), false);
        break;
      case 'bike_rack': {
        const m = this.mat('#2a2e33', 0.4, 0.7);
        for (let x = -W / 2 + 0.2; x <= W / 2 - 0.2; x += 0.6) {
          const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 16, Math.PI), m);
          hoop.position.set(x, 0, 0);
          hoop.castShadow = true;
          g.add(hoop);
        }
        break;
      }
      case 'lamp_post': {
        C(0.06, 0.09, 6, 0, 3, 0, this.mat('#2a2e33', 0.5, 0.6), 8);
        B(0.1, 0.08, 0.9, 0, 6, 0.4, this.mat('#2a2e33', 0.5, 0.6));
        B(0.3, 0.12, 0.5, 0, 5.92, 0.8, this.mat('#ffffff', 0.4, 0, { emissive: 0xffc070, emissiveIntensity: 1.4 }), false);
        break;
      }
      case 'traffic_light': {
        C(0.05, 0.05, 3, 0, 1.5, 0, this.mat('#2a2a2a', 0.5, 0.6), 8);
        B(0.3, 0.85, 0.22, 0, 3.3, 0, this.mat('#141414', 0.5));
        [0xff2020, 0xffa020, 0x20ff60].forEach((col, i) => B(0.16, 0.16, 0.03, 0, 3.58 - i * 0.27, 0.12, this.mat('#111', 0.3, 0, { emissive: col, emissiveIntensity: i === 0 ? 1.4 : 0.08 }), false));
        break;
      }
      case 'sign_post': {
        C(0.04, 0.04, 2.6, 0, 1.3, 0, this.mat('#8a9098', 0.4, 0.7), 8);
        const t = signTexture(p.label ?? 'NO BALL GAMES', '#ffffff', '#1a1a1a', { w: 512, h: 256 });
        B(0.8, 0.5, 0.03, 0, 2.4, 0.04, new THREE.MeshStandardMaterial({ map: t }), false);
        break;
      }
      case 'bollard_row': {
        for (let x = -W / 2 + 0.15; x <= W / 2; x += 0.75) {
          C(0.1, 0.12, 0.9, x, 0.45, 0, this.mat('#1a1a1a', 0.5, 0.4), 12);
          C(0.105, 0.105, 0.08, x, 0.78, 0, this.mat('#e8e4d8', 0.4, 0, { emissive: 0x404040, emissiveIntensity: 0.4 }), 12);
        }
        break;
      }
      case 'bus': {
        const paint = this.mat(c ?? '#b3121b', 0.35, 0.3);
        B(W, 2.9, D, 0, 1.75, 0, paint);
        B(W - 0.6, 0.8, D + 0.02, -0.1, 1.9, 0, this.mat('#0a0d12', 0.1, 0.8, { emissive: 0xfff0c8, emissiveIntensity: 0.15 }), false);
        B(W - 0.6, 0.6, D + 0.02, -0.1, 2.85, 0, this.mat('#0a0d12', 0.1, 0.8), false);
        B(0.04, 0.4, 1.6, W / 2 + 0.01, 3.0, 0, this.mat('#111', 0.3, 0, { emissive: 0xffa020, emissiveIntensity: 1 }), false);
        for (const dx of [-W / 2 + 1.2, W / 2 - 1.4]) for (const dz of [-D / 2 + 0.1, D / 2 - 0.1]) C(0.5, 0.5, 0.3, dx, 0.5, dz, this.mat('#0b0b0b', 0.9)).rotation.x = Math.PI / 2;
        break;
      }
      case 'forklift': {
        const y = this.mat(c ?? '#d8a018', 0.5, 0.3);
        B(W * 0.6, 0.9, D, -W * 0.15, 0.65, 0, y);
        B(W * 0.4, 0.05, D * 0.8, -W * 0.15, 2.1, 0, this.mat('#1a1a1a', 0.5, 0.6));
        for (const dx of [-W * 0.4, W * 0.1]) for (const dz of [-D / 2 + 0.05, D / 2 - 0.05]) B(0.05, 1.9, 0.05, dx, 1.2, dz, this.mat('#1a1a1a', 0.5, 0.6), false);
        B(0.1, 2.2, D * 0.8, W * 0.2, 1.1, 0, this.mat('#2a2a2a', 0.5, 0.7));
        for (const dz of [-0.25, 0.25]) B(0.9, 0.06, 0.12, W * 0.2 + 0.45, 0.12, dz, this.mat('#3a3a3a', 0.5, 0.7));
        for (const dx of [-W * 0.35, W * 0.05]) for (const dz of [-D / 2, D / 2]) C(0.25, 0.25, 0.2, dx, 0.25, dz, this.mat('#0b0b0b', 0.9)).rotation.x = Math.PI / 2;
        break;
      }
      case 'bollard_dock': {
        C(W * 0.7, W, 0.6, 0, 0.3, 0, this.mat('#1a1a1a', 0.6, 0.5), 12);
        C(W, W, 0.08, 0, 0.62, 0, this.mat('#1a1a1a', 0.6, 0.5), 12);
        const rope = new THREE.Mesh(new THREE.TorusGeometry(W * 0.8, 0.03, 6, 16), this.mat('#c8b080', 1));
        rope.rotation.x = Math.PI / 2;
        rope.position.y = 0.45;
        g.add(rope);
        break;
      }
      case 'crane_leg': {
        const m = this.mat('#c9a227', 0.6, 0.4);
        B(W, 12, D, 0, 6, 0, m);
        for (let y = 1; y < 12; y += 1.5) {
          const brace = B(0.06, 1.6, D + 0.02, 0, y, 0, this.mat('#8a6a12', 0.6, 0.5), false);
          brace.rotation.x = 0.7;
        }
        B(W + 0.6, 0.4, D + 0.6, 0, 0.2, 0, this.mat('#2a2a2a', 0.6, 0.6));
        break;
      }
      case 'kiosk': {
        B(W, 2.4, D, 0, 1.2, 0, this.mat(c ?? '#1d3a2a', 0.5));
        B(W - 0.3, 0.9, 0.04, 0, 1.6, D / 2 + 0.01, this.mat('#101418', 0.05, 0.7, { emissive: 0xfff2d8, emissiveIntensity: 0.7 }), false);
        B(W + 0.3, 0.1, D + 0.4, 0, 2.45, 0, this.mat('#1a1a1a', 0.5));
        const t = signTexture(p.label ?? 'NEWS', '#c81e1e', '#ffffff', { w: 512, h: 128 });
        B(W, 0.3, 0.04, 0, 2.2, D / 2 + 0.03, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 }), false);
        break;
      }
      case 'fountain': {
        C(W, W, 0.5, 0, 0.25, 0, new THREE.MeshStandardMaterial({ map: concreteTexture('#a8a498', 2, 1), roughness: 0.9 }), 24);
        const water = C(W - 0.1, W - 0.1, 0.02, 0, 0.45, 0, this.mat('#1a3a4a', 0.05, 0.5, { emissive: 0x2a5a7a, emissiveIntensity: 0.5 }), 24);
        water.castShadow = false;
        C(0.15, 0.25, 1.4, 0, 0.9, 0, this.mat('#a8a498', 0.9), 12);
        C(0.5, 0.4, 0.15, 0, 1.6, 0, this.mat('#a8a498', 0.9), 16);
        break;
      }
      case 'escalator': {
        const ramp = B(W, 0.3, D, 0, 1.2, 0, this.mat('#b8bcc4', 0.3, 0.8));
        ramp.rotation.z = 0.5;
        for (const dz of [-D / 2, D / 2]) {
          const side = B(W + 0.2, 1.0, 0.06, 0, 1.6, dz, this.mat('#a8c8d8', 0.05, 0.3, { transparent: true, opacity: 0.4 }), false);
          side.rotation.z = 0.5;
          const rail = B(W + 0.3, 0.06, 0.08, 0, 2.15, dz, this.mat('#1a1a1a', 0.5), false);
          rail.rotation.z = 0.5;
        }
        break;
      }
      case 'mall_planter': {
        B(W, 0.6, D, 0, 0.3, 0, this.mat('#d8d4cc', 0.4));
        B(W - 0.1, 0.05, D - 0.1, 0, 0.6, 0, this.mat('#3a2a1a', 1), false);
        for (let i = 0; i < 3; i++) {
          const tree = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 8), this.mat('#2a5a2a', 0.9));
          tree.position.set(-W / 3 + (i * W) / 3, 1.4, 0);
          tree.castShadow = true;
          g.add(tree);
        }
        break;
      }
      case 'atm': {
        B(W, 1.6, D, 0, 0.8, 0, this.mat('#4a4d55', 0.4, 0.6));
        B(W * 0.7, 0.3, 0.02, 0, 1.25, D / 2 + 0.01, this.mat('#0a1a2a', 0.1, 0.4, { emissive: 0x2a8ad8, emissiveIntensity: 0.9 }), false);
        B(W * 0.5, 0.15, 0.06, 0, 0.95, D / 2 + 0.03, this.mat('#2a2a2a', 0.4, 0.6), false);
        const t = signTexture('CASH', '#1f6a3a', '#ffffff', { w: 256, h: 96 });
        B(W, 0.2, 0.02, 0, 1.52, D / 2 + 0.01, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 }), false);
        break;
      }
      case 'vending': {
        B(W, 1.9, D, 0, 0.95, 0, this.mat(c ?? '#b3121b', 0.4, 0.3));
        B(W * 0.65, 1.3, 0.02, -W * 0.12, 1.15, D / 2 + 0.01, this.mat('#101418', 0.05, 0.6, { emissive: 0xfff8e8, emissiveIntensity: 0.8 }), false);
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) B(0.08, 0.16, 0.05, -W * 0.4 + k * 0.13, 0.65 + r * 0.32, D / 2 - 0.04, this.mat(['#d82a2a', '#2a8ad8', '#e8c82a', '#2a8a3a'][(r + k) % 4], 0.4), false);
        break;
      }
      case 'shop_rail': {
        const chrome = this.mat('#c8ccd0', 0.15, 0.95);
        for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) C(0.02, 0.02, 1.5, dx, 0.75, 0, chrome, 8);
        C(0.015, 0.015, W, 0, 1.48, 0, chrome, 8).rotation.z = Math.PI / 2;
        B(W, 0.04, D, 0, 0.03, 0, chrome, false);
        for (let x = -W / 2 + 0.15; x < W / 2 - 0.1; x += 0.11) {
          const col = ['#1a1a1a', '#1f2a44', '#7a1414', '#3a5a3a', '#e8e4dc', '#5a4a3a'][Math.floor(this.rnd() * 6)];
          B(0.04, 0.7, 0.45, x, 1.08, 0, this.mat(col, 0.95), false);
        }
        break;
      }
      case 'mannequin': {
        const skin = this.mat('#e8e4dc', 0.35);
        C(0.15, 0.15, 0.02, 0, 0.01, 0, this.mat('#1a1a1a', 0.3, 0.6), 16);
        C(0.015, 0.015, 0.7, 0, 0.36, 0, this.mat('#c8ccd0', 0.15, 0.9), 6);
        B(0.36, 0.55, 0.2, 0, 1.0, 0, this.mat(c ?? ['#1a1a1a', '#7a1414', '#1f2a44'][Math.floor(this.rnd() * 3)], 0.9));
        B(0.34, 0.25, 0.2, 0, 0.62, 0, this.mat('#2a3a5a', 0.9));
        C(0.06, 0.06, 0.1, 0, 1.33, 0, skin, 8);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
        head.scale.set(0.85, 1.1, 0.95);
        head.position.y = 1.5;
        head.castShadow = true;
        g.add(head);
        for (const dx of [-0.22, 0.22]) B(0.08, 0.5, 0.1, dx, 0.98, 0, this.mat('#1a1a1a', 0.9));
        break;
      }
      case 'display_cabinet':
      case 'glass_counter': {
        const tall = p.kind === 'display_cabinet';
        const h = tall ? 1.8 : 1.0;
        B(W, 0.3, D, 0, 0.15, 0, this.mat('#2a1a10', 0.5));
        B(W, h - 0.3, D, 0, 0.15 + h / 2, 0, this.mat('#c8e0f0', 0.02, 0.2, { transparent: true, opacity: 0.25, depthWrite: false }), false);
        for (let k = 0; k < (tall ? 3 : 1); k++) B(W - 0.05, 0.02, D - 0.05, 0, 0.5 + k * 0.45, 0, this.mat('#c8e0f0', 0.05, 0.2, { transparent: true, opacity: 0.4 }), false);
        // Watches, rings, phones glinting on the shelves.
        for (let i = 0; i < (tall ? 12 : 6); i++) {
          const gold = this.rnd() < 0.5;
          B(0.08, 0.03, 0.06, -W / 2 + 0.15 + this.rnd() * (W - 0.3), 0.53 + Math.floor(this.rnd() * (tall ? 3 : 1)) * 0.45, (this.rnd() - 0.5) * (D - 0.2), this.mat(gold ? '#d4af37' : '#c8ccd0', 0.15, 0.95, { emissive: gold ? 0x6a5010 : 0x404448, emissiveIntensity: 0.6 }), false);
        }
        B(W, 0.04, D, 0, 0.15 + h - 0.15 + 0.02, 0, this.mat('#2a1a10', 0.5), false);
        break;
      }
      case 'shop_counter': {
        B(W, 1.0, D, 0, 0.5, 0, this.mat(c ?? '#e8e4dc', 0.4));
        B(W + 0.06, 0.05, D + 0.06, 0, 1.02, 0, this.mat('#1a1a1a', 0.3, 0.2));
        B(0.35, 0.25, 0.3, W / 2 - 0.4, 1.17, 0, this.mat('#1a1a1a', 0.4, 0.4));
        B(0.3, 0.2, 0.02, W / 2 - 0.4, 1.4, -0.05, this.mat('#0a1a2a', 0.1, 0.4, { emissive: 0x2a8ad8, emissiveIntensity: 0.7 }), false);
        break;
      }
      case 'shop_shelf': {
        const m = this.mat(c ?? '#e8e4dc', 0.6);
        B(W, 1.9, 0.05, 0, 0.95, -D / 2 + 0.03, m);
        for (let i = 0; i < 4; i++) {
          B(W, 0.03, D, 0, 0.3 + i * 0.48, 0, m, false);
          for (let x = -W / 2 + 0.15; x < W / 2 - 0.1; x += 0.25) B(0.2, 0.14, D * 0.7, x, 0.38 + i * 0.48, 0, this.mat(['#1a1a1a', '#e8e4dc', '#7a1414', '#1f2a44', '#c97a1a', '#3a5a3a'][Math.floor(this.rnd() * 6)], 0.9), false);
        }
        break;
      }
      case 'changing_booth': {
        const m = this.mat('#e8e4dc', 0.6);
        B(0.04, 2.2, D, -W / 2, 1.1, 0, m);
        B(0.04, 2.2, D, W / 2, 1.1, 0, m);
        B(W, 2.2, 0.04, 0, 1.1, -D / 2, this.mat('#a8b8c8', 0.05, 0.2, { emissive: 0x4a5a6a, emissiveIntensity: 0.4 }));
        C(0.012, 0.012, W, 0, 2.15, D / 2, this.mat('#c8ccd0', 0.2, 0.9), 6).rotation.z = Math.PI / 2;
        B(W * 0.35, 1.9, 0.02, -W * 0.3, 1.18, D / 2, this.mat('#2a3a5a', 0.95), false);
        break;
      }
      case 'bar': {
        const wood = new THREE.MeshStandardMaterial({ map: woodFloorTexture(W / 1.5, 0.6), color: 0x6a3a1a, roughness: 0.4 });
        B(W, 1.05, D, 0, 0.52, 0, wood);
        B(W + 0.1, 0.06, D + 0.15, 0, 1.08, 0.05, this.mat('#3a1a0a', 0.25, 0.1));
        B(W, 0.04, 0.04, 0, 0.22, D / 2 + 0.12, this.mat('#c9a227', 0.2, 0.9), false);
        // Beer pumps.
        for (let i = 0; i < 4; i++) {
          C(0.03, 0.04, 0.2, -0.6 + i * 0.4, 1.2, 0.05, this.mat('#c8ccd0', 0.2, 0.9), 8);
          B(0.05, 0.3, 0.05, -0.6 + i * 0.4, 1.4, 0.05, this.mat(['#1a1a1a', '#e8e4dc', '#7a1414', '#1f2a44'][i], 0.4), false);
        }
        for (let i = 0; i < 3; i++) C(0.035, 0.03, 0.14, W / 2 - 0.4 - i * 0.18, 1.18, D / 2 - 0.1, this.mat('#d8a040', 0.1, 0.1, { transparent: true, opacity: 0.8, emissive: 0x6a3a10, emissiveIntensity: 0.3 }), 10);
        break;
      }
      case 'pool_table': {
        B(W, 0.18, D, 0, 0.72, 0, this.mat('#4a2a14', 0.5));
        B(W - 0.25, 0.02, D - 0.25, 0, 0.82, 0, this.mat('#1a5a2a', 1), false);
        for (const dx of [-W / 2 + 0.15, W / 2 - 0.15]) for (const dz of [-D / 2 + 0.15, D / 2 - 0.15]) B(0.14, 0.64, 0.14, dx, 0.32, dz, this.mat('#4a2a14', 0.5));
        const cols = ['#e8c82a', '#c81e1e', '#1a1a1a', '#f0f0f0', '#1f5a9a', '#c81e1e', '#e8c82a'];
        cols.forEach((col, i) => {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), this.mat(col, 0.15));
          ball.position.set(-0.3 + (i % 4) * 0.2 + this.rnd() * 0.1, 0.86, -0.2 + Math.floor(i / 4) * 0.3);
          g.add(ball);
        });
        // Lampshade over the table.
        B(1.2, 0.18, 0.4, 0, 2.3, 0, this.mat('#1d3a2a', 0.6, 0, { emissive: 0xfff0c8, emissiveIntensity: 0.3 }), false);
        break;
      }
      case 'pub_table': {
        C(W, W, 0.05, 0, 0.74, 0, this.mat('#3a2010', 0.35), 20);
        C(0.04, 0.05, 0.7, 0, 0.37, 0, this.mat('#1a1a1a', 0.4, 0.6), 8);
        C(0.25, 0.25, 0.03, 0, 0.02, 0, this.mat('#1a1a1a', 0.4, 0.6), 16);
        C(0.035, 0.03, 0.15, 0.1, 0.84, 0.05, this.mat('#d8a040', 0.1, 0.1, { transparent: true, opacity: 0.8 }), 10);
        break;
      }
      case 'fruit_machine': {
        B(W, 1.8, D, 0, 0.9, 0, this.mat('#1a1a2a', 0.4));
        B(W * 0.8, 0.45, 0.02, 0, 1.3, D / 2 + 0.01, this.mat('#111', 0.3, 0, { emissive: 0xff8a2a, emissiveIntensity: 0.8 }), false);
        B(W * 0.8, 0.3, 0.02, 0, 1.65, D / 2 + 0.01, this.mat('#111', 0.3, 0, { emissive: 0xff2aa0, emissiveIntensity: 1 }), false);
        for (let i = 0; i < 4; i++) B(0.06, 0.03, 0.03, -0.15 + i * 0.1, 0.95, D / 2 + 0.02, this.mat('#111', 0.3, 0, { emissive: [0xff2020, 0xffd020, 0x20ff60, 0x2080ff][i], emissiveIntensity: 1 }), false);
        break;
      }
      case 'jukebox': {
        B(W, 1.3, D, 0, 0.65, 0, this.mat('#5a2a14', 0.3));
        const top = C(W / 2, W / 2, D * 2, 0, 1.3, 0, this.mat('#d84a1a', 0.2, 0, { emissive: 0xff8a2a, emissiveIntensity: 0.9 }), 20);
        top.rotation.x = Math.PI / 2;
        B(W * 0.7, 0.4, 0.02, 0, 0.95, D / 2 + 0.01, this.mat('#1a1a1a', 0.1, 0.3, { emissive: 0xffe0a0, emissiveIntensity: 0.6 }), false);
        break;
      }
      case 'dj_booth': {
        B(W, 1.1, D, 0, 0.55, 0, this.mat('#121216', 0.4, 0.3));
        B(W, 0.08, D * 0.9, 0, 1.14, 0, this.mat('#1a1a1a', 0.3, 0.4));
        for (const dx of [-W / 3, W / 3]) {
          const deck = C(0.16, 0.16, 0.03, dx, 1.2, 0, this.mat('#2a2a2a', 0.2, 0.7), 20);
          deck.castShadow = false;
        }
        B(W, 0.06, 0.03, 0, 0.9, D / 2 + 0.01, this.mat('#111', 0.3, 0, { emissive: 0xa070ff, emissiveIntensity: 1.6 }), false);
        break;
      }
      default:
        // Anything without a model yet still shows its collision box, so you never bump into thin air.
        B(W || 0.3, 1, D || 0.3, 0, 0.5, 0, this.mat(c ?? '#5a5e64', 0.7));
    }
  }

  private car(g: THREE.Group, W: number, D: number, colour: string, home: boolean): void {
    const paint = this.mat(colour, 0.25, 0.7);
    const glass = this.mat('#0a0d12', 0.1, 0.8);
    this.box(W, 0.7, D, 0, 0.6, 0, paint, true, g);
    this.box(W * 0.54, 0.6, D - 0.12, -0.2, 1.22, 0, glass, true, g);
    this.box(W * 0.5, 0.06, D - 0.18, -0.2, 1.54, 0, paint, true, g);
    const tyre = this.mat('#0b0b0b', 0.9);
    for (const dx of [-W / 2 + 0.65, W / 2 - 0.65]) for (const dz of [-D / 2 + 0.05, D / 2 - 0.05]) {
      const t = this.cyl(0.33, 0.33, 0.24, dx, 0.33, dz, tyre, 16, g);
      t.rotation.x = Math.PI / 2;
    }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshBasicMaterial({ color: 0xe8e8e2 }));
    front.position.set(W / 2 + 0.01, 0.55, 0);
    front.rotation.y = Math.PI / 2;
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshBasicMaterial({ color: 0xe0b400 }));
    rear.position.set(-W / 2 - 0.01, 0.55, 0);
    rear.rotation.y = -Math.PI / 2;
    g.add(front, rear);
    if (home) {
      // Up on axle stands with the bonnet open: a project car.
      const bonnet = this.box(W * 0.3, 0.04, D - 0.1, W / 2 - W * 0.15, 1.2, 0, paint, true, g);
      bonnet.rotation.z = 0.9;
      bonnet.position.x = W / 2 - W * 0.2;
    }
  }

  // ---- doors, exits, gates, levers ------------------------------------------------------

  private buildExit(ex: ExitDef): void {
    if (ex.kind === 'door') {
      // A lit doorway on the wall behind the door point.
      const z = this.back + 0.05;
      const isStairs = ex.id.includes('stairs') || ex.id.includes('steps');
      const frame = this.mat('#e8e4d8', 0.6);
      this.box(1.4, 0.12, 0.14, ex.x, 2.35, z + 0.05, frame, false);
      this.box(0.12, 2.35, 0.14, ex.x - 0.7, 1.17, z + 0.05, frame, false);
      this.box(0.12, 2.35, 0.14, ex.x + 0.7, 1.17, z + 0.05, frame, false);
      const inner = this.mat(isStairs ? '#111316' : '#3a2416', 0.6, 0, { emissive: 0xffd8a0, emissiveIntensity: isStairs ? 0.08 : 0.15 });
      this.box(1.28, 2.25, 0.06, ex.x, 1.12, z, inner, false);
      if (isStairs) for (let i = 0; i < 6; i++) this.box(1.2, 0.05, 0.2, ex.x, 0.15 + i * 0.32, z + 0.06 - i * 0.01, this.mat('#555', 0.9), false);
      this.exitSign(ex, ex.x, 2.75, z + 0.12);
      return;
    }
    // Street sign at the end of the area.
    const b = this.level.bounds;
    const x = ex.side === 'left' ? b.minX + 0.6 : b.maxX - 0.6;
    const z = this.back + 0.1;
    this.cyl(0.05, 0.05, 2.6, x, 1.3, z, this.mat('#2b2e33', 0.4, 0.7), 8);
    this.exitSign(ex, x, 2.4, z + 0.06);
    // Floor chevrons pointing off the edge.
    const chev = this.mat('#ffd23d', 0.6, 0, { emissive: 0xffd23d, emissiveIntensity: 0.25, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), chev);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = Math.PI / 4;
      c.position.set(x + (ex.side === 'left' ? -1 : 1) * (i * 0.5 - 0.6), 0.01, 0);
      this.group.add(c);
    }
  }

  private exitSign(ex: ExitDef, x: number, y: number, z: number): void {
    const arrow = ex.kind === 'edge' ? (ex.side === 'left' ? '← ' : '') : '';
    const after = ex.kind === 'edge' && ex.side === 'right' ? ' →' : '';
    const t = signTexture(`${arrow}${ex.label}${after}`, '#16365a', '#ffffff', { w: 768, h: 128 });
    const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 });
    const text = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.3), mat);
    text.position.set(x, y, z);
    this.group.add(text);
    this.exitSigns.push({ exit: ex, mat, text, locked: null });
  }

  private buildGate(id: string, x: number, z0: number, z1: number): void {
    const g = new THREE.Group();
    const steel = this.mat('#3a4048', 0.4, 0.8);
    const len = z1 - z0;
    this.box(0.08, 0.08, len, 0, 2.3, 0, steel, true, g);
    this.box(0.08, 0.08, len, 0, 0.2, 0, steel, true, g);
    for (let z = -len / 2; z <= len / 2 + 0.01; z += 0.14) this.box(0.035, 2.2, 0.035, 0, 1.2, z, steel, true, g);
    g.position.set(x, 0, (z0 + z1) / 2);
    this.group.add(g);
    // Fixed posts either side.
    this.box(0.15, 2.6, 0.15, x, 1.3, z0, steel);
    this.box(0.15, 2.6, 0.15, x, 1.3, z1, steel);
    this.gates.set(id, { mesh: g, lift: 0 });
  }

  private buildLever(id: string, x: number): void {
    const z = this.back + 0.07;
    this.box(0.5, 0.7, 0.14, x, 1.2, z, this.mat('#5a6a5a', 0.6, 0.5));
    const lamp = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 1 });
    this.box(0.08, 0.08, 0.04, x + 0.15, 1.45, z + 0.08, lamp, false);
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.05, 1.2, z + 0.1);
    this.box(0.05, 0.45, 0.05, 0, 0.22, 0, this.mat('#c0c0c0', 0.3, 0.9), true, pivot);
    this.box(0.1, 0.1, 0.1, 0, 0.45, 0, this.mat('#b3121b', 0.4), true, pivot);
    pivot.rotation.z = 0.6;
    this.group.add(pivot);
    this.levers.set(id, { handle: pivot, lamp });
  }

  // ---- decoration and light ----------------------------------------------------------------

  private buildGraffiti(): void {
    const theme = this.level.theme;
    const density = themeProfile(theme).graffiti;
    if (!density) return;
    for (let x = this.level.bounds.minX + 2; x < this.level.bounds.maxX; x += density * (0.6 + this.rnd() * 0.8)) {
      const w = 1.4 + this.rnd() * 1.2;
      if (this.level.exits.some((e) => e.kind === 'door' && Math.abs(e.x - x) < w / 2 + 0.9)) continue;
      const m = new THREE.MeshStandardMaterial({ map: graffitiTexture(this.rnd), transparent: true, roughness: 0.9, depthWrite: false });
      this.panel(w, w / 2, x, 0.35 + w / 4 + this.rnd() * 0.25, m, 0.09);
    }
  }

  private buildLights(): void {
    const theme = this.level.theme;
    const g = this.group;
    const prof = themeProfile(theme);
    const indoor = prof.interior || prof.roofed;
    g.add(new THREE.HemisphereLight(indoor ? 0x8a8070 : 0x55607e, 0x14100c, indoor ? 1.1 : 0.9));
    const front = new THREE.DirectionalLight(0xffd2a8, indoor ? 0.6 : 0.75);
    front.position.set(2, 3, 12);
    g.add(front);
    // Shadow-casting light that follows the camera along the street.
    this.sun.position.set(-4, 12, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 10;
    this.sun.shadow.camera.bottom = -6;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.bias = -0.0008;
    g.add(this.sun, this.sun.target);
    this.shadowLights.push(this.sun);

    for (const l of this.level.lights) {
      const light = new THREE.PointLight(l.colour, l.intensity, l.range ?? 12, 1.6);
      light.position.set(l.x, l.y, l.z);
      g.add(light);
      this.flicker.push({ light, base: l.intensity });
      if (prof.interior) {
        // Ceiling lampshade.
        this.cyl(0.01, 0.01, 0.4, l.x, 2.8, l.z, this.mat('#222'), 6);
        this.cyl(0.12, 0.25, 0.22, l.x, 2.5, l.z, this.mat('#f0e0c0', 0.8, 0, { emissive: l.colour, emissiveIntensity: 0.8 }), 16);
      } else if (prof.roofed) {
        // Strip light hanging from the ceiling.
        this.box(1.4, 0.06, 0.2, l.x, Math.min(l.y + 0.6, 3.25), l.z, this.mat('#ffffff', 0.4, 0, { emissive: l.colour, emissiveIntensity: 1.1 }), false);
      } else {
        // Wall-mounted lamp bracket.
        const z = this.back + 0.05;
        const metal = this.mat('#1c1e22', 0.5, 0.6);
        this.box(0.08, 0.08, l.z - z, l.x, l.y + 0.25, (l.z + z) / 2, metal, false);
        this.box(0.4, 0.16, 0.5, l.x, l.y + 0.15, l.z, metal, false);
        this.box(0.34, 0.03, 0.42, l.x, l.y + 0.06, l.z, new THREE.MeshBasicMaterial({ color: l.colour }), false);
      }
    }
    if (STREET_THEMES.includes(theme)) {
      // Light spilling from the far side of the road.
      const spill = new THREE.PointLight(0xffb070, 8, 18, 1.6);
      spill.position.set((this.level.bounds.minX + this.level.bounds.maxX) / 2, 3, 9);
      g.add(spill);
    }
  }

  // ---- per frame -------------------------------------------------------------------------

  update(dt: number, time: number, world: World, camX: number): void {
    // Shadows follow the action.
    this.sun.position.set(camX - 4, 12, 8);
    this.sun.target.position.set(camX, 0, 0);

    for (const [i, f] of this.flicker.entries()) {
      if (themeProfile(this.level.theme).interior) continue;
      const n = Math.sin(time * 13.1 + i * 7) * Math.sin(time * 3.7 + i);
      f.light.intensity = f.base * (n > 0.985 ? 0.45 : 1);
    }

    this.syncDynamic(world, time);
    this.updateWeather(time, camX);

    // Gates slide up when open.
    for (const g of this.level.gates ?? []) {
      const v = this.gates.get(g.id);
      if (!v) continue;
      const target = world.isGateOpen(g) ? 2.4 : 0;
      v.lift += (target - v.lift) * Math.min(1, dt * 3);
      v.mesh.position.y = v.lift;
    }
    for (const l of this.level.levers ?? []) {
      const v = this.levers.get(l.id);
      if (!v) continue;
      const done = this.progress.has(l.sets);
      v.handle.rotation.z += ((done ? -0.6 : 0.6) - v.handle.rotation.z) * Math.min(1, dt * 8);
      v.lamp.emissive.setHex(done ? 0x20ff40 : 0xff2020);
    }
    for (const s of this.exitSigns) {
      const locked = exitLocked(s.exit, this.progress);
      if (locked === s.locked) continue;
      s.locked = locked;
      const label = locked ? `${s.exit.label} ✖` : s.exit.label;
      const arrowL = s.exit.kind === 'edge' && s.exit.side === 'left' ? '← ' : '';
      const arrowR = s.exit.kind === 'edge' && s.exit.side === 'right' ? ' →' : '';
      const t = signTexture(`${arrowL}${label}${arrowR}`, locked ? '#5a1414' : '#16365a', '#ffffff', { w: 768, h: 128 });
      s.mat.map?.dispose();
      s.mat.map = t;
      s.mat.emissiveMap = t;
      s.mat.needsUpdate = true;
    }

    // Highlight whatever you can use right now.
    const it = world.interactable;
    this.highlight.visible = !!it;
    if (it) {
      this.highlight.position.set(it.x, 0.03, it.z);
      const pulse = 1 + Math.sin(time * 6) * 0.08;
      this.highlight.scale.setScalar(pulse);
      const bad = (it.kind === 'exit' && it.locked) || (it.kind === 'lever' && it.done);
      (this.highlight.material as THREE.MeshBasicMaterial).color.setHex(bad ? 0xff4a3a : 0xffd23d);
    }
  }

  /** Keeps meshes for everything that comes and goes in the world in step with it. */
  private syncDynamic(world: World, time: number): void {
    const sync = <T extends { key: string }>(list: readonly T[], map: Map<string, THREE.Object3D>, make: (e: T) => THREE.Object3D, place: (m: THREE.Object3D, e: T) => void) => {
      const live = new Set<string>();
      for (const e of list) {
        live.add(e.key);
        let m = map.get(e.key);
        if (!m) {
          m = make(e);
          map.set(e.key, m);
          this.group.add(m);
        }
        place(m, e);
      }
      for (const [k, m] of map) {
        if (live.has(k)) continue;
        this.group.remove(m);
        disposeGroup(m);
        map.delete(k);
      }
    };
    // Cash on the floor: a small stack of notes or a few coins.
    sync(world.cash.map((c) => ({ ...c, key: `c:${c.key}` })), this.pickupMeshes, (c) => this.pickupMesh(c.amount >= 20 ? 'cash' : 'drop'), (m, c) => {
      m.position.set(c.x, 0.25 + Math.sin(time * 3 + c.x) * 0.06, c.z);
      m.rotation.y = time * 1.8;
    });
    // Secrets are only a faint glint until you stand on them.
    sync(world.secrets.map((s) => ({ ...s, key: `s:${s.key}` })), this.pickupMeshes, () => this.pickupMesh('secret'), (m, s) => {
      m.position.set(s.x, 0.3, s.z);
      m.rotation.y = time * 2;
      m.scale.setScalar(0.8 + Math.sin(time * 5) * 0.2);
    });
    // Items on the ground.
    sync(world.items, this.itemMeshes, (it) => {
      const m = this.groundItemMesh(it.stack.id, it.stack.colour);
      m.userData.born = it.bornAt < 0 ? -99 : time;
      return m;
    }, (m, it) => {
      const age = Math.max(0, time - (m.userData.born as number));
      const bounce = age < 0.6 ? Math.abs(Math.sin(age * 10)) * (0.6 - age) * 0.5 : 0;
      m.position.set(it.x, bounce, it.z);
      const spin = m.userData.spin as THREE.Object3D | undefined;
      if (spin) {
        spin.rotation.y = time * 1.5;
        spin.position.y = 0.35 + Math.sin(time * 3 + it.x) * 0.05;
      }
    });
    // Thrown weapons, spinning end over end.
    sync(world.projectiles, this.projMeshes, (p) => {
      const g = new THREE.Group();
      const w = buildWeaponMesh(p.weapon);
      w.position.y = -p.weapon.length / 2;
      g.add(w);
      return g;
    }, (m, p) => {
      m.position.set(p.x, p.y, p.z);
      m.rotation.z = -p.spin;
    });
    // Breakables: whole until smashed, then a pile of bits.
    for (const b of world.breakables) {
      let v = this.breakMeshes.get(b.def.id);
      if (!v) {
        v = this.breakableMesh(b.def.kind);
        v.whole.position.set(b.def.x, 0, b.def.z);
        v.debris.position.set(b.def.x, 0, b.def.z);
        this.group.add(v.whole, v.debris);
        this.breakMeshes.set(b.def.id, v);
      }
      v.whole.visible = !b.broken;
      v.debris.visible = b.broken;
      // A little shake when it takes a hit.
      if (!b.broken && b.hp < b.def.hp) v.whole.rotation.z = Math.sin(time * 40) * 0.01 * (b.def.hp - b.hp);
    }
    // A faint sparkle over anything not yet searched.
    for (const c of this.level.containers ?? []) {
      let m = this.containerMarks.get(c.id);
      if (!m) {
        m = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: c.requires ? 0xff8a3a : 0xfff2b0, transparent: true, opacity: 0.7 }));
        this.group.add(m);
        this.containerMarks.set(c.id, m);
      }
      const searched = world.isSearched(c);
      m.visible = !searched;
      if (!searched) {
        m.position.set(c.x, 1.45 + Math.sin(time * 2.5 + c.x) * 0.08, c.z);
        m.rotation.y = time * 2;
        ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.35 * Math.max(0, Math.sin(time * 3 + c.x * 1.7));
      }
    }
  }

  /** A weapon lies on the floor; anything else floats as its icon with a rarity ring. */
  private groundItemMesh(id: string, colour?: string): THREE.Object3D {
    const def = itemDef(id);
    const g = new THREE.Group();
    const rarity = new THREE.Color(RARITY_COLOURS[def?.rarity ?? 'common']);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 24), new THREE.MeshBasicMaterial({ color: rarity, transparent: true, opacity: 0.6 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    g.add(ring);
    const wid = def?.weapon;
    if (wid && WEAPONS[wid]) {
      const w = buildWeaponMesh(WEAPONS[wid]);
      w.rotation.z = Math.PI / 2;
      w.rotation.y = 0.4;
      w.position.set(WEAPONS[wid].length / 2, 0.05, 0);
      g.add(w);
      return g;
    }
    const spin = new THREE.Group();
    const tex = new THREE.TextureLoader().load(itemIconUrl(id, colour));
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    spin.add(card);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20), new THREE.MeshBasicMaterial({ color: rarity, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    glow.position.z = -0.01;
    spin.add(glow);
    g.add(spin);
    g.userData.spin = spin;
    return g;
  }

  private breakableMesh(kind: string): { whole: THREE.Object3D; debris: THREE.Object3D } {
    const whole = new THREE.Group();
    const debris = new THREE.Group();
    const wood = this.mat('#9a7a4e', 0.85);
    const B = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const splinters = (m: THREE.Material, n = 7) => {
      for (let i = 0; i < n; i++) B(0.08 + this.rnd() * 0.4, 0.03, 0.07, (this.rnd() - 0.5) * 0.9, 0.02 + this.rnd() * 0.04, (this.rnd() - 0.5) * 0.6, m, debris, 0, (this.rnd() - 0.5) * 0.3).rotation.y = this.rnd() * 3;
    };
    switch (kind) {
      case 'crate':
        B(0.75, 0.7, 0.65, 0, 0.35, 0, wood, whole);
        for (const y of [0.12, 0.58]) B(0.77, 0.08, 0.67, 0, y, 0, this.mat('#7a5a32', 0.9), whole);
        splinters(wood, 9);
        break;
      case 'pallet':
        for (let i = 0; i < 3; i++) B(0.8, 0.06, 0.6, 0, 0.06 + i * 0.14, 0, wood, whole);
        for (const dx of [-0.35, 0, 0.35]) B(0.08, 0.36, 0.6, dx, 0.18, 0, this.mat('#7a5a32', 0.9), whole);
        splinters(wood, 8);
        break;
      case 'chair':
        for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B(0.04, 0.45, 0.04, dx, 0.22, dz, this.mat('#5a3a20', 0.7), whole);
        B(0.44, 0.05, 0.44, 0, 0.47, 0, this.mat('#5a3a20', 0.7), whole);
        B(0.44, 0.45, 0.04, 0, 0.72, -0.2, this.mat('#5a3a20', 0.7), whole);
        B(0.4, 0.04, 0.4, 0, 0.5, 0, this.mat('#7a1e1e', 0.95), whole);
        splinters(this.mat('#5a3a20', 0.7), 6);
        break;
      case 'table':
        B(0.8, 0.05, 0.7, 0, 0.74, 0, this.mat('#4a2e18', 0.5), whole);
        for (const [dx, dz] of [[-0.34, -0.28], [0.34, -0.28], [-0.34, 0.28], [0.34, 0.28]]) B(0.05, 0.72, 0.05, dx, 0.36, dz, this.mat('#4a2e18', 0.5), whole);
        B(0.8, 0.05, 0.7, 0.1, 0.1, 0, this.mat('#4a2e18', 0.5), debris, 0, 0.25);
        splinters(this.mat('#4a2e18', 0.5), 4);
        break;
      case 'tv':
        B(0.6, 0.45, 0.45, 0, 0.6, 0, this.mat('#2a2a2a', 0.5), whole);
        B(0.5, 0.36, 0.01, 0, 0.6, 0.23, this.mat('#203028', 0.15, 0.3, { emissive: 0x405048, emissiveIntensity: 0.3 }), whole);
        B(0.7, 0.38, 0.5, 0, 0.19, 0, this.mat('#3a2a1a', 0.7), whole);
        B(0.6, 0.4, 0.45, 0, 0.2, 0.05, this.mat('#2a2a2a', 0.5), debris, 0.2, 0.3);
        B(0.7, 0.38, 0.5, 0, 0.19, -0.5, this.mat('#3a2a1a', 0.7), debris);
        break;
      case 'boxes':
        for (const [x, y, s] of [[-0.2, 0.2, 0.4], [0.22, 0.18, 0.36], [0, 0.58, 0.36]]) B(s, s, s, x, y, 0, this.mat('#b08a5a', 0.95), whole);
        for (let i = 0; i < 4; i++) B(0.4, 0.02, 0.35, (this.rnd() - 0.5) * 0.8, 0.02, (this.rnd() - 0.5) * 0.4, this.mat('#b08a5a', 0.95), debris).rotation.y = this.rnd() * 3;
        break;
      case 'window':
        B(1.2, 1.2, 0.06, 0, 1.4, 0, this.mat('#9ab0c8', 0.05, 0.3, { transparent: true, opacity: 0.45 }), whole);
        B(1.3, 0.08, 0.1, 0, 0.78, 0, this.mat('#e8e4d8', 0.6), whole);
        B(1.3, 0.08, 0.1, 0, 0.78, 0, this.mat('#e8e4d8', 0.6), debris);
        for (let i = 0; i < 10; i++) B(0.08 + this.rnd() * 0.1, 0.005, 0.06, (this.rnd() - 0.5) * 1.4, 0.005, (this.rnd() - 0.5) * 0.8, this.mat('#c8d8e8', 0.05, 0.4), debris).rotation.y = this.rnd() * 3;
        break;
      default: {
        // barrel
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), this.mat('#2a4a7a', 0.5, 0.5));
        drum.position.y = 0.45;
        drum.castShadow = true;
        whole.add(drum);
        const down = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), this.mat('#2a4a7a', 0.6, 0.5));
        down.rotation.z = Math.PI / 2;
        down.position.set(0.2, 0.3, 0);
        debris.add(down);
      }
    }
    debris.visible = false;
    return { whole, debris };
  }

  private pickupMesh(kind: string): THREE.Object3D {
    const g = new THREE.Group();
    if (kind === 'cash') {
      const note = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: 0x7a5aa0, emissive: 0x3a2060, emissiveIntensity: 0.6 }));
      const note2 = note.clone();
      note2.position.y = 0.04;
      note2.rotation.y = 0.4;
      g.add(note, note2);
    } else if (kind === 'drop') {
      const m = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25, emissive: 0x6a5010, emissiveIntensity: 0.6 });
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), m);
        c.position.set((i - 1) * 0.05, i * 0.022, 0);
        g.add(c);
      }
    } else if (kind === 'food') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0xf0f0e8, emissive: 0x404040, emissiveIntensity: 0.5 }));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.19), new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0x601010, emissiveIntensity: 0.5 }));
      g.add(box, band);
    } else {
      // Secret: a faint glint you have to notice.
      const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
      g.add(glint);
    }
    g.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  }

  dispose(): void {
    disposeGroup(this.group);
  }
}

/** A lit room seen through a window: warm light, a lampshade glow, curtains each side. */
function litWindowTexture(rnd: () => number): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const warm = ['#ffb24a', '#ffcf7a', '#f6e2b0', '#9ab8ff'][Math.floor(rnd() * 4)];
  const grad = g.createRadialGradient(40 + rnd() * 48, 50, 4, 64, 64, 90);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, warm);
  grad.addColorStop(1, '#3a2410');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(40,20,10,0.85)';
  g.fillRect(0, 0, 22 + rnd() * 12, 128);
  g.fillRect(128 - 22 - rnd() * 12, 0, 40, 128);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(62, 0, 4, 128);
  g.fillRect(0, 62, 128, 4);
  return toTexture(c);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
