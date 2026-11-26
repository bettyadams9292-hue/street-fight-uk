/**
 * The nudge to pick a bank (`Game.bankNudge`): the bank app is on the phone now, and you choose Califax or
 * Lloyd's THC in CaliStore. One card, the two banks' logos, Open my phone or Later.
 */
import { h } from './dom';
import { menuButton } from './controls';
import type { Screen } from './UIManager';
import { BANKS } from '../money/atm';

export function bankPrompt(openPhone: () => void, later: () => void): Screen {
  const logo = (id: 'califax' | 'lloyds') => {
    const b = BANKS[id];
    return h('span', { class: 'bp-logo', style: `background:${b.bg}` }, b.logo ? h('img', { src: b.logo, alt: b.name, draggable: 'false' }) : h('b', { text: b.mark }));
  };
  const el = h('div', { class: 'screen bp-screen' },
    h('div', { class: 'bp-card' },
      h('div', { class: 'bp-logos' }, logo('califax'), logo('lloyds')),
      h('h2', { text: 'Pick a bank' }),
      h('p', { text: 'Your money’s on your phone now. Open CaliStore and get the Califax or Lloyd’s THC app: your own bank’s cash machines are free, the other one charges.' }),
      h('nav', { class: 'bp-actions menu-list' },
        menuButton('Open my phone', openPhone, 'Choose in CaliStore', 'bp-btn primary', undefined, undefined, ''),
        menuButton('Later', later, 'It’s on the phone when you want it', 'bp-btn', undefined, undefined, ''),
      ),
    ),
  );
  return { el, onBack: later };
}
