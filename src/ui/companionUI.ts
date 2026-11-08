import type { Progress } from '../progress/Progress';
import { STYLES } from '../data/styles';
import { COMPANIONS, COMPANION_LIST, dismissCompanion, hireCompanion, setActiveCompanion, type CompanionDef } from '../companions/companions';
import { menuButton } from './controls';
import { h } from './dom';
import { panelScreen, result } from './hub';
import type { Screen } from './UIManager';

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

function card(c: CompanionDef): HTMLElement[] {
  const a = c.attributes;
  const stat = (label: string, v: number) => h('div', { class: 'stat-row' }, h('span', { text: label }), h('div', { class: 'stat-bar' }, h('i', { style: `width:${v * 10}%` })), h('em', { text: String(v) }));
  return [
    h('p', { class: 'hint', text: `${c.role} · ${STYLES[c.style].name}. Good: ${c.strengths}. Weak: ${c.weaknesses}.` }),
    stat('Strength', a.strength), stat('Speed', a.speed), stat('Endurance', a.endurance), stat('Defence', a.defence), stat('Technique', a.technique),
  ];
}

/** Talking to someone in the snug at the Red Lion. `challenge` starts their fight. */
export function recruitScreen(progress: Progress, id: string, close: () => void, saved: () => void, challenge: () => void): Screen {
  const c = COMPANIONS[id];
  let armed = false;
  return panelScreen(c.name, progress, (msg, rebuild) => {
    const s = progress.save.companions;
    const hired = s.recruited.includes(id);
    const locked = !!c.requires && !progress.has(c.requires);
    const rows: HTMLElement[] = [h('p', { class: 'quote', text: `“${hired ? 'Ready when you are.' : c.line}”` }), ...card(c)];
    if (hired) {
      rows.push(h('div', { class: 'row-actions' },
        s.active === id ? h('span', { class: 'owned-tag', text: 'With you' }) : menuButton('Bring them along', () => (result(setActiveCompanion(progress, id), `${c.nickname} is with you`, msg, saved), rebuild())),
      ));
    } else if (locked) {
      rows.push(h('p', { class: 'hub-warn', text: `${c.requiresText}. ${c.fee ? `Then it’s ${money(c.fee)}.` : ''}` }));
    } else if (c.challenge) {
      rows.push(h('p', { class: 'hint', text: 'Doesn’t want money: beat them in a fair fight here and they’ll join you. Nobody gets badly hurt (it stops when one of you is beaten).' }), menuButton('Fight them for it', challenge));
    } else {
      rows.push(menuButton(armed ? `Confirm: hire for ${money(c.fee)}` : `Hire — ${money(c.fee)}`, () => {
        if (!armed) {
          armed = true;
          return rebuild();
        }
        armed = false;
        result(hireCompanion(progress, id), `${c.nickname} is with you. They’ll follow you out.`, msg, saved);
        rebuild();
      }, armed ? 'Click again to confirm' : 'One-off fee, from your pocket then the tin'));
    }
    return rows;
  }, close);
}

/** Your crew: choose who follows you, or let someone go. Opened from the phone. */
export function crewScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  let armed: string | null = null;
  return panelScreen('Your crew', progress, (msg, rebuild) => {
    const s = progress.save.companions;
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: 'One person follows you at a time. They join fights, never touch passers-by, and get back up once a fight is over. They wait outside your house.' })];
    if (!s.recruited.length) rows.push(h('p', { text: 'Nobody yet. There are fighters for hire in the snug at the back of the Red Lion on the High Street.' }));
    for (const id of s.recruited) {
      const c = COMPANIONS[id];
      const active = s.active === id;
      rows.push(h('div', { class: `shop-row${active ? ' owned' : ''}` },
        h('div', { class: 'what' }, h('b', { text: `${c.name} — ${c.role}` }), h('span', { text: `${STYLES[c.style].name}. ${c.strengths}.` })),
        h('div', { class: 'row-actions' },
          active ? menuButton('Send home', () => (result(setActiveCompanion(progress, null), `${c.nickname} heads off`, msg, saved), rebuild()), undefined, 'small')
            : menuButton('Bring along', () => (result(setActiveCompanion(progress, id), `${c.nickname} is with you`, msg, saved), rebuild()), undefined, 'small'),
          menuButton(armed === id ? 'Confirm: let go' : 'Let go', () => {
            if (armed !== id) {
              armed = id;
              return rebuild();
            }
            armed = null;
            result(dismissCompanion(progress, id), `${c.nickname} is off your books (fee not refunded)`, msg, saved);
            rebuild();
          }, armed === id ? 'No refund' : undefined, 'small'),
        )));
    }
    const others = COMPANION_LIST.filter((c) => !s.recruited.includes(c.id));
    if (others.length) rows.push(h('p', { class: 'hint', text: `Still about in the Red Lion: ${others.map((c) => c.nickname).join(', ')}.` }));
    return rows;
  }, close);
}
