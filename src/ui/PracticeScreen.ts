import { STYLES } from '../data/styles';
import { STYLE_IDS, type StyleId } from '../styles/StyleData';
import { cycleRow, menuButton } from './controls';
import { h } from './dom';
import type { Screen, UIManager } from './UIManager';

/**
 * Training ground only: try any fighting style, and a second style to swap
 * to. In the full game you learn styles from trainers (Stage 5).
 */
export function practiceScreen(primary: StyleId, secondary: StyleId | null, ui: UIManager, apply: (p: StyleId, s: StyleId | null) => void): Screen {
  let p = primary;
  let s = secondary;
  const info = h('div', { class: 'style-info' });
  const render = () => {
    const st = STYLES[p];
    const moves = (['lp', 'hp', 'lk', 'hk'] as const).map((b) => `${b.toUpperCase()} ${st.moves[st.starters[b]].name}`).join(' · ');
    const specials = Object.entries(st.specials).map(([b, id]) => `SP+${b.toUpperCase()} ${st.moves[id!].name}`).join(' · ');
    info.replaceChildren(
      h('p', { class: 'blurb', text: st.blurb }),
      h('p', {}, h('b', { text: 'Strengths: ' }), st.strengths.join(', ')),
      h('p', {}, h('b', { text: 'Weaknesses: ' }), st.weaknesses.join(', ')),
      h('p', {}, h('b', { text: `${st.defenceName}: ` }), st.defenceText),
      h('p', {}, h('b', { text: 'Moves: ' }), moves),
      h('p', {}, h('b', { text: 'Specials: ' }), specials),
    );
  };
  const options = STYLE_IDS.map((id) => ({ value: id, label: STYLES[id].name }));
  const el = h(
    'div',
    { class: 'screen panel-screen' },
    h('h2', { text: 'Practice styles' }),
    h(
      'div',
      { class: 'panel' },
      cycleRow<StyleId>('Main style', options, p, (v) => {
        p = v;
        render();
      }),
      cycleRow<StyleId | null>('Swap to', [{ value: null, label: 'None' }, ...options], s, (v) => (s = v)),
      info,
      h('p', { class: 'hint', text: 'Training ground only. In the full game you learn styles from trainers at gyms and clubs. Swap stance in a fight with Tab, Back on a gamepad, or SWAP on touch.' }),
    ),
    h(
      'div',
      { class: 'panel-actions' },
      menuButton('Back', () => ui.pop()),
      menuButton('Use these styles', () => {
        apply(p, s && s !== p ? s : null);
        ui.pop();
      }),
    ),
  );
  render();
  return { el };
}
