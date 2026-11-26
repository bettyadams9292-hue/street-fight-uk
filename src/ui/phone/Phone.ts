/**
 * The phone (CaliLabsOS): how you get at everything out of a fight. Pull it up with its button (or P), put it away
 * the same way. It slides up from the bottom right like a phone out of a pocket, and slides back down.
 *
 * Apps that live on the phone: Messages (Mo, your needs, what's happened), Cabs (Duber and walking home),
 * your bank's app (Califax or Lloyd's THC, picked in CaliStore: your money and where it went), Jobs (what to do next) and Home (edit your house, when you're in it).
 * Map, Me and Crew and Settings open inside it (your pockets and bag are on you, not on the phone), like the bigger apps on a real phone.
 */
import { BANKS, OTHER_BANK_FEE } from '../../money/atm';
import { BANK_PITCH, chooseBank, myBank } from '../../money/banking';
import { h } from '../dom';
import type { AreaId, Progress } from '../../progress/Progress';
import { cabStop, onMap, place, places, travelOptions, unlocked, type TravelOption } from '../../map/worldMap';
import { CAB_FLAG, CAB_PER_MILE, moHint } from '../hub';
import { LEVELS } from '../../world/levels';
import { embedPortraitRules, markNarrow } from './embedCss';
import { mapApp } from './mapApp';
import { GANG_GRUDGE, GANG_HUNT, HEAT_KINDS, heatWord, KNOWN_FACE_HEAT, type HeatKind } from '../../progress/heat';
import { ARREST_HEAT } from '../../world/robbery';
import { coolPrice, gearBackPrice } from '../../progress/cops';
import { kerriganCool, kerriganGearBack, seizedValue, type Favour } from '../../world/custody';
import { wikiApp, type WikiDeps, type WikiPage } from './wikiApp';
import { CONTACT_IDS, CONTACTS, contactOpen, failJob, objectiveOf, standingWith, tierOf, timeLeft, type ActiveJob } from '../../jobs/jobs';
import type { Device } from '../moveList';

export interface PhoneMessage {
  text: string;
  kind: string;
  /** When it last came in (Date.now()). */
  at?: number;
  /** How many times it's come in. */
  count?: number;
}

