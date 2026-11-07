import type { StyleData, StyleId } from '../../styles/StyleData';
import { BJJ } from './bjj';
import { BOXING } from './boxing';
import { KARATE } from './karate';
import { KICKBOXING } from './kickboxing';
import { MUAY_THAI } from './muayThai';
import { STREET } from './street';
import { WRESTLING } from './wrestling';
import { dashStrike, jumpKick, jumpPunch } from './shared';

/** Give a style the arcade moves every style shares: jump attacks and the forward lunge. */
function withCommon(style: Omit<StyleData, 'air' | 'dash'> & Partial<Pick<StyleData, 'air' | 'dash'>>): StyleData {
  const jp = jumpPunch(style.id);
  const jk = jumpKick(style.id);
  const ds = dashStrike(style.id);
  return { ...style, moves: { ...style.moves, [jp.id]: jp, [jk.id]: jk, [ds.id]: ds }, air: { punch: jp.id, kick: jk.id }, dash: ds.id };
}

/** Every fighting style, by id. */
export const STYLES: Record<StyleId, StyleData> = {
  street: withCommon(STREET),
  boxing: withCommon(BOXING),
  kickboxing: withCommon(KICKBOXING),
  muay_thai: withCommon(MUAY_THAI),
  karate: withCommon(KARATE),
  wrestling: withCommon(WRESTLING),
  bjj: withCommon(BJJ),
};

export function getStyle(id: string): StyleData {
  return (STYLES as Record<string, StyleData>)[id] ?? STYLES.street;
}
