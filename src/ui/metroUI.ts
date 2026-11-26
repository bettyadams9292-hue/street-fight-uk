/**
 * The Metro's train screen (travel/metro.ts), in the venue kit's Metro look: where to, and the fare, paid as you board.
 */
import { h } from './dom';
import type { Progress } from '../progress/Progress';
import type { Screen } from './UIManager';
import { STATIONS, fare, stopsBetween, stationOf, type StationId } from '../travel/subway';
import { destinations } from '../travel/metro';
import { walletLine } from '../money/banking';
import { venueScreen, vnNote, vnRow, vnSection } from './venue';

export function trainScreen(p: Progress, here: StationId, ride: (to: StationId) => string | null, close: () => void): Screen {
  const note = vnNote('');
  const rows = destinations(p, here).map((to) => {
    const stops = stopsBetween(here, to).length - 1;
    return vnRow(stationOf(to).name, `${stops} stop${stops === 1 ? '' : 's'} · Zone ${stationOf(to).zone} · £${Math.ceil(fare(here, to))}`, 'Ride', () => {
      const why = ride(to);
      if (why) {
        note.textContent = why;
        note.className = 'vn-note bad';
      }
    });
  });
  const locked = STATIONS.filter((s) => !p.has(s.opens));
  return venueScreen({
    theme: 'metro',
    kicker: `Brack Metro · ${stationOf(here).name}`,
    title: 'Where to?',
    sub: 'Pay as you board: cash first, then your card. Mind the gap.',
    logo: '/art/metro/roundel.webp',
    wallet: walletLine(p),
    close,
    closeLabel: 'Stay on the platform',
    body: [
      note,
      rows.length ? vnSection('Stations', ...rows) : h('p', { class: 'vn-copy', text: 'Nowhere open to ride to yet.' }),
      locked.length ? h('p', { class: 'vn-copy small', text: `Shuttered till their district's boss is down: ${locked.map((s) => s.name).join(', ')}.` }) : null,
    ],
  });
}