/** "now", "4m", "2h": how long ago, the way a phone says it. */
export function ago(at: number | undefined, now = Date.now()): string {
  if (!at) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 45 ? 'now' : s < 3600 ? `${Math.max(1, Math.round(s / 60))}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
}

export interface PhoneDeps {
  /** GraftWiki: the controller in hand and your styles, for its Controls and Moves pages. */
  wiki: WikiDeps;
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
  /** Something changed that should be saved now (a favour from Kerrigan). */
  saved(): void;
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

export type AppId = 'home' | 'messages' | 'cabs' | 'bank' | 'store' | 'jobs' | 'heat' | 'house' | 'embed' | 'map' | 'wiki';

interface AppDef {
  id: string;
  name: string;
  icon: string;
  open: () => void;
  badge?: () => number;
  /** A picture for the icon in place of the painted one (the bank's logo), on its own colour. */
  img?: string;
  tint?: string;
}

const ICON = (f: string) => `/icons/hg/${f}.webp`;

/** The control nearest `from` in a direction, by where they are on screen (ties to the one most in line). */
export function nearest(all: HTMLElement[], from: HTMLElement, dir: 'up' | 'down' | 'left' | 'right'): HTMLElement | null {
  const c = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const o = c(from);
  let best: HTMLElement | null = null;
  let score = Infinity;
  for (const e of all) {
    if (e === from) continue;
    const p = c(e);
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 2) continue;
    const s = along + across * 2;
    if (s < score) {
      score = s;
      best = e;
    }
  }
  return best;
}
const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export class Phone {
  readonly el: HTMLElement;
  private screen: HTMLElement;
  private clock: HTMLElement;
  private app: AppId = 'home';
  private wikiPage: WikiPage = 'index';
  private wikiState: { device?: Device; q?: string } = {};
  private openNow = false;
  private clockTimer = 0;
  /** Stops watching the hosted app view's width. */
  private unwatch: () => void = () => {};
  /** The control picked with the keys or a pad (null: none yet). */
  private picked: HTMLElement | null = null;

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
          // The Duo's fold, down the middle of the unfolded screen (only drawn when it's unfolded: .phone.duo).
          h('span', { class: 'ph-crease', 'aria-hidden': 'true' }),
          h('button', { class: 'ph-homebar', 'aria-label': 'Home screen', onclick: () => this.go('home') }),
        ),
      ),
    );
    // Wider than tall (a desktop, or a phone held sideways): the phone is a CaliLabs Duo, unfolded.
    const fold = () => this.el.classList.toggle('duo', window.innerWidth > window.innerHeight);
    fold();
    window.addEventListener('resize', fold);
    window.addEventListener('orientationchange', fold);
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
    this.unwatch();
    this.unwatch = () => {};
    this.pick(null);
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
    else if (this.app === 'wiki' && this.wikiPage !== 'index') this.wikiGo('index');
    else if (this.app !== 'home') this.go('home');
    else this.close();
  }

  /** Put the phone away at once, no animation (the area is reloading under it). */
  dismiss(): void {
    if (!this.openNow) return;
    this.openNow = false;
    clearInterval(this.clockTimer);
    this.unwatch();
    this.unwatch = () => {};
    this.pick(null);
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
    if (app !== 'embed') {
      this.d.host(null);
      this.unwatch();
      this.unwatch = () => {};
    }
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
    this.unwatch();
    this.unwatch = markNarrow(box);
    this.d.host(box);
    fn();
  }

  /** Put the phone away and then do something in the world (a cab ride, editing the house). */
  private leave(fn: () => void): void {
    this.d.sound('tap');
    this.close(fn);
  }

  /**
   * The keys or a pad, on the phone's own screens: arrows (or the D-pad / stick) move between its buttons by where
   * they are on screen, Enter (or A) presses the one picked. Mouse, touch and pen just press buttons directly.
   * Returns whether the phone used it.
   */
  nav(a: 'up' | 'down' | 'left' | 'right' | 'confirm'): boolean {
    if (!this.openNow || this.app === 'embed') return false;
    const all = Array.from(this.screen.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]')).filter((e) => {
      if ((e as HTMLButtonElement).disabled) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!all.length) return false;
    const cur = this.picked && this.picked.isConnected && all.includes(this.picked) ? this.picked : null;
    if (a === 'confirm') {
      if (!cur) return this.pick(all.find((e) => e.classList.contains('ph-app')) ?? all[0]), true;
      if (cur instanceof HTMLInputElement) cur.focus();
      else cur.click();
      return true;
    }
    if (!cur) return this.pick(all.find((e) => e.classList.contains('ph-app')) ?? all[0]), true;
    this.pick(nearest(all, cur, a) ?? cur);
    return true;
  }

  private pick(el: HTMLElement | null): void {
    this.picked?.classList.remove('ph-pick');
    this.picked = el;
    if (!el) return;
    el.classList.add('ph-pick');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.d.sound('open');
  }

  private tick(): void {
    const t = new Date();
    this.clock.textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  }

  private render(): void {
    if (this.app === 'embed') return;
    this.picked = null;
    if (this.app === 'map') return this.renderMap();
    if (this.app === 'wiki') return this.renderWiki();
    const view = this.app === 'home' ? this.homeScreen() : this.appScreen(this.app);
    this.screen.replaceChildren(view);
    this.screen.dataset.app = this.app;
  }

  /** Open the phone straight on a GraftWiki article (the pause menu's Controls and Moves). */
  openWiki(page: WikiPage): void {
    this.wikiPage = page;
    this.wikiState = {};
    if (this.openNow) this.go('wiki');
    else this.open('wiki');
  }

  /** GraftWiki: articles under the phone's bar; Back goes to the contents, then home. */
  private renderWiki(): void {
    const page = this.wikiPage;
    const view = h(
      'div',
      { class: 'ph-appview view-wiki' },
      h('div', { class: 'ph-bar' },
        h('button', { class: 'ph-back', 'aria-label': 'Back', onclick: () => (page === 'index' ? this.go('home') : this.wikiGo('index')) }, h('img', { src: ICON('arrow_left'), alt: '' })),
        h('b', { text: 'GraftWiki' }),
      ),
      h('div', { class: 'ph-body wk-body' }, wikiApp(this.d.wiki, page, (p) => this.wikiGo(p), this.wikiState)),
    );
    this.screen.replaceChildren(view);
    this.screen.dataset.app = 'wiki';
  }

  private wikiGo(p: WikiPage): void {
    this.d.sound('tap');
    const keepScroll = p === this.wikiPage;
    const y = (this.screen.querySelector('.wk-body') as HTMLElement | null)?.scrollTop ?? 0;
    this.wikiPage = p;
    this.renderWiki();
    const body = this.screen.querySelector('.wk-body') as HTMLElement | null;
    if (body) body.scrollTop = keepScroll ? y : 0;
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
      ...this.bankApp(),
      { id: 'jobs', name: 'Jobs', icon: 'target_skull', open: () => this.go('jobs') },
      { id: 'heat', name: 'Heat', icon: 'police', open: () => ((this.kerriganSaid = ''), this.go('heat')) },
      { id: 'crew', name: 'Crew', icon: 'crew', open: () => this.launch(() => this.d.openMe('crew'), 'Crew') },
      { id: 'me', name: 'Me', icon: 'fist', open: () => this.launch(() => this.d.openMe('character'), 'Me') },
      { id: 'house', name: 'Home', icon: 'house', open: () => this.go('house') },
      { id: 'wiki', name: 'GraftWiki', icon: 'info', open: () => ((this.wikiPage = 'index'), this.go('wiki')) },
      { id: 'settings', name: 'Settings', icon: 'gear', open: () => this.launch(() => this.d.openSettings(), 'Settings') },
      // The store, with a dot until there's a bank on the phone.
      { id: 'store', name: 'CaliStore', icon: 'download', open: () => this.go('store'), badge: () => (this.d.progress()?.save.bank ? 0 : 1) },
    ];
  }

  /** Your bank's own app, once you've picked one in the store. */
  private bankApp(): AppDef[] {
    const b = myBank(this.d.progress()!);
    return b ? [{ id: 'bank', name: b.name, icon: 'coins', img: b.logo, tint: b.bg, open: () => this.go('bank') }] : [];
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
            h('span', { class: `ph-appicon${a.img ? ' logo' : ''}`, style: a.tint ? `background:${a.tint}` : '' }, h('img', { src: a.img ?? ICON(a.icon), alt: '', draggable: 'false' }), n ? h('span', { class: 'ph-badge', text: String(Math.min(n, 9)) }) : null),
            h('span', { class: 'ph-appname', text: a.name }),
          );
        }),
      ),
      h('div', { class: 'ph-os', text: 'CaliLabsOS' }),
    );
  }

  // ---- apps --------------------------------------------------------------------------------------

  private appScreen(app: AppId): HTMLElement {
    const titles: Record<AppId, string> = { home: '', messages: 'Messages', cabs: 'Duber', bank: myBank(this.d.progress()!)?.name ?? 'Bank', store: 'CaliStore', jobs: 'Jobs', heat: 'Heat', house: 'Home', embed: '', map: 'Maps', wiki: 'GraftWiki' };
    const body = app === 'messages' ? this.messages() : app === 'cabs' ? this.cabs() : app === 'bank' ? this.bank() : app === 'store' ? this.store() : app === 'jobs' ? this.jobs() : app === 'heat' ? this.heat() : this.house();
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
    // Newest first, each with how long ago it came in.
    const recent = [...log].reverse().sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    for (const m of recent)
      out.push(h('div', { class: `ph-note ${m.kind}` }, h('span', { text: m.text }), h('small', { class: 'ph-ago', text: `${(m.count ?? 1) > 1 ? `×${m.count}  ` : ''}${ago(m.at)}` })));
    return out;
  }

  private cabs(): HTMLElement[] {
    const p = this.d.progress()!;
    const here = this.d.here();
    if (!here) return [];
    const out: HTMLElement[] = [
      h('div', { class: 'ph-hero' }, h('img', { src: ICON('car_hatch'), alt: '' }), h('div', {}, h('b', { text: `On the meter: £${CAB_FLAG.toFixed(2)} + £${CAB_PER_MILE.toFixed(2)} a mile` }), h('span', { text: `Paid from the tin. ${money(p.save.cash.bank)} in it.` }))),
    ];
    if (!here.calm) out.push(h('p', { class: 'ph-warn', text: 'Not with a fight on. Sort it out first.' }));
    // Home first, then everywhere a cab stops that you know.
    const homeOpt = travelOptions(p, here.area, 'home', here.calm).find((o) => o.kind === 'home');
    if (homeOpt && here.area !== 'home' && here.area !== 'basement') out.push(this.ride('Home', '14 Tanner Road', homeOpt, 'home'));
    const seen = new Set<AreaId>();
    for (const pl of places()) {
      if (pl.id === here.area || seen.has(pl.id) || !onMap(pl.id) || !cabStop(pl.id) || !unlocked(p, pl.id)) continue;
      seen.add(pl.id);
      const opt = travelOptions(p, here.area, pl.id, here.calm, here.x).find((o) => o.kind === 'cab');
      if (opt) out.push(this.ride(pl.name, pl.district, opt, pl.id));
    }
    return out;
  }

  private ride(name: string, where: string, opt: TravelOption, area: AreaId): HTMLElement {
    return h('div', { class: 'ph-row' },
      h('div', { class: 'ph-what' }, h('b', { text: name }), h('span', { text: opt.ok ? (opt.miles !== undefined ? `${where} · ${opt.miles.toFixed(1)} mi` : where) : opt.why ?? where })),
      h('button', { class: 'ph-btn', disabled: !opt.ok, onclick: () => this.leave(() => this.d.travel(area, opt)) }, opt.kind === 'home' ? 'Go' : `£${opt.cost}`),
    );
  }

  /** Heat, district by district: where you are first, then the hottest. */
  private heat(): HTMLElement[] {
    const p = this.d.progress()!;
    const map = p.save.districtHeat;
    const here = p.here;
    const total = (d: string) => HEAT_KINDS.reduce((t, k) => t + p.heatIn(d)[k], 0);
    const names = [...new Set([here, ...Object.keys(map)].filter(Boolean))].sort((a, b) => (a === here ? -1 : b === here ? 1 : total(b) - total(a)));
    const LABEL: Record<HeatKind, string> = { police: 'Police', street: 'Locals', gang: 'Gang' };
    const card = (d: string) => {
      const h0 = p.heatIn(d);
      const notes: string[] = [];
      if (h0.police >= ARREST_HEAT) notes.push('Wanted: lose a fight here and you’re nicked.');
      else if (h0.police >= 40) notes.push('The police may be waiting when you arrive.');
      if (h0.street >= KNOWN_FACE_HEAT) notes.push('People know your face.');
      if (p.gangOn(d) && h0.gang < GANG_GRUDGE) notes.push('You’ve taken on their boss: their crew are watching you.');
      if (h0.gang >= GANG_HUNT) notes.push('Their crew are looking for you.');
      else if (h0.gang >= GANG_GRUDGE) notes.push('Their crew come at you harder.');
      return h('div', { class: `ph-heat${d === here ? ' here' : ''}` },
        h('div', { class: 'ph-heat-head' }, h('b', { text: d }), d === here ? h('span', { class: 'ph-heat-here', text: 'You’re here' }) : null),
        ...HEAT_KINDS.map((k) => h('div', { class: `ph-heat-row k-${k}` },
          h('span', { class: 'ph-heat-k', text: LABEL[k] }),
          h('span', { class: 'ph-heat-bar' }, h('i', { style: `width:${h0[k]}%` })),
          h('span', { class: 'ph-heat-w', text: k === 'gang' && !p.gangOn(d) && !h0.gang ? 'Not involved' : heatWord(h0[k]) }),
        )),
        notes.length ? h('p', { class: 'ph-heat-note', text: notes.join(' ') }) : null,
      );
    };
    const out: HTMLElement[] = [h('p', { class: 'ph-heat-intro', text: 'What the police, the locals and the gangs think of you. It all cools off as you move about.' })];
    out.push(...this.kerrigan(names));
    if (!names.length) out.push(h('p', { class: 'ph-empty', text: 'Nobody’s looking for you. Yet.' }));
    for (const d of names) out.push(card(d));
    out.push(h('button', { class: 'ph-link', onclick: () => ((this.wikiPage = 'heat'), this.go('wiki')) , text: 'How heat works' }));
    return out;
  }

  /** What Kerrigan last said (a favour done, or him getting caught). */
  private kerriganSaid = '';

  /**
   * Sgt Kerrigan, once you've paid him to lose your paperwork (progress/cops.ts): he cools a district's police
   * down and gets seized gear out of the property store, for a price, and tips you off when they're waiting for
   * you. Every favour has a small chance he's caught, and then the police everywhere come for you.
   */
  private kerrigan(districts: string[]): HTMLElement[] {
    const p = this.d.progress()!;
    const s = p.save.police;
    const out: HTMLElement[] = [];
    if (this.kerriganSaid) out.push(h('p', { class: 'ph-warn ph-kerrigan-said', text: this.kerriganSaid }));
    if (!s.contact) return out;
    out.push(h('div', { class: 'ph-sec', text: 'Sgt Kerrigan' }));
    out.push(h('p', { class: 'ph-heat-note', text: 'Bent as a nine-bob note. He rings ahead when they’re waiting for you. Every favour’s a risk: if he’s caught, he talks.' }));
    const done = (f: Favour, what: string) => {
      this.kerriganSaid = f.caught
        ? `Kerrigan’s been caught on the take, and he’s talking. Police heat up everywhere. He’s off your phone for good.`
        : `Kerrigan: "Done." ${what} (£${f.price})`;
      this.d.saved();
      this.render();
    };
    const have = p.save.cash.pocket + p.save.cash.bank;
    for (const d of districts) {
      const heat = p.heatIn(d).police;
      if (heat <= 0) continue;
      const price = coolPrice(heat);
      out.push(h('div', { class: 'ph-row' },
        h('div', { class: 'ph-what' }, h('b', { text: `Cool off ${d}` }), h('span', { text: 'Police heat there to nothing' })),
        h('button', { class: 'ph-btn', disabled: have < price, onclick: () => done(kerriganCool(p, d, Math.random()), `${d}’s gone quiet.`) }, money(price)),
      ));
    }
    if (s.seized.length) {
      const n = s.seized.reduce((t, x) => t + x.qty, 0);
      const price = gearBackPrice(seizedValue(p));
      out.push(h('div', { class: 'ph-row' },
        h('div', { class: 'ph-what' }, h('b', { text: 'Gear back' }), h('span', { text: `${n} seized item${n === 1 ? '' : 's'} out of the property store, to your stash at home (still hot)` })),
        h('button', { class: 'ph-btn', disabled: have < price, onclick: () => done(kerriganGearBack(p, Math.random()), 'It’s in your stash.') }, money(price)),
      ));
    }
    return out;
  }

  /** CaliStore: the two banks' apps. Getting one opens your account there (or moves it). */
  private store(): HTMLElement[] {
    const p = this.d.progress()!;
    const mine = p.save.bank;
    const out: HTMLElement[] = [
      h('div', { class: 'ph-store-head' }, h('b', { text: mine ? 'Banking' : 'Pick your bank' }), h('span', { text: mine ? 'Move your account any time. It’s free.' : 'Your money, your machines. One account, on your phone.' })),
    ];
    for (const id of ['califax', 'lloyds'] as const) {
      const b = BANKS[id];
      const pitch = BANK_PITCH[id];
      const yours = mine === id;
      out.push(h('div', { class: `ph-storeapp${yours ? ' yours' : ''}` },
        h('span', { class: 'ph-appicon logo', style: `background:${b.bg}` }, h('img', { src: b.logo ?? ICON('coins'), alt: '', draggable: 'false' })),
        h('div', { class: 'ph-what' }, h('b', { text: b.name }), h('span', { text: pitch.tagline })),
        h('button', { class: 'ph-btn get', onclick: () => {
          if (yours) return this.go('bank');
          if (!chooseBank(p, id)) return;
          this.d.saved();
          this.d.sound('tap');
          this.app = 'bank';
          this.render();
        } }, yours ? 'Open' : mine ? 'Switch' : 'Get'),
        h('ul', { class: 'ph-perks' }, ...pitch.perks.map((t) => h('li', { text: t }))),
      ));
    }
    return out;
  }

  private bank(): HTMLElement[] {
    const p = this.d.progress()!;
    const s = p.save;
    const f = s.finance;
    const rent = f.totals.rent.in;
    const b = myBank(p);
    if (!b) return this.store();
    const card = h('div', { class: `ph-card ph-bankcard bank-${b.id}`, style: `--bk-bg:${b.bg};--bk-panel:${b.panel};--bk-accent:${b.accent}` },
        h('span', { text: 'Total' }), h('b', { class: 'ph-total', text: money(s.cash.pocket + s.cash.bank) }),
        h('div', { class: 'ph-split' },
          h('div', {}, h('span', { text: 'In the tin' }), h('b', { text: money(s.cash.bank) })),
          h('div', {}, h('span', { text: 'On you' }), h('b', { text: money(s.cash.pocket) })),
        ),
      );
    if (b.logo) card.prepend(h('img', { class: 'ph-banklogo', src: b.logo, alt: b.name, draggable: 'false' }));
    const out: HTMLElement[] = [
      card,
      h('p', { class: 'ph-small', text: `Free at any ${b.name} machine. Other banks’ machines charge £${OTHER_BANK_FEE} a withdrawal.` }),
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
      for (const l of lines) out.push(h('div', { class: 'ph-line' }, h('span', { text: l.what }), l.amount ? h('b', { class: l.amount > 0 ? 'ph-in' : 'ph-out', text: `${l.amount > 0 ? '+' : '−'}${money(Math.abs(l.amount))}` }) : null));
    }
    return out;
  }

  /** Armed by the first tap on "Drop the job" (the second drops it). */
  private dropArmed = false;

  private jobs(): HTMLElement[] {
    const p = this.d.progress()!;
    const dest = p.save.destination;
    const j = p.save.jobs.active;
    const out: HTMLElement[] = [];
    if (j) {
      const left = timeLeft(p);
      const to = this.jobArea(j);
      out.push(
        h('div', { class: 'ph-sec', text: 'On a job' }),
        h('div', { class: 'ph-card ph-job' },
          h('b', { text: j.title }),
          h('span', { text: `For ${j.giver}` }),
          h('p', { text: `${objectiveOf(j)}${left !== null ? `. ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left.` : '.'}` }),
          h('div', { class: 'ph-actions' },
            h('button', { class: 'ph-btn', onclick: () => {
              this.d.setDestination(to);
              this.go('map');
            } }, 'Directions'),
            h('button', { class: `ph-btn${this.dropArmed ? ' danger' : ''}`, onclick: () => {
              if (!this.dropArmed) {
                this.dropArmed = true;
                return this.go('jobs');
              }
              this.dropArmed = false;
              failJob(p, 'dropped');
              this.d.saved();
              this.go('jobs');
            } }, this.dropArmed ? 'Tap again to drop it' : 'Drop the job'),
          ),
        ),
      );
    }
    out.push(
      h('div', { class: 'ph-sec', text: j ? 'The story' : 'Now' }),
      h('div', { class: 'ph-card ph-job' }, h('b', { text: j ? moHint(p) : this.d.objective() || 'Nothing on. Have a look round.' })),
    );
    if (!j) out.push(h('div', { class: 'ph-sec', text: 'Mo says' }), h('div', { class: 'ph-bubble solo' }, h('p', { text: moHint(p) })));
    if (dest && LEVELS[dest]) {
      out.push(h('div', { class: 'ph-sec', text: 'Heading to' }), h('div', { class: 'ph-row' },
        h('div', { class: 'ph-what' }, h('b', { text: place(dest).name }), h('span', { text: place(dest).district })),
        h('button', { class: 'ph-btn', onclick: () => this.go('map') }, 'Map'),
      ));
    }
    // Who gives out work, where to find them, and how you stand with them.
    out.push(h('div', { class: 'ph-sec', text: 'Contacts' }));
    for (const id of CONTACT_IDS) {
      const c = CONTACTS[id];
      const open = contactOpen(p, id);
      const met = p.save.jobs.met.includes(id);
      const tier = tierOf(standingWith(p, id));
      out.push(h('div', { class: 'ph-row ph-contact' },
        h('div', { class: 'ph-what' }, h('b', { text: `${c.name} · ${c.role}` }), h('span', { text: open ? c.where : `${c.where}. Not open to you yet.` })),
        open ? h('span', { class: 'ph-standing', text: met ? tier.name : 'Not met' }) : null,
        open ? h('button', { class: 'ph-btn', onclick: () => {
          this.d.setDestination(c.area);
          this.go('map');
        } }, 'Map') : null,
      ));
    }
    out.push(h('p', { class: 'ph-empty', text: 'Walk up to a contact and press USE to see their work. Now and then someone on the street needs a hand too: look for the yellow mark.' }));
    return out;
  }

  /** Where the job takes you next: the target's street, or back to whoever gave it. */
  private jobArea(j: ActiveJob): AreaId {
    if (j.stage === 'back' && j.from !== 'street') return CONTACTS[j.from].area;
    return j.area;
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
