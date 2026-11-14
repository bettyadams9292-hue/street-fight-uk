/**
 * Property kit (public/models/property): original low-poly models made for Street Fight UK
 * (tools/models/property/*.py write them). The four Ashcombe Park mansions with their railings
 * and gates, the hall staircase, Keys & Co's boards and window display, the jeweller's necklace
 * bust, and the fittings for the big rooms: pool, cinema, conservatory, roof terrace and
 * dressing room.
 *
 * Every piece is drawn at its real size, front to +z. Until the files load, or if they can't,
 * LevelView keeps its built-in look for each of them.
 */
import * as THREE from 'three';
import { modelSet } from './modelSet';

export const PROPERTY_MODELS = [
  'mansion_georgian', 'mansion_stone', 'mansion_brick', 'mansion_modern',
  'railing_stone', 'railing_brick', 'gates_stone', 'gates_brick',
  'staircase', 'agent_board', 'agent_window', 'jewel_bust',
  'pool_basin', 'pool_lounger', 'cinema_screen', 'projector', 'cinema_seats',
  'conservatory_glazing', 'terrace_balustrade', 'terrace_deck', 'terrace_sofa', 'terrace_table',
  'wardrobe_wall', 'dressing_island',
] as const;
export type PropertyModelId = (typeof PROPERTY_MODELS)[number];

const kit = modelSet('property', '/models/property/', PROPERTY_MODELS);

/** Board artwork by what the board says, and the window display's header. */
const ART: Record<string, string> = {
  'FOR SALE': '/art/agent/board_for_sale.webp',
  'TO LET': '/art/agent/board_to_let.webp',
  SOLD: '/art/agent/board_sold.webp',
  'LET BY KEYS & CO': '/art/agent/board_let_by.webp',
  header: '/art/agent/window_header.webp',
};
const art = new Map<string, THREE.Texture>();

function loadTexture(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (t: THREE.Texture) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        t.userData.shared = true;
        resolve(t);
      },
      undefined,
      () => {
        console.warn(`[property] ${url} failed`);
        resolve(null);
      },
    );
  });
}

let loading: Promise<void> | null = null;
export function loadProperty(): Promise<void> {
  loading ??= (async () => {
    await Promise.all([
      kit.load(),
      ...Object.entries(ART).map(async ([k, url]) => {
        const t = await loadTexture(url);
        if (t) art.set(k, t);
      }),
    ]);
  })();
  return loading;
}

/** A property piece at its real size, or null until loaded. */
export function propertyPiece(id: PropertyModelId): THREE.Group | null {
  return kit.piece(id, 0, 0, 0, { native: true });
}

/** Modelled width of each mansion, front face at z = 0 (each is scaled to the plot it stands on). */
export const MANSION_WIDTH: Record<'georgian' | 'stone' | 'brick' | 'modern', number> = { georgian: 19.9, stone: 20.4, brick: 16.5, modern: 21.0 };

// ---- per-instance materials (cached, shared: they outlive any one level) ------------------------

const recoloured = new Map<string, THREE.MeshStandardMaterial>();
/** Give the parts made of material `name` this colour (e.g. the bust's velvet, the stair treads). */
function recolour(root: THREE.Object3D, name: string, colour: string): void {
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.isMesh ? (mesh.material as THREE.MeshStandardMaterial) : null;
    if (!m || m.name !== name) return;
    const key = `${m.uuid}|${colour}`;
    let c = recoloured.get(key);
    if (!c) {
      const n = m.clone() as THREE.MeshStandardMaterial;
      n.color.set(colour);
      n.userData.shared = true;
      recoloured.set(key, n);
      c = n;
    }
    mesh.material = c;
  });
}

const mapped = new Map<string, THREE.MeshStandardMaterial>();
/** Put a picture on the parts made of material `name` (white base so the picture shows true). */
function applyMap(root: THREE.Object3D, name: string, key: string, tex: THREE.Texture): void {
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.isMesh ? (mesh.material as THREE.MeshStandardMaterial) : null;
    if (!m || m.name !== name) return;
    const k = `${m.uuid}|${key}`;
    let c = mapped.get(k);
    if (!c) {
      const n = m.clone() as THREE.MeshStandardMaterial;
      n.color.set('#ffffff');
      n.map = tex;
      n.emissiveMap = m.emissive.getHex() ? tex : null;
      n.userData.shared = true;
      n.userData.keepMap = true;
      mapped.set(k, n);
      c = n;
    }
    mesh.material = c;
  });
}

