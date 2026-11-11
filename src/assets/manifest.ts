/**
 * Every file the game loads at run time, in one place.
 *
 * Nearly everything on screen is still built in code. As modelled, painted and
 * recorded assets arrive they are listed here, each with the built-in version
 * it replaces. If a file is missing, slow, broken, or switched off with
 * `?assets=builtin`, the game uses that built-in version instead, so a bad
 * asset can never stop the game from running.
 */
export type AssetKind = 'model' | 'texture' | 'audio';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  url: string;
  /** Rough download size, used to weight the loading bar. */
  bytes: number;
  /** `boot` loads before the menu; anything else loads when that area or feature is first needed. */
  group: string;
  /** What the game uses when this file isn't available. */
  fallback: string;
  /** Where it came from and under what terms. */
  source: string;
}

export const ASSETS: AssetEntry[] = [
  {
    id: 'character_male',
    kind: 'model',
    url: '/models/character_male.glb',
    bytes: 3_986_068,
    group: 'boot',
    fallback: 'Procedural capsule rig (CharacterRig.ts, buildClassicRig)',
    source: 'Quaternius Universal Base Characters, CC0; converted in Blender (assets/quaternius-ubc/README.md)',
  },
  {
    id: 'character_female',
    kind: 'model',
    url: '/models/character_female.glb',
    bytes: 4_398_076,
    group: 'boot',
    fallback: 'Procedural capsule rig (CharacterRig.ts, buildClassicRig)',
    source: 'Quaternius Universal Base Characters, CC0; converted in Blender (assets/quaternius-ubc/README.md)',
  },
];

export const ASSET_BY_ID: Record<string, AssetEntry> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
