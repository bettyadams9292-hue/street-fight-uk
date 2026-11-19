/**
 * The approved asset library: one typed entry for every model the owner has signed off.
 *
 * Sources (copied unchanged into ./sources by tools/assets/syncApproved.mjs; the originals are never edited):
 * - the original street furniture library and Batch 03, `newassetsfromchatgpt.ts` (`createStreetAsset`)
 * - Batches 01, 02, 04, 05 and 07, `assets/streetassettesting/batchNN.ts` (`createAsset`)
 * Not here: Batch 06 (never approved), Batch 01's alternate globe street light (excluded by its register),
 * the gym / security / fence expansion (not in the approved batches) and anything security-related (no CCTV).
 *
 * Each entry says where the model may stand (`place`), whether it blocks you (`solid`), and which of the game's
 * props it can draw in place of the old model (`replaces`). Models are built once and shared (./prototype.ts).
 */
import type * as THREE from 'three';
import type { PropKind } from '../../world/LevelTypes';
import { createAsset as b01 } from './sources/batch01';
import { createAsset as b02 } from './sources/batch02';
import { createAsset as b04 } from './sources/batch04';
import { createAsset as b05 } from './sources/batch05';
import { createAsset as b07 } from './sources/batch07';
import { createStreetAsset as lib } from './sources/streetLibrary';

export type ApprovedBatch = 'street-library' | 'B01' | 'B02' | 'B03' | 'B04' | 'B05' | 'B07';
export type ApprovedCategory = 'street' | 'architecture' | 'shop' | 'pub' | 'takeaway' | 'domestic' | 'industrial' | 'interior';
/**
 * Where a model belongs: on the pavement, against or fixed to a building wall, on a roof, on a shop or room
 * floor, on a counter or shelf, or in a yard. Placement code checks this so nothing ends up where it can't be.
 */
export type Placement = 'pavement' | 'kerb' | 'facade' | 'roof' | 'floor' | 'counter' | 'wall-mounted' | 'yard' | 'road';

export interface ApprovedAsset {
  id: string;
  batch: ApprovedBatch;
  category: ApprovedCategory;
  name: string;
  build: () => THREE.Group;
  place: Placement;
  /** Blocks the player and NPCs where it stands (the prop it replaces keeps its own collision box). */
  solid: boolean;
  /** The game props this can be drawn as, in place of the old model. */
  replaces?: readonly PropKind[];
}

type Row = [id: string, batch: ApprovedBatch, category: ApprovedCategory, name: string, place: Placement, solid: boolean, replaces?: readonly PropKind[]];

/* eslint-disable @typescript-eslint/no-explicit-any */
const L = (id: string) => () => lib(id as any);
const F: Record<Exclude<ApprovedBatch, 'street-library' | 'B03'>, (id: any) => THREE.Group> = { B01: b01, B02: b02, B04: b04, B05: b05, B07: b07 };

