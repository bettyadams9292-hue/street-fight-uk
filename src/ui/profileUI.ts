import { BACKGROUNDS } from '../character/Character';
import {
  activeSlots,
  COMPANIONS,
  COMPANION_LEVEL_CAP,
  COMPANION_LIST,
  companionAvailable,
  companionCondition,
  companionXpFor,
  crewState,
  dismissCompanion,
  fightRating,
  firstAidCompanion,
  giveWeapon,
  takeWeapon,
  type CompanionDef,
} from '../companions/companions';
import { companionFighter, companionLook } from '../companions/crewFighter';
import { FIGHT_STYLES, PERSONALITIES } from '../companions/personality';
import {
  CONDITION_INFO,
  SEVERITY_NAMES,
  exhaustionEffect,
  injuryEffect,
  injuryName,
  overallCondition,
  timeToHeal,
  HEAL_TIME,
  type ConditionLevel,
  type ConditionSave,
  type Injury,
} from '../condition/condition';
import { WEAPONS } from '../combat/Weapons';
import { STYLES } from '../data/styles';
import { Fighter } from '../fighter/Fighter';
import { ITEMS, WEAR_SLOTS, WEAR_SLOT_LABELS } from '../items/items';
import { UPGRADES, UPGRADE_IDS, xpForNextLevel, LEVEL_CAP } from '../progress/catalogue';
import type { Progress } from '../progress/Progress';
import { currentFatigue, MAX_TRAINING_RANK } from '../training/gym';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { itemIconUrl } from './itemIcons';
import { livePortrait, portraitImage } from './portrait';
import type { Screen } from './UIManager';

/**
 * Character & Crew: one screen, two tabs.
 *  - Character: you, your numbers (all straight from your fighter), your condition and injuries, your kit, your progress.
 *  - Crew: everyone you've hired, who's with you, how fit they are, their numbers and kit, and what you can do for them.
 * Everything here reads the real game state and every button changes it.
 */

export interface ProfileOptions {
  progress: Progress;
  /** Your fighter as they are right now (live health, stamina, modifiers). */
  player: Fighter;
  /** Your crew in this area right now (live health and stamina). */
  liveCrew: { id: string; f: Fighter }[];
  /** Give someone an order (see Game.crewOrder). */
  order(id: string, order: 'follow' | 'home' | 'wait' | 'ready' | 'callover' | 'relax'): { ok: boolean; text: string; rebuild?: boolean };
  tab?: 'character' | 'crew';
  crewId?: string;
  /** Something changed that the world needs to rebuild for (who's following, their weapon). */
  crewChanged(): void;
  saved(): void;
  close(): void;
}

const pct = (n: number) => `${n >= 1 ? '+' : '−'}${Math.abs(Math.round((n - 1) * 100))}%`;
const mmss = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
};

function bar(cur: number, max: number, cls: string, label?: string): HTMLElement {
  const f = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
  return h('div', { class: `pf-bar ${cls}` }, h('i', { style: `width:${(f * 100).toFixed(1)}%` }), h('span', { text: label ?? `${Math.round(cur)} / ${Math.round(max)}` }));
}

function row(label: string, value: string, note?: string, cls = ''): HTMLElement {
  return h('div', { class: `pf-row ${cls}` }, h('span', { class: 'k', text: label }), h('b', { text: value }), note ? h('small', { text: note }) : null);
}

function section(title: string, ic: IconName, ...body: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'pf-sec' }, h('h4', {}, icon(ic), title), ...body);
}

function condBadge(level: ConditionLevel, big = false): HTMLElement {
  const c = CONDITION_INFO[level];
  const el = h('span', { class: `pf-cond${big ? ' big' : ''}`, title: c.text }, h('i'), c.label);
  el.style.setProperty('--c', c.colour);
  return el;
}

