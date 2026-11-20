/**
 * The phone (CaliLabsOS): how you get at everything out of a fight. Pull it up with its button (or P), put it away
 * the same way. It slides up from the bottom right like a phone out of a pocket, and slides back down.
 *
 * Apps that live on the phone: Messages (Mo, your needs, what's happened), Cabs (Dave's Cabs and walking home),
 * CaliBank (your money and where it went), Jobs (what to do next) and Home (edit your house, when you're in it).
 * Map, Me and Crew and Settings open inside it (your pockets and bag are on you, not on the phone), like the bigger apps on a real phone.
 */
import { h } from '../dom';
import type { AreaId, Progress } from '../../progress/Progress';
import { cabStop, onMap, place, places, travelOptions, unlocked, type TravelOption } from '../../map/worldMap';
import { TAXI_COST, moHint } from '../hub';
import { LEVELS } from '../../world/levels';
import { embedPortraitRules } from './embedCss';
import { mapApp } from './mapApp';

export interface PhoneMessage {
  text: string;
  kind: string;
}

export interface PhoneDeps {
  progress(): Progress | null;
  /** Where you are, and whether it's calm enough to leave (no fight, no police). */
  here(): { area: AreaId; calm: boolean; x: number } | null;
  /** The route on the map (null: none). */
  setDestination(area: AreaId | null): void;
  objective(): string;
  messages(): { needs: { key: string; tip: string; urgency: number }[]; log: PhoneMessage[] };
  markRead(): void;
  unread(): number;
  travel(area: AreaId, opt: TravelOption): void;
  payIn(): number;
  /** In your own house (Home app, paying into the tin). */
  atHome(): boolean;
  editHome(): void;
  openMap(): void;
  openBag(): void;
  openMe(tab: 'character' | 'crew'): void;
  openSettings(): void;
  /** Screens go inside this element while an app shows them (null: back over the game). */
  host(el: HTMLElement | null): void;
  /** Is a screen showing inside the phone? */
  hosting(): boolean;
  /** Close the screen showing inside the phone, as its own Back would. */
  closeHosted(): void;
  /** The phone opened or closed: stop and start play (`launching`: an app opens full screen next). */
  shown(open: boolean, launching?: boolean): void;
  sound(kind: 'open' | 'close' | 'tap'): void;
}

type AppId = 'home' | 'messages' | 'cabs' | 'bank' | 'jobs' | 'house' | 'embed' | 'map';

interface AppDef {
  id: string;
  name: string;
  icon: string;
  open: () => void;
  badge?: () => number;
}

