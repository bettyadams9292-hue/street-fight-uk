/**
 * The cash machine's software (money/atm.ts): what you see on the screen of a Califax or Lloyd's THC machine.
 *
 * Laid out like a British cash machine: a screen with four rows of options, each lined up with a physical
 * button at either side (the buttons and the words both press it), and the machine's keypad under it (beside it
 * on a phone held sideways) for typing an amount. One component for both banks; the brand (`BankBrand`) only
 * sets the name, colours, wordmark and messages. The money moves through `withdraw` / `deposit`, the same account
 * as the tin at home and the phone's CaliBank app.
 *
 * Opening plays the card-and-PIN sequence (about 2.5 s; the PIN fills itself). Every transaction runs once: the
 * money moves the moment it's confirmed, before the "counting" screens, and nothing can be pressed while they
 * play, so a double tap or closing the machine part-way can't pay twice or lose anything.
 */
import { ATM_MAX, DEPOSIT_STEPS, NOTE, WITHDRAW_STEPS, atmFee, deposit, withdraw, type BankBrand } from '../money/atm';
import type { Progress } from '../progress/Progress';
import { h } from './dom';
import type { Screen, UIManager } from './UIManager';

export type AtmSound = 'key' | 'ok' | 'err' | 'count';

interface Opt {
  label: string;
  go: () => void;
  off?: boolean;
}
type Row = [Opt | null, Opt | null, Opt | null, Opt | null];
interface View {
  body: (string | HTMLElement | null)[];
  left?: Row;
  right?: Row;
  /** Keypad entry is on. */
  entry?: boolean;
}

