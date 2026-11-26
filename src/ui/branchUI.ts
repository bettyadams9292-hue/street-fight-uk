/**
 * A bank branch's counter (station `bank_counter`, money/banking.ts): pay cash in, take cash out, no fee. Only your
 * own bank serves you; at the other bank's counter you can move your account here. In the bank's own colours.
 */
import { h } from './dom';
import type { Progress } from '../progress/Progress';
import type { Screen } from './UIManager';
import { BANKS, type BankId } from '../money/atm';
import { BRANCH_OF, accountNumber, branchDeposit, branchWithdraw, chooseBank, walletLine } from '../money/banking';
import { venueScreen, vnChips, vnNote, vnRow, vnSection, vnStat } from './venue';

const TELLERS: Record<BankId, string> = { califax: 'Priya at counter 2', lloyds: 'Gareth at counter 1' };

export function branchScreen(p: Progress, id: BankId, saved: () => void, close: () => void): Screen {
  const bank = BANKS[id];
  let note = '';
  let bad = false;
  const say = (t: string, b = false) => ((note = t), (bad = b), build());
  const holder = h('div', { class: 'vn-slot' });
  const screen = venueScreen({
    theme: { bg: bank.bg, panel: bank.panel, ink: bank.ink, accent: bank.accent, band: `linear-gradient(90deg, ${bank.accent}, ${bank.panel})` },
    kicker: `${bank.name} · ${BRANCH_OF[id]} branch`,
    title: 'Counter',
    sub: TELLERS[id],
    logo: bank.logo,
    logoPlate: bank.bg,
    wallet: walletLine(p),
    body: [holder],
    close,
    cls: 'vn-bank',
  });
  const wallet = screen.card.querySelector('.vn-wallet');

  const amounts = (have: number) => [10, 20, 50, 100, 500].filter((n) => n <= have);

  function build(): void {
    const c = p.save.cash;
    const mine = p.save.bank === id;
    if (wallet) wallet.textContent = walletLine(p);
    const out: HTMLElement[] = [vnNote(note, bad)];
    if (!mine) {
      const other = p.save.bank ? BANKS[p.save.bank].name : null;
      out.push(vnSection(other ? `You bank with ${other}` : 'No account yet',
        h('p', { class: 'vn-copy', text: other
          ? `We can only serve our own customers at the counter. Move your account to ${bank.name} and the same money comes with you: free, and ${bank.name} machines are free to use.`
          : `Open an account and your money's safe from muggings, beatings and the police. Pay in here, take out here or at any ${bank.name} machine, and your card pays in shops when your cash runs out.` }),
        vnRow(other ? `Move to ${bank.name}` : `Open a ${bank.name} account`, 'Takes a minute. The app goes on your phone.', other ? 'Move my account' : 'Open account', () => {
          chooseBank(p, id);
          saved();
          say(other ? `Your account's with ${bank.name} now.` : `Welcome to ${bank.name}. Your card's in the post: it's on your phone already.`);
        }),
      ));
    } else {
      out.push(h('div', { class: 'vn-stats' },
        vnStat('Account balance', `£${c.bank.toLocaleString('en-GB')}`, 'big'),
        vnStat('Cash on you', `£${c.pocket.toLocaleString('en-GB')}`),
        vnStat('Account', accountNumber(p.save.character.name, id)),
      ));
      const payIn = (n: number) => () => {
        const r = branchDeposit(p, n, id);
        if (!r.ok) return say(r.reason, true);
        saved();
        say(`Paid in £${r.amount}. Balance £${p.save.cash.bank.toLocaleString('en-GB')}.`);
      };
      const takeOut = (n: number) => () => {
        const r = branchWithdraw(p, n, id);
        if (!r.ok) return say(r.reason, true);
        saved();
        say(`£${r.amount} counted out. Mind how you go.`);
      };
      out.push(vnSection('Pay in',
        c.pocket > 0
          ? vnChips([...amounts(c.pocket).map((n) => ({ label: `£${n}`, go: payIn(n) })), { label: `All £${c.pocket.toLocaleString('en-GB')}`, go: payIn(c.pocket), on: true }])
          : h('p', { class: 'vn-copy', text: 'You’ve no cash on you to pay in.' }),
      ));
      out.push(vnSection('Take out',
        c.bank > 0
          ? vnChips([...amounts(c.bank).map((n) => ({ label: `£${n}`, go: takeOut(n) })), { label: `All £${c.bank.toLocaleString('en-GB')}`, go: takeOut(c.bank) }])
          : h('p', { class: 'vn-copy', text: 'There’s nothing in your account.' }),
        h('p', { class: 'vn-copy small', text: 'No fee at the counter. Cash on you can be lost: only take what you need.' }),
      ));
    }
    holder.replaceChildren(...out);
  }
  build();
  return screen;
}