function injuryList(c: ConditionSave, atHome: boolean): HTMLElement {
  if (!c.injuries.length) return h('p', { class: 'pf-none', text: 'No injuries.' });
  return h('ul', { class: 'pf-injuries' }, ...[...c.injuries].sort((a, b) => b.severity - a.severity).map((i) => injuryItem(i, atHome)));
}

function injuryItem(i: Injury, atHome: boolean): HTMLElement {
  const progress = 1 - i.left / HEAL_TIME[i.severity];
  const li = h('li', { class: `sev${i.severity}` },
    h('div', { class: 'inj-head' }, h('b', { text: injuryName(i) }), h('span', { class: 'sev', text: SEVERITY_NAMES[i.severity] })),
    h('div', { class: 'inj-effect', text: injuryEffect(i) }),
    h('div', { class: 'inj-rec' }, h('div', { class: 'pf-mini' }, h('i', { style: `width:${(progress * 100).toFixed(0)}%` })),
      h('small', { text: `${i.severity > 1 ? 'Eases' : 'Heals'} in ${mmss(i.left / (atHome ? 3 : 1))}${atHome ? ' (resting at home)' : ''}` })),
  );
  return li;
}

function weaponLine(st: { id: string; hits?: number } | null, f: Fighter | null): HTMLElement {
  if (!st) return row('Weapon', 'Fists', 'Nothing in hand');
  const d = ITEMS[st.id];
  const w = d.weapon ? WEAPONS[d.weapon] : null;
  const mult = f ? f.stats.damageMultiplier : 1;
  const data = f?.weapon?.data ?? w;
  return h('div', { class: 'pf-item' },
    h('img', { src: itemIconUrl(st.id), alt: '' }),
    h('div', {}, h('b', { text: d.name }), data ? h('small', { text: `${Math.round(data.light.damage * mult)} / ${Math.round(data.heavy.damage * mult)} damage · ${st.hits ?? data.durability}/${data.durability} hits left` }) : null),
  );
}

// ---------------------------------------------------------------------------------------------------

