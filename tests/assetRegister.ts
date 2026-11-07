/**
 * Writes docs/ASSET_REGISTER.md from the game's own data, so "where it appears"
 * and collision sizes always match the levels. Run: npx tsx tests/assetRegister.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { WEAPON_IDS, WEAPONS } from '../src/combat/Weapons';
import { ARCHETYPES } from '../src/ai/archetypes';
import { BOSSES } from '../src/ai/bosses';
import { ACCESSORIES, BOTTOM_STYLES, SHOE_STYLES, TOP_STYLES } from '../src/character/Appearance';
import { ITEM_LIST } from '../src/items/items';
import { LOOT } from '../src/items/loot';
import { AREA_IDS } from '../src/progress/Progress';
import { PROP_SIZE, type FacadeKind, type PropKind } from '../src/world/LevelTypes';
import { LEVELS } from '../src/world/levels';

type Row = { name: string; file: string; appears: string; status: string; needs: string; replacement: string; material: string; animation: string; collision: string; checked: string };

const used = <K extends string>(get: (id: (typeof AREA_IDS)[number]) => K[]): Map<K, string[]> => {
  const m = new Map<K, string[]>();
  for (const id of AREA_IDS) for (const k of new Set(get(id))) m.set(k, [...(m.get(k) ?? []), id]);
  return m;
};
/** Weapons carried by enemy types, bosses, or left by smashed furniture. */
const weaponSources = (id: string): string[] => [
  ...Object.values(ARCHETYPES).filter((a) => a.weapon === id).map((a) => `${a.name} enemies`),
  ...Object.values(BOSSES).filter((b) => b.weapon === id || b.phases.some((ph) => ph.weapon === id)).map((b) => `${b.name} (boss)`),
  ...AREA_IDS.filter((a) => (LEVELS[a].breakables ?? []).some((b) => b.drops === id)).map((a) => `smashed furniture in ${a}`),
  ...Object.entries(LOOT).filter(([, t]) => JSON.stringify(t).includes(`"w_${id}"`)).map(([k]) => `${k} loot`),
  ...WEAPON_IDS.filter((w) => WEAPONS[w].breaksInto === id).map((w) => `what's left of a ${WEAPONS[w].name.toLowerCase()}`),
];
const where = (list: string[] | undefined) => (list?.length ? list.join(', ') : 'not placed in a level');

const propUse = used<PropKind>((id) => LEVELS[id].props.map((p) => p.kind));
const facadeUse = used<FacadeKind>((id) => LEVELS[id].facades.map((f) => f.kind));
const breakUse = used<string>((id) => (LEVELS[id].breakables ?? []).map((b) => b.kind));
const weaponLevelUse = used<string>((id) => [
  ...LEVELS[id].pickups.filter((p) => p.item?.startsWith('w_')).map((p) => p.item!.slice(2)),
  ...LEVELS[id].encounters.flatMap((e) => e.waves.flatMap((w) => w.enemies.map((x) => x.weapon).filter((x): x is NonNullable<typeof x> => !!x))),
]);

/** Props rebuilt in Stage 5 (everything else predates it and was kept). */
const STAGE5_PROPS = new Set<string>(['chest', 'dumpster', 'rubbish_bags', 'cardboard', 'abandoned_car', 'container', 'market_stall', 'turnstile', 'pillar', 'bike_rack', 'lamp_post', 'traffic_light', 'sign_post', 'bollard_row', 'bus', 'forklift', 'bollard_dock', 'crane_leg', 'kiosk', 'fountain', 'escalator', 'mall_planter', 'atm', 'vending', 'shop_rail', 'mannequin', 'display_cabinet', 'glass_counter', 'shop_counter', 'shop_shelf', 'changing_booth', 'bar', 'pool_table', 'pub_table', 'fruit_machine', 'jukebox', 'dj_booth']);
const STAGE5_FACADES = new Set<string>(['semi', 'precinct', 'mall', 'stand', 'leisure', 'dock', 'containers', 'market', 'car_park', 'ruin', 'platform', 'fortress', 'interior']);
const ANIMATED_PROPS: Partial<Record<string, string>> = { cone: 'none (static)', vending: 'lit panel', traffic_light: 'lit lamps', fruit_machine: 'lit reels', jukebox: 'glow' };

