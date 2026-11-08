import { randomAppearance, type CharacterAppearance } from '../character/Appearance';
import { conditionModifiers } from '../condition/condition';
import { Rng } from '../core/Rng';
import { getStyle } from '../data/styles';
import { Fighter } from '../fighter/Fighter';
import { ITEMS } from '../items/items';
import type { Progress } from '../progress/Progress';
import { COMPANION_LEVEL_BONUS, crewState, type CompanionDef } from './companions';

/**
 * Building a companion's fighter in one place, so what the crew screen shows
 * is exactly what turns up in a fight: same look, same modifiers.
 */

export function companionLook(def: CompanionDef): CharacterAppearance {
  const rng = new Rng(def.seed);
  return { ...randomAppearance(() => rng.next(), def.body), accessories: [], ...def.look };
}

/** Damage share, extra health, pace, level and injuries. Safe to call again (replaces its own modifiers). */
export function applyCrewModifiers(f: Fighter, def: CompanionDef, p: Progress): void {
  const st = crewState(p, def.id);
  for (const src of ['companion', 'crew_level', 'injury']) f.stats.removeModifiersFrom(src);
  f.stats.addModifier({ id: 'companion_dmg', source: 'companion', stat: 'damageMult', mul: def.damageMult });
  if (def.health) f.stats.addModifier({ id: 'companion_hp', source: 'companion', flat: 'maxHealth', add: def.health });
  // Keeps up with you: a touch quicker than their stance would be.
  f.stats.addModifier({ id: 'companion_pace', source: 'companion', stat: 'moveSpeedMult', mul: 1.15 });
  const lv = st.level - 1;
  if (lv > 0) {
    f.stats.addModifier({ id: 'crew_lvl_dmg', source: 'crew_level', stat: 'damageMult', mul: 1 + COMPANION_LEVEL_BONUS.damage * lv });
    f.stats.addModifier({ id: 'crew_lvl_hp', source: 'crew_level', flat: 'maxHealth', add: COMPANION_LEVEL_BONUS.health * lv });
  }
  for (const m of conditionModifiers(st.condition)) f.stats.addModifier(m);
}

/** A companion as they'd be in a fight right now (for the crew screen's numbers and portrait). */
export function companionFighter(p: Progress, def: CompanionDef, id = 0, x = 0, z = 0): Fighter {
  const st = crewState(p, def.id);
  const f = new Fighter({
    id,
    name: def.nickname,
    team: 'player',
    attributes: { ...def.attributes },
    level: Math.max(1, p.save.level - 1),
    style: getStyle(def.style),
    x,
    z,
    appearance: companionLook(def),
  });
  applyCrewModifiers(f, def, p);
  f.vitals.reset();
  f.vitals.health = Math.max(1, Math.round(f.vitals.maxHealth * st.health));
  if (st.weapon && ITEMS[st.weapon.id]?.weapon) f.equipWeapon(ITEMS[st.weapon.id].weapon!, st.weapon.hits, st.weapon.mods);
  return f;
}