export function profileScreen(o: ProfileOptions): Screen {
  const p = o.progress;
  let tab: 'character' | 'crew' = o.tab ?? 'character';
  let crewId: string | null = o.crewId ?? p.save.companions.following[0] ?? p.save.companions.recruited[0] ?? null;
  let message = '';
  let bad = false;
  let confirmLetGo = false;
  let picking = false;
  const atHome = () => p.save.area === 'home' || p.save.area === 'basement';
  const el = h('div', { class: 'screen profile-screen' });

  const say = (r: { ok: boolean; reason?: string }, good: string) => {
    message = r.ok ? good : r.reason ?? 'Can’t do that';
    bad = !r.ok;
  };

  // ---- character tab ----
  function characterTab(): HTMLElement {
    const s = p.save;
    const f = o.player;
    const st = f.stats;
    const v = f.vitals;
    const fatigue = currentFatigue(s.gym, s.playTime);
    const level = overallCondition(v.health / v.maxHealth, s.condition, fatigue);
    const info = CONDITION_INFO[level];
    const bg = BACKGROUNDS[s.character.background];
    const need = s.level >= LEVEL_CAP ? 0 : xpForNextLevel(s.level);
    let total = s.xp;
    for (let l = 1; l < s.level; l++) total += xpForNextLevel(l);
    const attr = (k: Parameters<typeof st.attr>[0], label: string, note: string) => {
      const now = st.attr(k);
      const base = st.base[k];
      const diff = Math.round((now - base) * 10) / 10;
      return h('div', { class: 'pf-attr' }, h('span', { class: 'k', text: label }), h('div', { class: 'pf-attr-bar' }, h('i', { style: `width:${Math.min(100, now * 5)}%` })), h('b', { text: String(Math.round(now * 10) / 10) }),
        h('small', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : '', text: diff ? `${diff > 0 ? '+' : ''}${diff}` : '' }), h('em', { text: note }));
    };
    const styles = s.styles.learned.map((id) => `${STYLES[id].name}${s.styleTraining[id]?.rank ? ` (rank ${s.styleTraining[id]!.rank})` : ''}`);
    const ex = exhaustionEffect(fatigue);

    const left = h('div', { class: 'pf-col pf-left' },
      h('div', { class: 'pf-portrait' }, livePortrait(`you:${JSON.stringify(f.appearance)}:${s.held?.id ?? ''}`, f.appearance, f.weapon)),
      h('h2', { class: 'pf-name', text: s.character.name }),
      h('div', { class: 'pf-sub', text: `Level ${s.level} · ${bg.name}` }),
      condBadge(level, true),
      h('p', { class: 'pf-cond-text', text: info.text }),
      h('div', { class: 'pf-vitals' }, h('label', { text: 'Health' }), bar(v.health, v.maxHealth, 'hp'), h('label', { text: 'Stamina' }), bar(v.stamina, v.maxStamina, 'st')),
    );

    const centre = h('div', { class: 'pf-col pf-centre' },
      section('Progress', 'side',
        h('div', { class: 'pf-xp' }, h('span', { text: s.level >= LEVEL_CAP ? 'Top level' : `Level ${s.level} → ${s.level + 1}` }), bar(s.xp, need || 1, 'xp', need ? `${s.xp} / ${need} XP` : 'MAX')),
        row('Total experience', `${total.toLocaleString('en-GB')} XP`),
        row('Training points', String(s.trainingPoints), 'Spend at the coach’s board or a fighting gym'),
        row('Money', `£${s.cash.pocket.toLocaleString('en-GB')} on you`, `£${s.cash.bank.toLocaleString('en-GB')} in the tin`),
        row('Fighting styles', styles.join(', ')),
      ),
      section('Physical', 'gym',
        attr('strength', 'Strength', 'Damage and poise damage'),
        attr('endurance', 'Endurance', 'Health, stamina, recovery'),
        attr('agility', 'Agility', 'Moving in and out, getting up'),
        attr('speed', 'Speed', 'Attack and walking speed'),
        attr('defence', 'Defence', 'Damage taken, health, poise'),
        attr('technique', 'Technique', 'Clean hits'),
        h('div', { class: 'pf-fitness' }, ...UPGRADE_IDS.map((id) => h('span', { title: UPGRADES[id].per }, h('em', { text: UPGRADES[id].name }), h('b', { text: `${s.upgrades[id]}/${MAX_TRAINING_RANK}` })))),
      ),
      section('In a fight', 'weapon',
        row('Damage', pct(st.damageMultiplier), 'All your hits, from Strength, level, gear and injuries'),
        row('Clean hit chance', `${Math.round(st.cleanHitChance * 100)}%`, '×1.3 damage (Technique)'),
        row('Damage taken', `${Math.round((1 - st.defenceReduction) * st.damageTakenMultiplier * 100)}%`, 'Of what a hit would do (Defence, level, injuries)'),
        row('Attack speed', pct(st.attackSpeed)),
        row('Move speed', pct(st.moveSpeedMultiplier)),
        row('Stamina back', `${st.staminaRegenPerSecond.toFixed(1)} a second`),
        row('Poise', String(Math.round(st.maxPoise)), 'How much it takes to stagger you'),
        row('Record', `${s.stats.kos} KOs · ${s.stats.bosses} bosses`, `${s.stats.deaths} times beaten`),
      ),
    );

    const worn = WEAR_SLOTS.filter((slot) => s.worn[slot]).map((slot) => {
      const it = s.worn[slot]!;
      const d = ITEMS[it.id];
      return h('div', { class: 'pf-item' }, h('img', { src: itemIconUrl(it.id, it.colour), alt: '' }), h('div', {}, h('b', { text: d.name }), h('small', { text: `${WEAR_SLOT_LABELS[slot]}${d.stats?.length ? ` · ${d.stats.map((m) => m.text).join(', ')}` : ''}` })));
    });

    const right = h('div', { class: 'pf-col pf-right' },
      section('Condition', 'info',
        row('Health', `${Math.round(v.health)} / ${Math.round(v.maxHealth)}`),
        row('Stamina', `${Math.round(v.stamina)} / ${Math.round(v.maxStamina)}`),
        h('div', { class: 'pf-fatigue' }, h('span', { class: 'k', text: 'Fatigue' }), bar(fatigue, 100, 'fat', `${Math.round(fatigue)}%`)),
        ex ? h('p', { class: 'pf-warn', text: `${ex.label}: ${ex.text.toLowerCase()}. Rest, eat or play a while.` }) : null,
        h('div', { class: 'pf-sub2', text: 'Injuries' }),
        injuryList(s.condition, atHome()),
        s.condition.injuries.length
          ? h('p', { class: 'pf-hint', text: `All healed in about ${mmss(timeToHeal(s.condition) / (atHome() ? 3 : 1))}. Faster at home; the sofa sorts a level of everything; a first aid kit fixes your worst injury by a level, plasters see to bruising.` })
          : h('p', { class: 'pf-hint', text: 'Big hits to the head, body, legs, or heavy blows you block, can leave injuries after a fight.' }),
      ),
      section('Equipment', 'bag', weaponLine(s.held, f), ...(worn.length ? worn : [h('p', { class: 'pf-none', text: 'Nothing worn.' })]),
        row('Pockets', `${s.inventory.length} / ${p.inventoryCap}`, `Stash at home: ${s.storage.length} / ${s.storageCap}`)),
    );
    return h('div', { class: 'pf-grid' }, left, centre, right);
  }

  // ---- crew tab ----
  const liveOf = (id: string) => o.liveCrew.find((c) => c.id === id)?.f ?? null;
  const atHomeNow = () => p.save.area === 'home';

  function memberStatus(def: CompanionDef): { text: string; cls: string } {
    const s = p.save.companions;
    const st = crewState(p, def.id);
    const ok = companionAvailable(st);
    if (!ok.ok) return { text: 'Recovering', cls: 'down' };
    const following = s.following.includes(def.id);
    if (st.condition.injuries.some((i) => i.part !== 'bruising') || st.health < 0.6) return { text: following ? 'With you, hurt' : 'Injured', cls: 'hurt' };
    if (following) return { text: atHomeNow() ? 'With you (home)' : 'Following you', cls: 'active' };
    if (st.fatigue >= 50) return { text: 'Tired, resting', cls: 'hurt' };
    return { text: 'At home', cls: 'ready' };
  }

  function live(def: CompanionDef): Fighter {
    return liveOf(def.id) ?? companionFighter(p, def);
  }

  const giveOrder = (id: string, order: Parameters<ProfileOptions['order']>[1]) => {
    const r = o.order(id, order);
    message = r.text;
    bad = !r.ok;
    if (r.rebuild) o.crewChanged();
  };

  function crewTab(): HTMLElement {
    const s = p.save.companions;
    const recruited = s.recruited.map((id) => COMPANIONS[id]).filter(Boolean);
    if (crewId && !s.recruited.includes(crewId)) crewId = recruited[0]?.id ?? null;
    const slots = activeSlots(p);

    // Active crew: everyone following you, and how many places there are.
    const followers = s.following.map((id) => COMPANIONS[id]).filter(Boolean);
    const activeStrip = h('div', { class: 'pf-active' },
      h('div', { class: 'pf-active-head' }, h('b', { text: 'Active crew' }), h('span', { text: `${followers.length} / ${slots} following${slots < 2 ? ' · 2nd place after Sully Kane' : ''}` })),
      ...(followers.length ? followers.map((d) => activeCard(d)) : [h('p', { class: 'pf-none', text: recruited.length ? 'Nobody with you. Pick someone below and tap “Follow me”.' : 'No crew yet. Fighters for hire in the Snug at the Red Lion (High Street).' })]),
      followers.length ? h('p', { class: 'pf-hint', text: `${followers.every((d) => companionAvailable(crewState(p, d.id)).ok && crewState(p, d.id).fatigue < 50) ? 'Everyone’s fit to go.' : 'Someone needs rest before a big fight.'} G: quick orders (follow / wait / ready).` }) : null,
    );

    const list = h('div', { class: 'pf-crew-list' }, ...recruited.map((def) => {
      const st = crewState(p, def.id);
      const ms = memberStatus(def);
      const f = live(def);
      const img = portraitImage(`crew:${def.id}`, companionLook(def));
      const b = h('button', { class: `crew-card${def.id === crewId ? ' selected' : ''} ${ms.cls}`, 'data-nav': true, onclick: () => { crewId = def.id; confirmLetGo = false; picking = false; message = ''; render(); } },
        img ? h('img', { class: 'crew-pic', src: img, alt: '' }) : h('span', { class: 'crew-pic' }, icon('contact')),
        h('div', { class: 'crew-txt' },
          h('b', { text: def.name }),
          h('small', { text: `Lv ${st.level} · ${PERSONALITIES[def.personality].name} · ${FIGHT_STYLES[def.fightStyle].name}` }),
          bar(f.vitals.health, f.vitals.maxHealth, 'hp thin', ''),
        ),
        h('span', { class: `crew-status ${ms.cls}`, text: ms.text }),
      );
      return b;
    }));
    const notHired = COMPANION_LIST.filter((c) => !s.recruited.includes(c.id)).length;
    if (notHired) list.append(h('p', { class: 'pf-hint', text: `${notHired} more fighter${notHired > 1 ? 's' : ''} for hire in the Snug at the Red Lion.` }));

    const def = crewId ? COMPANIONS[crewId] : null;
    if (!def) return h('div', { class: 'pf-grid crew' }, h('div', { class: 'pf-col pf-left' }, activeStrip, list), h('div', { class: 'pf-col pf-centre' }, h('p', { class: 'pf-none', text: 'Hire someone at the Red Lion and they’ll show up here.' })));

    const st = crewState(p, def.id);
    const f = live(def);
    const fs = f.stats;
    const cond = companionCondition({ ...st, health: f.vitals.health / f.vitals.maxHealth });
    const liveF = liveOf(def.id);
    const isLive = !!liveF;
    const a = def.attributes;
    const need = st.level >= COMPANION_LEVEL_CAP ? 0 : companionXpFor(st.level);
    const ms = memberStatus(def);
    const avail = companionAvailable(st);
    const per = PERSONALITIES[def.personality];
    const sty = FIGHT_STYLES[def.fightStyle];
    const wpn = sty.weaponClasses ? `${Math.round((sty.weaponMult - 1) * 100)}% more damage with ${sty.weaponClasses.join(', ')} weapons; ${Math.round((1 - sty.unarmedMult) * 100)}% less without` : sty.weaponMult > 1 ? `+${Math.round((sty.weaponMult - 1) * 100)}% damage with any weapon` : sty.weaponMult < 1 ? `${Math.round((1 - sty.weaponMult) * 100)}% less damage with weapons` : 'Ordinary';

    const centre = h('div', { class: 'pf-col pf-centre' },
      h('div', { class: 'pf-crew-head' },
        h('div', { class: 'pf-portrait small' }, livePortrait(`crew:${def.id}:${st.weapon?.id ?? ''}`, companionLook(def), f.weapon)),
        h('div', {},
          h('h2', { class: 'pf-name', text: def.name }),
          h('div', { class: 'pf-sub', text: `${def.role}` }),
          h('div', { class: 'pf-tags' }, condBadge(cond), h('span', { class: `crew-status ${ms.cls}`, text: ms.text })),
          h('p', { class: 'pf-quote', text: `“${def.line}”` }),
          h('div', { class: 'pf-rating', title: 'From their attributes, damage share, level, health, injuries and weapon' }, h('span', { text: 'Fight rating' }), h('b', { text: String(fightRating(def, { ...st, health: f.vitals.health / f.vitals.maxHealth })) }), h('small', { text: '/ 100' })),
        ),
      ),
      section('Personality', 'contact',
        row('Type', per.name),
        h('p', { class: 'pf-desc', text: per.text }),
        row('In a fight', per.targeting === 'onPlayer' ? 'Goes for whoever’s on you' : per.targeting === 'weakest' ? 'Finishes off the weakest' : 'Takes on the nearest', `Joins in within ${per.engageRange} m${per.retreatAt ? ` · backs off under ${Math.round(per.retreatAt * 100)}% health` : ''}${per.helpsCrew ? ' · helps a crew mate who’s down' : ''}`),
      ),
      section('Fighting style', 'gym',
        row('Style', sty.name, `Uses ${STYLES[sty.moves].name} moves`),
        h('p', { class: 'pf-desc', text: sty.text }),
        row('Attack speed', pct(fs.attackSpeed)),
        row('Damage', pct(fs.damageMultiplier), `${Math.round(def.damageMult * 100)}% share × style × level × weapon`),
        row('Weapon proficiency', wpn),
        row('Move speed', pct(fs.moveSpeedMultiplier)),
        row('Damage taken', `${Math.round((1 - fs.defenceReduction) * fs.damageTakenMultiplier * 100)}%`),
        row('Clean hit chance', `${Math.round(fs.cleanHitChance * 100)}%`),
        row('Good at', def.strengths),
        row('Weak at', def.weaknesses),
      ),
      section('Level and stats', 'side',
        h('div', { class: 'pf-xp' }, h('span', { text: `Level ${st.level}${st.level < COMPANION_LEVEL_CAP ? ` → ${st.level + 1}` : ' (top)'}` }), bar(st.xp, need || 1, 'xp', need ? `${st.xp} / ${need} XP` : 'MAX')),
        row('Fights', String(st.fights), `${st.kos} knockouts of their own · each level +4% damage, +6 health`),
        ...(['strength', 'endurance', 'agility', 'speed', 'defence', 'technique'] as const).map((k) =>
          h('div', { class: 'pf-attr' }, h('span', { class: 'k', text: k[0].toUpperCase() + k.slice(1) }), h('div', { class: 'pf-attr-bar' }, h('i', { style: `width:${Math.min(100, a[k] * 10)}%` })), h('b', { text: String(a[k]) }))),
      ),
    );

    const ex = st.health < 1 ? `Health back in about ${mmss(((1 - st.health) * 300) / 3)} resting (they rest whenever they’re not out with you)` : null;
    const pocketsWeapons = p.save.inventory.filter((x) => ITEMS[x.id].weapon && WEAPONS[ITEMS[x.id].weapon!].cls !== 'thrown');
    const actions: HTMLElement[] = [];
    const following = s.following.includes(def.id);
    const m = liveF;
    if (following) actions.push(actBtn('Relax at home', 'home', () => giveOrder(def.id, 'home'), '', 'Stays home resting until you call them'));
    else actions.push(actBtn('Follow me', 'walk', () => giveOrder(def.id, 'follow'), 'primary', avail.ok ? (s.following.length >= slots ? (slots === 1 ? `Swaps with ${COMPANIONS[s.following[0]].nickname}` : 'All places taken') : undefined) : avail.reason, !avail.ok || (s.following.length >= slots && slots > 1)));
    if (m && following && !atHomeNow()) {
      actions.push(actBtn('Wait here', 'pin', () => giveOrder(def.id, 'wait'), '', 'Stays put until you say follow (G cycles orders)'));
      actions.push(actBtn('Get ready', 'target', () => giveOrder(def.id, 'ready'), '', 'Stays close and goes in sooner'));
      actions.push(actBtn('Back in with the crew', 'walk', () => giveOrder(def.id, 'follow'), 'quiet'));
    }
    if (m && atHomeNow()) {
      actions.push(actBtn('Come with me', 'walk', () => giveOrder(def.id, 'callover'), '', 'Gets up and follows you round the house'));
      actions.push(actBtn('Make yourself at home', 'home', () => giveOrder(def.id, 'relax'), 'quiet', 'Back to the sofa'));
    }
    const kits = p.save.inventory.filter((x) => x.id === 'first_aid').reduce((n, x) => n + x.qty, 0);
    if (st.health < 1 || st.condition.injuries.length) actions.push(actBtn('Patch them up', 'consumable', () => { say(firstAidCompanion(p, def.id), `${def.nickname} patched up`); if (isLive && !atHomeNow()) o.crewChanged(); }, '', kits ? `Uses a first aid kit (${kits} on you)` : 'Needs a first aid kit from your pockets', !kits));
    if (st.weapon) actions.push(actBtn('Take weapon back', 'weapon', () => { say(takeWeapon(p, def.id), 'Back in your pockets'); if (isLive) o.crewChanged(); }));
    if (picking) {
      actions.push(h('div', { class: 'pf-pick' }, h('div', { class: 'pf-sub2', text: 'Give them…' }),
        ...pocketsWeapons.map((w) => h('button', { class: 'pf-pick-item', 'data-nav': true, onclick: () => { say(giveWeapon(p, def.id, w.uid), `${def.nickname} has the ${ITEMS[w.id].name.toLowerCase()}`); picking = false; if (isLive) o.crewChanged(); render(); } },
          h('img', { src: itemIconUrl(w.id), alt: '' }), h('span', { text: ITEMS[w.id].name }), h('small', { text: `${w.hits ?? ''} hits` }))),
        actBtn('Cancel', 'back', () => { picking = false; render(); })));
    } else actions.push(actBtn(st.weapon ? 'Swap weapon' : 'Give a weapon', 'weapon', () => { picking = true; render(); }, '', pocketsWeapons.length ? `${pocketsWeapons.length} in your pockets` : 'No weapons in your pockets', !pocketsWeapons.length));
    if (confirmLetGo) actions.push(h('div', { class: 'pf-confirm' }, h('b', { text: `Let ${def.nickname} go for good? No refund.` }), h('div', { class: 'pf-confirm-row' },
      actBtn('Let them go', 'quit', () => { say(dismissCompanion(p, def.id), `${def.nickname} has gone`); confirmLetGo = false; o.crewChanged(); }, 'danger'),
      actBtn('Keep them', 'back', () => { confirmLetGo = false; render(); }))));
    else actions.push(actBtn('Let them go', 'quit', () => { confirmLetGo = true; render(); }, 'quiet', 'Their weapon comes back to you'));

    const right = h('div', { class: 'pf-col pf-right' },
      section('Condition', 'info',
        h('label', { class: 'pf-lab', text: 'Health' }), bar(f.vitals.health, f.vitals.maxHealth, 'hp'),
        h('label', { class: 'pf-lab', text: isLive ? 'Stamina' : 'Stamina (rested)' }), bar(f.vitals.stamina, f.vitals.maxStamina, 'st'),
        h('div', { class: 'pf-fatigue' }, h('span', { class: 'k', text: 'Fatigue' }), bar(st.fatigue, 100, 'fat', `${Math.round(st.fatigue)}%`)),
        row('Ready to fight', avail.ok ? (st.fatigue >= 50 ? 'Yes, but tired' : cond === 'excellent' || cond === 'good' ? 'Yes' : 'Yes, but hurt') : 'No', avail.ok ? undefined : avail.reason),
        row('Recovering', atHomeNow() && isLive ? 'Resting at home' : following ? 'Out with you' : 'Resting at home', 'Sat on a sofa at home is quickest for health and fatigue'),
        h('div', { class: 'pf-sub2', text: 'Injuries' }),
        injuryList(st.condition, !following || atHomeNow()),
        ex ? h('p', { class: 'pf-hint', text: ex }) : null,
      ),
      section('Equipment', 'bag',
        weaponLine(st.weapon, f),
        row('Clothes', [def.look.top, def.look.bottoms].filter(Boolean).join(', ') || 'Street clothes', 'Their own; no armour in this game'),
      ),
      section('Actions', 'contact', ...actions),
      h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message }),
    );
    return h('div', { class: 'pf-grid crew' }, h('div', { class: 'pf-col pf-left' }, activeStrip, list), centre, right);
  }

  function activeCard(def: CompanionDef): HTMLElement {
    const st = crewState(p, def.id);
    const f = live(def);
    const cond = companionCondition({ ...st, health: f.vitals.health / f.vitals.maxHealth });
    const avail = companionAvailable(st);
    const w = st.weapon ? ITEMS[st.weapon.id].name : 'Fists';
    return h('button', { class: 'pf-active-card', 'data-nav': true, onclick: () => { crewId = def.id; render(); } },
      h('div', { class: 'pf-active-row' }, h('b', { text: def.nickname }), condBadge(cond)),
      bar(f.vitals.health, f.vitals.maxHealth, 'hp thin'),
      bar(f.vitals.stamina, f.vitals.maxStamina, 'st thin'),
      h('small', { text: `${PERSONALITIES[def.personality].name} · ${w} · ${avail.ok ? (st.fatigue >= 50 ? 'Tired' : 'Ready') : 'Recovering: stays home'}` }),
    );
  }

  function actBtn(label: string, ic: IconName, fn: () => void, cls = '', sub?: string, disabled = false): HTMLElement {
    const b = h('button', { class: `act-btn ${cls}`, 'data-nav': true, onclick: () => { fn(); o.saved(); render(); } }, icon(ic), h('span', { class: 'lbl' }, h('b', { text: label }), sub ? h('small', { class: disabled ? 'why' : '', text: sub }) : null));
    if (disabled) b.setAttribute('disabled', '');
    return b;
  }

  function render(): void {
    const s = p.save.companions;
    const crewHurt = s.recruited.some((id) => !companionAvailable(crewState(p, id)).ok);
    el.replaceChildren(
      h('header', { class: 'pf-head' },
        h('div', { class: 'pf-tabs' },
          h('button', { class: `pf-tab${tab === 'character' ? ' on' : ''}`, 'data-nav': true, onclick: () => { tab = 'character'; message = ''; render(); } }, icon('contact'), 'Character'),
          h('button', { class: `pf-tab${tab === 'crew' ? ' on' : ''}`, 'data-nav': true, onclick: () => { tab = 'crew'; message = ''; render(); } }, icon('gym'), `Crew${s.recruited.length ? ` (${s.recruited.length})` : ''}`, crewHurt ? h('i', { class: 'dot' }) : null),
        ),
        h('span', { class: 'pf-keys', text: 'H or Esc to close' }),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', title: 'Close (Esc / H)', onclick: () => o.close() }, icon('close')),
      ),
      tab === 'character' ? characterTab() : crewTab(),
    );
  }

  return {
    el,
    onShow: () => render(),
    onBack: () => o.close(),
    onAction: (a) => {
      if (a === 'pause' || a === 'character') {
        o.close();
        return true;
      }
      if (a === 'left' || a === 'right') {
        // Shoulder-style switching between the two tabs.
        const next = a === 'right' ? 'crew' : 'character';
        if (next !== tab && document.activeElement?.classList.contains('pf-tab')) {
          tab = next;
          render();
          return true;
        }
      }
      return false;
    },
  };
}