const rows: { section: string; intro: string; rows: Row[] }[] = [];

rows.push({
  section: 'Characters',
  intro: 'Fighters, bosses and shopkeepers use Quaternius\' Universal Base Characters (CC0; originals in assets/quaternius-ubc), converted in Blender to the game\'s 11-joint skeleton (public/models/character_male.glb, character_female.glb), so the existing pose animation drives them. The classic procedural rig remains as a fallback (?classic).',
  rows: [
    { name: 'Male and female bodies (Quaternius UBC, CC0)', file: 'public/models/character_male.glb, character_female.glb: Body', appears: 'player, all enemies, bosses, NPCs, creator, shop try-on', status: 'Replaced (third-party CC0 model)', needs: 'More body types (Regular/Teen are in the paid Source pack)', replacement: 'Quaternius Universal Base Characters: about 7.3k-vertex sculpted body, face, eyes, fists; 11-joint skin weights; muscle/weight shape keys', material: 'Pack skin texture + normal map, tinted to skin tone', animation: 'Game pose system drives the bones', collision: 'BODY_RADIUS capsule in the sim', checked: 'Integrated; guard pose rendered in Blender; live build to check' },
    { name: 'Hair, beard, eyebrows (Quaternius UBC, CC0)', file: 'character_*.glb: hair_*, beard, brows', appears: 'every fighter', status: 'Replaced (third-party CC0 model)', needs: 'More styles (afro, cornrows, mohawk, bob, ponytail) to match the creator', replacement: '6 pack hairstyles mapped to the 12 game styles; beard for moustache/goatee/beards', material: 'Pack hair texture, tinted to hair colour', animation: 'Head joint', collision: 'n/a', checked: 'Integrated; rendered in Blender' },
    { name: 'Headwear (cap, beanie, glasses, snood, mouthguard, headguard, earring, chain)', file: 'src/render/CharacterRig.ts buildHeadwear', appears: 'fighters wearing them', status: 'Kept (procedural, lined up on the model head)', needs: 'Modelled versions', replacement: '—', material: 'PBR', animation: 'Head joint', collision: 'n/a', checked: 'Integrated; not screenshot-checked on the new heads' },
    { name: 'Classic procedural rig', file: 'src/render/CharacterRig.ts', appears: 'fallback only (?classic, or if the model fails to load)', status: 'Kept as fallback', needs: '—', replacement: '—', material: 'PBR', animation: 'Pose system', collision: 'n/a', checked: 'Visually checked (Stage 4)' },
  ],
});

const clothing: Row[] = [];
for (const t of TOP_STYLES) clothing.push({ name: `Top: ${t}`, file: 'character_*.glb garments (top_long/short/vest/puffer, hood, collar, coat_skirt)', appears: 'character creator, shop, worn items, enemies', status: t === 'none' ? 'n/a' : 'Replaced (skinned Blender garment)', needs: 'Cloth folds, seams, printed details', replacement: 'Skinned garment cut from the Quaternius body, with its shape keys', material: 'PBR, roughness per fabric (leather 0.32, puffer 0.4, cotton 0.9)', animation: 'Rigid to bones', collision: 'n/a', checked: 'Integrated; Stage 5 tops not screenshot-checked' });
for (const b of BOTTOM_STYLES) clothing.push({ name: `Bottoms: ${b}`, file: 'src/render/CharacterRig.ts', appears: 'creator, shop, worn items', status: ['trackies', 'jeans', 'shorts'].includes(b) ? 'Kept' : 'New (Stage 5)', needs: 'Cloth folds', replacement: 'Cuffs, cargo pockets, knee pads, reflective strips', material: 'PBR', animation: 'Rigid to bones', collision: 'n/a', checked: 'Integrated; not screenshot-checked' });
for (const s of SHOE_STYLES) clothing.push({ name: `Shoes: ${s}`, file: 'src/render/CharacterRig.ts buildShoe', appears: 'creator, shop, worn items', status: s === 'runners' ? 'New (Stage 5)' : 'Kept', needs: 'Laces, tread', replacement: 'Upper, sole, collar/heel geometry', material: 'PBR', animation: 'Rigid to knee', collision: 'n/a', checked: 'Integrated' });
for (const a of ACCESSORIES) clothing.push({ name: `Accessory: ${a}`, file: 'src/render/CharacterRig.ts', appears: 'creator, shop, worn items, bosses', status: ['beanie', 'sunglasses', 'snood', 'ring', 'belt', 'mouthguard'].includes(a) ? 'New (Stage 5)' : 'Kept', needs: '—', replacement: 'Dedicated geometry on head, hands or hips', material: 'PBR; metals 0.9 metalness', animation: 'Rigid', collision: 'n/a', checked: 'Integrated' });
rows.push({ section: 'Clothing and accessories', intro: 'Every style the item system can put on a character has its own geometry.', rows: clothing });

