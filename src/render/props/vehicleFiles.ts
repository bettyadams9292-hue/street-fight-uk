/**
 * Which model file each owned car and bike uses (public/models/vehicles). Plain data, no three.js,
 * so the tests can check it against the catalogue and the folder. Loaded by VehicleLibrary.
 */

/** Car id -> model file and the height it is fitted to (null: keep the file's proportions). */
export const CAR_MODELS: Record<string, { file: VehicleFile; height: number | null }> = {
  corvo: { file: 'hatchback-sports', height: 1.45 },
  pixie: { file: 'hatchback-sports', height: 1.42 },
  monarch: { file: 'sedan', height: 1.45 },
  regent: { file: 'sedan', height: 1.45 },
  vixen: { file: 'car-vixen', height: null },
  kestrel: { file: 'car-kestrel', height: null },
  tundra: { file: 'suv-luxury', height: 1.75 },
  sovereign: { file: 'suv', height: 1.75 },
  warden: { file: 'suv', height: 1.8 },
  brute: { file: 'truck', height: 1.75 },
  hornet: { file: 'sedan-sports', height: 1.4 },
  phantom: { file: 'car-phantom', height: null },
};

export const BIKE_IDS = ['pup85', 'trail125', 'mx250', 'mx350', 'mx450r', 'mx450f', 'enduro300', 'enduro500', 'factory450', 'gp500'] as const;

export const VEHICLE_FILES = [
  'hatchback-sports', 'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'truck', 'car-vixen', 'car-kestrel', 'car-phantom',
  ...BIKE_IDS.map((b) => `bike-${b}` as const),
] as const;
export type VehicleFile = (typeof VEHICLE_FILES)[number];
