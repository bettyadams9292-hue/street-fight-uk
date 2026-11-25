/**
 * A cashpoint (money/atm.ts): the machine's screen. Your CaliBank balance and what's on you, buttons to take cash
 * out (with the fee on a pay-to-use machine) and to pay it in.
 */
import { ATM_MAX, DEPOSIT_STEPS, WITHDRAW_STEPS, atmFee, deposit, withdraw } from '../money/atm';
import type { Progress } from '../progress/Progress';
import { menuButton } from './controls';
import { h } from './dom';
import type { Screen, UIManager } from './UIManager';

export function atmScreen(p: Progress, ui: UIManager, district: string, saved: () => void, close: () => void): Screen {
  const el = h('div', { class: 'screen atm-screen' });
  const fee = atmFee(district);
  let message = fee ? `This machine charges £${fee} to take cash out.` : 'Free cash withdrawals.';
  let bad = false;

  const key = (label: string, sub: string, ok: boolean, go: () => void): HTMLElement =>
    h('button', { class: 'atm-key', 'data-nav': true, 'data-grid': true, disabled: !ok, onclick: go }, h('b', { text: label }), h('span', { text: sub }));

  const build = (): void => {
    const c = p.save.cash;
    const take = (n: number) => {
      const r = withdraw(p, n, district);
      if (!r.ok) {
        message = r.reason;
        bad = true;
      } else {
        message = `Take your cash: £${r.amount}.${r.fee ? ` £${r.fee} fee.` : ''}`;
        bad = false;
        saved();
      }
      build();
    };
    const put = (n: number) => {
      const r = deposit(p, n);
      if (!r.ok) {
        message = r.reason;
        bad = true;
      } else {
        message = `Paid in: £${r.amount}. It’s safe if you get battered.`;
        bad = false;
        saved();
      }
      build();
    };
    const outs = WITHDRAW_STEPS.map((n) => key(`£${n}`, fee ? `+£${fee} fee` : 'Free', c.bank >= n + fee, () => take(n)));
    const most = Math.min(ATM_MAX, c.bank - fee);
    const ins = [...DEPOSIT_STEPS.map((n) => key(`£${n}`, 'Pay in', c.pocket >= n, () => put(n))), key('All of it', c.pocket > 0 ? `£${c.pocket}` : 'Nothing on you', c.pocket > 0, () => put(Infinity))];
    el.replaceChildren(
      h(
        'div',
        { class: 'atm-face' },
        h('div', { class: 'atm-brand' }, h('b', { text: 'CaliBank' }), h('span', { text: fee ? 'Cash machine · charges apply' : 'Free cash machine' })),
        h(
          'div',
          { class: 'atm-bal' },
          h('div', {}, h('span', { text: 'Available balance' }), h('b', { text: `£${c.bank.toLocaleString('en-GB')}` })),
          h('div', {}, h('span', { text: 'Cash on you' }), h('b', { text: `£${c.pocket.toLocaleString('en-GB')}` })),
        ),
        h('div', { class: 'atm-sec', text: 'Take cash out' }),
        h('div', { class: 'atm-keys' }, ...outs),
        most > 0 && !WITHDRAW_STEPS.includes(most as never) && most < ATM_MAX ? h('div', { class: 'atm-keys one' }, key(`£${most}`, 'Everything left', true, () => take(most))) : null,
        h('div', { class: 'atm-sec', text: 'Pay cash in' }),
        h('div', { class: 'atm-keys' }, ...ins),
        h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message }),
      ),
      h('div', { class: 'panel-actions' }, menuButton('Take card', close, 'Done')),
    );
    ui.keepFocus();
  };

  return { el, onShow: build, onBack: close };
}
