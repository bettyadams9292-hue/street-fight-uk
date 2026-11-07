import type { StyleData, StyleId } from '../../styles/StyleData';
import { BJJ } from './bjj';
import { BOXING } from './boxing';
import { KARATE } from './karate';
import { KICKBOXING } from './kickboxing';
import { MUAY_THAI } from './muayThai';
import { STREET } from './street';
import { WRESTLING } from './wrestling';

/** Every fighting style, by id. */
export const STYLES: Record<StyleId, StyleData> = {
  street: STREET,
  boxing: BOXING,
  kickboxing: KICKBOXING,
  muay_thai: MUAY_THAI,
  karate: KARATE,
  wrestling: WRESTLING,
  bjj: BJJ,
};

export function getStyle(id: string): StyleData {
  return (STYLES as Record<string, StyleData>)[id] ?? STREET;
}
