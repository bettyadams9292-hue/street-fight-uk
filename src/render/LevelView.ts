import * as THREE from 'three';
import { furniture, produceHeap, type FurnitureId, type ProduceId } from './props/KenneyLibrary';
import { gymPiece, type GymModelId } from './props/GymLibrary';
import { shopPiece, type ShopModelId } from './props/ShopLibrary';
import { hydroPiece, hydroReady, type HydroModelId } from './props/HydroLibrary';
import { securityPiece, type SecurityModelId } from './props/SecurityLibrary';
import { doorPiece, type DoorStyle } from './props/DoorLibrary';
import { surfaceMaterial, kitGroundTexture as kitTexture, type Surface, type SurfaceOptions } from './street/Flooring';
import { StreetDressing } from './street/StreetDressing';
import { SLICE_LEVELS, streetPassEnabled } from './street/slice';
import { KIT_KINDS } from '../city/catalogue';
import { hashString, planFacade, type FacadePlan } from '../city/compose';
import { cityKit } from './city/CityKit';
import { buildCityFacades, type SignedFacade } from './city/CityFacades';
import { fittedProp, lootModel } from './props/PropLibrary';
import { buildCar, fadeCar } from './street/carModel';
import type { Progress } from '../progress/Progress';
import type { ExitDef, FacadeDef, LevelDef, PropDef, Theme } from '../world/LevelTypes';
import { propHalf } from '../world/LevelTypes';
import { buildAnyModel, buildEquipmentModel, buildGymKitModel, buildFurnitureModel, buildVehicleModel } from './propModels';
import { EQUIPMENT } from '../business/catalogue';
import { CARS, FINISHES, FURNITURE } from '../property/catalogue';
import { themeProfile } from './themes';
import { kitStreet, planStreet, type StreetPlan } from '../city/street';
import { buildKitStreet, hasKitPiece, kitFloor, kitPiece, kitWall, polyKitReady, type KitFloor, type KitStreetView } from './kit/PolyKit';
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
import { brickTexture, canvas, shutterTexture, toTexture } from './textures';
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
  /** How many buildings the city kit put up in this area (0 = none, the built-in frontages). */
  cityBuilt = 0;
  /** Doorways the city kit built, so exits use them instead of drawing their own. */
  private kitDoors: number[] = [];
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
  /** Phase 3 street pass (`?street=classic` turns it off). */
  private readonly streetPass = streetPassEnabled(window.location.search);
  private dressing: StreetDressing | null = null;
  /** Cars between the camera and the play area: they fade when the player walks behind one. */
  private foreCars: { car: THREE.Object3D; x: number; z: number; hx: number; hz: number }[] = [];
  /** The flat's room dividers: they fade right out when you're beside one, so it never hides you. */
  private fadeWalls: { mat: THREE.MeshStandardMaterial; x: number }[] = [];

  /** The long street, built from the low-poly kits (city/street.ts). Null for interiors, or with `?world=classic`. */
  readonly street: StreetPlan | null;
  private kitView: KitStreetView | null = null;
  /** The area's own sky and key lights. Only the district you are standing in has them switched on. */
  private readonly lightRig = new THREE.Group();
  /** Street lamps of a kit street: the renderer lights the nearest few from one shared pool, so walking between districts never changes how many lights the shaders are built for. */
  readonly lampSpecs: { x: number; y: number; z: number; colour: number; intensity: number; range: number }[] = [];
  private seamBlocks: { exit: ExitDef; group: THREE.Object3D }[] = [];
  /** Rooms and shops drawn to match the low-poly streets (flat colours, kit floor tiles). */
  private lowPoly = false;

  /** A floor from the kit's tiles in the low-poly look; false (and nothing added) without the kit. */
  private kitGround(kind: KitFloor, x0: number, x1: number, z0: number, z1: number, colour: string): boolean {
    if (!this.lowPoly) return false;
    const m = kitFloor(kind, x0, x1, z0, z1, colour, hash(`${this.level.id}:${Math.round(x0 * 10)}`));
    if (!m) return false;
    this.group.add(m);
    return true;
  }

  constructor(readonly level: LevelDef, private readonly progress: Progress) {
    this.back = backWallZ(level);
    const classic = new URLSearchParams(window.location.search).get('world') === 'classic';
    this.street = !classic && kitStreet(level) && polyKitReady() ? planStreet(level) : null;
    this.lowPoly = !classic && polyKitReady();
    this.X0 = this.street ? this.street.x0 : level.bounds.minX - LEVEL_EXTENT;
    this.X1 = this.street ? this.street.x1 : level.bounds.maxX + LEVEL_EXTENT;
    this.group.add(this.lightRig);
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

  /** Floor finishes at home: boards, carpet or tiles in the finish's colours. */
  private floorFinish(id: string, w: number, d: number): THREE.MeshStandardMaterial {
    const f = FINISHES[id];
    switch (f.pattern) {
      case 'boards':
        return new THREE.MeshStandardMaterial({ map: woodFloorTexture(w / 2, d / 2), roughness: 0.5, color: f.colour });
      case 'tiles':
        return new THREE.MeshStandardMaterial({ map: tileTexture(f.colour, f.colour2 ?? '#555', w / 0.6, d / 0.6, 64), roughness: 0.35 });
      default:
        return new THREE.MeshStandardMaterial({ map: plasterTexture(f.colour, w / 1.5, d / 1.5), roughness: 1, color: 0xf0f0f0 });
    }
  }

  /** Wall finishes at home: paint, paper, brick slips, panelling or tiles. */
  private wallFinish(id: string, w: number, h: number): THREE.MeshStandardMaterial {
    const f = FINISHES[id];
    switch (f.pattern) {
      case 'tiles':
        return new THREE.MeshStandardMaterial({ map: tileTexture(f.colour, f.colour2 ?? '#999', w / 0.3, h / 0.15, 48), roughness: 0.3 });
      case 'brick':
        return new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, h / 4), roughness: 0.95, color: 0xd8b8a8 });
      case 'stripes': {
        const [c, g] = canvas(64, 64);
        g.fillStyle = f.colour;
        g.fillRect(0, 0, 64, 64);
        g.fillStyle = f.colour2 ?? '#888';
        for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
        return new THREE.MeshStandardMaterial({ map: toTexture(c, w / 0.6, 1), roughness: 0.9 });
      }
      case 'panelling':
        return new THREE.MeshStandardMaterial({ map: plasterTexture(f.colour2 ?? '#e8e4dc', w / 3, 1), roughness: 0.9 });
      default:
        return new THREE.MeshStandardMaterial({ map: plasterTexture(f.colour, w / 3, 1), roughness: 0.9 });
    }
  }

  // ---- building the area -----------------------------------------------------------

  private build(): void {
    const lvl = this.level;
    if (this.street) {
      // Ground, buildings, shop interiors, street furniture and vehicles all come from the kit plan.
      this.kitView = buildKitStreet(this.street);
      if (this.kitView) {
        this.group.add(this.kitView.group);
        for (const f of this.kitView.faders) this.foreCars.push({ car: f.group, x: f.x, z: f.z, hx: f.hx, hz: f.hz });
      }
      this.kitDoors = this.street.doors;
    } else this.buildGround();
    // Carry the end facades on past the edges so the camera never sees a gap.
    const fac = this.street ? [] : [...lvl.facades].sort((a, b) => a.x0 - b.x0);
    if (fac.length) {
      const last = fac[fac.length - 1];
      const run: FacadeDef[] = [{ ...fac[0], x0: this.X0, x1: fac[0].x0, label: undefined }, ...fac, { ...last, x0: last.x1, x1: this.X1, label: undefined }];
      // Kit-built frontages (the city builder) where the kit has loaded; everything else keeps its own builder.
      const kit = new URLSearchParams(window.location.search).get('city') === 'classic' ? null : cityKit();
      const plans: FacadePlan[] = [];
      const signs: SignedFacade[] = [];
      let recent: string[] = [];
      for (const f of run) {
        if (f.x1 - f.x0 < 0.05) continue;
        if (!kit || !KIT_KINDS.has(f.kind)) {
          this.buildFacade(f);
          recent = [];
          continue;
        }
        const doors = lvl.exits.filter((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1).map((e) => e.x);
        const plan = planFacade({ kind: f.kind, x0: f.x0, x1: f.x1, label: f.label, theme: lvl.theme, seed: hashString(`${lvl.id}:${f.x0}`), doors, recent });
        recent = [...recent, ...plan.buildings.map((b) => b.design.id)].slice(-2);
        plans.push(plan);
        signs.push({ kind: f.kind, label: f.label === 'back' ? undefined : f.label, colour: f.colour, buildings: plan.buildings });
      }
      if (kit && plans.length) {
        const city = buildCityFacades(kit, plans, this.back, signs);
        this.group.add(city);
        this.cityBuilt = plans.reduce((n, p) => n + p.buildings.length, 0);
        this.kitDoors = plans.flatMap((p) => p.buildings.flatMap((b) => b.doors));
      }
    }
    if (!this.street && themeProfile(lvl.theme).skyline !== 'none') this.buildSkyline();
    for (const w of lvl.walls ?? []) this.buildWall(w);
    for (let i = 0; i < lvl.props.length; i++) {
      const p = lvl.props[i];
      // A kit model already stands in for this one.
      if (this.street?.propDone[i]) continue;
      const before = this.group.children.length;
      this.buildProp(p);
      this.propObjects.set(p, this.group.children.slice(before));
    }
    for (const ex of lvl.exits) this.buildExit(ex);
    for (const g of lvl.gates ?? []) this.buildGate(g.id, g.x, g.z0, g.z1);
    for (const l of lvl.levers ?? []) this.buildLever(l.id, l.x);
    if (!this.street) this.buildGraffiti();
    this.buildLights();
    this.buildWeather();
    if (!this.street && this.streetPass && SLICE_LEVELS.includes(lvl.id)) {
      this.dressing = new StreetDressing(lvl, this.back, lvl.bounds.maxZ + 0.4, this.X0, this.X1, seeded(hash(`${lvl.id}:dressing`)));
      this.group.add(this.dressing.group);
    }
    if (this.lowPoly && themeProfile(lvl.theme).interior) flattenTextures(this.group);
  }

  /** Put a Kenney furniture model into the prop group, fitted to w × h × d; false if the kit isn't loaded. */
  private fit(g: THREE.Group, id: FurnitureId, w: number, h: number, d: number, o: { x?: number; y?: number; z?: number; upholstery?: string; turn?: number } = {}): boolean {
    const m = furniture(id, w, h, d, { upholstery: o.upholstery, turn: o.turn });
    if (!m) return false;
    m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    g.add(m);
    return true;
  }

  /** Put a gym model (GymLibrary) into the group, fitted to w × h × d; false until they've loaded. */
  private gym(g: THREE.Group, id: GymModelId, w: number, h: number, d: number, o: { x?: number; y?: number; z?: number; keepAspect?: boolean; turn?: number } = {}): boolean {
    const m = gymPiece(id, w, h, d, o);
    if (!m) return false;
    m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    g.add(m);
    return true;
  }

  /**
   * A real door (DoorLibrary) in a doorway on the back wall: x its centre, w × h the opening, `out` in front of
   * the wall. Picked per level and spot, so a street keeps its doors. False until the doors load.
   */
  private door(style: DoorStyle, x: number, w: number, h: number, out = 0.02, y = 0): boolean {
    const m = doorPiece(style, hashString(`${this.level.id}:${Math.round(x * 10)}`), w, h);
    if (!m) return false;
    m.position.set(x, y, this.back + out);
    this.group.add(m);
    return true;
  }

  /** A security-set piece (SecurityLibrary) on the back wall: x along the street, y its height, `out` in front of the wall. */
  private secure(id: SecurityModelId, x: number, y: number, out = 0, scale = 1, turn = 0): boolean {
    const m = securityPiece(id, scale, { turn });
    if (!m) return false;
    m.position.set(x, y, this.back + out);
    this.group.add(m);
    return true;
  }

  /** Put a shop or casino fitting (ShopLibrary) into the group; false until they've loaded. */
  private fitting(g: THREE.Group, id: ShopModelId, w: number, h: number, d: number, o: { x?: number; y?: number; z?: number; keepAspect?: boolean; native?: boolean } = {}): boolean {
    const m = shopPiece(id, w, h, d, o);
    if (!m) return false;
    m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    g.add(m);
    return true;
  }

  /** Put a Polyfork kit piece (e.g. 'cafe/bistro-chair') into the group, fitted to w × h × d; false until the kit has loaded. */
  private piece(g: THREE.Group, id: string, w: number, h: number, d: number, o: { x?: number; y?: number; z?: number; keepAspect?: boolean; turn?: number; paint?: string } = {}): boolean {
    const m = kitPiece(id, w, h, d, o);
    if (!m) return false;
    m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    g.add(m);
    return true;
  }

  /** Granite kerbstones along the edge of the pavement: separate stones, each a slightly different grey. */
  private kerb(x0: number, x1: number, z: number, h: number): void {
    const len = 0.9;
    const n = Math.ceil((x1 - x0) / len);
    const geo = new THREE.BoxGeometry(len - 0.012, h, 0.22);
    // Rounded-off top edge: pull the top front corners in a touch.
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setZ(i, p.getZ(i) - 0.02);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: kitTexture('T_Concrete_BaseColor', true), normalMap: kitTexture('T_Concrete_Normal', false), color: '#b8b8b6', roughness: 0.75 });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(x0 + (i + 0.5) * len, h / 2, z);
      mesh.setMatrixAt(i, m);
      const k = 0.75 + this.rnd() * 0.3;
      mesh.setColorAt(i, c.setRGB(k, k, k * (0.97 + this.rnd() * 0.05)));
    }
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** British road markings: double yellow lines by the kerb, a dashed white centre line, and drain grates in the gutter. */
  private roadMarkings(x0: number, x1: number, z: number): void {
    const paint = (colour: string) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    const yellow = paint('#d8a823');
    const white = paint('#e4e2dc');
    const strip = (xa: number, xb: number, zc: number, w: number, m: THREE.Material) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, w), m);
      g.rotation.x = -Math.PI / 2;
      g.position.set((xa + xb) / 2, -0.012, zc);
      this.group.add(g);
    };
    strip(x0, x1, z + 0.3, 0.07, yellow);
    strip(x0, x1, z + 0.45, 0.07, yellow);
    for (let x = x0 + 1; x < x1; x += 6) strip(x, x + 3, z + 5.2, 0.1, white);
    // Gully grates in the gutter.
    const grate = new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.5, metalness: 0.7 });
    for (let x = x0 + 4 + this.rnd() * 6; x < x1 - 2; x += 14 + this.rnd() * 8) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.01, 0.3), grate);
      g.position.set(x, -0.012, z + 0.2);
      this.group.add(g);
      for (let k = -0.18; k <= 0.18; k += 0.06) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.26), this.mat('#050506', 1));
        bar.position.set(x + k, -0.008, z + 0.2);
        this.group.add(bar);
      }
    }
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
        Gym: new THREE.MeshStandardMaterial({ color: 0x1d2a22, roughness: 0.95 }),
        Garage: new THREE.MeshStandardMaterial({ map: concreteTexture('#7a7874', 4, 2), roughness: 0.9 }),
      };
      for (const f of this.level.facades) {
        const fin = f.floor ? FINISHES[f.floor] : undefined;
        const mat = fin ? this.floorFinish(fin.id, f.x1 - f.x0, front - this.back) : floors[f.label ?? ''] ?? new THREE.MeshStandardMaterial({ map: woodFloorTexture(4, 2) });
        // Leave a hole in the floor where the stairs go down.
        const well = this.level.props.find((q) => q.kind === 'stairwell' && q.x > f.x0 && q.x < f.x1);
        const lp: [KitFloor, string] | null = fin
          ? [fin.pattern === 'boards' ? 'boards' : fin.pattern === 'tiles' ? 'encaustic' : 'carpet', fin.colour]
          : f.label === 'Gym' ? ['resin', '#2a3a30'] : f.label === 'Garage' ? ['resin', '#7a7874'] : ['boards', '#9a7a5a'];
        if (!well && this.kitGround(lp[0], f.x0, f.x1, this.back, front, lp[1])) {
          if (f.x0 > minX) this.box(0.24, 0.015, front - 0.1, f.x0, 0.008, (front + 0.1) / 2 + 0.05, this.mat('#8a7a5a', 0.5, 0.3), false);
          continue;
        }
        if (well) {
          const [hx, hz] = propHalf(well);
          const h = { x0: well.x - hx, x1: well.x + hx, z1: well.z + hz };
          this.ground(f.x0, h.x0, this.back, front, mat);
          this.ground(h.x1, f.x1, this.back, front, mat);
          this.ground(h.x0, h.x1, h.z1, front, mat);
        } else this.ground(f.x0, f.x1, this.back, front, mat);
        // Thresholds between rooms.
        if (f.x0 > minX) this.box(0.24, 0.015, front - 0.1, f.x0, 0.008, (front + 0.1) / 2 + 0.05, this.mat('#8a7a5a', 0.5, 0.3), false);
      }
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
    void depth;
    // Surfaces from the city kit's textures (street/Flooring.ts): each district has its own.
    const wet = (this.level.weather ?? 'clear') === 'rain' ? 0.75 : 0.25;
    const seed = hash(this.level.id) % 97;
    const surf = (kind: Surface, tint?: string, extra: Partial<SurfaceOptions> = {}) =>
      surfaceMaterial(kind, { tint, wallZ: this.back, kerbZ: prof.road ? front : 1e4, wet, seed, ...extra });
    const SURFACES: Partial<Record<string, () => THREE.MeshStandardMaterial>> = {
      city: () => surf('flags'),
      nightlife: () => surf('flags', '#9a9aa2'),
      precinct: () => surf('paviours', '#d8c8b8'),
      leisure: () => surf('paviours', '#c4a090'),
      residential: () => surf('paving', '#d6d2c8'),
      market: () => surf('setts'),
      alleys: () => surf('setts', '#8a8478'),
      stadium: () => surf('concrete', '#c8c4bc'),
      docks: () => surf('concrete', '#a8a49c'),
      industrial: () => surf('yard', undefined, { bays: 2.6 }),
      ind_estate: () => surf('yard', undefined, { bays: 2.6 }),
      territory: () => surf('yard', '#9a948c', { bays: 0 }),
      hq: () => surf('yard', '#8a8680', { bays: 3 }),
      factory: () => surf('concrete', '#9a968c'),
    };
    const groundMat: THREE.MeshStandardMaterial = (SURFACES[theme] ?? (() => surf('paving')))();
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
      this.kerb(X0, X1, front + 0.1, 0.14);
      this.ground(X0, X1, front + 0.2, front + 14, surfaceMaterial('concrete', { tint: '#5a5a5c', wet, seed, kerbZ: front + 0.2 }), -0.01);
      return;
    }
    if (theme === 'alleys') {
      // Low back wall of the gardens opposite.
      this.ground(X0, X1, front, front + 12, surfaceMaterial('dirt', { tint: '#8a8070', wet, seed }));
      this.box(W, 0.6, 0.3, (X0 + X1) / 2, 0.3, front + 0.5, new THREE.MeshStandardMaterial({ map: brickTexture(W / 4, 0.3) }));
      return;
    }
    this.kerb(X0, X1, front + 0.12, 0.12);
    this.ground(X0, X1, front + 0.25, front + 14, surfaceMaterial('asphalt', { wet, seed, patches: true, kerbZ: front + 0.3 }), -0.02);
    this.roadMarkings(X0, X1, front + 0.25);
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
    const flags = this.level.facades[0]?.flags ?? [];
    const floor =
      theme === 'basement'
        ? this.basementFloor(W, depth, flags)
        : theme === 'grow_shop'
          ? new THREE.MeshStandardMaterial({ map: tileTexture('#e8ece4', '#c8ccc4', W / 0.6, depth / 0.6, 64), roughness: 0.3 })
          : theme === 'gym_store' || theme === 'wrestling_club'
            ? new THREE.MeshStandardMaterial({ map: concreteTexture('#2a2c30', W / 3, depth / 3), roughness: 0.6 })
            : theme === 'boxing_gym' || theme === 'karate_dojo'
              ? new THREE.MeshStandardMaterial({ map: woodFloorTexture(W / 2, depth / 2), roughness: 0.5, color: theme === 'karate_dojo' ? 0xe8d0a0 : 0xa08060 })
          : theme === 'furniture_store'
        ? new THREE.MeshStandardMaterial({ map: woodFloorTexture(W / 2, depth / 2), roughness: 0.45, color: 0xc8a882 })
        : theme === 'car_showroom'
          ? new THREE.MeshStandardMaterial({ map: tileTexture('#d8dadc', '#b8babc', W / 1.2, depth / 1.2, 64), roughness: 0.12, metalness: 0.15 })
          : theme === 'bike_shop'
            ? new THREE.MeshStandardMaterial({ map: concreteTexture('#4a4c50', W / 4, depth / 4), roughness: 0.4, metalness: 0.1 })
            : theme === 'casino'
              ? new THREE.MeshStandardMaterial({ map: this.casinoCarpet(W, depth), roughness: 1 })
              : theme === 'shop'
        ? new THREE.MeshStandardMaterial({ map: tileTexture('#e8e4dc', '#b8b4ac', W / 0.8, depth / 0.8, 64), roughness: 0.25, metalness: 0.05 })
        : theme === 'pawn'
          ? new THREE.MeshStandardMaterial({ map: tileTexture('#5a1e22', '#4a181c', W / 0.5, depth / 0.5, 32), roughness: 1 })
          : new THREE.MeshStandardMaterial({ map: woodFloorTexture(W / 2, depth / 2), roughness: 0.55, color: 0x9a7a5a });
    const LP: Partial<Record<string, [KitFloor, string]>> = {
      grow_shop: ['tiles', '#e8ece4'],
      gym_store: ['resin', '#2a2c30'],
      wrestling_club: ['resin', '#2a2c30'],
      boxing_gym: ['boards', '#a08060'],
      karate_dojo: ['boards', '#e8d0a0'],
      furniture_store: ['boards', '#c8a882'],
      car_showroom: ['tiles', '#d8dadc'],
      bike_shop: ['resin', '#4a4c50'],
      casino: ['carpet', '#5a1a2a'],
      shop: ['tiles', '#c4beb4'],
      pawn: ['carpet', '#5a1e22'],
      pub: ['boards', '#6a4a2a'],
      jeweller: ['tiles', '#2a2a30'],
      estate_agent: ['boards', '#8a6a4a'],
    };
    const lp = theme === 'basement' ? undefined : LP[theme] ?? ['boards', '#9a7a5a'];
    if (!lp || !this.kitGround(lp[0], minX, maxX, this.back, front, lp[1])) this.ground(minX, maxX, this.back, front, floor);
    this.box(W, 0.3, 0.2, (minX + maxX) / 2, -0.15, front + 0.1, this.mat('#2a2522'), false);
    this.ground(this.X0, this.X1, front + 0.2, front + 20, this.mat('#07080b', 1), -0.3);
    for (const x of [minX - 0.15, maxX + 0.15]) this.box(0.3, 3.2, depth, x, 1.6, (front + this.back) / 2, this.mat('#3a332c'));
  }

  private casinoCarpet(W: number, D: number): THREE.CanvasTexture {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#5a0a14';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#c9a227';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(32 + (i % 2) * 64, 32 + Math.floor(i / 2) * 64, 22, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#1a3a6a';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(64 * (i % 2), 64 * Math.floor(i / 2), 10, 0, Math.PI * 2);
      g.fill();
    }
    return toTexture(c, W / 1.6, D / 1.6);
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
      ? new THREE.MeshStandardMaterial({ map: tileTexture('#b8b4ac', '#8a867e', W / 1.2, depth / 1.2, 64), roughness: 0.22, metalness: 0.1 })
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
        return this.houseFront(f);
      case 'showroom':
        return this.showroom(f);
      case 'casino':
        return this.casinoFront(f);
      case 'basement':
        return this.basementWalls(f);
      case 'gym_front':
        return this.gymFront(f);
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
      case 'mansion':
        return this.mansion(f);
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
        const col = doorCols[Math.floor(this.rnd() * doorCols.length)];
        if (!this.door('house', x + door, 1.1, 2.15)) this.box(1.0, 2.1, 0.08, x + door, 1.05, this.back + 0.04, this.mat(col, 0.4));
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
    this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: concreteTexture('#6e6a62', w / 3, 2), roughness: 1 }), 0);
    const tex = windowGridTexture(Math.max(2, Math.round(w / 2)), 2, '#ffd08a', '#1a1d24', '#7a766c', 0.3);
    this.panel(w - 0.6, 3, cx, 6, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }), 0.03);
    const lit = f.label !== 'TO LET';
    const colour = f.colour ?? '#2a5a8a';
    this.box(w - 0.4, 2.6, 0.06, cx, 1.3, this.back + 0.08, this.mat('#0e1216', 0.05, 0.7, { emissive: 0xffe8c8, emissiveIntensity: lit ? 0.26 : 0.02 }), false);
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
    this.panel(w, 4.2, cx, 2.1, this.mat('#8e8a84', 0.5), 0);
    this.box(w - 0.6, 2.8, 0.05, cx, 1.4, this.back + 0.1, this.mat('#1a2026', 0.04, 0.8, { emissive: 0xfff4e4, emissiveIntensity: 0.3 }), false);
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
    // Dome cameras up by the ceiling: one in the corner of every shop, a row of them in the casino.
    if (theme === 'casino') for (let x = f.x0 + 3; x < f.x1 - 1; x += 6) this.secure('wall_dome', x, H - 0.25, 0.02, 1.4);
    else this.secure('wall_dome', f.x1 - 1.0, H - 0.25, 0.02, 1.4);
    const colour = f.colour ?? '#8c7a5e';
    if (theme === 'gym_store' || theme === 'boxing_gym' || theme === 'karate_dojo' || theme === 'wrestling_club') {
      this.gymInterior(f, theme);
    } else if (theme === 'grow_shop') {
      this.growShopInterior(f);
    } else if (theme === 'furniture_store' || theme === 'car_showroom' || theme === 'bike_shop' || theme === 'casino') {
      this.showroomInterior(f, theme);
    } else if (theme === 'pub') {
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

  /**
   * Number 14: your own house. Red brick, tiled roof with gutters and a
   * downpipe, chimney, sills, a proper front door with handle and letterbox,
   * porch light, a low garden wall, the drive and the front path.
   */
  private houseFront(f: FacadeDef): void {
    const H = 6.4;
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    // Real extent only: the end-caps carry plain terrace on past the edges.
    if (!f.label) return this.terrace(f, false);
    this.brickWall(f.x0, f.x1, H, 0xffe8dc);
    // Soldier course over the ground floor and a string course.
    this.box(w, 0.1, 0.06, cx, 2.75, this.back + 0.03, this.mat('#7a3a2a', 0.9), false);
    const door = this.level.exits.find((e) => e.kind === 'door' && e.to === 'home');
    const dx = door ? door.x : cx;
    // Front door: panelled, with glass, handle, letterbox and number.
    const frame = this.mat('#f0eee6', 0.5);
    if (!this.door('house', dx, 1.25, 2.35, 0.02, 0.12)) {
      this.box(1.3, 2.35, 0.08, dx, 1.17, this.back + 0.04, frame, false);
      this.box(1.05, 2.15, 0.08, dx, 1.08, this.back + 0.08, this.mat('#1d3a2a', 0.35, 0.1), false);
      for (const dy of [0.45, 1.05]) this.box(0.75, 0.42, 0.02, dx, dy, this.back + 0.13, this.mat('#173022', 0.4), false);
      this.box(0.75, 0.42, 0.02, dx, 1.7, this.back + 0.13, this.mat('#c8d8e8', 0.1, 0.3, { emissive: 0xffd8a0, emissiveIntensity: 0.35 }), false);
      this.box(0.28, 0.06, 0.03, dx, 1.3, this.back + 0.14, this.mat('#c9a227', 0.25, 0.9), false);
      this.cyl(0.035, 0.035, 0.08, dx + 0.38, 1.05, this.back + 0.16, this.mat('#c9a227', 0.25, 0.9), 10).rotation.x = Math.PI / 2;
      this.box(0.2, 0.12, 0.04, dx, 2.0, this.back + 0.14, this.mat('#c9a227', 0.25, 0.9), false);
    }
    const plate = new THREE.MeshStandardMaterial({ map: signTexture(f.label, '#e8e4d8', '#111', { w: 128, h: 128, serif: true }) });
    this.panel(0.26, 0.26, dx + 0.85, 1.8, plate, 0.05);
    // Step and porch canopy with a light.
    this.box(1.5, 0.12, 0.45, dx, 0.06, this.back + 0.24, this.mat('#9a968c', 0.9));
    this.box(1.7, 0.08, 0.7, dx, 2.5, this.back + 0.35, this.mat('#2a2d33', 0.6));
    this.box(0.12, 0.2, 0.1, dx - 0.85, 2.0, this.back + 0.06, this.mat('#111', 0.4, 0.5), false);
    this.box(0.08, 0.12, 0.08, dx - 0.85, 1.95, this.back + 0.12, this.mat('#fff4d8', 0.3, 0, { emissive: 0xffd8a0, emissiveIntensity: 1.2 }), false);
    // Bay window downstairs, two upstairs.
    const glass = this.windowMat(0.6);
    const bayX = dx + 2.7;
    this.windowAt(bayX, 1.55, 2.0, 1.4, glass);
    this.box(2.4, 0.12, 0.35, bayX, 2.36, this.back + 0.18, this.mat('#e8e4d8', 0.7), false);
    this.windowAt(dx, 4.5, 1.1, 1.2, this.windowMat(0));
    this.windowAt(bayX, 4.5, 1.5, 1.2, this.windowMat(0.4));
    this.windowAt(dx - 3.2, 4.5, 1.5, 1.2, this.windowMat(0));
    // Garage door on the left of the drive.
    const gx = f.x0 + 2.4;
    const sh = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.55, metalness: 0.45, color: 0xd8d8d0 });
    this.box(3.6, 2.4, 0.06, gx, 1.2, this.back + 0.04, sh, false);
    this.box(3.9, 0.12, 0.1, gx, 2.46, this.back + 0.06, frame, false);
    // Tiled roof, gutter, downpipe, chimney.
    const roof = new THREE.MeshStandardMaterial({ map: tileTexture('#6a2a1e', '#3a160e', w / 0.35, 8, 32), roughness: 0.8 });
    const r = this.box(w + 0.3, 0.12, 2.8, cx, H + 0.75, this.back - 1.0, roof);
    r.rotation.x = 0.55;
    this.box(w + 0.35, 0.12, 0.14, cx, H + 0.05, this.back + 0.12, this.mat('#15161a', 0.5, 0.3), false);
    this.cyl(0.05, 0.05, H, f.x1 - 0.3, H / 2, this.back + 0.12, this.mat('#15161a', 0.5, 0.3), 8);
    this.box(0.18, 0.25, 0.25, f.x1 - 0.3, 0.12, this.back + 0.15, this.mat('#15161a', 0.5, 0.3), false);
    this.box(1.1, 1.4, 0.7, f.x0 + 1.2, H + 1.4, this.back - 0.4, new THREE.MeshStandardMaterial({ map: brickTexture(0.35, 0.4) }));
    for (const k of [0, 0.35]) this.cyl(0.09, 0.11, 0.4, f.x0 + 1.0 + k, H + 2.3, this.back - 0.4, this.mat('#7a4a2a'));
    // Satellite dish and an outside tap.
    const dish = this.cyl(0.32, 0.05, 0.12, bayX + 1.4, 3.6, this.back + 0.2, this.mat('#d8d8d0', 0.5, 0.3), 16);
    dish.rotation.x = Math.PI / 2 - 0.3;
    this.box(0.06, 0.12, 0.08, f.x1 - 0.8, 0.6, this.back + 0.06, this.mat('#c9a227', 0.3, 0.8), false);
    // Garden: low brick wall with copings in front of the bay, a gravel strip, the drive and the path.
    const front = this.level.bounds.minZ + 0.25;
    const wallX0 = dx + 0.8;
    const wallX1 = f.x1 - 0.2;
    if (wallX1 - wallX0 > 1) {
      // A narrow planted bed under the bay window, edged by a low wall.
      this.ground(wallX0, wallX1, this.back + 0.02, front, this.mat('#2a3a1e', 1), 0.004);
      for (let x = wallX0 + 0.4; x < wallX1 - 0.3; x += 0.55) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.mat(this.rnd() < 0.3 ? '#4a6a2a' : '#2f5a26', 0.9));
        b.scale.set(1, 0.75, 0.8);
        b.position.set(x, 0.18, this.back + 0.3);
        b.castShadow = true;
        this.group.add(b);
      }
      this.box(wallX1 - wallX0, 0.45, 0.16, (wallX0 + wallX1) / 2, 0.22, front, new THREE.MeshStandardMaterial({ map: brickTexture((wallX1 - wallX0) / 2, 0.25) }));
      this.box(wallX1 - wallX0 + 0.05, 0.06, 0.22, (wallX0 + wallX1) / 2, 0.48, front, this.mat('#bdb8aa', 0.8), false);
    }
    // Block-paved drive from the garage to the kerb, and the path to the door.
    const drive = new THREE.MeshStandardMaterial({ map: tileTexture('#8a6a5a', '#5a4438', 14, 10, 32), roughness: 0.9 });
    this.ground(f.x0 + 0.1, dx - 0.75, this.back + 0.02, this.level.bounds.maxZ + 0.35, drive, 0.006);
    this.ground(dx - 0.6, dx + 0.6, this.back + 0.02, this.level.bounds.maxZ + 0.35, this.mat('#a8a49a', 0.85), 0.007);
    // Dropped kerb.
    this.box(dx - f.x0 - 0.8, 0.05, 0.25, (f.x0 + 0.1 + dx - 0.75) / 2, 0.03, this.level.bounds.maxZ + 0.52, this.mat('#9a9890', 0.9), false);
  }

  /** A shop with a big glass showroom front: furniture, cars, bikes. */
  private showroom(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const colour = f.colour ?? '#1f4fa8';
    if (!f.label) return this.warehouseOrShop(f);
    const trade = this.level.theme === 'ind_estate';
    const H = trade ? 7 : 7.5;
    if (trade) {
      // Portal-frame unit: cladding above, glazing below.
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: corrugatedTexture('#c8ccd0', w / 2, 2), roughness: 0.6, metalness: 0.3 }), 0);
    } else this.brickWall(f.x0, f.x1, H);
    if (!trade) for (let x = f.x0 + 1.5; x < f.x1 - 0.5; x += 3) this.windowAt(x, 5.4, 1.2, 1.3, this.windowMat(this.rnd() < 0.5 ? 0.45 : 0));
    // Glazing in bays with slim mullions, lit from inside.
    const gw = w - 1.0;
    const glass = this.mat('#101820', 0.05, 0.7, { emissive: 0xf4f0e8, emissiveIntensity: 0.55 });
    this.box(gw + 0.2, 3.2, 0.08, cx, 1.65, this.back + 0.04, this.mat('#1a1a1c', 0.4, 0.5));
    this.box(gw, 3.0, 0.06, cx, 1.6, this.back + 0.09, glass, false);
    for (let x = f.x0 + 0.5; x <= f.x1 - 0.5 + 0.01; x += gw / Math.max(2, Math.round(gw / 2.4))) this.box(0.08, 3.0, 0.1, x, 1.6, this.back + 0.11, this.mat('#1a1a1c', 0.3, 0.6), false);
    // What's in the window: silhouettes of the stock.
    const kind = f.label.includes('MOTORS') ? 'car' : f.label.includes('MOTO') ? 'bike' : f.label.includes('GREEN') ? 'grow' : 'furniture';
    const sil = this.mat('#1a1a1c', 0.6, 0, { transparent: true, opacity: 0.55 });
    for (let x = f.x0 + 2.2; x < f.x1 - 1.5; x += kind === 'car' ? 5 : 2.6) {
      if (kind === 'car') {
        this.box(3.6, 0.7, 0.02, x, 0.75, this.back + 0.12, sil, false);
        this.box(1.8, 0.5, 0.02, x - 0.2, 1.35, this.back + 0.12, sil, false);
      } else if (kind === 'grow') {
        this.box(1.2, 1.9, 0.02, x, 0.95, this.back + 0.12, sil, false);
        this.box(1.0, 0.05, 0.02, x, 1.6, this.back + 0.13, this.mat('#ffffff', 0.5, 0, { emissive: 0xd8a0ff, emissiveIntensity: 1.2 }), false);
      } else if (kind === 'bike') {
        for (const dx of [-0.6, 0.6]) {
          const wh = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 6, 20), sil);
          wh.position.set(x + dx, 0.45, this.back + 0.12);
          this.group.add(wh);
        }
        this.box(1.0, 0.25, 0.02, x, 0.95, this.back + 0.12, sil, false);
      } else {
        this.box(1.6, 0.5, 0.02, x, 0.5, this.back + 0.12, sil, false);
        this.box(1.6, 0.4, 0.02, x, 0.95, this.back + 0.12, sil, false);
        this.box(0.06, 1.4, 0.02, x + 1.0, 0.8, this.back + 0.12, sil, false);
      }
    }
    // Fascia sign, lit.
    const t = signTexture(f.label, colour, '#ffffff', { w: 1024, h: 160 });
    const sign = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 });
    this.box(Math.min(w - 0.6, 11), 0.9, 0.18, cx, 3.75, this.back + 0.16, sign, false);
    // Totem sign and flags on the trade estate.
    if (trade) {
      const tt = signTexture(kind === 'car' ? 'NEW · USED · FINANCE' : kind === 'grow' ? 'LIGHTING · AIR · TENTS' : 'MX · ENDURO · SERVICE', '#ffffff', colour, { w: 512, h: 128 });
      this.box(0.15, 4.2, 0.15, f.x1 - 1.2, 2.1, this.back + 0.4, this.mat('#2a2a2e', 0.4, 0.6));
      this.box(1.6, 0.8, 0.12, f.x1 - 1.2, 3.9, this.back + 0.4, new THREE.MeshStandardMaterial({ map: tt, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.4 }), false);
      for (let i = 0; i < 3; i++) {
        const fx = f.x0 + 1.0 + i * 1.2;
        this.cyl(0.03, 0.03, 4.4, fx, 2.2, this.back + 0.35, this.mat('#d8d8d8', 0.3, 0.8), 6);
        this.box(0.6, 0.35, 0.01, fx + 0.32, 4.1, this.back + 0.35, this.mat(i % 2 ? colour : '#ffffff', 0.9), false);
      }
    }
    // Entrance canopy over the door.
    const door = this.level.exits.find((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1);
    if (door) {
      this.box(2.4, 0.12, 1.0, door.x, 2.95, this.back + 0.5, this.mat(colour, 0.5));
      this.box(1.4, 2.4, 0.04, door.x, 1.2, this.back + 0.13, this.mat('#c8dce8', 0.05, 0.2, { emissive: 0xf8f4e8, emissiveIntensity: 0.7 }), false);
    }
  }

  private warehouseOrShop(f: FacadeDef): void {
    if (this.level.theme === 'ind_estate') return this.warehouse(f);
    return this.brickWall(f.x0, f.x1, 7.5);
  }

  /** The Golden Lion: black and gold, neon, marquee bulbs, a red carpet and a doorman's rope. */
  private casinoFront(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    if (!f.label) return this.office(f);
    const H = 9;
    this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture('#141012', w / 3, 3), roughness: 0.4, metalness: 0.2 }), 0);
    const gold = this.mat('#c9a227', 0.25, 0.9, { emissive: 0x5a4010, emissiveIntensity: 0.4 });
    // Gold pilasters and cornice.
    for (let x = f.x0 + 0.3; x <= f.x1 - 0.3 + 0.01; x += (w - 0.6) / 4) this.box(0.35, H - 0.6, 0.2, x, (H - 0.6) / 2, this.back + 0.1, gold);
    this.box(w, 0.35, 0.4, cx, H - 0.2, this.back + 0.2, gold);
    // Smoked glass upstairs.
    for (let x = f.x0 + 1.6; x < f.x1 - 1; x += (w - 0.6) / 4) this.box(2.6, 2.4, 0.05, x + 0.4, 6.2, this.back + 0.04, this.mat('#1a0a12', 0.05, 0.8, { emissive: 0xff2a6a, emissiveIntensity: 0.12 }), false);
    // Neon name and a lion.
    const t = signTexture(f.label, '#000000', '#ffd23d', { neon: true, w: 1024, h: 192 });
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    neon.position.set(cx, 4.4, this.back + 0.22);
    this.group.add(neon);
    const t2 = signTexture('CASINO', '#000000', '#ff3a8a', { neon: true, w: 512, h: 128 });
    const neon2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: t2, transparent: true }));
    neon2.position.set(cx, 3.35, this.back + 0.22);
    this.group.add(neon2);
    // Marquee canopy with bulbs.
    const door = this.level.exits.find((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1);
    const dx = door?.x ?? cx;
    this.box(6, 0.4, 1.4, dx, 2.85, this.back + 0.7, this.mat('#1a1012', 0.4, 0.3));
    const bulb = this.mat('#fff4d8', 0.3, 0, { emissive: 0xffe0a0, emissiveIntensity: 1.6 });
    for (let x = dx - 2.9; x <= dx + 2.9; x += 0.3) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), bulb);
      b.position.set(x, 2.62, this.back + 1.42);
      this.group.add(b);
    }
    // Revolving-style doors, red carpet, brass posts and rope.
    this.box(2.2, 2.5, 0.06, dx, 1.25, this.back + 0.1, this.mat('#2a1a0a', 0.1, 0.5, { emissive: 0xffb050, emissiveIntensity: 0.5 }), false);
    this.box(0.08, 2.5, 0.1, dx, 1.25, this.back + 0.14, gold, false);
    this.ground(dx - 1.1, dx + 1.1, this.back + 0.05, this.level.bounds.minZ + 0.9, this.mat('#7a0a14', 1), 0.008);
    for (const side of [-1, 1]) {
      for (const k of [0.3, 1.1]) this.cyl(0.04, 0.06, 0.9, dx + side * 1.35, 0.45, this.level.bounds.minZ + k - 0.6, gold, 10);
      const rope = this.cyl(0.025, 0.025, 0.8, dx + side * 1.35, 0.78, this.level.bounds.minZ + 0.1, this.mat('#a01020', 0.8), 6);
      rope.rotation.x = Math.PI / 2;
    }
  }

  private basementFloor(W: number, D: number, flags: string[]): THREE.MeshStandardMaterial {
    if (flags.includes('epoxy_floor')) {
      const [c, g] = canvas(256, 64);
      g.fillStyle = '#6a6e74';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 256, Math.random() * 64, 2, 2);
      g.fillStyle = '#e8c020';
      g.fillRect(0, 50, 256, 4);
      return new THREE.MeshStandardMaterial({ map: toTexture(c, W / 4, D / 3), roughness: 0.25, metalness: 0.1 });
    }
    const sealed = flags.some((f) => f !== 'tier0' && f.startsWith('tier'));
    const m = new THREE.MeshStandardMaterial({ map: concreteTexture(sealed ? '#7a7874' : '#5e5a54', W / 3, D / 3), roughness: sealed ? 0.6 : 0.98 });
    return m;
  }

  /**
   * The basement: brick and concrete walls, joists, pipes, cables and a fuse
   * board. Gets cleaner, brighter and more serious with each tier and improvement.
   */
  private basementWalls(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const flags = f.flags ?? [];
    const has = (k: string) => flags.includes(k);
    const tier = Number((flags.find((x) => x.startsWith('tier')) ?? 'tier0').slice(4));
    const H = 3.8;
    if (has('tiled_walls')) {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture('#e8e8e4', w / 3, 1), roughness: 0.8 }), 0);
      this.box(w, 1.6, 0.03, cx, 0.8, this.back + 0.02, new THREE.MeshStandardMaterial({ map: tileTexture('#f4f4f0', '#b8b8b0', w / 0.3, 1.6 / 0.15, 48), roughness: 0.25 }), false);
    } else if (has('white_walls')) {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, H / 4), color: 0xf4f2ec, roughness: 0.95 }), 0);
    } else {
      // Old brick, damp tide-mark, a concrete plinth.
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, H / 4), color: tier === 0 ? 0x8a7a6a : 0xb8a898, roughness: 1 }), 0);
      this.box(w, 0.5, 0.05, cx, 0.25, this.back + 0.03, new THREE.MeshStandardMaterial({ map: concreteTexture('#5a5650', w / 3, 0.3), roughness: 1 }), false);
      if (tier === 0) for (let x = f.x0 + 3; x < f.x1 - 1; x += 4.5) this.panel(1.8 + this.rnd(), 0.9, x, 0.9, this.mat('#2a2620', 1, 0, { transparent: true, opacity: 0.35 }), 0.04);
    }
    // Joists and a ceiling.
    const joist = this.mat(tier === 0 ? '#5a4632' : '#7a6448', 0.85);
    for (let x = f.x0 + 1.9; x < f.x1; x += 0.9) this.box(0.1, 0.22, 3.6, x, H - 0.31, this.back + 1.6, joist, false);
    this.box(w, 0.08, 3.8, cx, H - 0.16, this.back + 1.7, this.mat(tier === 0 ? '#3a3228' : '#d8d4c8', 0.95), false);
    // Pipes and a cable tray along the wall.
    const pipe = this.mat('#b87333', 0.35, 0.8);
    for (const [y, r] of [[3.0, 0.035], [2.88, 0.025]] as const) {
      const pp = this.cyl(r, r, w, cx, y, this.back + 0.12, pipe, 8);
      pp.rotation.z = Math.PI / 2;
      pp.castShadow = false;
    }
    this.box(w, 0.03, 0.15, cx, 2.72, this.back + 0.1, this.mat('#8a8e94', 0.5, 0.6), false);
    for (let x = f.x0 + 2.5; x < f.x1 - 0.5; x += 5) this.box(0.6, 0.02, 0.1, x, 2.75, this.back + 0.1, this.mat('#2a2a2a', 0.8), false);
    // Fuse board and meter by the terminal; a better board once rewired.
    const rewired = has('electrics') || has('three_phase');
    // The junction box (security set): battered and hanging open until you rewire, then a tidy closed board.
    if (!this.secure(rewired ? 'electric_box' : tier === 0 ? 'electric_box_broken' : 'electric_box_open', 4.4, 1.85, 0.03, 2.2)) {
      this.box(0.5, 0.65, 0.12, 4.4, 1.7, this.back + 0.06, this.mat(rewired ? '#f0eee8' : '#3a3428', 0.5), false);
      this.box(0.42, 0.2, 0.02, 4.4, 1.75, this.back + 0.13, this.mat(rewired ? '#2a2a2e' : '#1a1a1a', 0.4), false);
    }
    if (has('three_phase') && !this.secure('electric_box', 5.1, 1.85, 0.03, 2.2)) this.box(0.5, 0.4, 0.15, 4.4, 2.3, this.back + 0.08, this.mat('#e8c020', 0.5), false);
    // The steel door comes with an entry keypad and a motion sensor on the stairs.
    if (has('security_door')) {
      this.secure('keypad', 1.45, 2.75, 0.03, 1.6); // beside the door at the top of the stairs
      this.secure('motion_sensor', 2.1, 3.3, 0.03, 1.8);
    }
    // Ducting along the ceiling.
    if (has('ducting')) {
      const duct = this.mat('#c8c8c0', 0.35, 0.7);
      this.box(w - 2, 0.35, 0.35, cx + 1, 3.2, this.back + 0.6, duct, false);
      for (let x = f.x0 + 3; x < f.x1 - 1; x += 3) this.box(0.4, 0.04, 0.4, x, 3.0, this.back + 0.6, this.mat('#2a2a2a', 0.5), false);
    }
    // Lighting: a bare bulb, then battens, then LED panels.
    if (has('led_lighting')) {
      for (let x = f.x0 + 3; x < f.x1; x += 3) this.box(0.6, 0.03, 0.6, x, H - 0.42, this.back + 1.3, this.mat('#ffffff', 0.4, 0, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 }), false);
    } else if (tier >= 1) {
      for (let x = f.x0 + 3; x < f.x1; x += 6) this.box(1.2, 0.05, 0.08, x, H - 0.45, this.back + 1.2, this.mat('#ffffff', 0.4, 0, { emissive: 0xfff4e0, emissiveIntensity: 1.2 }), false);
    } else {
      for (const x of [4, 10]) {
        this.cyl(0.005, 0.005, 0.5, x, H - 0.65, this.back + 1.3, this.mat('#111'), 4).castShadow = false;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.mat('#fff4d8', 0.3, 0, { emissive: 0xffc070, emissiveIntensity: 1.6 }));
        bulb.position.set(x, H - 0.95, this.back + 1.3);
        this.group.add(bulb);
      }
    }
    // Office corner and branding at the top tier; a lounge if bought.
    if (tier >= 3) {
      const t = signTexture('TANNER ROAD SUPPLY CO.', '#101418', '#40ff90', { w: 1024, h: 128 });
      this.panel(5, 0.6, f.x1 - 5, 2.4, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6 }), 0.05);
      this.box(0.06, 2.2, 0.06, 14, 1.1, this.back + 0.1, this.mat('#e8c020', 0.6), false);
    }
    if (has('lounge')) {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), this.mat('#7a2a2a', 1));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(3.0, 0.012, -0.2);
      this.group.add(rug);
      const t = signTexture('OPEN', '#000000', '#ff3a8a', { neon: true, w: 256, h: 128 });
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      n.position.set(3.0, 2.0, this.back + 0.05);
      this.group.add(n);
      this.box(0.25, 0.4, 0.25, 3.75, 0.98, this.back + 0.4, this.mat('#2a2a2e', 0.3, 0.6), false);
    }
  }

  /** Gym store and fighting gyms: their own wall, posters, branding. */
  private gymInterior(f: FacadeDef, theme: Theme): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 3.2;
    const wall = f.colour ?? '#3a3c40';
    if (theme === 'boxing_gym') {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, H / 4), color: 0xc8a898, roughness: 0.95 }), 0);
    } else this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture(wall, w / 3, 1), roughness: 0.85 }), 0);
    if (f.label) {
      const accent = theme === 'karate_dojo' ? '#7a1414' : theme === 'wrestling_club' ? '#e8c020' : theme === 'gym_store' ? '#9a1c1c' : '#f0eee8';
      const t = signTexture(f.label, theme === 'karate_dojo' ? '#f0eee8' : '#141416', accent, { w: 1024, h: 112 });
      this.panel(Math.min(w - 2, 10), 0.55, cx, 2.75, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }), 0.05);
    }
    // Posters / scrolls / belts on the wall.
    const items = theme === 'boxing_gym' ? ['FIGHT NIGHT', 'ABA CHAMPS 1994', 'NO PAIN'] : theme === 'karate_dojo' ? ['空手', 'RESPECT', 'BELT GRADING'] : theme === 'wrestling_club' ? ['TAKEDOWN', 'CLUB RULES', 'GRAPPLE'] : ['NEW IN', 'HOME GYM SALE', 'TRAIN HARD'];
    items.forEach((text, i) => {
      const t = signTexture(text, i % 2 ? '#f0eee8' : '#1a1a1c', i % 2 ? '#7a1414' : '#e8c020', { w: 256, h: 192 });
      this.panel(0.9, 0.68, f.x0 + 2.2 + i * ((w - 4) / 2.6), 1.75, new THREE.MeshStandardMaterial({ map: t }), 0.04);
    });
    if (theme === 'gym_store') this.box(w, 1.0, 0.03, cx, 0.5, this.back + 0.02, this.mat('#1a1a1c', 0.5), false);
  }

  /** Green Fingers: bright white walls, green branding, product boards, a purple-lit demo corner. */
  private growShopInterior(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 3.2;
    this.panel(w, H, cx, H / 2, this.mat(f.colour ?? '#e8ece4', 0.7), 0);
    this.box(w, 0.35, 0.03, cx, 2.55, this.back + 0.02, this.mat('#2a8a3a', 0.5), false);
    if (f.label) {
      const t = signTexture(f.label, '#2a8a3a', '#ffffff', { w: 1024, h: 96 });
      this.panel(Math.min(w - 1, 11), 0.5, cx, 2.9, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 }), 0.05);
    }
    // Demo corner glow and info boards.
    this.box(5, 2.2, 0.02, 11.3, 1.2, this.back + 0.02, this.mat('#2a1a3a', 0.6, 0, { emissive: 0x3a1a5a, emissiveIntensity: 0.35 }), false);
    for (const [x, text] of [[3.0, 'ROOM KIT'], [5.6, 'LIGHT · AIR'], [14.9, 'SECURITY']] as const) {
      const t = signTexture(text, '#ffffff', '#2a8a3a', { w: 512, h: 128 });
      this.panel(1.6, 0.4, x, 2.25, new THREE.MeshStandardMaterial({ map: t }), 0.05);
    }
  }

  /** A fight gym in an old brick unit: painted sign, steel door, steamed-up windows with a bag in them. */
  private gymFront(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    if (!f.label) return this.brickWall(f.x0, f.x1, 6);
    this.brickWall(f.x0, f.x1, 6.2);
    const colour = f.colour ?? '#7a1414';
    const t = signTexture(f.label, colour, '#f0eee8', { w: 1024, h: 160, serif: true });
    this.box(Math.min(w - 1, 9), 0.9, 0.12, cx, 3.6, this.back + 0.1, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }), false);
    const sil = this.mat('#1a1a1c', 0.6, 0, { transparent: true, opacity: 0.6 });
    for (const x of [f.x0 + 2.2, f.x1 - 2.2]) {
      this.box(2.6, 1.6, 0.05, x, 1.6, this.back + 0.04, this.mat('#a8b8c0', 0.3, 0.2, { emissive: 0xfff0d8, emissiveIntensity: 0.35 }), false);
      this.box(0.4, 1.0, 0.02, x - 0.5, 1.7, this.back + 0.07, sil, false);
      this.box(2.7, 0.08, 0.1, x, 0.78, this.back + 0.08, this.mat('#e8e4dc', 0.6), false);
    }
    const door = this.level.exits.find((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1);
    if (door) {
      if (!this.door('service', door.x, 1.3, 2.3, 0.04)) this.box(1.3, 2.3, 0.06, door.x, 1.15, this.back + 0.06, this.mat('#2a2e34', 0.4, 0.7), false);
      this.box(1.6, 0.1, 0.5, door.x, 2.45, this.back + 0.25, this.mat(colour, 0.5), false);
      this.box(0.1, 0.18, 0.1, door.x + 0.75, 2.2, this.back + 0.08, this.mat('#fff4d8', 0.3, 0, { emissive: 0xffd8a0, emissiveIntensity: 1.2 }), false);
    }
  }

  /** Back walls of the furniture shop, car showroom, bike shop and casino. */
  private showroomInterior(f: FacadeDef, theme: Theme): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const H = 3.2;
    const colour = f.colour ?? '#e8e4dc';
    const label = (text: string, bg: string, fg: string, width: number, y: number, glow = 0.8) => {
      const t = signTexture(text, bg, fg, { w: 1024, h: 128 });
      this.panel(width, width / 8, cx, y, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow }), 0.05);
    };
    if (theme === 'furniture_store') {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture(colour, w / 3, 1), roughness: 0.9 }), 0);
      // Timber slat feature wall behind the counter, pendant lights, price cards.
      for (let x = f.x1 - 5; x < f.x1 - 0.2; x += 0.18) this.box(0.1, H, 0.05, x, H / 2, this.back + 0.03, this.mat('#a87a4a', 0.6), false);
      for (let x = f.x0 + 2.5; x < f.x1 - 2; x += 3.5) {
        this.cyl(0.006, 0.006, 0.8, x, H - 0.4, this.back + 1.3, this.mat('#111'), 4);
        this.cyl(0.08, 0.25, 0.25, x, H - 0.9, this.back + 1.3, this.mat('#1a1a1c', 0.5, 0.3, { emissive: 0xffd8a0, emissiveIntensity: 0.25, side: THREE.DoubleSide }), 16);
        this.panel(0.5, 0.3, x + 1.2, 1.1, new THREE.MeshStandardMaterial({ map: signTexture(`£${[95, 180, 290, 420, 160][Math.floor(this.rnd() * 5)]}`, '#ffffff', '#c81010', { w: 256, h: 128 }) }), 0.04);
      }
      if (f.label) label(f.label, '#2a4a3a', '#f0eee8', 8, 2.75, 0.5);
    } else if (theme === 'car_showroom') {
      this.panel(w, H, cx, H / 2, this.mat(colour, 0.5), 0);
      // Brand wall: big blue stripe, backlit logo, finance boards.
      this.box(w, 0.5, 0.03, cx, 2.3, this.back + 0.02, this.mat('#1f4fa8', 0.4, 0, { emissive: 0x1f4fa8, emissiveIntensity: 0.4 }), false);
      for (let x = f.x0 + 3; x < f.x1 - 4; x += 5.2) {
        this.box(1.6, 1.0, 0.03, x + 2.6, 1.3, this.back + 0.03, this.mat('#111', 0.2), false);
        this.panel(1.5, 0.9, x + 2.6, 1.3, new THREE.MeshStandardMaterial({ map: signTexture(['0% FINANCE', 'PART EX', '12 MONTH MOT', 'DRIVE AWAY'][Math.floor(this.rnd() * 4)], '#0a1830', '#ffffff', { w: 256, h: 160 }), emissive: 0xffffff, emissiveIntensity: 0.15 }), 0.05);
      }
      if (f.label) label(f.label, '#1f4fa8', '#ffffff', 9, 2.82, 0.9);
      // Ceiling light rails.
      for (let x = f.x0 + 2; x < f.x1; x += 4) this.box(2.4, 0.04, 0.1, x, H - 0.05, this.back + 1.4, this.mat('#ffffff', 0.4, 0, { emissive: 0xf4f8ff, emissiveIntensity: 1.2 }), false);
    } else if (theme === 'bike_shop') {
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: corrugatedTexture('#2a2c30', w / 2, 1), roughness: 0.6, metalness: 0.4 }), 0);
      // Helmets and goggles on shelves, a pegboard of tools in the workshop end, MX banners.
      for (let x = f.x0 + 1.5; x < f.x1 - 7; x += 2.1) {
        this.box(1.6, 0.04, 0.3, x + 0.5, 2.0, this.back + 0.15, this.mat('#1a1a1c', 0.4, 0.5), false);
        for (let k = 0; k < 3; k++) {
          const hm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.mat(['#e86a10', '#1f4fa8', '#e8e4dc', '#c81010', '#3a9a3a'][Math.floor(this.rnd() * 5)], 0.25, 0.2));
          hm.scale.set(1, 0.9, 1.15);
          hm.position.set(x + k * 0.5, 2.16, this.back + 0.17);
          this.group.add(hm);
        }
      }
      this.box(4, 1.3, 0.03, f.x1 - 4.5, 1.7, this.back + 0.02, this.mat('#a8885a', 0.9), false);
      for (let i = 0; i < 10; i++) this.box(0.05, 0.25 + (i % 3) * 0.1, 0.03, f.x1 - 6.3 + i * 0.38, 1.75, this.back + 0.05, this.mat(i % 3 ? '#2a2a2e' : '#c81010', 0.4, 0.6), false);
      for (let i = 0; i < 3; i++) {
        const t = signTexture(['MOTOCROSS', 'ENDURO', 'RACE READY'][i], ['#e86a10', '#1a1a1a', '#1f4fa8'][i], '#ffffff', { w: 512, h: 128 });
        this.panel(2.2, 0.55, f.x0 + 3 + i * 4, 2.75, new THREE.MeshStandardMaterial({ map: t }), 0.04);
      }
      if (f.label) label(f.label, '#e86a10', '#111111', 7, 1.0, 0.4);
    } else {
      // Casino: deep red walls, gold trim, mirrored panels, chandeliers.
      this.panel(w, H, cx, H / 2, new THREE.MeshStandardMaterial({ map: plasterTexture(colour, w / 3, 1), roughness: 0.7 }), 0);
      const gold = this.mat('#c9a227', 0.25, 0.9, { emissive: 0x5a4010, emissiveIntensity: 0.3 });
      this.box(w, 0.06, 0.06, cx, 1.0, this.back + 0.04, gold, false);
      this.box(w, 0.06, 0.06, cx, 2.6, this.back + 0.04, gold, false);
      for (let x = f.x0 + 2; x < f.x1 - 1; x += 3) this.box(1.2, 1.4, 0.02, x, 1.8, this.back + 0.03, this.mat('#3a2a2a', 0.05, 0.6, { emissive: 0x5a2a1a, emissiveIntensity: 0.25 }), false);
      for (let x = f.x0 + 4; x < f.x1 - 2; x += 7) {
        this.cyl(0.01, 0.01, 0.5, x, H - 0.25, this.back + 1.3, gold, 4);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const drop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), this.mat('#fff4d8', 0.1, 0, { emissive: 0xffe0a0, emissiveIntensity: 1.4 }));
          drop.position.set(x + Math.cos(a) * 0.35, H - 0.6, this.back + 1.3 + Math.sin(a) * 0.35);
          this.group.add(drop);
        }
        this.cyl(0.38, 0.2, 0.08, x, H - 0.52, this.back + 1.3, gold, 16);
      }
      if (f.label) {
        const t = signTexture(f.label, '#000000', '#ffd23d', { neon: true, w: 1024, h: 160 });
        const n = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.95), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
        n.position.set(cx - 4, 2.85, this.back + 0.06);
        this.group.add(n);
      }
    }
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
        if (!this.door('service', x + 1.0, 0.95, 1.75, 0.12)) this.box(0.9, 1.6, 0.04, x + 1.0, 0.8, this.back + 0.14, this.mat('#4a3a2a', 0.9));
      } else {
        const col = doorCols[Math.floor(this.rnd() * doorCols.length)];
        if (!this.door('house', x + 1.0, 1.05, 2.15)) {
          this.box(0.95, 2.1, 0.08, x + 1.0, 1.05, this.back + 0.04, this.mat(col, 0.5));
          this.box(0.05, 0.05, 0.05, x + 1.3, 1.0, this.back + 0.1, this.mat('#c9a227', 0.3, 0.8), false);
        }
        this.box(1.15, 0.12, 0.25, x + 1.0, 2.25, this.back + 0.12, this.mat('#d8d4c8', 0.7));
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
    if (!this.door('shop', f.x1 - 0.65, 0.95, 2.2, 0.1)) this.box(0.9, 2.2, 0.06, f.x1 - 0.65, 1.1, this.back + 0.12, this.mat('#222', 0.5));
    if (f.label) {
      const sign = new THREE.MeshStandardMaterial({ map: signTexture(f.label, colour, '#ffffff'), emissive: 0xffffff, emissiveMap: signTexture(f.label, colour, '#ffffff'), emissiveIntensity: lit ? 0.35 : 0.05 });
      this.box(w - 0.4, 0.75, 0.15, cx, 3.5, this.back + 0.15, sign, false);
    } else {
      this.box(w - 0.4, 0.75, 0.15, cx, 3.5, this.back + 0.15, this.mat(colour, 0.6), false);
    }
    // Burglar alarm bell box over the fascia, as on every high-street shop.
    this.secure('alarm_box', f.x0 + 0.55, 4.3, 0.02, 2.2);
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
    if (!this.door('shop', f.x1 - 1.2, 1.15, 2.3, 0.12)) this.box(1.1, 2.3, 0.06, f.x1 - 1.2, 1.15, this.back + 0.14, this.mat('#2a1a0e', 0.4));
    if (f.label) {
      const tex = signTexture(f.label, colour, '#d9b65a', { serif: true });
      this.box(w - 0.4, 0.7, 0.16, cx, 3.65, this.back + 0.16, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }), false);
    }
    // Hanging sign on a bracket.
    this.box(0.06, 0.06, 1.0, f.x0 + 1.0, 4.6, this.back + 0.5, this.mat('#111', 0.4, 0.7), false);
    this.box(0.08, 0.9, 0.7, f.x0 + 1.0, 4.1, this.back + 0.75, this.mat(colour, 0.5));
    this.secure('alarm_box', f.x1 - 0.8, 4.5, 0.02, 2.2);
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
    // Door entry keypad, a lamp over the door and a camera watching it.
    this.secure('keypad', cx + 1.45, 1.35, 0.02, 1.6);
    this.secure('wall_lamp', cx - 1.55, 2.75, 0.02, 1.4);
    this.secure('wall_camera', cx + 1.7, 3.3, 0.02, 1.5, -0.4);
  }

  private garages(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    this.secure('wall_lamp', cx, 2.5, 0.06, 1.5);
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
    // Security lamp, a camera over the roller door and the alarm box.
    if (!this.secure('wall_lamp', cx + w * 0.3, 4.3, 0.02, 2.2)) this.box(0.4, 0.2, 0.3, cx + w * 0.3, 4.2, this.back + 0.2, this.mat('#ffffff', 0.4, 0, { emissive: 0xe8ffe8, emissiveIntensity: 1.3 }), false);
    this.secure('wall_camera', cx - w * 0.15 + rw / 2 + 0.5, 4.6, 0.02, 1.8, -0.5);
    this.secure('alarm_box', f.x1 - 1.0, 5.2, 0.02, 2.4);
    if (f.label) {
      const tex = signTexture(f.label, theme === 'territory' ? '#2a0e0a' : '#e8e4d8', theme === 'territory' ? '#ff4a2a' : '#1a1a1a', { neon: theme === 'territory' });
      this.box(Math.min(w - 1, 9), 1.0, 0.1, cx, 6.6, this.back + 0.08, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: theme === 'territory' ? 1.2 : 0.15 }), false);
    }
  }

  /**
   * A big house set back behind railings and gate piers, with a lawn in front. Its style comes from
   * `flags` (georgian, stone, brick or modern), so no two mansions on the road look the same.
   */
  private mansion(f: FacadeDef): void {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const style = f.flags?.[0] ?? (['georgian', 'stone', 'brick', 'modern'] as const)[hashString(f.label ?? `${f.x0}`) % 4];
    const set = 4.2;
    const z = this.back - set;
    const wallMat =
      style === 'brick'
        ? new THREE.MeshStandardMaterial({ map: brickTexture(w / 4, 3), color: 0xb08070, roughness: 0.9 })
        : style === 'modern'
          ? new THREE.MeshStandardMaterial({ map: plasterTexture('#eeece6', w / 4, 3), roughness: 0.6 })
          : new THREE.MeshStandardMaterial({ map: plasterTexture(style === 'stone' ? '#c8bc9e' : '#e6dcc4', w / 4, 3), roughness: 0.85 });
    const trim = this.mat(style === 'modern' ? '#2a2c30' : '#f2eee4', 0.6);
    const mainW = w * (style === 'modern' ? 0.62 : 0.5);
    const wingW = (w - mainW) / 2 - 0.4;
    const H = style === 'modern' ? 7.4 : 9.2;
    // Lawn from the railings back to the house.
    this.ground(f.x0, f.x1, z, this.back, new THREE.MeshStandardMaterial({ color: 0x3f6a34, roughness: 1 }), 0.012);
    this.box(1.6, 0.02, set, cx, 0.02, this.back - set / 2, this.mat('#bdb5a4', 0.95), false);
    // The house: a main block and two lower wings set back a little.
    this.box(mainW, H, 0.6, cx, H / 2, z - 0.3, wallMat);
    for (const sx of [-1, 1]) this.box(wingW, H * 0.72, 0.6, cx + sx * (mainW / 2 + wingW / 2 + 0.2), (H * 0.72) / 2, z - 1.2, wallMat);
    const glass = (x: number, y: number, ww: number, hh: number, zz: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), this.windowMat(this.rnd() < 0.55 ? 0.6 : 0));
      m.position.set(x, y, zz);
      this.group.add(m);
    };
    if (style === 'modern') {
      // Floor-to-ceiling glass bands and a cantilevered upper floor.
      glass(cx, 1.6, mainW - 1.2, 2.6, z + 0.02);
      glass(cx + 0.6, 5.1, mainW - 2.4, 2.4, z + 0.62);
      this.box(mainW + 1.2, 0.35, 1.6, cx + 0.6, 3.6, z + 0.2, this.mat('#f4f2ee', 0.4));
      this.box(mainW + 1.4, 0.3, 1.0, cx, H + 0.15, z, this.mat('#2a2c30', 0.5));
      for (const sx of [-1, 1]) glass(cx + sx * (mainW / 2 + wingW / 2 + 0.2), 2.2, wingW - 0.8, 2.2, z - 0.88);
    } else {
      // Rows of sash windows with surrounds, and a hipped roof.
      const cols = Math.max(3, Math.round(mainW / 2.2));
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < cols; c++) {
          const x = cx - mainW / 2 + (mainW / cols) * (c + 0.5);
          if (r === 0 && Math.abs(x - cx) < 1.2) continue;
          const y = 2 + r * 3.4;
          glass(x, y, 1.0, 1.7, z + 0.02);
          this.box(1.3, 0.12, 0.1, x, y - 0.95, z + 0.05, trim, false);
          this.box(1.3, 0.12, 0.1, x, y + 0.95, z + 0.05, trim, false);
        }
      for (const sx of [-1, 1]) {
        const wx = cx + sx * (mainW / 2 + wingW / 2 + 0.2);
        for (let c = 0; c < Math.max(1, Math.round(wingW / 2.4)); c++) glass(wx - wingW / 2 + (wingW / Math.max(1, Math.round(wingW / 2.4))) * (c + 0.5), 2.2, 0.95, 1.6, z - 0.88);
      }
      const roof = this.mat(style === 'brick' ? '#4a3a32' : '#3a3e46', 0.8);
      const ridge = new THREE.Shape();
      ridge.moveTo(-mainW / 2 - 0.3, 0);
      ridge.lineTo(mainW / 2 + 0.3, 0);
      ridge.lineTo(mainW / 2 - 1.2, 2.2);
      ridge.lineTo(-mainW / 2 + 1.2, 2.2);
      ridge.lineTo(-mainW / 2 - 0.3, 0);
      const rg = new THREE.Mesh(new THREE.ExtrudeGeometry(ridge, { depth: 1.2, bevelEnabled: false }), roof);
      rg.position.set(cx, H, z - 1.1);
      this.group.add(rg);
      this.box(mainW + 0.4, 0.3, 0.3, cx, H, z + 0.05, trim, false);
      // Portico: columns and a pediment over the front door.
      if (style !== 'brick') {
        for (const dx of [-1.6, -0.55, 0.55, 1.6]) this.cyl(0.16, 0.18, 3.4, cx + dx, 1.7, z + 1.0, trim, 12);
        this.box(4.0, 0.4, 1.3, cx, 3.6, z + 0.7, trim, false);
        const ped = new THREE.Shape();
        ped.moveTo(-2.1, 0);
        ped.lineTo(2.1, 0);
        ped.lineTo(0, 1.0);
        ped.lineTo(-2.1, 0);
        const pm = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.3, bevelEnabled: false }), trim);
        pm.position.set(cx, 3.8, z + 1.1);
        this.group.add(pm);
      }
      // The front door.
      this.box(1.5, 2.8, 0.1, cx, 1.4, z + 0.03, this.mat(style === 'brick' ? '#1d2a1d' : '#1a1a1e', 0.4), false);
    }
    // Railings along the front with gate piers at the drive, lamps on top, and a name plate.
    const iron = this.mat('#18191c', 0.4, 0.6);
    const pierMat = this.mat(style === 'brick' ? '#8a5a48' : '#d8d0c0', 0.8);
    const gateX = this.level.exits.find((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1)?.x ?? cx;
    const rz = this.back + 0.08;
    this.box(w, 0.5, 0.25, cx, 0.25, rz, pierMat);
    const n = Math.floor(w / 0.16);
    const geo = new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6);
    const inst = new THREE.InstancedMesh(geo, iron, n);
    const mx = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = f.x0 + i * 0.16 + 0.08;
      if (Math.abs(x - gateX) < 1.7) continue;
      inst.setMatrixAt(k++, mx.makeTranslation(x, 1.25, rz));
    }
    inst.count = k;
    this.group.add(inst);
    this.box(w, 0.05, 0.05, cx, 1.95, rz, iron, false);
    for (const sx of [-1, 1]) {
      const px = gateX + sx * 1.8;
      this.box(0.5, 2.4, 0.5, px, 1.2, rz, pierMat);
      this.box(0.62, 0.12, 0.62, px, 2.45, rz, pierMat, false);
      this.cyl(0.14, 0.14, 0.3, px, 2.66, rz, this.mat('#fff2d0', 0.3, 0, { emissive: 0xffd890, emissiveIntensity: 1.4 }), 10);
    }
    // Gates, open.
    for (const sx of [-1, 1]) {
      const gate = new THREE.Group();
      for (let i = 0; i < 9; i++) this.box(0.025, 1.8, 0.025, sx * (0.08 + i * 0.17), 1.0, 0, iron, false, gate);
      this.box(1.55, 0.06, 0.04, sx * 0.78, 1.85, 0, iron, false, gate);
      this.box(1.55, 0.06, 0.04, sx * 0.78, 0.2, 0, iron, false, gate);
      gate.position.set(gateX + sx * 1.55, 0, rz);
      gate.rotation.y = sx * -1.1;
      this.group.add(gate);
    }
    if (f.label) {
      const t = signTexture(f.label, '#1a1a1e', '#e8d6a0', { w: 512, h: 96 });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.3 }));
      plate.position.set(gateX - 1.8, 1.7, rz + 0.26);
      this.group.add(plate);
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
    const fin = f.wall ? FINISHES[f.wall] : undefined;
    if (this.lowPoly) {
      // Low-poly: a flat-coloured wall with its pattern built from blocks.
      const pattern = fin?.pattern ?? (f.label === 'Garage' ? 'brick' : f.label === 'Kitchen' ? 'tiles' : 'paint');
      const c1 = fin?.colour ?? (f.label === 'Garage' ? '#8a5a48' : f.label === 'Kitchen' ? '#e8e2cc' : colour);
      this.group.add(kitWall(pattern, c1, fin?.colour2, f.x0, f.x1, this.back + 0.02, H));
    } else {
      const wall = fin
        ? this.wallFinish(fin.id, w, H)
        : new THREE.MeshStandardMaterial({ map: f.label === 'Garage' ? brickTexture(w / 4, 1) : f.label === 'Kitchen' ? tileTexture('#e8e2cc', '#9a9480', w / 1.5, 2, 48) : plasterTexture(colour, w / 3, 1), roughness: 0.9 });
      this.panel(w, H, cx, H / 2, wall, 0);
    }
    if (fin?.pattern === 'panelling' && !this.lowPoly) {
      // Panelling to dado height, with a rail.
      this.box(w, 1.05, 0.04, cx, 0.53, this.back + 0.02, new THREE.MeshStandardMaterial({ map: woodFloorTexture(w / 2, 0.5), color: fin.colour, roughness: 0.5 }), false);
      this.box(w, 0.05, 0.06, cx, 1.07, this.back + 0.05, this.mat('#4a2e1a', 0.5), false);
    }
    // Skirting, coving and the ceiling edge to sell the cutaway.
    const isHome = f.label !== 'Garage' && f.label !== 'Gym';
    this.box(w, 0.12, 0.04, cx, 0.06, this.back + 0.03, this.mat('#f0eee6', 0.6), false);
    if (isHome) this.box(w, 0.08, 0.08, cx, H - 0.04, this.back + 0.04, this.mat('#f0eee6', 0.7), false);
    this.box(w, 0.25, 0.6, cx, H + 0.12, this.back + 0.3, this.mat('#d8d4c8', 0.9), false);
    // Door frames where the room meets the next (the gap is at the front).
    if (isHome || f.label === 'Gym') {
      const trim = this.mat('#f0eee6', 0.5);
      for (const x of [f.x0, f.x1]) {
        if (x <= this.level.bounds.minX + 0.01 || x >= this.level.bounds.maxX - 0.01) continue;
        this.box(0.3, 2.25, 0.06, x, 1.12, 0.12, trim, false);
        this.box(0.3, 0.1, 1.4, x, 2.25, 0.75, trim, false);
      }
    }
    // A window onto the night street.
    const wx = f.windowX !== undefined ? f.windowX : isHome ? this.defaultWindowX(f) : null;
    if (wx !== null && wx !== undefined) {
      const bath = f.label === 'Bathroom';
      const ww = bath ? 0.9 : 1.4;
      const wh = bath ? 0.8 : 1.1;
      const wy = bath ? 2.0 : 1.75;
      const win = bath ? this.mat('#c8d4dc', 0.6, 0, { emissive: 0x5a6a8a, emissiveIntensity: 0.35 }) : this.mat('#0b1020', 0.1, 0.4, { emissive: 0x2a3a6a, emissiveIntensity: 0.5 });
      this.box(ww, wh, 0.04, wx, wy, this.back + 0.02, this.mat('#f0eee6', 0.6), false);
      this.box(ww - 0.15, wh - 0.15, 0.05, wx, wy, this.back + 0.03, win, false);
      this.box(0.04, wh - 0.15, 0.06, wx, wy, this.back + 0.05, this.mat('#f0eee6', 0.6), false);
      this.box(ww + 0.2, 0.05, 0.14, wx, wy - wh / 2 - 0.03, this.back + 0.08, this.mat('#f0eee6', 0.6), false);
      if (!bath) {
        const curtain = this.mat(colour === '#6d7a8c' || f.label === 'Bedroom' ? '#2a3a5a' : '#7a2a2a', 1);
        this.box(0.3, 1.3, 0.05, wx - 0.8, 1.85, this.back + 0.08, curtain, false);
        this.box(0.3, 1.3, 0.05, wx + 0.8, 1.85, this.back + 0.08, curtain, false);
        this.cyl(0.015, 0.015, 2.1, wx, 2.45, this.back + 0.1, this.mat('#2a2a2a', 0.4, 0.6), 6).rotation.z = Math.PI / 2;
      }
    }
    // Light switch and a socket by the door gap.
    if (isHome) {
      this.box(0.08, 0.12, 0.02, f.x1 - 0.35, 1.25, this.back + 0.02, this.mat('#f4f2ec', 0.5), false);
      this.box(0.14, 0.08, 0.02, f.x0 + 0.5, 0.32, this.back + 0.02, this.mat('#f4f2ec', 0.5), false);
    }
    // Long mirror on the bedroom wall.
    for (const st of this.level.stations ?? []) {
      if (st.id !== 'mirror' || st.x < f.x0 || st.x > f.x1) continue;
      this.box(0.7, 1.7, 0.04, st.x, 1.15, this.back + 0.03, this.mat('#3a2a1a', 0.6), false);
      this.box(0.6, 1.6, 0.03, st.x, 1.15, this.back + 0.05, this.mat('#a8b8c8', 0.05, 0.2, { emissive: 0x6a7a8a, emissiveIntensity: 0.5 }), false);
    }
    if (f.label === 'Bathroom') {
      // Mirror and shelf over the basin; tiled splashback.
      const basin = this.level.props.find((p) => p.kind === 'basin');
      if (basin) {
        this.box(0.62, 0.55, 0.03, basin.x, 1.55, this.back + 0.03, this.mat('#a8b8c8', 0.05, 0.2, { emissive: 0x6a7a8a, emissiveIntensity: 0.45 }), false);
        this.box(0.62, 0.03, 0.12, basin.x, 1.24, this.back + 0.07, this.mat('#f4f2ec', 0.4), false);
      }
    }
    if (f.label === 'Garage') {
      const sh = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.5 });
      this.box(3.2, 2.3, 0.05, cx + 1.2, 1.15, this.back + 0.04, sh, false);
      // Pegboard of tools and a wall rack over the bike bays.
      this.box(2.4, 1.0, 0.03, cx - 2.6, 1.7, this.back + 0.02, this.mat('#a8885a', 0.9), false);
      const tool = this.mat('#2a2a2e', 0.4, 0.7);
      for (let i = 0; i < 7; i++) this.box(0.05, 0.3 + (i % 3) * 0.08, 0.03, cx - 3.6 + i * 0.32, 1.7, this.back + 0.05, i % 2 ? tool : this.mat('#c81010', 0.5), false);
      this.box(3.0, 0.06, 0.25, cx - 2.6, 2.45, this.back + 0.14, this.mat('#2a2a2e', 0.5, 0.5), false);
      for (let i = 0; i < 4; i++) this.box(0.45, 0.25, 0.22, cx - 3.7 + i * 0.7, 2.62, this.back + 0.14, this.mat(['#3a5a8a', '#c8a020', '#7a1414', '#3a3a3a'][i], 0.6), false);
    }
    if (f.label === 'Gym') {
      this.box(3, 1.6, 0.03, cx - 1.2, 1.4, this.back + 0.02, this.mat('#a8b8c8', 0.05, 0.2, { emissive: 0x5a6a7a, emissiveIntensity: 0.45 }), false);
    }
    if (f.label) {
      const t = signTexture(f.label.toUpperCase(), '#1a1a1a', '#e8e4d8', { w: 512, h: 96 });
      // Top left of the room, clear of door signs and wall pieces.
      this.panel(1.4, 0.26, f.x0 + 0.95, 2.72, new THREE.MeshStandardMaterial({ map: t }), 0.04);
    }
  }

  private defaultWindowX(f: FacadeDef): number {
    const w = f.x1 - f.x0;
    const cx = (f.x0 + f.x1) / 2;
    const busy = [...this.level.exits.filter((e) => e.kind === 'door').map((e) => e.x), ...(this.level.stations ?? []).filter((s) => s.id === 'mirror').map((s) => s.x)];
    let wx = cx + w * 0.15;
    if (busy.some((x) => Math.abs(x - wx) < 1.8)) wx = cx - w * 0.28;
    return wx;
  }

  private buildWall(w: { minX: number; maxX: number; minZ: number; maxZ: number; visual?: 'wall' | 'none' }): void {
    if (w.visual === 'none') return;
    const home = this.level.theme === 'home';
    const h = home ? 3 : 1.1;
    // Room dividers are see-through enough that you never lose yourself behind one.
    const m = home ? new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false }) : this.mat('#3a3d42', 0.5, 0.6);
    // A see-through divider casts no shadow: it would darken the rooms either side.
    this.box(w.maxX - w.minX, h, w.maxZ - w.minZ, (w.minX + w.maxX) / 2, h / 2, (w.minZ + w.maxZ) / 2, m, !home);
    if (home) this.fadeWalls.push({ mat: m, x: (w.minX + w.maxX) / 2 });
    if (home) {
      // Door frame on the open end.
      this.box(w.maxX - w.minX + 0.12, 0.1, 0.12, (w.minX + w.maxX) / 2, 2.2, w.maxZ, this.mat('#f0ece0', 0.6), false);
    }
  }

  // ---- props --------------------------------------------------------------------

  private buildProp(p: PropDef): void {
    if (p.kind === 'furniture' || p.kind === 'vehicle' || p.kind === 'equipment' || p.kind === 'gym_kit') return this.buildModelProp(p);
    const [hx, hz] = propHalf(p);
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
      {
        const colour = c ?? (p.kind === 'homecar' ? '#2a4a6a' : ['#1f2a44', '#6b6b70', '#2a2a2a', '#8a8a82'][Math.floor(this.rnd() * 4)]);
        if (this.streetPass) {
          const car = buildCar(W, D, colour, p.kind === 'homecar');
          g.add(car);
          if (p.z > 0.6) this.foreCars.push({ car, x: p.x, z: p.z, hx, hz });
        } else this.car(g, W, D, colour, p.kind === 'homecar');
        break;
      }
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
        if (this.fit(g, 'bedDouble', W, 0.75, D)) break;
        B(W, 0.4, D, 0, 0.2, 0, this.mat('#4a3a2a', 0.8));
        B(W - 0.05, 0.2, D - 0.05, 0, 0.5, 0, this.mat('#e8e4d8', 1));
        B(W - 0.06, 0.08, D * 0.65, 0, 0.62, D * 0.15, this.mat('#2a4a7a', 1));
        B(W * 0.7, 0.12, 0.35, 0, 0.64, -D / 2 + 0.25, this.mat('#f4f0e8', 1));
        B(W, 0.9, 0.06, 0, 0.45, -D / 2, this.mat('#4a3a2a', 0.8));
        break;
      }
      case 'wardrobe': {
        if (this.fit(g, 'bookcaseClosedDoors', W, 2.1, D)) break;
        const wood = this.mat('#7a5a3a', 0.7);
        B(W, 2.1, D, 0, 1.05, 0, wood);
        B(0.02, 1.9, 0.01, 0, 1.05, D / 2 + 0.005, this.mat('#2a1a0a'), false);
        for (const dx of [-0.08, 0.08]) B(0.03, 0.15, 0.04, dx, 1.1, D / 2 + 0.02, this.mat('#c9a227', 0.3, 0.8), false);
        break;
      }
      case 'desk': {
        if (this.fit(g, 'desk', W, 0.78, D)) {
          this.fit(g, 'laptop', 0.4, 0.25, 0.3, { x: -0.1, y: 0.78 });
          this.fit(g, 'lampRoundTable', 0.2, 0.42, 0.2, { x: W / 2 - 0.2, y: 0.78 });
          break;
        }
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
        if (this.fit(g, 'loungeSofa', p.turned ? D : W, 0.85, p.turned ? W : D, { upholstery: c ?? '#4a5a3a', turn: p.turned ? Math.PI / 2 : 0 })) break;
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
        if (this.fit(g, 'cabinetTelevision', W, 0.5, D)) {
          this.fit(g, 'televisionModern', W * 1.05, 0.72, 0.12, { y: 0.5 });
          break;
        }
        B(W, 0.45, D, 0, 0.22, 0, this.mat('#2a2a2a', 0.6));
        B(W * 1.1, 0.7, 0.05, 0, 0.85, 0, this.mat('#0a0a0a', 0.2, 0.5));
        B(W * 1.05, 0.64, 0.01, 0, 0.85, 0.03, this.mat('#0a0e18', 0.1, 0, { emissive: 0x3a6aff, emissiveIntensity: 0.6 }), false);
        break;
      }
      case 'table': {
        if (this.fit(g, 'table', W, 0.76, D)) break;
        const wood = this.mat('#8a6a4a', 0.7);
        B(W, 0.05, D, 0, 0.74, 0, wood);
        for (const dx of [-W / 2 + 0.05, W / 2 - 0.05]) for (const dz of [-D / 2 + 0.05, D / 2 - 0.05]) B(0.05, 0.74, 0.05, dx, 0.37, dz, wood, false);
        // Phone on the living room table, kettle on the kitchen one.
        B(0.08, 0.01, 0.15, 0.1, 0.77, 0, this.mat('#111', 0.2, 0, { emissive: 0x6aa0ff, emissiveIntensity: 0.8 }), false);
        break;
      }
      case 'fridge': {
        if (this.fit(g, 'kitchenFridgeLarge', W, 1.8, D)) break;
        B(W, 1.8, D, 0, 0.9, 0, this.mat('#e8e8e4', 0.3, 0.1));
        B(0.03, 0.4, 0.04, W / 2 - 0.08, 1.2, D / 2 + 0.02, this.mat('#888', 0.3, 0.8), false);
        B(W - 0.02, 0.01, 0.01, 0, 1.15, D / 2 + 0.005, this.mat('#aaa'), false);
        break;
      }
      case 'cooker':
        if (this.fit(g, 'kitchenStove', W, 0.92, D)) break;
        B(W, 0.9, D, 0, 0.45, 0, this.mat('#e8e8e4', 0.3, 0.2));
        break;
      case 'counter': {
        if (this.fit(g, 'kitchenCabinet', W * 0.4, 0.92, D, { x: -W * 0.3 }) && this.fit(g, 'kitchenSink', W * 0.3, 0.92, D, { x: W * 0.05 }) && this.fit(g, 'kitchenStove', W * 0.3, 0.92, D, { x: W * 0.35 })) {
          this.fit(g, 'kitchenMicrowave', 0.45, 0.28, 0.32, { x: -W * 0.3, y: 0.92 });
          break;
        }
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
        // The standing punch bag (LowPoly Gym Assets).
        if (this.gym(g, 'punch_bag', hx * 2, 1.9, hx * 2, { keepAspect: true })) break;
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
        if (this.fitting(g, 'workbench', W, 2.0, D)) break;
        const wood = this.mat('#8a6a3a', 0.85);
        B(W, 0.08, D, 0, 0.9, 0, wood);
        for (const dx of [-W / 2 + 0.06, W / 2 - 0.06]) B(0.08, 0.9, D - 0.1, dx, 0.45, 0, wood);
        B(W, 1.0, 0.04, 0, 1.6, -D / 2, this.mat('#5a4a3a', 0.9)); // pegboard
        for (let i = 0; i < 5; i++) B(0.04, 0.25, 0.03, -W / 2 + 0.3 + i * 0.35, 1.6, -D / 2 + 0.04, this.mat('#9aa', 0.4, 0.8), false);
        break;
      }
      case 'shelves': {
        if (this.piece(g, 'cafe/wire-shelving-rack', W, 1.9, D)) {
          for (let i = 0; i < 6; i++) B(0.3, 0.25, 0.3, -W / 2 + 0.25 + (i % 3) * 0.5, 0.55 + Math.floor(i / 3) * 0.5 + 0.125, 0, this.mat(['#a87a4a', '#3a5a8a', '#8a2a2a'][i % 3], 0.9), false);
          break;
        }
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
        const model = fittedProp('dumpster', W, 1.35, D);
        if (model) {
          g.add(model);
          break;
        }
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
        // Produce heaped in crates (Kenney's food kit), a different stall mix each time.
        const mixes: ProduceId[][] = [
          ['apple', 'orange', 'banana', 'pear', 'lemon', 'grapes'],
          ['tomato', 'carrot', 'onion', 'paprika', 'broccoli', 'cabbage', 'mushroom', 'leek'],
          ['bread', 'loaf', 'loaf-round', 'croissant'],
          ['fish', 'meat-raw', 'cheese'],
        ];
        const mix = mixes[Math.floor(this.rnd() * mixes.length)];
        for (let i = 0; i < 4; i++) {
          const x = -W / 2 + W / 8 + (i * W) / 4;
          B(W / 4.5, 0.15, D * 0.7, x, 1.02, 0, this.mat('#a8865a', 0.9), false);
          const heap = produceHeap(mix[(i + Math.floor(this.rnd() * 9)) % mix.length], W / 5, D * 0.6, () => this.rnd(), mix === mixes[2] ? 0.16 : 0.09);
          if (heap) {
            heap.position.set(x, 1.1, 0);
            g.add(heap);
          } else B(W / 5, 0.08, D * 0.6, x, 1.12, 0, this.mat(['#d84a1a', '#3a8a2a', '#e8c82a', '#7a1a4a'][i], 0.8), false);
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
        // Modelled at its real size; the CASH sign goes on its green header.
        if (this.fitting(g, 'atm', 0, 0, 0, { native: true })) {
          const t = signTexture('CASH', '#1f6a3a', '#ffffff', { w: 256, h: 96 });
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.16), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 }));
          sign.position.set(0, 1.58, 0.262);
          g.add(sign);
          break;
        }
        B(W, 1.6, D, 0, 0.8, 0, this.mat('#4a4d55', 0.4, 0.6));
        B(W * 0.7, 0.3, 0.02, 0, 1.25, D / 2 + 0.01, this.mat('#0a1a2a', 0.1, 0.4, { emissive: 0x2a8ad8, emissiveIntensity: 0.9 }), false);
        B(W * 0.5, 0.15, 0.06, 0, 0.95, D / 2 + 0.03, this.mat('#2a2a2a', 0.4, 0.6), false);
        const t = signTexture('CASH', '#1f6a3a', '#ffffff', { w: 256, h: 96 });
        B(W, 0.2, 0.02, 0, 1.52, D / 2 + 0.01, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 }), false);
        break;
      }
      case 'vending': {
        if (this.piece(g, 'cafe/drinks-fridge', W, 1.9, D)) break;
        B(W, 1.9, D, 0, 0.95, 0, this.mat(c ?? '#b3121b', 0.4, 0.3));
        B(W * 0.65, 1.3, 0.02, -W * 0.12, 1.15, D / 2 + 0.01, this.mat('#101418', 0.05, 0.6, { emissive: 0xfff8e8, emissiveIntensity: 0.8 }), false);
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) B(0.08, 0.16, 0.05, -W * 0.4 + k * 0.13, 0.65 + r * 0.32, D / 2 - 0.04, this.mat(['#d82a2a', '#2a8ad8', '#e8c82a', '#2a8a3a'][(r + k) % 4], 0.4), false);
        break;
      }
      case 'shop_rail': {
        if (this.fitting(g, 'clothes_rail', W, 1.57, D)) break;
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
        if (this.fitting(g, (['mannequin', 'mannequin_red', 'mannequin_navy'] as const)[Math.floor(this.rnd() * 3)], 0, 0, 0, { native: true })) break;
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
        // A glass counter is the street's display case (Polyfork), with watches and rings glinting inside.
        if (!tall && hasKitPiece('cafe/pastry-display-case')) {
          const n = Math.max(1, Math.round(W / 1.4));
          for (let i = 0; i < n; i++) this.piece(g, 'cafe/pastry-display-case', W / n, 1.1, D, { x: -W / 2 + (W / n) * (i + 0.5) });
          for (let i = 0; i < 8; i++) {
            const gold = this.rnd() < 0.5;
            B(0.08, 0.03, 0.06, -W / 2 + 0.2 + this.rnd() * (W - 0.4), 0.82, (this.rnd() - 0.5) * (D - 0.3), this.mat(gold ? '#d4af37' : '#c8ccd0', 0.15, 0.95, { emissive: gold ? 0x6a5010 : 0x404448, emissiveIntensity: 0.6 }), false);
          }
          break;
        }
        if (tall && this.fitting(g, 'display_cabinet', W, 1.8, D)) break;
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
        // The street's own shop counter (Polyfork) in modules, with a till on the end.
        if (hasKitPiece('cafe/service-counter-module')) {
          const n = Math.max(1, Math.round(W / 1.6));
          for (let i = 0; i < n; i++) this.piece(g, 'cafe/service-counter-module', W / n, 1.0, D, { x: -W / 2 + (W / n) * (i + 0.5) });
          this.piece(g, 'cafe/pos-terminal', 0.5, 0.45, 0.4, { x: W / 2 - 0.4, y: 1.0, keepAspect: true });
          break;
        }
        B(W, 1.0, D, 0, 0.5, 0, this.mat(c ?? '#e8e4dc', 0.4));
        B(W + 0.06, 0.05, D + 0.06, 0, 1.02, 0, this.mat('#1a1a1a', 0.3, 0.2));
        B(0.35, 0.25, 0.3, W / 2 - 0.4, 1.17, 0, this.mat('#1a1a1a', 0.4, 0.4));
        B(0.3, 0.2, 0.02, W / 2 - 0.4, 1.4, -0.05, this.mat('#0a1a2a', 0.1, 0.4, { emissive: 0x2a8ad8, emissiveIntensity: 0.7 }), false);
        break;
      }
      case 'shop_shelf': {
        // Wire shelving (Polyfork) stocked with packets and tins.
        if (hasKitPiece('cafe/wire-shelving-rack')) {
          const n = Math.max(1, Math.round(W / 1.2));
          for (let i = 0; i < n; i++) this.piece(g, 'cafe/wire-shelving-rack', W / n, 1.9, D, { x: -W / 2 + (W / n) * (i + 0.5) });
          for (let lv = 0; lv < 4; lv++) {
            for (let x = -W / 2 + 0.14; x < W / 2 - 0.1; x += 0.22) {
              if (this.rnd() < 0.18) continue;
              const tall = 0.12 + this.rnd() * 0.12;
              B(0.16, tall, D * 0.55, x, 0.42 + lv * 0.4 + tall / 2, 0, this.mat(['#1a1a1a', '#e8e4dc', '#7a1414', '#1f2a44', '#c97a1a', '#3a5a3a', '#d8b82a'][Math.floor(this.rnd() * 7)], 0.8), false);
            }
          }
          break;
        }
        const m = this.mat(c ?? '#e8e4dc', 0.6);
        B(W, 1.9, 0.05, 0, 0.95, -D / 2 + 0.03, m);
        for (let i = 0; i < 4; i++) {
          B(W, 0.03, D, 0, 0.3 + i * 0.48, 0, m, false);
          for (let x = -W / 2 + 0.15; x < W / 2 - 0.1; x += 0.25) B(0.2, 0.14, D * 0.7, x, 0.38 + i * 0.48, 0, this.mat(['#1a1a1a', '#e8e4dc', '#7a1414', '#1f2a44', '#c97a1a', '#3a5a3a'][Math.floor(this.rnd() * 6)], 0.9), false);
        }
        break;
      }
      case 'changing_booth': {
        if (this.fitting(g, 'changing_booth', W, 2.2, D)) break;
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
        // The bar front is the street's counter (Polyfork), under a dark polished top.
        if (hasKitPiece('cafe/service-counter-module')) {
          const n = Math.max(1, Math.round(W / 1.6));
          for (let i = 0; i < n; i++) this.piece(g, 'cafe/service-counter-module', W / n, 1.03, D, { x: -W / 2 + (W / n) * (i + 0.5) });
        } else B(W, 1.05, D, 0, 0.52, 0, wood);
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
        if (this.piece(g, 'cafe/bistro-table', W * 2, 0.76, W * 2)) {
          C(0.035, 0.03, 0.15, 0.1, 0.84, 0.05, this.mat('#d8a040', 0.1, 0.1, { transparent: true, opacity: 0.8 }), 10);
          break;
        }
        C(W, W, 0.05, 0, 0.74, 0, this.mat('#3a2010', 0.35), 20);
        C(0.04, 0.05, 0.7, 0, 0.37, 0, this.mat('#1a1a1a', 0.4, 0.6), 8);
        C(0.25, 0.25, 0.03, 0, 0.02, 0, this.mat('#1a1a1a', 0.4, 0.6), 16);
        C(0.035, 0.03, 0.15, 0.1, 0.84, 0.05, this.mat('#d8a040', 0.1, 0.1, { transparent: true, opacity: 0.8 }), 10);
        break;
      }
      case 'fruit_machine':
      case 'slot_machine': {
        // One cabinet design for the pub's fruit machine and the casino's slots (the pub's runs brighter).
        const cab = this.mat(c ?? (p.kind === 'fruit_machine' ? '#1a1a2a' : '#2a1030'), 0.3, 0.4);
        B(W, 1.15, D, 0, 0.58, 0, cab);
        B(W, 0.55, D * 0.75, 0, 1.42, -D * 0.12, cab);
        B(W - 0.1, 0.38, 0.02, 0, 1.45, D * 0.27, this.mat('#111', 0.2, 0, { emissive: p.kind === 'fruit_machine' ? 0xff8a2a : 0xffc040, emissiveIntensity: 0.9 }), false);
        for (let i = 0; i < 3; i++) B(0.15, 0.24, 0.02, -0.2 + i * 0.2, 1.12, D / 2 + 0.01, this.mat('#f8f4e8', 0.3, 0, { emissive: 0xfff0d0, emissiveIntensity: 0.5 }), false);
        B(W, 0.05, D, 0, 1.73, -D * 0.12, this.mat('#c9a227', 0.2, 0.9, { emissive: 0x7a5a10, emissiveIntensity: 0.4 }), false);
        if (p.kind === 'fruit_machine') for (let i = 0; i < 4; i++) B(0.06, 0.03, 0.03, -0.15 + i * 0.1, 0.95, D / 2 + 0.02, this.mat('#111', 0.3, 0, { emissive: [0xff2020, 0xffd020, 0x20ff60, 0x2080ff][i], emissiveIntensity: 1 }), false);
        const arm = C(0.02, 0.02, 0.5, W / 2 + 0.03, 1.15, 0, this.mat('#d8d8d8', 0.2, 1), 8);
        arm.rotation.z = -0.15;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), this.mat('#c81010', 0.3));
        knob.position.set(W / 2 + 0.07, 1.42, 0);
        g.add(knob);
        B(W * 0.7, 0.05, 0.12, 0, 0.82, D / 2 + 0.05, this.mat('#1a1a1a', 0.4), false);
        break;
      }
      case 'jukebox': {
        if (this.piece(g, 'cars/jukebox', W, 1.6, D, { keepAspect: true })) break;
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
      case 'bath': {
        if (this.fit(g, 'bathtub', W, 0.6, D)) break;
        const white = this.mat('#f4f2ec', 0.25);
        B(W, 0.55, D, 0, 0.28, 0, white);
        B(W - 0.14, 0.04, D - 0.12, 0, 0.53, 0, this.mat('#a8c8d8', 0.05, 0.1, { emissive: 0x2a4a5a, emissiveIntensity: 0.2 }), false);
        B(W, 0.04, 0.03, 0, 0.3, D / 2 + 0.01, this.mat('#e8e4dc', 0.3), false);
        C(0.02, 0.02, 0.22, W / 2 - 0.15, 0.68, -D / 2 + 0.06, this.mat('#d8d8d8', 0.15, 1), 8);
        // Shower over the bath: rail and curtain.
        B(0.02, 0.02, D, -W / 2 + 0.05, 2.0, 0, this.mat('#d8d8d8', 0.15, 1), false);
        B(0.02, 1.3, D * 0.8, -W / 2 + 0.06, 1.35, 0.05, this.mat('#e8f0f4', 1, 0, { transparent: true, opacity: 0.8 }), false);
        C(0.07, 0.07, 0.02, -W / 2 + 0.3, 1.9, -D / 2 + 0.05, this.mat('#d8d8d8', 0.15, 1), 12);
        break;
      }
      case 'toilet': {
        if (this.fit(g, 'toilet', W, 0.8, D)) break;
        const white = this.mat('#f4f2ec', 0.25);
        B(W * 0.8, 0.4, D * 0.7, 0, 0.2, 0.05, white);
        B(W, 0.06, D * 0.85, 0, 0.42, 0.06, white);
        B(W * 1.3, 0.38, 0.18, 0, 0.62, -D / 2 + 0.09, white);
        B(0.06, 0.02, 0.03, 0.06, 0.8, -D / 2 + 0.1, this.mat('#d8d8d8', 0.15, 1), false);
        break;
      }
      case 'basin': {
        const white = this.mat('#f4f2ec', 0.25);
        C(0.07, 0.09, 0.78, 0, 0.39, -0.02, white, 12);
        B(W, 0.14, D, 0, 0.84, 0, white);
        B(W - 0.1, 0.02, D - 0.1, 0, 0.91, 0.02, this.mat('#a8c8d8', 0.05, 0.1), false);
        C(0.015, 0.015, 0.14, 0, 0.98, -D / 2 + 0.05, this.mat('#d8d8d8', 0.15, 1), 8);
        break;
      }
      case 'computer_desk': {
        const wood = this.mat('#3a2a1e', 0.5);
        B(W, 0.05, D, 0, 0.75, 0, wood);
        for (const dx of [-W / 2 + 0.04, W / 2 - 0.04]) B(0.05, 0.75, D - 0.04, dx, 0.375, 0, this.mat('#1a1a1c', 0.4, 0.4));
        // Monitor, keyboard, mouse, a tower, a lamp: obviously the computer.
        B(0.62, 0.38, 0.03, -0.05, 1.1, -D / 2 + 0.12, this.mat('#111', 0.3, 0.3), false);
        B(0.58, 0.34, 0.01, -0.05, 1.1, -D / 2 + 0.14, this.mat('#0a1220', 0.2, 0, { emissive: 0x4a8aff, emissiveIntensity: 0.75 }), false);
        B(0.06, 0.14, 0.06, -0.05, 0.85, -D / 2 + 0.12, this.mat('#111', 0.3, 0.3), false);
        B(0.42, 0.02, 0.14, -0.05, 0.785, 0.06, this.mat('#1a1a1c', 0.5), false);
        B(0.06, 0.02, 0.1, 0.25, 0.785, 0.08, this.mat('#1a1a1c', 0.5), false);
        B(0.2, 0.42, 0.42, W / 2 - 0.16, 0.21, 0, this.mat('#1a1a1c', 0.4, 0.3));
        B(0.01, 0.08, 0.02, W / 2 - 0.06, 0.36, 0.2, this.mat('#40ff90', 0.3, 0, { emissive: 0x40ff90, emissiveIntensity: 1.2 }), false);
        C(0.18, 0.2, 0.06, -0.05, 0.5, D / 2 + 0.3, this.mat('#1a1a1c', 0.8), 14);
        C(0.03, 0.03, 0.45, -0.05, 0.22, D / 2 + 0.3, this.mat('#2a2a2e', 0.4, 0.6), 8);
        break;
      }
      case 'coach_board': {
        B(0.9, 0.6, 0.03, 0, 1.5, 0, this.mat('#f4f4f0', 0.4), false);
        B(0.94, 0.64, 0.02, 0, 1.5, -0.01, this.mat('#8a8e94', 0.3, 0.7), false);
        const t = signTexture('TRAINING PLAN', '#f4f4f0', '#1f4fa8', { w: 256, h: 64 });
        this.panel(0.8, 0.2, p.x, 1.66, new THREE.MeshStandardMaterial({ map: t }), p.z - this.back + 0.03);
        break;
      }
      case 'staircase': {
        // A flight of stairs up to the landing against the back wall, with a banister along the open side.
        const tread = this.mat(c ?? '#8a6040', 0.55);
        const riser = this.mat('#f0ece2', 0.7);
        const steps = 12;
        for (let i = 0; i < steps; i++) {
          const x = -W / 2 + (W / steps) * (i + 0.5);
          B(W / steps + 0.01, 0.04, D, x, 0.21 * (i + 1), 0, tread, false);
          B(0.02, 0.21, D, x - W / steps / 2, 0.21 * (i + 0.5), 0, riser, false);
        }
        // Stringer and the wall it's against.
        const string = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(W, 2.52), 0.22, 0.05), riser);
        string.rotation.z = Math.atan2(2.52, W);
        string.position.set(0, 1.2, D / 2);
        g.add(string);
        const rail = this.mat('#3a2416', 0.4);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(W, 2.52), 0.06, 0.06), rail);
        bar.rotation.z = Math.atan2(2.52, W);
        bar.position.set(0, 2.15, D / 2);
        g.add(bar);
        for (let i = 0; i <= steps; i += 2) B(0.03, 0.9, 0.03, -W / 2 + (W / steps) * i, 0.21 * i + 0.45, D / 2, riser, false);
        B(0.12, 1.2, 0.12, -W / 2, 0.6, D / 2, rail);
        break;
      }
      case 'agent_board': {
        // An estate agent's board on a post: FOR SALE, TO LET, SOLD, LET BY.
        const text = p.label ?? 'FOR SALE';
        const sold = /SOLD|LET BY|^LET/.test(text);
        const t = signTexture(text, sold ? '#b3121b' : '#16365a', '#ffffff', { w: 384, h: 256 });
        B(0.08, 2.0, 0.08, 0, 1.0, 0, this.mat('#e8e4dc', 0.6));
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.03), [this.mat('#e8e4dc', 0.6), this.mat('#e8e4dc', 0.6), this.mat('#e8e4dc', 0.6), this.mat('#e8e4dc', 0.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), this.mat('#e8e4dc', 0.6)]);
        board.position.set(0, 1.9, 0.06);
        board.castShadow = true;
        g.add(board);
        break;
      }
      case 'jewel_bust': {
        // A velvet display bust with a chain on it, on a small plinth.
        const velvet = this.mat(c ?? '#1a1a22', 0.95);
        B(W, 0.9, D, 0, 0.45, 0, this.mat('#e8e4dc', 0.3));
        C(0.05, 0.07, 0.25, 0, 1.03, 0, velvet, 12);
        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), velvet);
        chest.scale.set(1.2, 1, 0.6);
        chest.rotation.x = Math.PI;
        chest.position.y = 1.22;
        g.add(chest);
        const gold = this.mat('#d8b04a', 0.18, 0.95, { emissive: 0x6a5010, emissiveIntensity: 0.6 });
        const ch = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 24, Math.PI), gold);
        ch.rotation.z = Math.PI;
        ch.position.set(0, 1.2, 0.07);
        g.add(ch);
        break;
      }
      case 'stairwell': {
        // A hole in the garage floor with a steel balustrade, and stairs dropping away to the back.
        const concrete = this.mat('#8a8884', 0.9);
        const n = 8;
        for (let i = 0; i < n; i++) {
          const d = (D * 0.9) / n;
          B(W - 0.1, 0.05, d + 0.02, 0, -0.18 * (i + 1), D / 2 - 0.05 - d * (i + 0.5), concrete, false);
          B(W - 0.1, 0.18, 0.02, 0, -0.18 * (i + 0.5), D / 2 - 0.05 - d * i, this.mat('#6a6864', 0.95), false);
        }
        // Side walls of the stairwell going down.
        for (const dx of [-W / 2, W / 2]) B(0.05, 1.5, D, dx, -0.75, 0, this.mat('#6a6864', 0.95), false);
        // Hazard nosing, rail and posts.
        B(W, 0.03, 0.06, 0, 0.015, D / 2 - 0.03, this.mat('#e8c020', 0.6, 0, { emissive: 0x5a4a00, emissiveIntensity: 0.3 }), false);
        const rail = this.mat('#c8c8c8', 0.25, 0.85);
        for (const dx of [-W / 2 + 0.03, W / 2 - 0.03]) {
          for (const dz of [-D / 2 + 0.05, 0, D / 2 - 0.15]) C(0.02, 0.02, 1.0, dx, 0.5, dz, rail, 8);
          B(0.04, 0.04, D - 0.1, dx, 1.0, -0.05, rail, false);
          B(0.02, 0.02, D - 0.1, dx, 0.5, -0.05, rail, false);
        }
        B(W - 0.06, 0.04, 0.04, 0, 1.0, -D / 2 + 0.05, rail, false);
        // A warm light down the well.
        const glow = this.mat('#fff4d8', 0.3, 0, { emissive: 0xffd8a0, emissiveIntensity: 1.2 });
        B(0.3, 0.06, 0.1, 0, -1.0, -D / 2 + 0.06, glow, false);
        break;
      }
      case 'security_post': {
        // A CCTV post (security set) at its real height: cameras, lamp and junction boxes up the pole.
        const m = securityPiece((p.item ?? 'post_high') as SecurityModelId, 1, { turn: -(p.rot ?? 0) * (Math.PI / 2) });
        if (m) g.add(m);
        break;
      }
      case 'hydro_prop': {
        // Hydroponics dressing (HydroLibrary), at its real size; nothing until the pack loads.
        const m = hydroPiece((p.item ?? 'cannabis_plant') as HydroModelId, 0, 0, 0, { native: true, turn: -(p.rot ?? 0) * (Math.PI / 2) });
        if (m) g.add(m);
        break;
      }
      case 'gym_prop': {
        // Benches, plate stacks and loose dumbbells dressing the gyms; nothing until the models load.
        this.gym(g, (p.item ?? 'flat_bench') as GymModelId, W, 1.2, D, { keepAspect: true });
        break;
      }
      case 'boxing_ring': {
        B(W, 0.35, D * 2, 0, 0.175, 0, this.mat('#1f3a6a', 0.7));
        B(W - 0.1, 0.03, D * 2 - 0.1, 0, 0.36, 0, this.mat('#e8e4dc', 0.9), false);
        for (const dx of [-W / 2 + 0.06, W / 2 - 0.06]) for (const dz of [-D + 0.06, D - 0.06]) C(0.05, 0.05, 1.3, dx, 0.95, dz, this.mat(dx < 0 ? '#c81010' : '#1f4fa8', 0.4), 10);
        for (const y of [0.7, 1.0, 1.3]) {
          B(W - 0.12, 0.025, 0.025, 0, y, -D + 0.06, this.mat('#e8e4dc', 0.6), false);
          for (const dx of [-W / 2 + 0.06, W / 2 - 0.06]) B(0.025, 0.025, D * 2 - 0.12, dx, y, 0, this.mat('#e8e4dc', 0.6), false);
        }
        break;
      }
      case 'dojo_mat':
      case 'wrestling_mat': {
        const dojo = p.kind === 'dojo_mat';
        B(W, 0.05, D * 2, 0, 0.025, 0, this.mat(dojo ? '#c8b070' : '#1f4fa8', 0.9), false);
        if (dojo) {
          for (let x = -W / 2 + 0.9; x < W / 2; x += 0.9) B(0.02, 0.052, D * 2, x, 0.026, 0, this.mat('#9a8450', 0.9), false);
          B(W, 0.054, 0.08, 0, 0.027, -D + 0.04, this.mat('#7a1414', 0.9), false);
        } else {
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 40), this.mat('#e8c020', 0.8));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.055;
          g.add(ring);
        }
        break;
      }
      case 'gym_rack': {
        // Gloves, pads and skipping ropes on a wall rack.
        if (this.gym(g, 'glove_rack', W, 1.6, D, { keepAspect: true, z: -D / 2 + 0.12 })) break;
        const black = this.mat('#141416', 0.5, 0.3);
        for (const dx of [-W / 2 + 0.04, W / 2 - 0.04]) B(0.05, 1.6, D, dx, 0.8, 0, black);
        for (const y of [0.5, 1.0, 1.5]) B(W, 0.03, D, 0, y, 0, black, false);
        for (let i = 0; i < 6; i++) {
          const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.mat(['#c81010', '#1f4fa8', '#1a1a1a'][i % 3], 0.5));
          glove.scale.set(1, 0.8, 1.2);
          glove.position.set(-W / 2 + 0.2 + (i % 3) * 0.28, i < 3 ? 1.08 : 0.58, 0);
          g.add(glove);
        }
        break;
      }
      case 'basement_stairs': {
        // Timber stairs coming down the left wall, with a handrail and the door at the top.
        const tread = this.mat('#7a5a3a', 0.7);
        const n = 9;
        const rise = 0.18;
        for (let i = 0; i < n; i++) {
          const y = 0.18 + i * rise;
          B(W, 0.05, D / n + 0.05, 0, y, D / 2 - (i + 0.5) * (D / n), tread);
          B(W, 0.18, 0.02, 0, y - 0.1, D / 2 - i * (D / n), this.mat('#5a4028', 0.8), false);
        }
        for (const dx of [-W / 2 + 0.03, W / 2 - 0.03]) {
          const stringer = B(0.05, 0.3, Math.hypot(D, n * rise), dx, (n * rise) / 2 + 0.05, 0, this.mat('#5a4028', 0.8));
          stringer.rotation.x = Math.atan2(n * rise, D); // low at the front, up to the door at the back
        }
        const rail = B(0.05, 0.05, Math.hypot(D, n * rise), W / 2 + 0.05, (n * rise) / 2 + 0.95, 0, this.mat('#2a2a2e', 0.4, 0.6), false);
        rail.rotation.x = Math.atan2(n * rise, D);
        const steelDoor = this.level.facades[0]?.flags?.includes('security_door');
        // The door at the top: a worn timber door, or the steel one once it's fitted.
        const top = steelDoor ? null : doorPiece('stairs', 4242, 1.0, 2.1);
        if (top) {
          top.position.set(p.x, n * rise + 0.05, this.back + 0.02);
          this.group.add(top);
        } else {
          this.box(0.95, 2.05, 0.08, p.x, n * rise + 1.1, this.back + 0.06, steelDoor ? this.mat('#4a5058', 0.35, 0.8) : this.mat('#6a5038', 0.7), false);
          if (steelDoor) for (const y of [0.5, 1.0, 1.5]) this.box(0.9, 0.04, 0.03, p.x, n * rise + 0.1 + y, this.back + 0.11, this.mat('#2a2e34', 0.4, 0.8), false);
        }
        break;
      }
      case 'terminal_desk': {
        const pro = this.level.facades[0]?.flags?.some((f) => f === 'tier3' || f === 'lounge');
        B(W, 0.05, D, 0, 0.76, 0, this.mat(pro ? '#2a2a2e' : '#8a6a4a', 0.5));
        for (const dx of [-W / 2 + 0.04, W / 2 - 0.04]) B(0.05, 0.76, D - 0.04, dx, 0.38, 0, this.mat('#2a2a2e', 0.5, 0.4));
        // Laptop (or a pro monitor bank), always lit: it's the way in.
        B(0.36, 0.02, 0.25, -0.1, 0.795, 0.02, this.mat('#2a2a2e', 0.3, 0.5), false);
        const screen = B(0.36, 0.24, 0.015, -0.1, 0.92, -0.1, this.mat('#0a1018', 0.2, 0, { emissive: 0x40ff90, emissiveIntensity: 0.7 }), false);
        screen.rotation.x = -0.2;
        if (pro) for (const dx of [-0.45, 0.35]) B(0.4, 0.26, 0.03, dx, 1.12, -D / 2 + 0.05, this.mat('#0a1018', 0.2, 0, { emissive: 0x3a6aff, emissiveIntensity: 0.6 }), false);
        C(0.2, 0.22, 0.08, 0.1, 0.5, D / 2 + 0.25, this.mat('#1a1a1c', 0.8), 14);
        C(0.03, 0.03, 0.45, 0.1, 0.22, D / 2 + 0.25, this.mat('#2a2a2e', 0.4, 0.6), 8);
        break;
      }
      case 'junk': {
        const card = this.mat('#a8845a', 0.95);
        if (p.label === 'mattress') {
          const m = B(W * 2 * 0.45, 1.8, 0.25, 0, 0.9, -D / 2 + 0.2, this.mat('#c8bca0', 1));
          m.rotation.x = -0.12;
          B(0.6, 0.05, 0.8, 0.3, 0.03, 0.05, this.mat('#4a3a2a', 0.9));
          C(0.3, 0.3, 0.05, -0.4, 0.3, 0.1, this.mat('#2a2a2a', 0.9), 16).rotation.x = Math.PI / 2;
        } else if (p.label === 'tins') {
          for (let i = 0; i < 9; i++) C(0.11, 0.11, 0.22, -0.35 + (i % 3) * 0.3, 0.11 + Math.floor(i / 6) * 0.22, -0.3 + Math.floor(i / 3) % 2 * 0.35, this.mat(['#d8d4c8', '#7a8a9a', '#a85a3a'][i % 3], 0.6, 0.4), 12);
          B(0.9, 0.04, 0.5, 0, 0.5, -0.1, this.mat('#5a4a3a', 0.9));
        } else {
          for (let i = 0; i < 6; i++) {
            const b = B(0.55, 0.42, 0.45, -0.5 + (i % 3) * 0.5, 0.21 + Math.floor(i / 3) * 0.42, -0.05 + ((i * 7) % 3) * 0.05, card);
            b.rotation.y = ((i * 13) % 5 - 2) * 0.06;
          }
        }
        break;
      }
      case 'grow_shelf': {
        // Green Fingers' shelving, stocked with the hydroponics pack's kit (room kit or lighting, air and nutrients).
        if (hydroReady() && this.fitting(g, 'grow_shelf', W, 2.0, D)) {
          const stock: HydroModelId[][] = p.label === 'environment'
            ? [['water_pump', 'water_pump', 'fan', 'fan'], ['nutrient_bottles', 'nutrient_bottles', 'nutrient_bottles', 'ph_meter', 'ph_meter'], ['grow_light', 'grow_light'], ['nutrient_bottles', 'watering_can', 'nutrient_bottles']]
            : [['dwc_bucket', 'dwc_bucket', 'reservoir'], ['seedling_tray', 'seedling_tray', 'seedling_tray'], ['cannabis_plant', 'cannabis_plant', 'cannabis_plant', 'cannabis_plant'], ['harvest_crate', 'watering_can', 'strawberry_planter']];
          stock.forEach((row, l) => {
            const y = 0.12 + l * 0.48 + 0.0125;
            const slot = (W - 0.12) / row.length;
            row.forEach((id, k) => {
              const m = hydroPiece(id, slot - 0.06, 0.42, D - 0.08, { keepAspect: true });
              if (!m) return;
              m.position.set(-W / 2 + 0.06 + slot * (k + 0.5), y, 0.02);
              g.add(m);
            });
          });
          break;
        }
        const H = 2.0;
        for (const dx of [-W / 2 + 0.03, W / 2 - 0.03]) B(0.04, H, D, dx, H / 2, 0, this.mat('#e8ece8', 0.4, 0.3));
        B(W, H, 0.02, 0, H / 2, -D / 2 + 0.01, this.mat('#2a8a3a', 0.8), false);
        const cols = p.label === 'environment' ? ['#1a1a1c', '#c8ccd0', '#2a2a2e', '#e8e4dc'] : ['#1a1a1c', '#2a8a3a', '#e8e4dc', '#c8a870'];
        for (let l = 0; l < 4; l++) {
          const y = 0.12 + l * 0.48;
          B(W, 0.03, D, 0, y, 0, this.mat('#e8ece8', 0.4, 0.3), false);
          for (let k = 0; k < 4; k++) {
            const bw = 0.32 + (k % 2) * 0.08;
            B(bw, 0.3 - (k % 3) * 0.05, D - 0.08, -W / 2 + 0.25 + k * (W - 0.4) / 3.5, y + 0.17, 0, this.mat(cols[(k + l) % cols.length], 0.6));
          }
          // Price strip.
          B(W, 0.04, 0.01, 0, y - 0.02, D / 2 + 0.005, this.mat('#ffd23d', 0.6, 0, { emissive: 0x7a6a10, emissiveIntensity: 0.3 }), false);
        }
        break;
      }
      case 'tyre_stack': {
        const tyre = this.mat('#0f0f10', 0.95);
        for (let i = 0; i < 4; i++) {
          const t = new THREE.Mesh(new THREE.TorusGeometry(W / 2 - 0.1, 0.1, 8, 20), tyre);
          t.rotation.x = Math.PI / 2;
          t.position.set(0, 0.1 + i * 0.2, 0);
          t.castShadow = true;
          g.add(t);
        }
        break;
      }
      case 'bike_stand': {
        B(W, 0.12, D, 0, 0.06, 0, this.mat('#1a1a1c', 0.4, 0.5));
        B(W - 0.08, 0.02, D - 0.08, 0, 0.13, 0, this.mat('#e86a10', 0.5, 0, { emissive: 0xe86a10, emissiveIntensity: 0.25 }), false);
        break;
      }
      case 'roulette_table': {
        // The table and the wheel's bowl are a model; the numbered wheel and the layout are drawn on it.
        if (!this.fitting(g, 'roulette_table', W, 1.01, D)) {
          B(W, 0.08, D, 0, 0.82, 0, this.mat('#4a2a14', 0.5));
          B(W - 0.1, 0.02, D - 0.1, 0, 0.87, 0, this.mat('#1a5a2a', 1));
          for (const dx of [-W / 2 + 0.12, W / 2 - 0.12]) for (const dz of [-D / 2 + 0.12, D / 2 - 0.12]) C(0.05, 0.05, 0.8, dx, 0.4, dz, this.mat('#2a1a10', 0.5), 8);
          C(0.36, 0.3, 0.12, -W / 2 + 0.48, 0.94, 0, this.mat('#3a1a0a', 0.3, 0.2), 32).castShadow = false;
        }
        const wheel = C(0.3, 0.3, 0.03, -W / 2 + 0.48, 1.0, 0, this.rouletteMat(), 37);
        wheel.castShadow = false;
        C(0.03, 0.03, 0.12, -W / 2 + 0.48, 1.07, 0, this.mat('#c9a227', 0.2, 1), 8);
        const lay = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.1, D - 0.3), this.mat('#ffffff', 0.9, 0, { map: this.layoutTexture() }));
        lay.rotation.x = -Math.PI / 2;
        lay.position.set(0.35, 0.885, 0);
        g.add(lay);
        for (let i = 0; i < 5; i++) C(0.035, 0.035, 0.02 + (i % 3) * 0.02, 0.1 + i * 0.25, 0.9, -0.15 + (i % 2) * 0.3, this.mat(['#c81010', '#1f4fa8', '#1a1a1a', '#e8e4dc', '#2a8a3a'][i], 0.4), 12).castShadow = false;
        break;
      }
      case 'blackjack_table': {
        if (this.fitting(g, 'blackjack_table', 0, 0, 0, { native: true })) break;
        const top = C(W / 2, W / 2, 0.08, 0, 0.82, 0, this.mat('#4a2a14', 0.5), 40);
        top.scale.z = D / W;
        const felt = C(W / 2 - 0.06, W / 2 - 0.06, 0.02, 0, 0.87, 0, this.mat('#1a5a2a', 1), 40);
        felt.scale.z = D / W;
        felt.castShadow = false;
        C(0.08, 0.12, 0.8, 0, 0.4, 0, this.mat('#2a1a10', 0.5), 12);
        for (let i = 0; i < 5; i++) {
          const a = Math.PI * (0.15 + i * 0.175);
          const card = B(0.1, 0.005, 0.14, Math.cos(a) * W * 0.32, 0.885, Math.sin(a) * D * 0.3, this.mat('#f8f4ec', 0.6), false);
          card.rotation.y = a;
        }
        B(0.3, 0.12, 0.18, 0, 0.92, -D / 2 + 0.2, this.mat('#2a2a2e', 0.4), false);
        // Stools along the front.
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * W * 0.32;
          C(0.17, 0.17, 0.08, x, 0.68, D / 2 + 0.3, this.mat('#7a1414', 0.8), 14);
          C(0.03, 0.03, 0.66, x, 0.33, D / 2 + 0.3, this.mat('#c9a227', 0.2, 1), 8).castShadow = false;
        }
        break;
      }
      case 'casino_cage': {
        if (!this.fitting(g, 'casino_cage', 0, 0, 0, { native: true })) {
          B(W, 1.0, D, 0, 0.5, 0, this.mat('#2a1a10', 0.4));
          B(W, 0.05, D + 0.05, 0, 1.02, 0, this.mat('#c9a227', 0.2, 0.9));
          for (let x = -W / 2 + 0.1; x <= W / 2 - 0.05; x += 0.12) B(0.015, 1.2, 0.015, x, 1.62, D / 2 - 0.05, this.mat('#c9a227', 0.2, 0.9), false);
          B(W, 0.08, D, 0, 2.25, 0, this.mat('#2a1a10', 0.4), false);
        }
        const t = signTexture('CASHIER', '#1a0a04', '#ffd23d', { w: 512, h: 96 });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.26), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7 }));
        sign.position.set(0, 2.42, D / 2 + 0.012);
        g.add(sign);
        break;
      }
      case 'prize_podium': {
        const base = C(W / 2, W / 2 + 0.1, 0.25, 0, 0.125, 0, this.mat('#1a1a1c', 0.25, 0.6), 48);
        base.scale.z = D / W;
        const ring = C(W / 2 + 0.02, W / 2 + 0.02, 0.04, 0, 0.25, 0, this.mat('#c9a227', 0.2, 0.9, { emissive: 0xc9a227, emissiveIntensity: 0.5 }), 48);
        ring.scale.z = D / W;
        ring.castShadow = false;
        const t = signTexture('WIN THIS MOTOR', '#3a0e14', '#ffd23d', { w: 1024, h: 128, neon: true });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 }));
        sign.position.set(0, 2.55, -D + 0.1);
        g.add(sign);
        break;
      }
      default:
        // Anything without a model yet still shows its collision box, so you never bump into thin air.
        B(W || 0.3, 1, D || 0.3, 0, 0.5, 0, this.mat(c ?? '#5a5e64', 0.7));
    }
  }

  /** Furniture and vehicles from the catalogues (propModels.ts). */
  private buildModelProp(p: PropDef): void {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    this.group.add(g);
    const rot = p.rot ?? 0;
    if (p.kind === 'gym_kit') {
      const m = buildGymKitModel(p.item ?? '');
      g.add(m);
      if (p.plinth && p.item !== 'speed_ball' && p.item !== 'bag') {
        const [hx, hz] = propHalf(p);
        const r = Math.max(hx, hz) + 0.12;
        const plinth = this.cyl(r, r + 0.04, 0.08, 0, 0.04, 0, this.mat('#2a2c30', 0.3, 0.3), 32, g);
        plinth.scale.z = (hz + 0.15) / r;
        plinth.castShadow = false;
        m.position.y = 0.08;
      }
      if (p.item === 'speed_ball') g.position.z = this.back + 0.25;
      return;
    }
    if (p.kind === 'equipment') {
      const def = EQUIPMENT[p.item ?? ''];
      const m = buildEquipmentModel(p.item ?? '', p.label);
      g.add(m);
      g.rotation.y = -rot * (Math.PI / 2);
      if (def?.mount === 'wall') g.position.z = this.back + def.size[1] + 0.01;
      else if (p.plinth) {
        const r = Math.max(def?.size[0] ?? 0.5, def?.size[1] ?? 0.5) + 0.12;
        const plinth = this.cyl(r, r + 0.04, 0.08, 0, 0.04, 0, this.mat('#e8ece8', 0.2, 0.2), 32, g);
        plinth.scale.z = ((def?.size[1] ?? 0.5) + 0.15) / r;
        plinth.castShadow = false;
        m.position.y = 0.08;
      }
      return;
    }
    if (p.kind === 'furniture') {
      const m = buildFurnitureModel(p.item ?? '', p.colour);
      g.add(m);
      g.rotation.y = -rot * (Math.PI / 2);
      if (p.wallY !== undefined) {
        // Wall pieces hang flat on the back wall, whatever the room's depth.
        const d = FURNITURE[p.item ?? '']?.size[1] ?? 0.05;
        g.position.z = this.back + d + 0.01;
      }
      return;
    }
    const isCar = !!CARS[p.item ?? ''];
    const model = buildVehicleModel(p.item ?? '', p.colour);
    g.add(model);
    g.rotation.y = -rot * (Math.PI / 2);
    const [hx, hz] = propHalf(p);
    if (p.label === 'podium') {
      model.position.y = 0.27;
      this.spinners.push(g);
    } else if (p.plinth) {
      const plinth = this.cyl(Math.max(hx, hz) + 0.15, Math.max(hx, hz) + 0.2, 0.12, 0, 0.06, 0, this.mat('#e8e8ec', 0.15, 0.3), 40, g);
      plinth.scale.z = (hz + 0.25) / (Math.max(hx, hz) + 0.2);
      plinth.castShadow = false;
      model.position.y = 0.12;
      const glow = this.cyl(Math.max(hx, hz) + 0.21, Math.max(hx, hz) + 0.21, 0.02, 0, 0.005, 0, this.mat('#ffffff', 0.5, 0, { emissive: isCar ? 0x6aa0ff : 0xff9a3a, emissiveIntensity: 0.8 }), 40, g);
      glow.scale.z = plinth.scale.z;
      glow.castShadow = false;
    } else if (!isCar && p.solid === false) {
      // A parked bike leans on its stand.
      model.rotation.x = -0.12;
    }
  }

  private dynamic = new Map<string, THREE.Object3D[]>();
  /** Meshes each level prop was built into (so one can be hidden mid-visit). */
  private propObjects = new Map<PropDef, THREE.Object3D[]>();

  /** Switch this district's own sky and key lights on or off. Districts streamed in beside the one you are in keep theirs off. */
  setActive(on: boolean): void {
    this.lightRig.visible = on;
  }

  hideProp(p: PropDef): void {
    for (const o of this.propObjects.get(p) ?? []) o.visible = false;
  }

  /** Add a prop after the level is built (a bike parked mid-visit). Replaces any with the same key. */
  addDynamicProp(key: string, p: PropDef): void {
    this.removeDynamicProp(key);
    const before = new Set(this.group.children);
    this.buildProp(p);
    this.dynamic.set(key, this.group.children.filter((c: THREE.Object3D) => !before.has(c)));
  }

  removeDynamicProp(key: string): void {
    const list = this.dynamic.get(key);
    if (!list) return;
    for (const o of list) {
      this.group.remove(o);
      disposeGroup(o);
    }
    this.dynamic.delete(key);
  }

  /** Things that turn slowly (the casino podium). */
  private spinners: THREE.Object3D[] = [];
  private ghost: THREE.Group | null = null;
  private ghostOk: THREE.MeshBasicMaterial | null = null;
  private ghostBad: THREE.MeshBasicMaterial | null = null;

  /** The placement editor's see-through preview: green where it fits, red where it doesn't. */
  setGhost(item: string | null, colour: string, at: { x: number; z: number; rot: number } = { x: 0, z: 0, rot: 0 }, ok = true): void {
    if (!item) {
      if (this.ghost) this.group.remove(this.ghost);
      this.ghost = null;
      return;
    }
    if (!this.ghostOk) {
      this.ghostOk = new THREE.MeshBasicMaterial({ color: 0x3aff7a, transparent: true, opacity: 0.45, depthWrite: false });
      this.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.45, depthWrite: false });
    }
    if (!this.ghost || this.ghost.userData.item !== item) {
      if (this.ghost) this.group.remove(this.ghost);
      const g = new THREE.Group();
      const m = buildAnyModel(item, colour);
      m.traverse((o: THREE.Object3D) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = false;
          o.userData.shared = true;
        }
      });
      g.add(m);
      // A footprint outline on the floor so you can see exactly where it sits.
      const def = FURNITURE[item] ?? EQUIPMENT[item];
      if (def && def.mount !== 'wall') {
        const foot = new THREE.Mesh(new THREE.PlaneGeometry(def.size[0] * 2, def.size[1] * 2), this.ghostOk);
        foot.rotation.x = -Math.PI / 2;
        foot.position.y = 0.02;
        foot.userData.foot = true;
        g.add(foot);
      }
      g.userData.item = item;
      this.ghost = g;
      this.group.add(g);
    }
    const g = this.ghost;
    const def = FURNITURE[item] ?? EQUIPMENT[item];
    g.position.set(at.x, 0, def?.mount === 'wall' ? this.back + (def.size[1] ?? 0.05) + 0.01 : at.z);
    g.rotation.y = def?.mount === 'wall' ? 0 : -at.rot * (Math.PI / 2);
    const m = ok ? this.ghostOk! : this.ghostBad!;
    g.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.material = m;
    });
  }

  private rouletteTex: THREE.Material | null = null;
  private rouletteMat(): THREE.Material {
    if (this.rouletteTex) return this.rouletteTex;
    const [c, g] = canvas(256, 256);
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const order = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    for (let i = 0; i < 37; i++) {
      const a0 = (i / 37) * Math.PI * 2;
      const a1 = ((i + 1) / 37) * Math.PI * 2;
      g.fillStyle = order[i] === 0 ? '#1a8a3a' : reds.has(order[i]) ? '#b81414' : '#111';
      g.beginPath();
      g.moveTo(128, 128);
      g.arc(128, 128, 126, a0, a1);
      g.fill();
    }
    g.fillStyle = '#5a3a1a';
    g.beginPath();
    g.arc(128, 128, 70, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9a227';
    g.beginPath();
    g.arc(128, 128, 22, 0, Math.PI * 2);
    g.fill();
    this.rouletteTex = new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.3, metalness: 0.2 });
    return this.rouletteTex;
  }

  private layoutTex: THREE.CanvasTexture | null = null;
  private layoutTexture(): THREE.CanvasTexture {
    if (this.layoutTex) return this.layoutTex;
    const [c, g] = canvas(512, 160);
    g.fillStyle = '#1a5a2a';
    g.fillRect(0, 0, 512, 160);
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    g.strokeStyle = '#f0eee8';
    g.lineWidth = 2;
    g.font = 'bold 16px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let n = 1; n <= 36; n++) {
      const col = Math.floor((n - 1) / 3);
      const row = 2 - ((n - 1) % 3);
      const x = 40 + col * 38;
      const y = 8 + row * 40;
      g.fillStyle = reds.has(n) ? '#b81414' : '#111';
      g.fillRect(x, y, 38, 40);
      g.strokeRect(x, y, 38, 40);
      g.fillStyle = '#f0eee8';
      g.fillText(String(n), x + 19, y + 20);
    }
    g.fillStyle = '#1a8a3a';
    g.fillRect(4, 8, 36, 120);
    g.strokeRect(4, 8, 36, 120);
    g.fillStyle = '#f0eee8';
    g.fillText('0', 22, 68);
    this.layoutTex = toTexture(c);
    return this.layoutTex;
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

  /**
   * The line between two districts of the long street. Nothing is drawn when the way is open;
   * when the story still has it shut, a row of barriers stands across the pavement and the road.
   */
  private buildSeam(ex: ExitDef): void {
    if (!ex.requires && !ex.requiresAll) return;
    const g = new THREE.Group();
    const { minZ, maxZ } = this.level.bounds;
    const x = ex.x + (ex.side === 'left' ? 0.35 : -0.35);
    const red = this.mat('#c0262a', 0.6);
    const white = this.mat('#ecebe6', 0.6);
    const leg = this.mat('#2a2d33', 0.5, 0.5);
    for (let z = minZ + 0.5; z <= maxZ + 0.01; z += 1.25) {
      for (let k = 0; k < 5; k++) this.box(0.07, 0.2, 0.22, x, 0.95, z - 0.44 + k * 0.22, k % 2 ? white : red, true, g);
      this.box(0.06, 0.95, 0.06, x, 0.47, z - 0.45, leg, true, g);
      this.box(0.06, 0.95, 0.06, x, 0.47, z + 0.45, leg, true, g);
      this.box(0.4, 0.05, 0.08, x, 0.03, z - 0.45, leg, false, g);
      this.box(0.4, 0.05, 0.08, x, 0.03, z + 0.45, leg, false, g);
    }
    g.visible = exitLocked(ex, this.progress);
    this.group.add(g);
    this.seamBlocks.push({ exit: ex, group: g });
  }

  private buildExit(ex: ExitDef): void {
    if (ex.seam) return this.buildSeam(ex);
    if (ex.kind === 'door') {
      const z = this.back + 0.05;
      // The building already has a real doorway here: just sign it.
      const kitDoor = this.kitDoors.find((d) => Math.abs(d - ex.x) <= 1.2);
      if (kitDoor !== undefined) {
        // Under the shop's own board where there is one, not over it.
        const board = this.street?.signs.find((s) => s.y > 3 && Math.abs(s.x - kitDoor) < s.w / 2 + 0.6);
        this.exitSign(ex, kitDoor, board ? board.y - board.h / 2 - 0.3 : 3.25, this.back + 0.35);
        return;
      }
      // A real door on the wall behind the door point (DoorLibrary); the old lit doorway until the doors load.
      const isStairs = ex.id.includes('stairs') || ex.id.includes('steps');
      // Stairs drawn as a model (the stairwell in the garage floor, the basement stairs with their own door at the top): just sign them.
      if (isStairs && this.level.props.some((p) => (p.kind === 'stairwell' || p.kind === 'basement_stairs') && Math.abs(p.x - ex.x) < 1.6)) {
        this.exitSign(ex, ex.x, 2.75, z + 0.12);
        return;
      }
      const indoors = themeProfile(this.level.theme).interior;
      // Stairways are an open way through, never a door.
      if (!isStairs && this.door(indoors ? 'interior' : 'service', ex.x, 1.15, 2.25, 0.03)) {
        this.exitSign(ex, ex.x, 2.75, z + 0.12);
        return;
      }
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
    // Boards only for places worth finding (shops, gyms, the pub, story routes); ordinary doors,
    // stairs and the way back out go unlabelled. The prompt still says where a door goes.
    if (ex.kind === 'door' && !isPoiExit(ex)) return;
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
    const indoor = !this.street && (prof.interior || prof.roofed);
    // The kit's colours are painted for plain daylight; at night they need a little more sky to read.
    const rig = this.lightRig;
    rig.add(new THREE.HemisphereLight(indoor ? 0x8a8070 : this.street ? 0x6f7a9c : 0x55607e, this.street ? 0x2a2420 : 0x14100c, indoor ? 1.1 : this.street ? 1.25 : 0.9));
    const front = new THREE.DirectionalLight(0xffd2a8, indoor ? 0.6 : this.street ? 0.9 : 0.75);
    front.position.set(2, 3, 12);
    rig.add(front);
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
    rig.add(this.sun, this.sun.target);
    this.shadowLights.push(this.sun);

    if (this.street) {
      // Kit streets: the lamp posts are models in the plan, and the renderer's shared pool does the lighting.
      for (const l of this.level.lights) this.lampSpecs.push({ x: l.x, y: l.y, z: l.z, colour: l.colour, intensity: l.intensity, range: l.range ?? 12 });
      return;
    }
    for (const l of this.level.lights) {
      // Rooms are small and pale: their lamps run softer, so walls and paintwork don't burn out white.
      const power = l.intensity * (prof.interior ? 0.72 : 1);
      const light = new THREE.PointLight(l.colour, power, l.range ?? 12, 1.6);
      light.position.set(l.x, l.y, l.z);
      g.add(light);
      this.flicker.push({ light, base: power });
      if (prof.interior) {
        // Ceiling lampshade.
        this.cyl(0.01, 0.01, 0.4, l.x, 2.8, l.z, this.mat('#222'), 6);
        this.cyl(0.12, 0.25, 0.22, l.x, 2.5, l.z, this.mat('#f0e0c0', 0.8, 0, { emissive: l.colour, emissiveIntensity: 0.45 }), 16);
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
    for (const sp of this.spinners) sp.rotation.y = time * 0.25;
    for (const b of this.seamBlocks) b.group.visible = exitLocked(b.exit, world.progress);
    this.dressing?.update(time, camX);
    if (this.foreCars.length) {
      const pl = world.player.pos;
      for (const c of this.foreCars) fadeCar(c.car, pl.z < c.z - c.hz + 0.2 && Math.abs(pl.x - c.x) < c.hx + 0.6 ? 0.22 : 1, dt);
    }
    if (this.fadeWalls.length) {
      const px = world.player.pos.x;
      for (const w of this.fadeWalls) {
        const target = Math.abs(px - w.x) < 1.8 ? 0.08 : 0.45;
        w.mat.opacity += (target - w.mat.opacity) * Math.min(1, dt * 6);
      }
    }
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
      // Centre it on the ring and rest it on the floor, whatever its shape.
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(w);
      w.position.x -= (b.min.x + b.max.x) / 2;
      w.position.y += 0.01 - b.min.y;
      return g;
    }
    const spin = new THREE.Group();
    // Watches, phones, keys and sunglasses are modelled, and so are food, groceries, materials,
    // collectibles and quest items (by Game id): show the real thing turning over.
    const model = def ? (lootModel(id) ?? lootModel(def.icon)) : null;
    if (model) {
      model.rotation.x = 0.5;
      spin.add(model);
      const glow3 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: rarity, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
      glow3.position.z = -0.12;
      spin.add(glow3);
      g.add(spin);
      g.userData.spin = spin;
      return g;
    }
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
    this.dressing?.dispose();
    this.kitView?.dispose();
    disposeGroup(this.group);
  }
}

/**
 * Rooms and shops in the low-poly look: every surface with a painted texture (plaster, boards, tiles,
 * brick, carpet) becomes its texture's average colour, flat-shaded like the street kits. Anything
 * carrying words or pictures that must be read (signs, glowing displays) keeps its texture, as do the
 * shared prop models, the characters and anything lit by its own map.
 */
const flatColour = new WeakMap<THREE.Texture, THREE.Color | null>();
function averageColour(t: THREE.Texture): THREE.Color | null {
  if (flatColour.has(t)) return flatColour.get(t)!;
  let out: THREE.Color | null = null;
  const img = t.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (img && img.width && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (g) {
      g.drawImage(img, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        gg += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      out = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
    }
  }
  flatColour.set(t, out);
  return out;
}

function flattenTextures(root: THREE.Object3D): void {
  const done = new Set<THREE.Material>();
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o.userData.shared) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const sm = m as THREE.MeshStandardMaterial;
      if (done.has(sm) || !sm.isMeshStandardMaterial || !sm.map || sm.emissiveMap || sm.userData.keepMap || sm.map.userData.text) continue;
      if (!(sm.map as THREE.CanvasTexture).isCanvasTexture) continue;
      const avg = averageColour(sm.map);
      if (!avg) continue;
      done.add(sm);
      sm.color.multiply(avg);
      sm.map.dispose();
      sm.map = null;
      sm.needsUpdate = true;
    }
  });
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

/** A door that leads somewhere worth a sign: a business, a club, or a route the story opens. */
export function isPoiExit(ex: ExitDef): boolean {
  // Someone's front door: the agent's board outside says whether it's for sale or let.
  if (ex.to === 'property') return false;
  if (ex.shop || ex.requires || ex.requiresAll?.length) return true;
  return /^(Into |Upstairs: |Through |Walkway |Down to )/.test(ex.label);
}