const E: Row = [null, null, null, null];
const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export function atmScreen(
  p: Progress,
  ui: UIManager,
  district: string,
  bank: BankBrand,
  saved: () => void,
  close: () => void,
  sound: (k: AtmSound) => void = () => {},
): Screen {
  const el = h('div', { class: `screen atm-screen atm-${bank.id}` });
  el.style.setProperty('--atm-bg', bank.bg);
  el.style.setProperty('--atm-panel', bank.panel);
  el.style.setProperty('--atm-ink', bank.ink);
  el.style.setProperty('--atm-accent', bank.accent);
  const fee = atmFee(district);

  let alive = true;
  let busy = false;
  let leaving = false;
  let view: View = { body: [] };
  /** Keypad entry: what's typed, and what happens on ENTER. */
  let typed = '';
  let entryMax = 3;
  let onEnter: ((n: number) => void) | null = null;
  let onCancel: (() => void) | null = null;
  const timers: number[] = [];

  /** Later, unless the machine's closed by then (or is saying goodbye: only the goodbye's own timer still runs). */
  const after = (ms: number, fn: () => void, always = false) => {
    timers.push(window.setTimeout(() => alive && (always || !leaving) && fn(), ms));
  };
  /** A run of screens one after another, input off until the last. */
  const sequence = (steps: [number, () => View][], then: () => void) => {
    busy = true;
    let t = 0;
    for (const [ms, v] of steps) {
      const at = t;
      after(at, () => show(v()));
      t += ms;
    }
    after(t, () => {
      busy = false;
      then();
    });
  };

  const loader = () => h('div', { class: 'atm-loader' }, h('i'), h('i'), h('i'));
  const msg = (text: string, cls = '') => h('p', { class: `atm-msg ${cls}`.trim(), text });
  const big = (text: string) => h('p', { class: 'atm-big', text });
  const opt = (label: string, go: () => void, off = false): Opt => ({ label, go, off });

  // ---- the screens ------------------------------------------------------------------------------------------

  const menu = (): void => {
    show({
      body: [msg(bank.welcome, 'atm-title'), msg('Please select a service.')],
      left: [opt('Cash Withdrawal', withdrawal), opt('Cash Deposit', depositMenu), null, null],
      right: [opt('Balance Enquiry', balance), opt('Recent Transactions', statement), null, opt('Return Card', exit)],
    });
  };

  const another = (): View => ({
    body: [msg('Would you like another service?')],
    left: [null, null, null, opt('NO', exit)],
    right: [null, null, null, opt('YES', menu)],
  });

  const error = (text: string, back: () => void): void => {
    sound('err');
    show({
      body: [msg('Sorry', 'atm-title atm-bad'), msg(text)],
      left: [null, null, null, opt('Return Card', exit)],
      right: [null, null, null, opt('Back', back)],
    });
  };

  const withdrawal = (): void => {
    const c = p.save.cash;
    const take = (n: number) => () => doWithdraw(n);
    show({
      body: [
        msg('Cash Withdrawal', 'atm-title'),
        msg('Please select an amount:'),
        msg(fee ? `This machine charges £${fee} per withdrawal.` : 'Free cash withdrawals.', 'atm-small'),
        msg(`Available balance ${gbp(c.bank)}`, 'atm-small'),
      ],
      left: [opt(gbp(WITHDRAW_STEPS[0]), take(WITHDRAW_STEPS[0])), opt(gbp(WITHDRAW_STEPS[1]), take(WITHDRAW_STEPS[1])), opt(gbp(WITHDRAW_STEPS[2]), take(WITHDRAW_STEPS[2])), opt('Other Amount', () => entry('withdraw'))],
      right: [opt(gbp(WITHDRAW_STEPS[3]), take(WITHDRAW_STEPS[3])), opt(gbp(WITHDRAW_STEPS[4]), take(WITHDRAW_STEPS[4])), opt(gbp(WITHDRAW_STEPS[5]), take(WITHDRAW_STEPS[5])), opt('Cancel', menu)],
    });
  };

  const depositMenu = (): void => {
    const pocket = p.save.cash.pocket;
    if (pocket <= 0) return error('You have no cash to deposit.', menu);
    const put = (n: number) => () => confirmDeposit(n);
    const d = DEPOSIT_STEPS;
    show({
      body: [msg('Cash Deposit', 'atm-title'), msg('Please select an amount:'), msg(`Cash available ${gbp(pocket)}`, 'atm-small')],
      left: [opt(gbp(d[0]), put(d[0]), pocket < d[0]), opt(gbp(d[1]), put(d[1]), pocket < d[1]), opt(gbp(d[2]), put(d[2]), pocket < d[2]), opt('Other Amount', () => entry('deposit'))],
      right: [opt(gbp(d[3]), put(d[3]), pocket < d[3]), opt(gbp(d[4]), put(d[4]), pocket < d[4]), opt(`Deposit All (${gbp(pocket)})`, put(pocket)), opt('Cancel', menu)],
    });
  };

  const confirmDeposit = (n: number): void => {
    if (n > p.save.cash.pocket) return error('You don’t have that much cash on you.', depositMenu);
    show({
      body: [msg('Cash Deposit', 'atm-title'), msg('You are depositing:'), big(gbp(n)), msg('Please confirm.')],
      left: [null, null, null, opt('Cancel', depositMenu)],
      right: [null, null, null, opt('Confirm', () => doDeposit(n))],
    });
  };

  /** Other Amount: the keypad. */
  const entry = (mode: 'withdraw' | 'deposit'): void => {
    typed = '';
    entryMax = mode === 'withdraw' ? String(ATM_MAX).length : 6;
    onEnter = (n) => (mode === 'withdraw' ? doWithdraw(n) : confirmDeposit(n));
    onCancel = mode === 'withdraw' ? withdrawal : depositMenu;
    showEntry(mode);
  };
  let entryMode: 'withdraw' | 'deposit' = 'withdraw';
  const showEntry = (mode = entryMode): void => {
    entryMode = mode;
    show({
      body: [
        msg(mode === 'withdraw' ? 'Cash Withdrawal' : 'Cash Deposit', 'atm-title'),
        msg(mode === 'withdraw' ? `Enter the amount, in multiples of £${NOTE} (up to ${gbp(ATM_MAX)}):` : `Enter the amount (you have ${gbp(p.save.cash.pocket)}):`),
        h('div', { class: 'atm-amount' }, h('span', { text: '£' }), h('b', { text: typed || '0' })),
        msg('Then press ENTER.', 'atm-small'),
      ],
      left: [null, null, null, opt('Cancel', () => onCancel?.())],
      right: [null, null, opt('Clear', () => key('clear')), opt('Enter', () => key('enter'))],
      entry: true,
    });
  };
  const key = (k: string): void => {
    if (!view.entry || busy) return;
    sound('key');
    if (k === 'clear') typed = '';
    else if (k === 'cancel') return void onCancel?.();
    else if (k === 'enter') {
      const n = Number(typed || '0');
      if (n <= 0) return error('Please enter an amount.', () => showEntry());
      return onEnter?.(n);
    } else if (/^\d$/.test(k) && typed.length < entryMax && !(typed === '' && k === '0')) typed += k;
    showEntry();
  };

  const doWithdraw = (n: number): void => {
    if (busy) return;
    const r = withdraw(p, n, district);
    if (!r.ok) return error(r.reason, withdrawal);
    saved();
    const done = { type: 'Cash withdrawal', amount: r.amount, fee: r.fee, balance: p.save.cash.bank };
    sequence(
      [
        [650, () => ({ body: [msg('Processing your withdrawal…'), loader()] })],
        [800, () => (sound('count'), { body: [msg('Counting your cash…'), loader()] })],
        [900, () => (sound('ok'), { body: [msg('Please take your cash.', 'atm-title'), big(gbp(r.amount)), r.fee ? msg(`A £${r.fee} fee has been charged.`, 'atm-small') : null] })],
      ],
      () => receiptAsk(done),
    );
  };

  const doDeposit = (n: number): void => {
    if (busy) return;
    const r = deposit(p, n, district);
    if (!r.ok) return error(r.reason, depositMenu);
    saved();
    const done = { type: 'Cash deposit', amount: r.amount, fee: 0, balance: p.save.cash.bank };
    sequence(
      [
        [650, () => ({ body: [msg('Processing your deposit…'), loader()] })],
        [800, () => (sound('count'), { body: [msg('Counting your cash…'), loader()] })],
        [1100, () => (sound('ok'), { body: [msg('Deposit accepted.', 'atm-title'), big(gbp(r.amount)), msg(`New balance ${gbp(done.balance)}`)] })],
      ],
      () => receiptAsk(done),
    );
  };

  interface Done { type: string; amount: number; fee: number; balance: number }
  const receiptAsk = (d: Done): void => {
    show({
      body: [msg('Would you like a receipt?')],
      left: [null, null, null, opt('NO', () => show(another()))],
      right: [null, null, null, opt('YES', () => receipt(d))],
    });
  };

  const receipt = (d: Done): void => {
    const now = new Date();
    const line = (a: string, b: string) => h('div', { class: 'atm-rline' }, h('span', { text: a }), h('b', { text: b }));
    const slip = h(
      'div',
      { class: 'atm-receipt' },
      h('div', { class: 'atm-rhead', text: bank.mark }),
      line('Date', now.toLocaleDateString('en-GB')),
      line('Time', now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
      line('Location', district),
      line('Transaction', d.type),
      line('Amount', gbp(d.amount)),
      d.fee ? line('Fee', gbp(d.fee)) : null,
      line('Available balance', gbp(d.balance)),
      h('div', { class: 'atm-rfoot', text: `Thank you for banking with ${bank.name}` }),
    );
    show({ body: [slip], left: [null, null, null, opt('Return Card', exit)], right: [null, null, null, opt('Another Service', menu)] });
  };

  const balance = (): void => {
    show({
      body: [msg('ACCOUNT BALANCE', 'atm-title'), msg('Available balance:'), big(gbp(p.save.cash.bank)), msg('Would you like another service?', 'atm-small')],
      left: [null, null, null, opt('NO', exit)],
      right: [null, null, null, opt('YES', menu)],
    });
  };

  const statement = (): void => {
    const lines = p.save.finance.ledger.slice(-6).reverse();
    const now = p.save.playTime;
    const when = (t: number) => {
      const m = Math.max(0, Math.round((now - t) / 60));
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
    };
    const rows = lines.length
      ? lines.map((l) => h('div', { class: 'atm-sline' }, h('small', { text: when(l.t) }), h('span', { text: l.what }), h('b', { text: `${l.amount >= 0 ? '+' : '−'}${gbp(Math.abs(l.amount))}` })))
      : [msg('No recent transactions.', 'atm-small')];
    show({
      body: [msg('MINI STATEMENT', 'atm-title'), h('div', { class: 'atm-statement' }, ...rows), msg(`Available balance ${gbp(p.save.cash.bank)}`, 'atm-small')],
      left: [null, null, null, opt('Return Card', exit)],
      right: [null, null, null, opt('Another Service', menu)],
    });
  };

  const exit = (): void => {
    if (leaving) return;
    leaving = true;
    busy = true;
    sound('ok');
    show({ body: [msg(`Thank you for banking with ${bank.name}.`, 'atm-title'), msg('Please take your card.'), loader()] });
    after(1100, finish, true);
  };
  const finish = (): void => {
    if (!alive) return;
    alive = false;
    for (const t of timers) clearTimeout(t);
    window.removeEventListener('keydown', onKey, true);
    close();
  };

  const boot = (): void => {
    const dots = (n: number) => h('div', { class: 'atm-pin' }, ...[0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
    const head = (text: string) => [msg(text), loader()];
    sequence(
      [
        [450, () => ({ body: [h('div', { class: 'atm-hero', text: bank.mark }), loader()] })],
        [600, () => ({ body: head('Reading your card…') })],
        [250, () => ({ body: [msg('Please enter your PIN'), dots(0)] })],
        ...[1, 2, 3, 4].map((n): [number, () => View] => [n === 4 ? 300 : 180, () => (sound('key'), { body: [msg('Please enter your PIN'), dots(n)] })]),
        [600, () => ({ body: head('Verifying your details…') })],
      ],
      menu,
    );
  };

  // ---- drawing -----------------------------------------------------------------------------------------------

  const glass = h('div', { class: 'atm-glass' });
  const head = h('div', { class: 'atm-head' });
  const body = h('div', { class: 'atm-body' });
  const grid = h('div', { class: 'atm-bezel' });
  const pad = h('div', { class: 'atm-keypad' });

  const press = (o: Opt | null) => () => {
    if (!o || o.off || busy) return;
    sound('key');
    o.go();
  };

  const show = (v: View): void => {
    if (!alive) return;
    view = v;
    body.replaceChildren(...v.body.filter((x): x is string | HTMLElement => x !== null).map((x) => (typeof x === 'string' ? msg(x) : x)));
    // With no options on screen the message sits in the middle of the whole glass.
    body.style.gridRow = [...(v.left ?? E), ...(v.right ?? E)].some(Boolean) ? '' : '1 / 6';
    const kids: HTMLElement[] = [glass, head, body];
    for (const side of ['left', 'right'] as const) {
      const row = v[side] ?? E;
      row.forEach((o, i) => {
        const r = String(i + 2);
        kids.push(h('button', { class: `atm-side ${side}${o && !o.off && !busy ? ' live' : ''}`, style: `grid-row:${r}`, 'aria-label': o?.label ?? 'Unused button', tabindex: -1, onclick: press(o) }));
        if (o) kids.push(h('button', { class: `atm-opt ${side}${o.off ? ' off' : ''}`, style: `grid-row:${r}`, 'data-nav': true, disabled: o.off || busy, onclick: press(o) }, h('span', { text: o.label })));
      });
    }
    grid.replaceChildren(...kids);
    pad.classList.toggle('live', !!v.entry && !busy);
    ui.keepFocus();
  };

  // The keypad: always there like the real thing, live only while typing an amount.
  const padKey = (label: string, k: string, cls = '') => h('button', { class: `atm-k ${cls}`.trim(), tabindex: -1, onclick: () => key(k) }, label);
  pad.append(
    padKey('1', '1'), padKey('2', '2'), padKey('3', '3'), padKey('CANCEL', 'cancel', 'cancel'),
    padKey('4', '4'), padKey('5', '5'), padKey('6', '6'), padKey('CLEAR', 'clear', 'clear'),
    padKey('7', '7'), padKey('8', '8'), padKey('9', '9'), padKey('ENTER', 'enter', 'enter'),
    padKey('', 'none', 'blank'), padKey('0', '0'), padKey('', 'none', 'blank'), padKey('', 'none', 'blank'),
  );
  const onKey = (e: KeyboardEvent): void => {
    if (!el.isConnected) return void window.removeEventListener('keydown', onKey, true);
    if (!view.entry || busy) return;
    if (/^\d$/.test(e.key)) key(e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete') key('clear');
    else if (e.key === 'Enter') key('enter');
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  el.append(
    h(
      'div',
      { class: 'atm-machine' },
      h('div', { class: 'atm-fascia', style: `background:${bank.fascia[0]};color:${bank.fascia[1]}`, text: bank.mark }),
      h('div', { class: 'atm-front' }, grid, pad),
    ),
  );
  head.append(h('b', { text: bank.mark }), h('span', { text: fee ? `Charges £${fee}` : 'Free withdrawals' }));

  let started = false;
  return {
    el,
    onShow: () => {
      if (started) return show(view);
      started = true;
      window.addEventListener('keydown', onKey, true);
      boot();
    },
    onBack: () => {
      if (view.entry) return void onCancel?.();
      exit();
    },
  };
}
