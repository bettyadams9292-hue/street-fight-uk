import type { Progress } from '../progress/Progress';
import { COMPANIONS, followMe, hireCompanion, type CompanionDef } from '../companions/companions';
import { FIGHT_STYLES, PERSONALITIES } from '../companions/personality';
import { menuButton } from './controls';
import { h } from './dom';
import { panelScreen, result } from './hub';
import type { Screen } from './UIManager';

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

function card(c: CompanionDef): HTMLElement[] {
  const a = c.attributes;
  const stat = (label: string, v: number) => h('div', { class: 'stat-row' }, h('span', { text: label }), h('div', { class: 'stat-bar' }, h('i', { style: `width:${v * 10}%` })), h('em', { text: String(v) }));
  return [
    h('p', { class: 'hint', text: `${PERSONALITIES[c.personality].name} · ${FIGHT_STYLES[c.fightStyle].name}. ${PERSONALITIES[c.personality].text}` }),
    h('p', { class: 'hint', text: `Good: ${c.strengths}. Weak: ${c.weaknesses}.` }),
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
        s.following.includes(id) ? h('span', { class: 'owned-tag', text: 'With you' }) : menuButton('Bring them along', () => (result(followMe(progress, id), `${c.nickname} is with you`, msg, saved), rebuild())),
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
