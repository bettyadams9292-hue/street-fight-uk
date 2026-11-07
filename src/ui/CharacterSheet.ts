import { BACKGROUNDS, CREATION_BASE, CURRENT_STAGE, finalAttributes, type PlayerCharacter } from '../character/Character';
import { ATTRIBUTE_NAMES, Stats } from '../stats/Stats';
import { ATTRIBUTE_LABELS, derivedStats } from './CharacterCreator';
import { menuButton } from './controls';
import { h } from './dom';
import type { Screen } from './UIManager';

const STYLE_NAMES: Record<string, string> = { street: 'Street Fighting' };

/** Your fighter: look, attributes, what they do, background and perks. */
export function characterSheet(c: PlayerCharacter, actions: { editLook: () => void; back: () => void }): Screen {
  const bg = BACKGROUNDS[c.background];
  const attrs = finalAttributes(c.allocated, c.background);
  const stats = new Stats(attrs, c.level);

  const attrRows = ATTRIBUTE_NAMES.map((a) => {
    const bonus = bg.bonus[a] ?? 0;
    const parts = [`${CREATION_BASE} base`];
    if (c.allocated[a]) parts.push(`+${c.allocated[a]} spent`);
    if (bonus) parts.push(`+${bonus} background`);
    return h('div', { class: 'derived-row' }, h('span', { text: ATTRIBUTE_LABELS[a] }), h('span', { class: 'muted', text: parts.join(', ') }), h('b', { text: String(attrs[a]) }));
  });

  const perkLive = bg.perk.activeFromStage <= CURRENT_STAGE;
  const el = h(
    'div',
    { class: 'screen creator sheet' },
    h(
      'div',
      { class: 'creator-panel' },
      h('h2', { text: c.name }),
      h(
        'div',
        { class: 'creator-content' },
        h('div', { class: 'derived-row' }, h('span', { text: 'Background' }), h('b', { text: bg.name })),
        h('div', { class: 'derived-row' }, h('span', { text: 'Level' }), h('b', { text: String(c.level) })),
        h('div', { class: 'derived-row' }, h('span', { text: 'Cash' }), h('b', { text: `£${c.money}` })),
        h('h3', { text: 'Fighting styles' }),
        ...Object.entries(c.styleRanks).map(([id, rank]) =>
          h('div', { class: 'derived-row' }, h('span', { text: STYLE_NAMES[id] ?? id }), h('b', { text: `Rank ${rank}` })),
        ),
        h('h3', { text: 'Attributes' }),
        ...attrRows,
        h('h3', { text: 'In a fight' }),
        ...derivedStats(stats),
        h('h3', { text: 'Perk' }),
        h('p', { class: 'perk' }, bg.perk.text, h('span', { class: perkLive ? 'tag live' : 'tag', text: perkLive ? 'Active' : `From Stage ${bg.perk.activeFromStage}` })),
      ),
      h('div', { class: 'creator-footer' }, menuButton('Back', actions.back), menuButton('Change look', actions.editLook)),
    ),
    h('div', { class: 'creator-stage' }),
  );
  return { el, onBack: actions.back };
}

/** Simple yes/no question. */
export function confirmScreen(title: string, body: string, yes: string, no: string, onYes: () => void, onNo: () => void): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    h('h2', { text: title }),
    h('p', { class: 'confirm-body', text: body }),
    h('nav', { class: 'menu-list' }, menuButton(no, onNo), menuButton(yes, onYes)),
  );
  return { el, onBack: onNo };
}