const ICON = (f: string) => `/icons/hg/${f}.webp`;
const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export class Phone {
  readonly el: HTMLElement;
  private screen: HTMLElement;
  private clock: HTMLElement;
  private app: AppId = 'home';
  private openNow = false;
  private clockTimer = 0;

  constructor(private d: PhoneDeps) {
    this.clock = h('span', { class: 'ph-time' });
    this.screen = h('div', { class: 'ph-screen' });
    this.el = h(
      'div',
      { class: 'phone off', 'aria-hidden': 'true', role: 'dialog', 'aria-label': 'Phone' },
      h('div', { class: 'ph-shade', onclick: () => this.close() }),
      h(
        'div',
        { class: 'ph-device' },
        h('div', { class: 'ph-bezel' },
          h('div', { class: 'ph-status' }, this.clock, h('span', { class: 'ph-island' }), h('span', { class: 'ph-sig' }, h('i'), h('i'), h('i'), h('i')), h('span', { class: 'ph-batt' }, h('i'))),
          this.screen,
          h('button', { class: 'ph-homebar', 'aria-label': 'Home screen', onclick: () => this.go('home') }),
        ),
      ),
    );
  }

  get isOpen(): boolean {
    return this.openNow;
  }

  /** Pull the phone up, on its home screen or straight into an app. */
  open(app: AppId = 'home'): void {
    if (!this.d.progress()) return;
    this.app = app;
    this.render();
    this.tick();
    this.openNow = true;
    this.el.classList.remove('off', 'leaving');
    this.el.setAttribute('aria-hidden', 'false');
    // Next frame, so the slide-up animates from the pocket.
    requestAnimationFrame(() => requestAnimationFrame(() => this.openNow && this.el.classList.add('up')));
    this.d.sound('open');
    this.d.shown(true);
    this.clockTimer = window.setInterval(() => this.tick(), 15000);
  }

  /** Put it away. `then` runs once it's down. */
  close(then?: () => void): void {
    if (!this.openNow) return;
    if (this.d.hosting()) this.d.closeHosted();
    this.d.host(null);
    this.openNow = false;
    clearInterval(this.clockTimer);
    this.el.classList.remove('up');
    this.el.classList.add('leaving');
    this.el.setAttribute('aria-hidden', 'true');
    this.d.sound('close');
    const done = () => {
      if (this.openNow) return;
      this.el.classList.add('off');
      this.el.classList.remove('leaving');
      this.d.shown(false, !!then);
      if (then) then();
    };
    window.setTimeout(done, 260);
  }

  toggle(): void {
    if (this.openNow) this.close();
    else this.open();
  }

  /** Back: an app goes back to the home screen; the home screen puts the phone away. */
  back(): void {
    if (this.app === 'embed' && this.d.hosting()) this.d.closeHosted();
    else if (this.app !== 'home') this.go('home');
    else this.close();
  }

  /** Put the phone away at once, no animation (the area is reloading under it). */
  dismiss(): void {
    if (!this.openNow) return;
    this.openNow = false;
    clearInterval(this.clockTimer);
    this.d.host(null);
    this.el.classList.remove('up', 'leaving');
    this.el.classList.add('off');
    this.el.setAttribute('aria-hidden', 'true');
    this.d.shown(false, true);
  }

  /** The screen inside the phone closed: back to the home screen, unless another took its place. */
  hostEmptied(): void {
    window.setTimeout(() => {
      if (this.openNow && this.app === 'embed' && !this.d.hosting()) this.go('home');
    }, 0);
  }

  /** Something new came in: refresh what's showing. */
  refresh(): void {
    if (this.openNow) this.render();
  }

  private go(app: AppId): void {
    this.d.sound('tap');
    if (app !== 'embed') this.d.host(null);
    this.app = app;
    this.render();
  }

  /** A bigger app (Map, Me, Crew, Settings): its screen opens inside the phone, under the phone's own bar. */
  private launch(fn: () => void, title = ''): void {
    this.d.sound('tap');
    this.app = 'embed';
    const box = h('div', { class: 'ph-embed' });
    this.screen.replaceChildren(h('div', { class: 'ph-appview view-embed' },
      h('div', { class: 'ph-bar' },
        h('button', { class: 'ph-back', 'aria-label': 'Back', onclick: () => this.back() }, h('img', { src: ICON('arrow_left'), alt: '' })),
        h('b', { text: title }),
      ),
      box,
    ));
    this.screen.dataset.app = 'embed';
    embedPortraitRules();
    this.d.host(box);
    fn();
  }

  /** Put the phone away and then do something in the world (a cab ride, editing the house). */
  private leave(fn: () => void): void {
    this.d.sound('tap');
    this.close(fn);
  }

  private tick(): void {
    const t = new Date();
    this.clock.textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  }

  private render(): void {
    if (this.app === 'embed') return;
    if (this.app === 'map') return this.renderMap();
    const view = this.app === 'home' ? this.homeScreen() : this.appScreen(this.app);
    this.screen.replaceChildren(view);
    this.screen.dataset.app = this.app;
  }

  /** Maps: full-bleed, its own sheet and buttons; a small back button over the map. */
  private renderMap(): void {
    const p = this.d.progress();
    const here = this.d.here();
    if (!p || !here) return;
    const view = mapApp({
      progress: p,
      here: { area: here.area, x: here.x },
      calm: here.calm,
      travel: (area, opt) => this.leave(() => this.d.travel(area, opt)),
      setDestination: (area) => this.d.setDestination(area),
    });
    this.screen.replaceChildren(h('div', { class: 'ph-appview view-map' }, view, h('button', { class: 'pm-back', 'aria-label': 'Back', onclick: () => this.go('home') }, h('img', { src: ICON('arrow_left'), alt: '' }))));
    this.screen.dataset.app = 'map';
  }

  // ---- home screen ---------------------------------------------------------------------------

  private apps(): AppDef[] {
    const unread = () => this.d.unread();
    return [
      { id: 'messages', name: 'Messages', icon: 'bell', open: () => this.go('messages'), badge: unread },
      { id: 'map', name: 'Maps', icon: 'map', open: () => this.go('map') },
      { id: 'cabs', name: 'Cabs', icon: 'car_hatch', open: () => this.go('cabs') },
      { id: 'bank', name: 'CaliBank', icon: 'coins', open: () => this.go('bank') },
      { id: 'jobs', name: 'Jobs', icon: 'target_skull', open: () => this.go('jobs') },
      { id: 'crew', name: 'Crew', icon: 'crew', open: () => this.launch(() => this.d.openMe('crew'), 'Crew') },
      { id: 'me', name: 'Me', icon: 'fist', open: () => this.launch(() => this.d.openMe('character'), 'Me') },
      { id: 'house', name: 'Home', icon: 'house', open: () => this.go('house') },
      { id: 'settings', name: 'Settings', icon: 'gear', open: () => this.launch(() => this.d.openSettings(), 'Settings') },
    ];
  }

  private homeScreen(): HTMLElement {
    const p = this.d.progress()!;
    const t = new Date();
    return h(
      'div',
      { class: 'ph-home' },
      h('div', { class: 'ph-lock' },
        h('div', { class: 'ph-bigtime', text: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` }),
        h('div', { class: 'ph-date', text: t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) }),
        h('div', { class: 'ph-widget' }, h('span', { text: 'On you' }), h('b', { text: money(p.save.cash.pocket) }), h('span', { text: 'Tin' }), h('b', { text: money(p.save.cash.bank) })),
      ),
      h('div', { class: 'ph-grid' },
        ...this.apps().map((a) => {
          const n = a.badge?.() ?? 0;
          return h('button', { class: `ph-app app-${a.id}`, onclick: a.open },
            h('span', { class: 'ph-appicon' }, h('img', { src: ICON(a.icon), alt: '', draggable: 'false' }), n ? h('span', { class: 'ph-badge', text: String(Math.min(n, 9)) }) : null),
            h('span', { class: 'ph-appname', text: a.name }),
          );
        }),
      ),
      h('div', { class: 'ph-os', text: 'CaliLabsOS' }),
    );
  }

  // ---- apps --------------------------------------------------------------------------------------

  private appScreen(app: AppId): HTMLElement {
    const titles: Record<AppId, string> = { home: '', messages: 'Messages', cabs: 'Dave’s Cabs', bank: 'CaliBank', jobs: 'Jobs', house: 'Home', embed: '', map: 'Maps' };
    const body = app === 'messages' ? this.messages() : app === 'cabs' ? this.cabs() : app === 'bank' ? this.bank() : app === 'jobs' ? this.jobs() : this.house();
    return h(
      'div',
      { class: `ph-appview view-${app}` },
      h('div', { class: 'ph-bar' },
        h('button', { class: 'ph-back', 'aria-label': 'Back', onclick: () => this.go('home') }, h('img', { src: ICON('arrow_left'), alt: '' })),
        h('b', { text: titles[app] }),
      ),
      h('div', { class: 'ph-body' }, ...body),
    );
  }

  private messages(): HTMLElement[] {
    const p = this.d.progress()!;
    const { needs, log } = this.d.messages();
    this.d.markRead();
    const out: HTMLElement[] = [
      h('div', { class: 'ph-thread' },
        h('div', { class: 'ph-avatar', text: 'M' }),
        h('div', { class: 'ph-bubble' }, h('b', { text: 'Mo' }), h('p', { text: moHint(p) })),
      ),
    ];
    if (needs.length) {
      out.push(h('div', { class: 'ph-sec', text: 'You' }));
      for (const n of needs) out.push(h('div', { class: `ph-note need u${n.urgency}` }, h('img', { src: ICON(n.key === 'hunger' ? 'food' : n.key === 'hygiene' ? 'shower' : n.key === 'bladder' ? 'toilet' : n.key === 'teeth' ? 'tooth' : n.key === 'energy' ? 'sleep' : 'info'), alt: '' }), h('span', { text: n.tip })));
    }
    out.push(h('div', { class: 'ph-sec', text: 'Recent' }));
    if (!log.length) out.push(h('p', { class: 'ph-empty', text: 'Nothing new.' }));
    for (const m of [...log].reverse()) out.push(h('div', { class: `ph-note ${m.kind}` }, h('span', { text: m.text })));
    return out;
  }

  private cabs(): HTMLElement[] {
    const p = this.d.progress()!;
    const here = this.d.here();
    if (!here) return [];
    const out: HTMLElement[] = [
      h('div', { class: 'ph-hero' }, h('img', { src: ICON('car_hatch'), alt: '' }), h('div', {}, h('b', { text: `£${TAXI_COST} a ride` }), h('span', { text: `Paid from the tin. ${money(p.save.cash.bank)} in it.` }))),
    ];
    if (!here.calm) out.push(h('p', { class: 'ph-warn', text: 'Not with a fight on. Sort it out first.' }));
    // Home first, then everywhere a cab stops that you know.
    const homeOpt = travelOptions(p, here.area, 'home', here.calm).find((o) => o.kind === 'home');
    if (homeOpt && here.area !== 'home' && here.area !== 'basement') out.push(this.ride('Home', '14 Tanner Road', homeOpt, 'home'));
    const seen = new Set<AreaId>();
    for (const pl of places()) {
      if (pl.id === here.area || seen.has(pl.id) || !onMap(pl.id) || !cabStop(pl.id) || !unlocked(p, pl.id)) continue;
      seen.add(pl.id);
      const opt = travelOptions(p, here.area, pl.id, here.calm).find((o) => o.kind === 'cab');
      if (opt) out.push(this.ride(pl.name, pl.district, opt, pl.id));
    }
    return out;
  }

  private ride(name: string, where: string, opt: TravelOption, area: AreaId): HTMLElement {
    return h('div', { class: 'ph-row' },
      h('div', { class: 'ph-what' }, h('b', { text: name }), h('span', { text: opt.ok ? where : opt.why ?? where })),
      h('button', { class: 'ph-btn', disabled: !opt.ok, onclick: () => this.leave(() => this.d.travel(area, opt)) }, opt.kind === 'home' ? 'Go' : `£${opt.cost}`),
    );
  }

  private bank(): HTMLElement[] {
    const p = this.d.progress()!;
    const s = p.save;
    const f = s.finance;
    const rent = f.totals.rent.in;
    const out: HTMLElement[] = [
      h('div', { class: 'ph-card' },
        h('span', { text: 'Total' }), h('b', { class: 'ph-total', text: money(s.cash.pocket + s.cash.bank) }),
        h('div', { class: 'ph-split' },
          h('div', {}, h('span', { text: 'In the tin' }), h('b', { text: money(s.cash.bank) })),
          h('div', {}, h('span', { text: 'On you' }), h('b', { text: money(s.cash.pocket) })),
        ),
      ),
    ];
    const atHome = this.d.atHome();
    out.push(h('div', { class: 'ph-row' },
      h('div', { class: 'ph-what' }, h('b', { text: 'Pay into the tin' }), h('span', { text: atHome ? 'Safe in the tin. Pocket money goes if you get battered.' : 'The tin’s at home. Pay in there.' })),
      h('button', { class: 'ph-btn', disabled: !atHome || s.cash.pocket <= 0, onclick: () => {
        const n = this.d.payIn();
        if (n) this.render();
      } }, s.cash.pocket > 0 ? money(s.cash.pocket) : 'Nothing'),
    ));
    if (rent) out.push(h('div', { class: 'ph-row' }, h('div', { class: 'ph-what' }, h('b', { text: 'Rent in so far' }), h('span', { text: 'From the places you let out' })), h('b', { class: 'ph-in', text: money(rent) })));
    const lines = f.ledger.slice(-8).reverse();
    if (lines.length) {
      out.push(h('div', { class: 'ph-sec', text: 'Statement' }));
      for (const l of lines) out.push(h('div', { class: 'ph-line' }, h('span', { text: l.what }), h('b', { class: l.amount >= 0 ? 'ph-in' : 'ph-out', text: `${l.amount >= 0 ? '+' : '−'}${money(Math.abs(l.amount))}` })));
    }
    return out;
  }

  private jobs(): HTMLElement[] {
    const p = this.d.progress()!;
    const dest = p.save.destination;
    const out: HTMLElement[] = [
      h('div', { class: 'ph-sec', text: 'Now' }),
      h('div', { class: 'ph-card ph-job' }, h('b', { text: this.d.objective() || 'Nothing on. Have a look round.' })),
      h('div', { class: 'ph-sec', text: 'Mo says' }),
      h('div', { class: 'ph-bubble solo' }, h('p', { text: moHint(p) })),
    ];
    if (dest && LEVELS[dest]) {
      out.push(h('div', { class: 'ph-sec', text: 'Heading to' }), h('div', { class: 'ph-row' },
        h('div', { class: 'ph-what' }, h('b', { text: place(dest).name }), h('span', { text: place(dest).district })),
        h('button', { class: 'ph-btn', onclick: () => this.go('map') }, 'Map'),
      ));
    }
    return out;
  }

  private house(): HTMLElement[] {
    if (!this.d.atHome()) {
      const here = this.d.here();
      const p = this.d.progress()!;
      const opt = here ? travelOptions(p, here.area, 'home', here.calm).find((o) => o.kind === 'home') : undefined;
      return [
        h('div', { class: 'ph-hero' }, h('img', { src: ICON('house'), alt: '' }), h('div', {}, h('b', { text: '14 Tanner Road' }), h('span', { text: 'You can change your house when you’re in it.' }))),
        ...(opt ? [this.ride('Go home', 'Free, on foot', opt, 'home')] : []),
      ];
    }
    return [
      h('div', { class: 'ph-hero' }, h('img', { src: ICON('house'), alt: '' }), h('div', {}, h('b', { text: '14 Tanner Road' }), h('span', { text: 'Move, turn, recolour, store or sell your furniture.' }))),
      h('button', { class: 'ph-btn wide', onclick: () => this.leave(() => this.d.editHome()) }, 'Edit home'),
    ];
  }
}
