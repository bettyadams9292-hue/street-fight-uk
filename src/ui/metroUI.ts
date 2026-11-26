/**
 * The Metro's screens (travel/metro.ts), in the venue kit's Metro look: the gate line (tap in, or hop the
 * barriers) and the train (where to; what the ride will cost when you tap out).
 */
import { h } from './dom';
import type { Progress } from '../progress/Progress';
import type { Screen } from './UIManager';
import { STATIONS, fare, stopsBetween, stationOf, type StationId } from '../travel/subway';
import { destinations, maxFare } from '../travel/metro';
import { walletLine } from '../money/banking';
import { venueScreen, vnNote, vnRow, vnSection } from './venue';

const money = (n: number) => `£${n.toFixed(2)}`;

export function gatesScreen(p: Progress, here: StationId, act: { tap: () => string | null; hop: () => void; close: () => void }): Screen {
  const st = stationOf(here);
  const need = maxFare(p, here);
  const note = vnNote('');
  const screen = venueScreen({
    theme: 'metro',
    kicker: `Brack Metro · Zone ${st.zone}`,
    title: 'Ticket barriers',
    sub: `${st.name}. Pay as you go: the fare's taken when you tap out.`,
    logo: '/art/metro/roundel.webp',
    wallet: walletLine(p),
    close: act.close,
    body: [
      note,
      vnSection('Through the gates',
        vnRow('Tap in', p.save.bank ? `Your ${p.save.bank === 'lloyds' ? 'Lloyd’s THC' : 'Califax'} card, or cash at the machine. You need ${money(need)} to travel.` : `Cash at the machine: you need ${money(need)} on you to travel.`, 'Tap in', () => {
          const why = act.tap();
          if (why) {
            note.textContent = why;
            note.className = 'vn-note bad';
          }
        }),
        vnRow('Hop the barriers', `Free, if nobody sees. Caught, it's a £50 penalty fare, the police told and it goes on your record. Staff on the gates in zone ${st.zone}${st.zone === 1 ? ': busy' : ''}.`, 'Hop it', act.hop, 'danger'),
      ),
    ],
  });
  return screen;
}

export function trainScreen(p: Progress, here: StationId, ride: (to: StationId) => void, close: () => void): Screen {
  const tapped = p.save.metro.tappedIn;
  const rows = destinations(p, here).map((to) => {
    const stops = stopsBetween(here, to).length - 1;
    const f = tapped ? fare(tapped, to) : 0;
    return vnRow(stationOf(to).name, `${stops} stop${stops === 1 ? '' : 's'} · Zone ${stationOf(to).zone}${tapped ? ` · ${money(f)} when you tap out` : ' · no ticket'}`, 'Ride', () => ride(to));
  });
  const locked = STATIONS.filter((s) => s.opens && !p.has(s.opens));
  return venueScreen({
    theme: 'metro',
    kicker: 'Brack Metro · On the train',
    title: 'Where to?',
    sub: tapped ? 'You tapped in. Mind the gap.' : 'No ticket. Keep your head down.',
    logo: '/art/metro/roundel.webp',
    close,
    closeLabel: 'Stay on the platform',
    body: [
      vnSection('Stations', ...rows),
      locked.length ? h('p', { class: 'vn-copy small', text: `Not running yet: ${locked.map((s) => s.name).join(', ')}.` }) : null,
    ],
  });
}