rows.push({
  section: 'Weapons (melee and improvised only; no firearms)',
  intro: 'All 36 have a dedicated model in src/render/weaponMesh.ts (Stage 4 had 3 shapes shared by everything).',
  rows: WEAPON_IDS.map((id) => {
    const w = WEAPONS[id];
    return { name: w.name, file: `src/render/weaponMesh.ts (${id})`, appears: [...(weaponLevelUse.get(id) ?? []), ...weaponSources(id)].join(', ') || 'loot tables only', status: ['bottle', 'bat', 'pipe'].includes(id) ? 'Replaced (detail added)' : 'New (Stage 5)', needs: 'Wear decals', replacement: 'Procedural parts model', material: 'PBR (wood, steel, rubber, glass)', animation: 'Held in hand; spins when thrown', collision: `Reach ${w.light.reach ?? '—'} m via move hit spheres; ${w.throwable ? 'throwable' : 'not throwable'}${w.breaks ? `, breaks after ${w.durability}` : ''}`, checked: 'Integrated; type-checked; not screenshot-checked' };
  }),
});

rows.push({
  section: 'Props',
  intro: 'Collision boxes come from PROP_SIZE, the same table the renderer sizes each model from, so what you see is what you bump into.',
  rows: (Object.keys(PROP_SIZE) as PropKind[]).map((k) => {
    const [hx, hz] = PROP_SIZE[k];
    return { name: k, file: 'src/render/LevelView.ts buildProp', appears: where(propUse.get(k)), status: STAGE5_PROPS.has(k) ? 'New (Stage 5)' : 'Kept (Stage 3–4)', needs: 'Baked textures / higher-poly models', replacement: 'Procedural model', material: 'PBR, canvas textures where needed', animation: ANIMATED_PROPS[k] ?? 'none', collision: hx === 0 ? 'none' : `${(hx * 2).toFixed(2)} × ${(hz * 2).toFixed(2)} m box`, checked: STAGE5_PROPS.has(k) ? 'Integrated; not screenshot-checked' : 'Visually checked (Stage 4)' };
  }),
});

const facadeKinds: FacadeKind[] = ['terrace', 'shop', 'pub', 'tower', 'garages', 'warehouse', 'fence', 'hoarding', 'subway', 'office', 'club', 'house_front', 'room', 'semi', 'precinct', 'mall', 'stand', 'leisure', 'dock', 'containers', 'market', 'car_park', 'ruin', 'platform', 'fortress', 'interior'];
rows.push({
  section: 'Buildings and environment',
  intro: 'Facades are the back walls of the 2.5D play strip; ground, skyline, lighting and weather are per theme (src/render/themes.ts).',
  rows: [
    ...facadeKinds.map((k) => ({ name: `Facade: ${k}`, file: 'src/render/LevelView.ts', appears: where(facadeUse.get(k)), status: STAGE5_FACADES.has(k) ? 'New (Stage 5)' : 'Kept', needs: 'Modelled depth (window reveals, roofs) beyond the back plane', replacement: 'Procedural panels with canvas textures', material: 'Brick/concrete/tile/corrugated canvas textures, emissive windows and signs', animation: 'Lights flicker on streets', collision: 'Back wall of the walkable band', checked: STAGE5_FACADES.has(k) ? 'Integrated; not screenshot-checked' : 'Visually checked (Stage 4)' })),
    { name: 'Ground per theme', file: 'src/render/LevelView.ts buildGround / interiorGround / roofedGround', appears: 'all 24 areas', status: 'Improved', needs: 'Normal maps', replacement: 'Paving, cobbles, concrete, markings, tiles, boards, carpet; quay and water at the docks', material: 'Canvas textures', animation: 'Water shimmer', collision: 'Level bounds', checked: 'Integrated' },
    { name: 'Rain', file: 'src/render/LevelView.ts buildWeather', appears: 'areas with weather: rain', status: 'New (Stage 5)', needs: 'Splashes, wet shading', replacement: '900 line-segment streaks following the camera', material: 'LineBasic', animation: 'Falls every frame', collision: 'n/a', checked: 'Integrated; not screenshot-checked' },
  ],
});

