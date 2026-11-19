/**
 * Home and shop furniture from the interior furniture pack (src/render/approved, `FURNITURE` batch).
 *
 * Each catalogue item (property/catalogue.ts FURNITURE) that has a fitting pack model is drawn with it: fitted to
 * the item's footprint (so collision, placement and the home editor behave exactly as before), its main fabric or
 * wood repainted in the colour the player chose. Items with no pack equivalent (TVs, rugs, appliances, bathroom
 * fittings, wall decor) keep their own models, and so do the eight bookcases the pack can't build yet.
 */
import * as THREE from 'three';
import { FURNITURE } from '../../property/catalogue';
import { prototype, repaint } from '../approved/prototype';
import { ASSETS as PACK } from '../approved/sources/furniture';

/** The pack's own colours (sRGB), as it picks them per variant: wood, upholstery (cloth) and cushions. */
const PALETTE = ['#a77a50', '#77533d', '#c3aa88', '#454b52', '#e5ded0', '#51645b', '#8b5151', '#2c3540', '#b6a088', '#8a7d6b'];
const VARIANT = new Map((PACK as readonly { id: string; variant: number }[]).map((a) => [a.id, a.variant]));

/** Catalogue item → pack model, and whether the colour choice is its fabric (upholstery) or its wood. */
export const PACK_FOR: Readonly<Record<string, { id: string; paint: 'fabric' | 'wood'; frame?: string }>> = {
  sofa_3: { id: 'f05_02', paint: 'fabric' },
  sofa_2: { id: 'f05_01', paint: 'fabric' },
  armchair: { id: 'f04_15', paint: 'fabric', frame: '#4a2e1a' },
  coffee_table: { id: 'f02_09', paint: 'wood' },
  tv_unit: { id: 'f03_12', paint: 'wood' },
  bed_double: { id: 'f06_03', paint: 'fabric' },
  bed_single: { id: 'f06_01', paint: 'fabric' },
  wardrobe2: { id: 'f03_01', paint: 'wood' },
  bedside: { id: 'f03_15', paint: 'wood' },
  drawers: { id: 'f03_13', paint: 'wood' },
  desk2: { id: 'f02_17', paint: 'wood' },
  dining_table: { id: 'f02_02', paint: 'wood' },
  dining_chair: { id: 'f04_01', paint: 'wood' },
  cupboard: { id: 'f03_16', paint: 'wood' },
  trophy_cab: { id: 'f03_10', paint: 'wood' },
};

const broken = new Set<string>();

/** The pack's model for a catalogue item, fitted and painted; null where there is none (the caller draws its own). */
export function packFurnitureModel(item: string, colour?: string): THREE.Group | null {
  const map = PACK_FOR[item];
  const def = FURNITURE[item];
  if (!map || !def || broken.has(map.id)) return null;
  let proto;
  try {
    proto = prototype(map.id);
  } catch {
    broken.add(map.id);
    return null;
  }
  const size = proto.box.getSize(new THREE.Vector3());
  const centre = proto.box.getCenter(new THREE.Vector3());
  const sx = (def.size[0] * 2) / size.x;
  const sz = (def.size[1] * 2) / size.z;
  // Height follows the footprint's stretch, but never by more than a fifth, so a sofa stays a sofa.
  const sy = Math.max(0.85, Math.min(1.2, Math.sqrt(sx * sz)));
  const paint = colour ?? def.colours[0];
  const g = new THREE.Group();
  g.name = `pack:${map.id}`;
  for (const part of proto.parts) {
    let geo = part.geometry;
    // The chosen colour goes on the pack's upholstery (a fabric piece) or its wood (a wooden one); a fabric piece's
    // cushions take a lighter shade of it, so it still reads in two tones.
    if (paint && geo.getAttribute('color')) {
      geo = geo.clone();
      const v = VARIANT.get(map.id) ?? 0;
      const at = (k: number) => PALETTE[(v + k) % PALETTE.length];
      const pairs: [string, string][] = map.paint === 'fabric'
        ? [[at(4), paint], [at(6), '#' + new THREE.Color(paint).lerp(new THREE.Color('#ffffff'), 0.25).getHexString()]]
        : [[at(0), paint]];
      if (map.frame) pairs.push([at(0), map.frame]);
      repaint(geo, pairs);
    }
    const mesh = new THREE.Mesh(geo, part.material);
    mesh.castShadow = !(part.material as THREE.Material).transparent;
    mesh.receiveShadow = true;
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(-centre.x * sx, -proto.box.min.y * sy, -centre.z * sz);
    g.add(mesh);
  }
  return g;
}
