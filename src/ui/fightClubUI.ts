/**
 * The Arches on screen (fightclub/club.ts): Sully's card. Tonight's fight, the ladder, the title and its defences.
 */
import { h } from './dom';
import { menuButton } from './controls';
import { panelScreen } from './hub';
import type { Screen } from './UIManager';
import type { Progress } from '../progress/Progress';
import {
  CHAMPION, DEFENCE_TRIPS, nightOf, NIGHT_SECONDS, LADDER, STRIP_TRIPS, buyInOf, canFight, clubTick, defencePurse, foughtTonight, nextBout, purseOf, standing, type Bout,
} from '../fightclub/club';

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

function boutTitle(b: Bout): string {
  return b.kind === 'defence' ? `Title defence ${b.n + 1}` : b.kind === 'title' ? (b.rematch ? 'Title rematch' : 'Title fight') : `Number ${LADDER.length - b.rank} on the card`;
}

/**
 * Sully's card. `fight` pays the buy-in and rings the bell (Game: World.startClubFight); it returns a reason when
 * it can't.
 */
export function clubScreen(p: Progress, close: () => void, fight: (b: Bout) => string | null): Screen {
  return panelScreen('The Arches', p, (msg, rebuild) => {
    const c = p.save.club;
    if (clubTick(p).stripped) msg('You kept a challenger waiting too long. They’ve stripped you of the title: win it back.', true);
    const rows: HTMLElement[] = [];
    rows.push(h('p', { class: 'quote', text: c.wins + c.losses === 0
      ? '“Licensed boxing never paid me a penny. This pays. One fight a night, winner takes the purse, loser loses the buy-in. Climb the card and you get a go at Iron Mick for the belt.” – Sully'
      : c.champion ? '“Champ. Every few nights someone wants that belt. Keep them waiting and they’ll take it off you anyway.” – Sully'
      : '“Back for more? Good.” – Sully' }));
    rows.push(h('div', { class: 'club-standing' },
      h('b', { text: standing(p) }),
      h('small', { text: `Record ${c.wins}–${c.losses}${c.earned ? ` · ${money(c.earned)} in purses` : ''}${c.everChamp ? ` · ${c.defences} defence${c.defences === 1 ? '' : 's'}` : ''}` }),
    ));

    // Tonight.
    rows.push(h('div', { class: 'job-sec', text: 'Tonight' }));
    const b = nextBout(p);
    if (!b) {
      const left = (c.due ?? 0) - nightOf(p);
      rows.push(h('p', { class: 'ph-empty', text: `No challenger yet. The next one’s ready in ${left} night${left === 1 ? '' : 's'}, for ${money(defencePurse(c.defences))}.` }));
    } else if (foughtTonight(p)) {
      rows.push(h('p', { class: 'ph-empty', text: `You’ve had your fight tonight. The next night starts after about ${Math.ceil((NIGHT_SECONDS - (p.save.playTime % NIGHT_SECONDS)) / 60)} more minutes out there.` }));
    } else {
      const purse = purseOf(b);
      const buy = buyInOf(b);
      const can = canFight(p, b);
      rows.push(h('div', { class: `job-card club-bout${b.kind === 'ladder' ? '' : ' title'}` },
        h('div', { class: 'job-head' }, h('b', { class: 'job-title', text: b.who.name }), h('span', { class: 'job-kind', text: boutTitle(b) })),
        h('p', { class: 'job-brief', text: b.who.blurb }),
        h('div', { class: 'club-pay' },
          h('span', { text: `Purse ${money(purse)}` }),
          h('span', { text: buy ? `Buy-in ${money(buy)}` : 'No buy-in: you’re the champ' }),
          b.kind === 'title' && !c.everChamp ? h('span', { class: 'club-belt', text: 'Win: the Arches belt (one of a kind)' }) : null,
        ),
        h('div', { class: 'row-actions' }, menuButton('Fight', () => {
          const why = fight(b);
          if (why) return msg(why, true), rebuild();
        }, can.ok ? `${buy ? `${money(buy)} in · ` : ''}${money(purse)} to win` : can.reason, 'primary', undefined, undefined, 'fight')),
      ));
    }

    // The ladder.
    rows.push(h('div', { class: 'job-sec', text: 'The card' }));
    const holder = c.champion ? 'You' : c.holder !== null ? 'The man who beat you' : CHAMPION.name;
    rows.push(h('div', { class: `club-rung champ${c.champion ? ' you' : ''}` }, h('span', { class: 'club-no', text: 'C' }), h('b', { text: holder }), h('small', { text: c.champion ? 'Champion' : money(purseOf(nextBoutTitle(p))) })));
    for (let i = LADDER.length - 1; i >= 0; i--) {
      const f = LADDER[i];
      const beaten = c.rank > i;
      const next = !c.champion && c.rank === i;
      rows.push(h('div', { class: `club-rung${beaten ? ' beaten' : ''}${next ? ' next' : ''}` },
        h('span', { class: 'club-no', text: String(LADDER.length - i) }),
        h('b', { text: f.name }),
        h('small', { text: beaten ? 'Beaten' : `${money(f.purse)} purse` }),
      ));
    }
    rows.push(h('p', { class: 'club-rules', text: `To the stoppage, one on one in the pit: no weapons, no crew. The doctor patches you up after. Hold the title and a challenger’s due every ${DEFENCE_TRIPS} nights (a night is about ${NIGHT_SECONDS / 60} minutes of play) (more money each time you keep it); leave them waiting ${STRIP_TRIPS} nights past that and you’re stripped.` }));
    return rows;
  }, close);
}

/** The title fight as it stands, for the champion's row (who has it, and its purse). */
function nextBoutTitle(p: Progress): Bout {
  const b = nextBout(p);
  return b && b.kind !== 'ladder' ? b : { kind: 'title', who: CHAMPION, rematch: false };
}
