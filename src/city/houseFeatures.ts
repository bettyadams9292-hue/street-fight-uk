/**
 * Measured from the city kit's house models (the front wall's top, the roof's top, and the flat tops of real
 * chimney stacks, in model space before the placement's stretch): where British detail fixes to each house.
 * Re-measure if the kit's houses change (the measuring script is in docs/OVERHAUL_AUDIT.md).
 */
export interface HouseFeatures {
  /** Top of the front wall: where the gutter runs and downpipes start. */
  eaves: number;
  /** Highest point of the house (a flat-topped terrace unit's parapet). */
  top: number;
  /** Real chimney stacks: centre (x, z), the top of the stack (y) and its width along x. */
  stacks: { x: number; z: number; y: number; w: number }[];
}

export const HOUSE_FEATURES: Readonly<Record<string, HouseFeatures>> = {
  'hood/two-storey-family-house': { eaves: 6.26, top: 11.2, stacks: [{ x: 3.05, z: -0.0, y: 11.2, w: 1.54 }] },
  'hood/single-storey-ranch-house': { eaves: 3.94, top: 5.9, stacks: [{ x: 3.65, z: 1.15, y: 5.9, w: 0.87 }] },
  'hood/townhouse-row-unit': { eaves: 6.25, top: 7.46, stacks: [] },
  'hood/porch-front-cottage': { eaves: 7.4, top: 7.72, stacks: [] },
  'hood/split-level-house': { eaves: 7.28, top: 7.28, stacks: [] },
};
