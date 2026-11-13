/**
 * Low-poly shop and casino fittings (public/models/shop), modelled to match
 * the city kit by tools/models/shop.py: the clothes rail, mannequins, changing
 * booth, tall display cabinet, cash machine, workbench, grow-shop shelving and
 * the casino's tables and cashier's cage.
 *
 * Until the files load, or if they can't, everything keeps its built-in model.
 */
import type * as THREE from 'three';
import { modelSet, type PieceOptions } from './modelSet';

export const SHOP_MODELS = [
  'clothes_rail', 'mannequin', 'mannequin_red', 'mannequin_navy', 'changing_booth', 'display_cabinet', 'atm',
  'workbench', 'grow_shelf', 'roulette_table', 'blackjack_table', 'casino_cage',
] as const;
export type ShopModelId = (typeof SHOP_MODELS)[number];

const shop = modelSet('shop', '/models/shop/', SHOP_MODELS);

export function loadShop(): Promise<void> {
  return shop.load();
}

/** A shop piece fitted into w × h × d metres (or at its real size with `native`). Null until loaded. */
export function shopPiece(id: ShopModelId, w: number, h: number, d: number, o: PieceOptions = {}): THREE.Group | null {
  return shop.piece(id, w, h, d, o);
}