const ROWS: Row[] = [
  // ---- original street furniture library ----
  ['pillarPostBox', 'street-library', 'street', 'Pillar postbox', 'pavement', true, ['postbox']],
  ['wallPostBox', 'street-library', 'street', 'Wall postbox', 'wall-mounted', false],
  ['busStopPole', 'street-library', 'street', 'Bus stop pole', 'kerb', true],
  ['busShelter', 'street-library', 'street', 'Bus shelter', 'kerb', true, ['busstop']],
  ['busBench', 'street-library', 'street', 'Bus bench', 'kerb', true],
  ['timetableBoard', 'street-library', 'street', 'Timetable board', 'kerb', true],
  ['streetLamp', 'street-library', 'street', 'Street lamp', 'kerb', true, ['lamp_post']],
  ['bollard', 'street-library', 'street', 'Bollard', 'kerb', true, ['bollard', 'bollard_row', 'bollard_dock']],
  ['railings', 'street-library', 'street', 'Railings', 'pavement', true],
  ['litterBin', 'street-library', 'street', 'Litter bin', 'pavement', true],
  ['recyclingBin', 'street-library', 'street', 'Recycling bin', 'pavement', true],
  ['telephoneBox', 'street-library', 'street', 'Red telephone kiosk', 'pavement', true, ['phonebox']],
  ['electricalCabinet', 'street-library', 'street', 'Street electrical cabinet', 'pavement', true],
  ['streetNameSign', 'street-library', 'street', 'Street name sign', 'wall-mounted', false],
  ['pedestrianCrossing', 'street-library', 'street', 'Pedestrian crossing', 'road', false],
  ['roadSign', 'street-library', 'street', 'Road sign', 'kerb', true, ['sign_post']],
  ['wheelieBinBlack', 'street-library', 'street', 'Wheelie bin (black)', 'pavement', true, ['bin']],
  ['wheelieBinBrown', 'street-library', 'street', 'Wheelie bin (brown)', 'pavement', true, ['bin']],
  ['wheelieBinGreen', 'street-library', 'street', 'Wheelie bin (green)', 'pavement', true, ['bin']],
  ['wheelieBinBlue', 'street-library', 'street', 'Wheelie bin (blue)', 'pavement', true, ['bin']],
  ['parkBench', 'street-library', 'street', 'Park bench', 'pavement', true, ['bench']],
  // ---- Batch 03 (approved, in the street library) ----
  ['palletStack', 'B03', 'industrial', 'Weathered pallet stack', 'yard', true, ['pallets']],
  ['scrapHeap', 'B03', 'industrial', 'Scrapyard metal heap', 'yard', true, ['scrap']],
  ['storageRack', 'B03', 'industrial', 'Warehouse storage rack', 'floor', true, ['rack']],
  ['chestTrunk', 'B03', 'interior', 'Old storage chest', 'floor', true, ['chest']],
  ['rubbishBags', 'B03', 'street', 'Black bin bags', 'pavement', false, ['rubbish_bags']],
  ['shippingContainer', 'B03', 'industrial', 'Shipping container', 'yard', true, ['container']],
  ['tyreStack', 'B03', 'industrial', 'Tyre stack', 'yard', true, ['tyre_stack']],
  ['poolTable', 'B03', 'pub', 'Pool table', 'floor', true, ['pool_table']],
  ['fruitMachine', 'B03', 'pub', 'Fruit machine', 'floor', true, ['fruit_machine']],
  ['washBasin', 'B03', 'domestic', 'Wash basin', 'floor', true],
  // ---- Batch 01 (globeStreetLight excluded by its register) ----
  ['retailCounter', 'B01', 'shop', 'Retail counter', 'floor', true],
  ['highTable', 'B01', 'pub', 'High café table', 'floor', true],
  ['stockedShelves', 'B01', 'shop', 'Stocked shop shelves', 'floor', true],
  ['manholeCover', 'B01', 'street', 'UK utility access cover', 'pavement', false],
  ['queueBarrier', 'B01', 'interior', 'Queue barrier post', 'floor', false],
  ['queueBarrierOpen', 'B01', 'interior', 'Queue barrier, two posts', 'floor', false],
  ['queueBarrierLine', 'B01', 'interior', 'Queue barrier, straight run', 'floor', false],
  ['queueBarrierCorner', 'B01', 'interior', 'Queue barrier, corner', 'floor', false],
  ['drinksFridge', 'B01', 'shop', 'Glass-door drinks fridge', 'floor', true],
  ['streetPlanter', 'B01', 'street', 'Street planter', 'pavement', true, ['planter']],
  ['shopCounterTill', 'B01', 'shop', 'Shop counter with till', 'floor', true],
  ['cardboardBox', 'B01', 'interior', 'Cardboard box', 'floor', false, ['cardboard']],
  // ---- Batch 02 ----
  ['cardTerminal', 'B02', 'shop', 'Chip-and-PIN terminal', 'counter', false],
  ['backBarShelves', 'B02', 'pub', 'Back-bar bottle shelves', 'floor', true],
  ['receptionCounter', 'B02', 'interior', 'Reception desk', 'floor', true],
  ['pottedTree', 'B02', 'interior', 'Indoor potted tree', 'floor', true],
  ['wineBottle', 'B02', 'pub', 'Wine bottle', 'counter', false],
  ['oilDrum', 'B02', 'industrial', 'Oil drum', 'yard', true, ['drum']],
  ['wallClock', 'B02', 'interior', 'Wall clock', 'wall-mounted', false],
  ['chalkboardMenu', 'B02', 'pub', 'Pub chalkboard menu', 'floor', false],
  ['pastryCabinet', 'B02', 'takeaway', 'Hot food and pastry cabinet', 'counter', false],
  ['waitingSofa', 'B02', 'interior', 'Reception waiting sofa', 'floor', true],
  // ---- Batch 04 ----
  ['skipBin', 'B04', 'street', "Builder's skip", 'road', true, ['skip']],
  ['trafficCone', 'B04', 'street', 'Traffic cone', 'pavement', false, ['cone']],
  ['roadBarrier', 'B04', 'street', 'Roadworks barrier', 'pavement', true, ['barrier']],
  ['shoppingTrolley', 'B04', 'street', 'Supermarket trolley', 'pavement', true, ['trolley']],
  ['pubBarrel', 'B04', 'pub', 'Beer barrel', 'yard', true],
  ['woodenCrate', 'B04', 'industrial', 'Timber crate', 'yard', true, ['crates']],
  ['parkPicnicTable', 'B04', 'street', 'Picnic table', 'pavement', true],
  // ---- Batch 05 ----
  ['laundretteWasher', 'B05', 'shop', 'Laundrette washing machine', 'floor', true],
  ['laundretteDryer', 'B05', 'shop', 'Laundrette tumble dryer', 'floor', true],
  ['bakeryDisplay', 'B05', 'shop', 'Bakery bread display', 'floor', true],
  ['takeawayCounter', 'B05', 'takeaway', 'Takeaway serving counter', 'floor', true],
  ['pubDartboard', 'B05', 'pub', 'Dartboard cabinet', 'wall-mounted', false],
  ['bikeRack', 'B05', 'street', 'Sheffield bicycle stand', 'pavement', true, ['bike_rack']],
  ['arcadeCabinet', 'B05', 'interior', 'Arcade cabinet', 'floor', true],
  ['dumpster', 'B05', 'street', 'Trade waste bin', 'pavement', true, ['dumpster']],
  ['pallet', 'B05', 'industrial', 'Timber pallet', 'yard', false],
  ['trafficLight', 'B05', 'street', 'UK traffic lights', 'kerb', true, ['traffic_light']],
  ['vendingMachine', 'B05', 'shop', 'Snack vending machine', 'floor', true, ['vending']],
  ['parkingMeter', 'B05', 'street', 'Pay-and-display machine', 'kerb', true],
  ['cashMachine', 'B05', 'street', 'Cashpoint kiosk', 'pavement', true, ['atm']],
  ['noticeBoard', 'B05', 'street', 'Community notice board', 'pavement', true],
  ['gardenShed', 'B05', 'domestic', 'Timber garden shed', 'yard', true],
  ['cafeMenuStand', 'B05', 'street', 'Pavement café menu stand', 'pavement', false],
  ['newspaperStand', 'B05', 'shop', 'Newspaper rack', 'pavement', true, ['kiosk']],
  ['shoppingBasket', 'B05', 'shop', 'Hand basket', 'floor', false],
  ['deliveryTrolley', 'B05', 'industrial', 'Sack truck', 'yard', false],
  ['marketStall', 'B05', 'street', 'Market stall', 'pavement', true, ['market_stall']],
  // ---- Batch 07 ----
  ['brickWallSection', 'B07', 'architecture', 'Brick garden wall', 'pavement', true],
  ['brickGatePier', 'B07', 'architecture', 'Brick gate pier', 'pavement', true],
  ['terracedDoor', 'B07', 'architecture', 'Victorian terraced front door', 'facade', false],
  ['bayWindow', 'B07', 'architecture', 'Bay window', 'facade', false],
  ['sashWindow', 'B07', 'architecture', 'Sash window', 'facade', false],
  ['shopAwning', 'B07', 'architecture', 'Shop awning', 'facade', false],
  ['rollerShutter', 'B07', 'architecture', 'Roller shutter', 'facade', false],
  ['shopFascia', 'B07', 'architecture', 'Shopfront fascia and frame', 'facade', false],
  ['pubHangingSign', 'B07', 'pub', 'Pub hanging sign', 'facade', false],
  ['pubWindow', 'B07', 'pub', 'Leaded pub window', 'facade', false],
  ['chimneyPot', 'B07', 'architecture', 'Chimney pot', 'roof', false],
  ['roofVent', 'B07', 'architecture', 'Roof extractor vent', 'roof', false],
  ['airConUnit', 'B07', 'architecture', 'Air-conditioning unit', 'wall-mounted', false],
  ['downpipe', 'B07', 'architecture', 'Rainwater downpipe', 'facade', false],
  ['gutterCorner', 'B07', 'architecture', 'Guttering', 'facade', false],
  ['coalBunker', 'B07', 'domestic', 'Coal bunker', 'yard', true],
  ['milkCrate', 'B07', 'shop', 'Milk crate', 'floor', false],
  ['breadTray', 'B07', 'shop', 'Bakery bread tray', 'counter', false],
  ['kegRack', 'B07', 'pub', 'Keg cradle', 'floor', true],
  ['pubStool', 'B07', 'pub', 'Pub bar stool', 'floor', false],
  ['pubBooth', 'B07', 'pub', 'Pub booth', 'floor', true],
  ['takeawayMenuBoard', 'B07', 'takeaway', 'Takeaway menu board', 'wall-mounted', false],
  ['fishChipFryer', 'B07', 'takeaway', 'Chip-shop fryer', 'floor', true],
  ['chippyWarmer', 'B07', 'takeaway', 'Chip-shop heated display', 'counter', false],
  ['butcherCounter', 'B07', 'shop', "Butcher's chilled counter", 'floor', true],
  ['marketProduceCrate', 'B07', 'shop', 'Greengrocer produce crate', 'floor', false],
  ['laundretteFoldingTable', 'B07', 'shop', 'Laundrette folding table', 'floor', true],
  ['clothesAirer', 'B07', 'domestic', 'Clothes airer', 'floor', false],
  ['estateGarageDoor', 'B07', 'architecture', 'Up-and-over garage door', 'facade', false],
  ['gardenWaterButt', 'B07', 'domestic', 'Water butt', 'yard', true],
];

export const APPROVED: Readonly<Record<string, ApprovedAsset>> = Object.fromEntries(
  ROWS.map(([id, batch, category, name, place, solid, replaces]) => [
    id,
    { id, batch, category, name, place, solid, replaces, build: batch === 'street-library' || batch === 'B03' ? L(id) : () => F[batch](id) },
  ]),
);

export const APPROVED_IDS: readonly string[] = ROWS.map((r) => r[0]);