/** The listing photos shown in the agent's window, loaded the first time the window is drawn. */
const WINDOW_LISTINGS = ['m_wyvern_hall', 'h_hollins_27', 'a_pinnacle_ph', 'f_kingsway_7', 'm_glasshouse', 'h_tanner_9'];
const photos = new Map<string, Promise<THREE.Texture | null>>();
function listingPhoto(id: string): Promise<THREE.Texture | null> {
  let p = photos.get(id);
  if (!p) photos.set(id, (p = loadTexture(`/art/property/${id}.webp`)));
  return p;
}

// ---- props ----------------------------------------------------------------------------------

/** Prop kinds this kit draws. */
export const PROPERTY_PROP_KINDS = new Set([
  'staircase', 'agent_board', 'agent_window', 'jewel_bust',
  'pool_basin', 'pool_lounger', 'cinema_screen', 'projector', 'cinema_seats',
  'conservatory_glazing', 'terrace_balustrade', 'terrace_deck', 'terrace_sofa', 'terrace_table',
  'wardrobe_wall', 'dressing_island',
]);

/**
 * Modelled footprint (width along x, depth along z) for pieces that stretch to fit their prop's size, and
 * whether the model's origin is at the wall behind it (so it's moved back to the prop's back edge).
 */
const FIT: Record<string, { w: number; d?: number; wall?: boolean; turn?: number; y?: number }> = {
  staircase: { w: 2.2, d: 1.0 },
  jewel_bust: { w: 0.44, d: 0.4 },
  pool_basin: { w: 5.6, d: 1.6 },
  pool_lounger: { w: 1.9 },
  cinema_screen: { w: 4.6, wall: true },
  cinema_seats: { w: 2.3, turn: Math.PI },
  conservatory_glazing: { w: 6.0, wall: true },
  terrace_balustrade: { w: 6.0, wall: true },
  terrace_deck: { w: 6.0, d: 3.8 },
  wardrobe_wall: { w: 3.4, d: 0.6 },
  dressing_island: { w: 1.6, d: 0.7 },
  projector: { w: 0.36, y: 2.46 },
};

/**
 * The model for a property prop, sized to its footprint W × D (metres) and centred on the prop,
 * or null to keep the built-in version (not loaded yet, or a board saying something with no artwork).
 */
export function propertyProp(kind: string, W: number, D: number, o: { colour?: string; label?: string } = {}): THREE.Object3D | null {
  if (!PROPERTY_PROP_KINDS.has(kind)) return null;
  if (kind === 'agent_board') {
    const tex = art.get(o.label ?? 'FOR SALE');
    if (!tex) return null;
    const p = propertyPiece('agent_board');
    if (p) applyMap(p, 'board_face', o.label ?? 'FOR SALE', tex);
    return p;
  }
  const p = propertyPiece(kind as PropertyModelId);
  if (!p) return null;
  const fit = FIT[kind];
  if (fit) {
    const inner = p.children[0];
    if (kind !== 'projector') inner.scale.set(W / fit.w, 1, fit.d ? D / fit.d : 1);
    if (fit.y) inner.position.y = fit.y;
    if (fit.turn) inner.rotation.y = fit.turn;
    if (fit.wall) inner.position.z = -D / 2;
  }
  if (kind === 'jewel_bust' && o.colour) recolour(p, 'velvet', o.colour);
  if (kind === 'staircase' && o.colour) recolour(p, 'tread', o.colour);
  if (kind === 'agent_window') {
    const header = art.get('header');
    if (header) applyMap(p, 'header', 'header', header);
    WINDOW_LISTINGS.forEach((id, i) =>
      void listingPhoto(id).then((t) => {
        if (t) applyMap(p, `photo_${i}`, id, t);
      }),
    );
  }
  return p;
}