rows.push({
  section: 'World objects',
  intro: '',
  rows: [
    ...['crate', 'pallet', 'chair', 'table', 'tv', 'boxes', 'window', 'barrel'].map((k) => ({ name: `Breakable: ${k}`, file: 'src/render/LevelView.ts breakableMesh', appears: where(breakUse.get(k)), status: 'New (Stage 5)', needs: 'Physics debris', replacement: 'Whole model + debris model swapped when smashed', material: 'PBR', animation: 'Shakes when hit', collision: '0.8 × 0.7 m, removed when broken', checked: 'Integrated; not screenshot-checked' })),
    { name: 'Ground items', file: 'src/render/LevelView.ts groundItemMesh', appears: 'anything dropped or placed', status: 'New (Stage 5)', needs: 'A 3D model per item instead of an icon card', replacement: 'Weapons use their 3D model; other items float as their icon with a rarity ring', material: 'Icon texture', animation: 'Bob, spin, landing bounce', collision: 'none (picked up by interact)', checked: 'Integrated; not screenshot-checked' },
    { name: `Item icons (${ITEM_LIST.length})`, file: 'src/ui/itemIcons.ts', appears: 'inventory, stash, shop, pawn, ground items', status: 'New (Stage 5)', needs: 'Painted or rendered artwork', replacement: 'Canvas-drawn icon per icon kind, tinted by item colour', material: '2D canvas', animation: 'none', collision: 'n/a', checked: 'Integrated; not screenshot-checked' },
    { name: 'Searchable container marker', file: 'src/render/LevelView.ts', appears: 'every container', status: 'New (Stage 5)', needs: '—', replacement: 'Small glint, orange if locked', material: 'Basic', animation: 'Pulses until searched', collision: 'n/a', checked: 'Integrated' },
  ],
});

const esc = (t: string) => t.replace(/\|/g, '/');
let md = `# Asset register\n\nGenerated by \`npx tsx tests/assetRegister.ts\` from the game data. Every visual asset is built in code: no external models or textures could be downloaded in the development environment, so nothing here is a GLB, a scanned texture or motion-captured. "Not screenshot-checked" means it is wired in and type-checks but has not been looked at in a running build.\n\n`;
const total = rows.reduce((n, s) => n + s.rows.length, 0);
md += `${total} assets across ${rows.length} groups.\n\n`;
for (const s of rows) {
  md += `## ${s.section} (${s.rows.length})\n\n${s.intro ? s.intro + '\n\n' : ''}`;
  md += '| Asset | File | Where it appears | Status | Still needs | Replacement / build | Material | Animation | Collision | Integrated / checked |\n|---|---|---|---|---|---|---|---|---|---|\n';
  for (const r of s.rows) md += `| ${[r.name, r.file, r.appears, r.status, r.needs, r.replacement, r.material, r.animation, r.collision, r.checked].map(esc).join(' | ')} |\n`;
  md += '\n';
}
mkdirSync('docs', { recursive: true });
writeFileSync('docs/ASSET_REGISTER.md', md);
console.log(`wrote docs/ASSET_REGISTER.md (${total} assets)`);
