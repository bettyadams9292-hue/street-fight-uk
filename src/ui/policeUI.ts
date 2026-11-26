/**
 * The police's own screens, in their own look rather than the game's menu style:
 * - the stop (OLD BILL, `policeStop`): a card with the Battenburg band, the force's badge, the officer's words
 *   big, and the choices as cards (talk your way out, come quietly, have it out);
 * - the custody record after you're nicked (`custodyRecord`): a paper form with a reference, the charges, what
 *   was seized, bail set in big figures, and the ways out;
 * - the front counter at the station (`frontCounter`): your file on the desk and settling up.
 * Set in Inter (public/fonts, OFL), like the rest of the game's prompts. Every choice is a real menu button
 * (data-nav), so keys and pads move between them.
 */
import { h } from './dom';
import { menuButton } from './controls';
import type { Screen } from './UIManager';

export interface PoliceChoice {
  label: string;
  sub?: string;
  go: () => void;
  /** How it reads: the safe way out, the costly one, or trouble. */
  tone?: 'calm' | 'cost' | 'danger';
}

const FORCE = 'Kirkgate Constabulary';

function badge(): HTMLElement {
  const b = document.createElement('span');
  b.className = 'pz-badge';
  // A plain eight-pointed star with a crown-less shield: the force's own, not any real force's crest.
  b.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3l4.2 7.4 8.3-1.9-1.9 8.3L42 21l-7.4 4.2 1.9 8.3-8.3-1.9L24 39l-4.2-7.4-8.3 1.9 1.9-8.3L6 21l7.4-4.2-1.9-8.3 8.3 1.9z"/><path class="pz-shield" d="M24 14l7 2.6v5.2c0 4.6-3 7.3-7 8.7-4-1.4-7-4.1-7-8.7v-5.2z"/></svg>';
  return b;
}

function choices(list: PoliceChoice[]): HTMLElement {
  return h('nav', { class: 'pz-choices menu-list' }, ...list.map((c) => menuButton(c.label, c.go, c.sub, `pz-choice ${c.tone ?? 'calm'}`, undefined, undefined, '')));
}

/** The stop: the officer's words, what you know of him, and what you can do. */
export function policeStop(o: { lead: string; count: number; said: string; know: string; facts: string[]; choices: PoliceChoice[] }): Screen {
  const el = h('div', { class: 'screen pz-screen pz-stop' },
    h('div', { class: 'pz-card' },
      h('div', { class: 'pz-battenburg' }),
      h('header', { class: 'pz-head' }, badge(), h('div', {}, h('span', { class: 'pz-kicker', text: FORCE }), h('h2', { text: 'Police. Stop.' }))),
      h('p', { class: 'pz-officer', text: `${o.lead}${o.count > 1 ? ` and ${o.count - 1 === 1 ? 'another officer' : `${o.count - 1} more`}` : ''}` }),
      h('blockquote', { class: 'pz-said', text: o.said }),
      h('p', { class: 'pz-know', text: o.know }),
      h('ul', { class: 'pz-facts' }, ...o.facts.map((f) => h('li', { text: f }))),
      choices(o.choices),
    ),
  );
  return { el, onBack: o.choices[o.choices.length - 1].go };
}

/** The custody record: booked in, what they've got you for, what they took, bail, and the ways out. */
export function custodyRecord(o: { ref: string; charges: { what: string; where: string }[]; seized: string; bail: number; time: number; notes: string[]; choices: PoliceChoice[] }): Screen {
  const money = (n: number) => `£${n.toLocaleString('en-GB')}`;
  const el = h('div', { class: 'screen pz-screen pz-custody' },
    h('div', { class: 'pz-sheet' },
      h('header', { class: 'pz-sheet-head' }, badge(), h('div', {}, h('span', { class: 'pz-kicker', text: FORCE }), h('h2', { text: 'Custody record' })), h('span', { class: 'pz-ref', text: o.ref })),
      h('div', { class: 'pz-stamp', text: 'Detained' }),
      h('table', { class: 'pz-table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Offence' }), h('th', { text: 'Where' }))),
        h('tbody', {}, ...(o.charges.length ? o.charges.map((c) => h('tr', {}, h('td', { text: c.what }), h('td', { text: c.where }))) : [h('tr', {}, h('td', { text: 'Wanted for questioning' }), h('td', { text: 'None they can make stick' }))])),
      ),
      h('p', { class: 'pz-row' }, h('span', { text: 'Property' }), h('b', { text: o.seized })),
      h('div', { class: 'pz-figures' },
        h('div', {}, h('span', { text: 'Bail' }), h('b', { text: money(o.bail) })),
        o.time
          ? h('div', { class: 'pz-time' }, h('span', { text: 'Can\u2019t pay: time in the cell' }), h('b', { text: `${Math.floor(o.time / 60)}:${String(o.time % 60).padStart(2, '0')}` }))
          : h('div', {}, h('span', { text: 'Release' }), h('b', { text: 'When it\u2019s paid' })),
      ),
      h('div', { class: 'pz-notes' }, ...o.notes.map((n) => h('p', { class: 'pz-note', text: n }))),
      choices(o.choices),
    ),
  );
  return { el, onBack: o.choices[o.choices.length - 1].go };
}

/** The front counter: your file, and settling a district's fines. */
export function frontCounter(o: { sergeant: string; file: string[]; empty: boolean; choices: PoliceChoice[] }): Screen {
  const el = h('div', { class: 'screen pz-screen pz-counter' },
    h('div', { class: 'pz-card' },
      h('div', { class: 'pz-battenburg' }),
      h('header', { class: 'pz-head' }, badge(), h('div', {}, h('span', { class: 'pz-kicker', text: FORCE }), h('h2', { text: 'Front counter' }))),
      h('p', { class: 'pz-officer', text: o.sergeant }),
      o.empty ? h('p', { class: 'pz-know', text: 'Types your name in. Nothing comes up.' }) : h('ul', { class: 'pz-facts file' }, ...o.file.map((f) => h('li', { text: f }))),
      choices(o.choices),
    ),
  );
  return { el, onBack: o.choices[o.choices.length - 1].go };
}
