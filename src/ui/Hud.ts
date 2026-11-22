import { ARCHETYPES, type ArchetypeId } from '../ai/archetypes';
import { TRAINING_MODE_LABELS, type TrainingOpponent } from '../core/TrainingMode';
import type { Fighter } from '../fighter/Fighter';
import { hasTitle, titleArt, titleFor } from './titles';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { Notifications } from './notifications';
import { HOTBAR_EMPTY_ICON, HOTBAR_LABELS, HOTBAR_SLOTS, type HotbarSlot, type HotbarView } from '../items/hotbar';
import { ITEMS } from '../items/items';
import { WEAPONS } from '../combat/Weapons';
import { itemIconUrl } from './itemIcons';

const NEED_ICONS: Record<string, IconName> = { hunger: 'food', energy: 'sleep', hygiene: 'shower', oral: 'tooth', bladder: 'toilet', nutrition: 'food' };

interface BarSet {
  root: HTMLElement;
  name: HTMLElement;
  hpFill: HTMLElement;
  hpTrail: HTMLElement;
  hpRecover: HTMLElement;
  hpText: HTMLElement;
  stFill: HTMLElement;
  stText: HTMLElement;
  fatigue: HTMLElement;
  style: HTMLElement;
  trail: number;
  trailHold: number;
  side: 'left' | 'right';
}

function bars(side: 'left' | 'right'): BarSet {
  const hpFill = h('div', { class: 'fill hp' });
  const hpTrail = h('div', { class: 'fill trail' });
  const hpRecover = h('div', { class: 'fill recover' });
  const hpText = h('span', { class: 'bar-text' });
  const stFill = h('div', { class: 'fill st' });
  const stText = h('span', { class: 'bar-text' });
  const name = h('div', { class: 'fighter-name' });
  const fatigue = h('span', { class: 'fatigue' });
  const style = h('div', { class: 'style-row' });
  const root = h(
    'div',
    { class: `fighter-panel ${side}` },
    h('div', { class: 'name-row' }, name, fatigue),
    h('div', { class: 'bar health' }, hpTrail, hpRecover, hpFill, hpText),
    h('div', { class: 'bar stamina' }, stFill, h('i', { class: 'tick t30' }), h('i', { class: 'tick t10' }), stText),
    style,
  );
  return { root, name, hpFill, hpTrail, hpRecover, hpText, stFill, stText, fatigue, style, trail: 1, trailHold: 0, side };
}

/**
 * In-fight HUD: health and stamina for you and your opponent, combat
 * notifications, combo counter, floating damage numbers and the
 * training-ground controls.
 */
/** The word on each hotbar slot's tag. */
const HOTBAR_TAGS: Record<HotbarSlot, string> = { medic: 'MED', food: 'FOOD', weapon: 'WEAPON' };

export class Hud {
  readonly el: HTMLElement;
  private player = bars('left');
  private enemy = bars('right');
  private notices: HTMLElement;
  private combo: HTMLElement;
  /** Red at the screen's edges when you take a hit; it lingers while you're on low health. */
  private hurtEdge: HTMLElement;
  private hurtFlash = 0;
  private comboTimer = 0;
  private floaters: HTMLElement;
  private fps: HTMLElement;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private modeButtons = new Map<TrainingOpponent, HTMLButtonElement>();
  private opponentButton: HTMLButtonElement;
  private prompt: HTMLElement;
  private promptKey = '';
  private subBar: HTMLElement;
  private subFill: HTMLElement;
  // Story mode.
  private story: HTMLElement;
  private money: HTMLElement;
  private levelText: HTMLElement;
  private xpFill: HTMLElement;
  private objective: HTMLElement;
  private banner: HTMLElement;
  private bossBar: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossTrail: HTMLElement;
  private bossTrailV = 1;
  private weaponText: HTMLElement;
  private notes = new Notifications();
  private bagBtn!: HTMLElement;
  private bailBtn!: HTMLElement;
  /** The hotbar: medical, food and weapon, each a slot you tap, click or press 1, 2 or 3 for. */
  private hotbar!: HTMLElement;
  private hotbarSlots = new Map<HotbarSlot, { btn: HTMLElement; img: HTMLImageElement; n: HTMLElement; bar: HTMLElement; name: string }>();
  private hotbarKey = '';
  private bailCost!: HTMLElement;
  private bagCount!: HTMLElement;
  private flow!: HTMLElement;
  /** Where the tutorial's lesson card sits: under the objective, above notifications (src/tutorial/overlay.ts). */
  lesson!: HTMLElement;
  private head!: HTMLElement;
  private weaponChip: HTMLElement;
  private weaponBar: HTMLElement;
  private heatChip: HTMLElement;
  private route: HTMLElement;
  private routeText: HTMLElement;
  private vs: HTMLElement;
  private needsChips: HTMLElement;
  private needsKey = '';
  /** What the needs currently say, by need (shown in the tray and when a need's badge is tapped). */
  private needTips: { key: string; tip: string; urgency: number }[] = [];
  /** Recent messages (newest last), kept for the notifications tray instead of filling the screen. */
  private log: { text: string; kind: string; at: number; count?: number }[] = [];
  private unread = 0;
  private bellBtn!: HTMLElement;
  private tray!: HTMLElement;
  private zoomBtn!: HTMLElement;
  private activity: HTMLElement;
  private activityTitle: HTMLElement;
  private activityLabel: HTMLElement;
  private activityFill: HTMLElement;
  private sleepShade: HTMLElement;

  constructor(actions: { setMode: (m: TrainingOpponent) => void; nextOpponent: () => void; reset: () => void; pause: () => void; map: () => void; inventory: () => void; character: () => void; use?: () => void; zoom?: () => void; editHome?: () => void; phone?: () => void; bail?: () => void; hotbar?: (slot: HotbarSlot) => void }) {
    const modes = (Object.keys(TRAINING_MODE_LABELS) as TrainingOpponent[]).map((m, i) => {
      const b = h('button', { class: 'chip', title: `Key ${i + 1}`, onclick: () => actions.setMode(m) }, h('span', { class: 'key-hint', text: `${i + 1} \u00b7 ` }), TRAINING_MODE_LABELS[m]) as HTMLButtonElement;
      this.modeButtons.set(m, b);
      return b;
    });
    this.opponentButton = h('button', { class: 'chip opponent', title: 'Key N: next opponent type', onclick: () => actions.nextOpponent() }) as HTMLButtonElement;
    this.notices = h('div', { class: 'notices' });
    this.combo = h('div', { class: 'combo' });
    this.hurtEdge = h('div', { class: 'hurt-edge' });
    this.floaters = h('div', { class: 'floaters' });
    this.fps = h('div', { class: 'fps' });
    this.prompt = h('div', { class: 'prompt' });
    // On a phone the "USE  Pick up can of pop" plate is the button: tap it to use the thing.
    this.prompt.addEventListener('pointerdown', (e) => {
      if (!this.prompt.classList.contains('interact')) return;
      e.preventDefault();
      e.stopPropagation();
      this.prompt.classList.add('down');
      actions.use?.();
    });
    const lift = () => this.prompt.classList.remove('down');
    this.prompt.addEventListener('pointerup', lift);
    this.prompt.addEventListener('pointercancel', lift);
    this.prompt.addEventListener('pointerleave', lift);
    this.subFill = h('div', { class: 'sub-fill' });
    this.subBar = h('div', { class: 'sub-bar' }, this.subFill);
    this.money = h('span', { class: 'money' });
    this.levelText = h('span', { class: 'lvl' });
    this.xpFill = h('div', { class: 'xp-fill' });
    this.objective = h('div', { class: 'objective' });
    this.weaponText = h('span', { class: 'weapon-held' });
    this.routeText = h('span');
    this.route = h('div', { class: 'route-line off' }, icon('route'), this.routeText);
    this.needsChips = h('div', { class: 'needs-chips' });
    this.weaponBar = h('span');
    this.weaponChip = h('div', { class: 'status-chip weapon off' }, h('span', { class: 'wname' }), h('span', { class: 'bar' }, this.weaponBar));
    this.heatChip = h('div', { class: 'status-chip heat off' });
    // Tap the objective to read all of it; it's one line otherwise.
    this.objective.addEventListener('click', () => this.objective.classList.toggle('open'));
    this.story = h(
      'div',
      { class: 'story-info' },
      h('div', { class: 'story-row' }, this.levelText, this.money, this.weaponText, h('span', { class: 'story-gap' }), this.needsChips),
      h('div', { class: 'xp-bar' }, this.xpFill),
      h('div', { class: 'status-strip' }, this.weaponChip, this.heatChip),
      this.objective,
      this.route,
    );
    this.vs = h('div', { class: 'vs', text: 'VS' });
    this.banner = h('div', { class: 'area-banner' });
    this.bossName = h('div', { class: 'boss-name' });
    this.bossFill = h('div', { class: 'fill hp' });
    this.bossTrail = h('div', { class: 'fill trail' });
    this.bossBar = h('div', { class: 'boss-bar' }, this.bossName, h('div', { class: 'bar health' }, this.bossTrail, this.bossFill));
    // Everything under the top bars flows down in one column: your level, money and needs, the objective,
    // then notifications. Its top follows the bars and buttons above it (measured, so it fits any screen).
    this.lesson = h('div', { class: 'tut-slot' });
    this.flow = h('div', { class: 'hud-flow' }, this.story, this.lesson, this.notes.el);
    this.activityTitle = h('b');
    this.activityLabel = h('span');
    this.activityFill = h('div', { class: 'act-fill' });
    this.activity = h('div', { class: 'house-activity off' }, this.activityTitle, this.activityLabel, h('div', { class: 'act-bar' }, this.activityFill), h('small', { text: 'Esc or move to stop' }));
    this.sleepShade = h('div', { class: 'sleep-shade' });
    this.el = h(
      'div',
      { class: 'hud' },
      this.sleepShade,
      this.activity,
      this.banner,
      this.bossBar,
      (this.head = h('div', { class: 'hud-top' }, this.player.root, this.vs, this.enemy.root)),
      this.flow,
      h(
        'div',
        { class: 'training-bar' },
        h('span', { class: 'training-label', text: 'Partner:' }),
        ...modes,
        this.opponentButton,
        h('button', { class: 'chip', title: 'Key R', onclick: () => actions.reset() }, h('span', { class: 'key-hint', text: 'R \u00b7 ' }), 'Reset'),
      ),
      h(
        'div',
        { class: 'hud-buttons' },
        (this.zoomBtn = h('button', { class: 'hud-btn room-only zoom-btn', 'aria-label': 'Zoom in', title: 'Zoom (Z)', onclick: () => actions.zoom?.() }, icon('zoom-in'), h('span', { class: 'k', text: 'Z' }))),
        // What you carry is on you, not on the phone: pockets and the bag on your back.
        (this.bailBtn = h('button', { class: 'hud-btn bail-btn off', 'aria-label': 'Pussy out: throw down cash and run', title: 'Pussy out (X)', onclick: () => actions.bail?.() },
          h('b', { text: 'PUSSY OUT' }), (this.bailCost = h('small', { text: '' })))),
        (this.bagBtn = h('button', { class: 'hud-btn story-only bag-btn', 'aria-label': 'Pockets and bag', title: 'Pockets & bag (I)', onclick: () => actions.inventory() }, icon('bag'), (this.bagCount = h('span', { class: 'slot-count' })), h('span', { class: 'k', text: 'I' }))),
        // Everything else (messages, map, crew, cabs, money, editing the house) is on the phone.
        (this.bellBtn = h('button', { class: 'hud-btn story-only phone-btn', 'aria-label': 'Phone', title: 'Phone (P)', onclick: () => actions.phone?.() }, icon('phone'), h('span', { class: 'bell-dot' }), h('span', { class: 'k', text: 'P' }))),
        h('button', { class: 'hud-btn pause-btn', 'aria-label': 'Pause', title: 'Pause (Esc)', onclick: () => actions.pause() }, '\u275a\u275a'),
      ),
      (this.hotbar = h('div', { class: 'hotbar story-only off', role: 'group', 'aria-label': 'Hotbar' },
        ...HOTBAR_SLOTS.map((slot, i) => {
          const img = h('img', { class: 'hb-ico', src: `/icons/hg/${HOTBAR_EMPTY_ICON[slot]}.webp`, alt: '', draggable: 'false' }) as HTMLImageElement;
          const n = h('span', { class: 'hb-n' });
          const bar = h('span', { class: 'hb-bar' }, h('i'));
          // pointerdown, not click: in a fight a tap has to land at once, and a stray drag mustn't lose it.
          const btn = h('button', { class: `hb-slot ${slot} empty`, 'data-slot': slot, 'aria-label': HOTBAR_LABELS[slot], title: `${HOTBAR_LABELS[slot]} (${i + 1})` },
            h('span', { class: 'hb-k', text: String(i + 1) }), img, n, bar, h('span', { class: 'hb-cd' }), h('span', { class: 'hb-tag', text: HOTBAR_TAGS[slot] }));
          btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            actions.hotbar?.(slot);
          });
          btn.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') e.preventDefault();
          });
          this.hotbarSlots.set(slot, { btn, img, n, bar, name: '' });
          return btn;
        }))),
      h('div', { class: 'prompt-wrap' }, this.prompt, this.subBar),
      (this.tray = h('div', { class: 'notif-tray off', role: 'dialog', 'aria-label': 'Notifications' })),
      this.notices,
      this.hurtEdge,
      this.combo,
      this.floaters,
      this.fps,
    );
  }

  /**
   * Keep the column under the top bars just below them, whatever the screen: the bars and buttons change size
   * with the screen, a fight (two panels), the boss bar and the phone's own scaling.
   */
  private layoutObserver: ResizeObserver | null = null;
  private layout = (): void => {
    const top = this.el.getBoundingClientRect().top;
    let b = 0;
    const fighting = this.enemy.root.style.visibility === 'visible';
    // The enemy's panel keeps its space while hidden: measure only what's shown.
    for (const el of [fighting ? this.head : this.player.root, this.el.querySelector('.hud-buttons') as HTMLElement | null, this.bossBar]) {
      if (!el || !el.offsetParent || getComputedStyle(el).visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0) b = Math.max(b, r.bottom - top);
    }
    this.el.style.setProperty('--head-b', `${Math.round(b)}px`);
  };
  /**
   * The hotbar's three slots: what each would use (its painted icon and how many you've got), the weapon's
   * condition and whether it's in your hands, and the wait after a use (a sweep over every slot, 0..1 left).
   * Hidden while a screen is open and outside the story.
   */
  setHotbar(views: HotbarView[] | null, wait: number): void {
    this.hotbar.classList.toggle('off', !views);
    this.hotbar.style.setProperty('--hb-wait', String(Math.max(0, Math.min(1, wait))));
    this.hotbar.classList.toggle('waiting', wait > 0);
    if (!views) return;
    const key = views.map((v) => `${v.stack?.uid ?? ''}:${v.stack?.id ?? ''}:${v.count}:${v.stack?.hits ?? ''}:${v.inHand?.uid ?? ''}:${v.inHand?.hits ?? ''}`).join('|');
    if (key === this.hotbarKey) return;
    this.hotbarKey = key;
    for (const v of views) {
      const el = this.hotbarSlots.get(v.slot)!;
      const st = v.stack ?? v.inHand;
      const d = st ? ITEMS[st.id] : null;
      const src = st ? itemIconUrl(st.id, st.colour) : `/icons/hg/${HOTBAR_EMPTY_ICON[v.slot]}.webp`;
      if (el.img.getAttribute('src') !== src) el.img.src = src;
      el.btn.classList.toggle('empty', !st);
      // The weapon slot with only the one in your hands: pressing puts it away.
      el.btn.classList.toggle('in-hand', !v.stack && !!v.inHand);
      el.n.textContent = v.stack && v.count > 1 ? `×${v.count}` : '';
      // A weapon's wear: hits left of its durability (a fresh one has no count yet: full).
      const max = d?.weapon ? WEAPONS[d.weapon].durability : 0;
      const hits = max > 0 ? st?.hits ?? max : 0;
      el.bar.classList.toggle('off', !(max > 0));
      if (max > 0) {
        const c = Math.max(0, Math.min(1, hits / max));
        const i = el.bar.firstElementChild as HTMLElement;
        i.style.width = `${c * 100}%`;
        i.style.background = c > 0.5 ? '#6ad04a' : c > 0.25 ? '#e8c040' : '#e84a3a';
      }
      const what = d ? (v.stack ? `${d.name}${v.count > 1 ? `, ${v.count} left` : ''}` : `${d.name} in your hands: put it away`) : `${HOTBAR_LABELS[v.slot]}: nothing on you`;
      el.btn.setAttribute('aria-label', `${HOTBAR_LABELS[v.slot]}: ${what}`);
      el.btn.title = `${what} (${HOTBAR_SLOTS.indexOf(v.slot) + 1})`;
    }
  }

  /** A slot used: a quick punch of light on it. */
  flashHotbar(slot: HotbarSlot, ok: boolean): void {
    const b = this.hotbarSlots.get(slot)?.btn;
    if (!b) return;
    b.classList.remove('used', 'nope');
    void b.offsetWidth;
    b.classList.add(ok ? 'used' : 'nope');
  }

  /**
   * The pussy-out button: shown in a fight you're allowed to run from, saying what it costs (a share of the cash
   * on you, or the district's grudge when you've none). Hidden in boss fights, against the police and out of fights.
   */
  setBail(can: { ok: true; cost: number } | { ok: false; reason: string } | null): void {
    const show = !!can && can.ok;
    this.bailBtn.classList.toggle('off', !show);
    if (can && can.ok) {
      const t = can.cost > 0 ? `drop £${can.cost}` : 'they’ll remember';
      if (this.bailCost.textContent !== t) this.bailCost.textContent = t;
    }
  }

  /**
   * The big shout when you pussy out: a line slammed across the middle of the screen in the game's lettering,
   * with what it cost you underneath. Gone after a couple of seconds.
   */
  shame(title: string, sub: string): void {
    this.el.querySelector('.shame')?.remove();
    const el = h('div', { class: 'shame', role: 'status' }, h('b', { text: title }), h('span', { text: sub }));
    this.el.append(el);
    window.setTimeout(() => el.classList.add('out'), 2300);
    window.setTimeout(() => el.remove(), 2800);
  }

  /** Start keeping the layout (call once the HUD is in the page). */
  attach(): void {
    if (this.layoutObserver || typeof ResizeObserver === 'undefined') return;
    this.layoutObserver = new ResizeObserver(() => this.layout());
    this.layoutObserver.observe(this.head);
    this.layoutObserver.observe(this.player.root);
    const btns = this.el.querySelector('.hud-buttons');
    if (btns) this.layoutObserver.observe(btns);
    this.layoutObserver.observe(this.bossBar);
    window.addEventListener('resize', this.layout);
    this.layout();
  }

  setMode(mode: TrainingOpponent, archetype: ArchetypeId): void {
    for (const [m, b] of this.modeButtons) b.classList.toggle('on', m === mode);
    this.opponentButton.replaceChildren(h('span', { class: 'key-hint', text: 'N \u00b7 ' }), `${ARCHETYPES[archetype].name} \u203a`);
    this.opponentButton.classList.toggle('on', mode === 'spar');
  }

  /** Context prompt above the training bar (grapple options, finisher, escapes). */
  setPrompt(text: string, submission: number | null, interact = false): void {
    if (this.promptKey !== text) {
      this.promptKey = text;
      // "THING\u0001" leads an interaction; keys arrive marked ⟦…⟧ and are set as key caps.
      const parts: (Node | string)[] = [];
      let rest = text;
      const cut = rest.indexOf('\u0001');
      if (cut >= 0) {
        parts.push(h('span', { class: 'what', text: rest.slice(0, cut) }));
        rest = rest.slice(cut + 1);
      }
      for (const [i, piece] of rest.split(/\u27e6|\u27e7/).entries()) {
        if (!piece) continue;
        parts.push(i % 2 ? h('kbd', { text: piece }) : h('span', { text: piece }));
      }
      this.prompt.replaceChildren(...parts);
      this.prompt.classList.toggle('locked', text.endsWith('(locked)'));
    }
    this.prompt.classList.toggle('interact', interact);
    this.prompt.style.display = text ? (interact ? 'flex' : 'block') : 'none';
    this.subBar.style.display = submission === null ? 'none' : 'block';
    if (submission !== null) this.subFill.style.width = `${submission}%`;
  }

  // ---- story mode -----------------------------------------------------------------

  /** Story mode hides the training bar and shows money, XP, objective and boss bar. */
  setStory(on: boolean): void {
    this.el.classList.toggle('story', on);
    if (!on) this.bossBar.classList.remove('on');
  }

  updateStory(
    info: {
      pocket: number; bank: number; level: number; xp: number; xpNext: number; objective: string; weapon: string | null;
      boss: { name: string; title: string; health: number; max: number } | null;
      /** Pocket slots used / available; weapon condition 0..1; police heat 0..100. */
      slots?: { used: number; cap: number }; condition?: number | null; heat?: number; police?: boolean;
      /** The map's route, if one is set. */
      route?: string | null;
      /** In a fight (or one close by): show the fight details, hide the rest. */
      fighting?: boolean;
    },
    dt: number,
  ): void {
    this.el.classList.toggle('fighting', !!info.fighting);
    if (info.slots) {
      // How full you are, on the bag button: red when there's no room left.
      const t = `${info.slots.used}/${info.slots.cap}`;
      if (this.bagCount.textContent !== t) this.bagCount.textContent = t;
      this.bagBtn.classList.toggle('full', info.slots.used >= info.slots.cap);
      this.bagBtn.setAttribute('aria-label', `Pockets and bag: ${info.slots.used} of ${info.slots.cap} slots used`);
    }
    const r = info.route ?? '';
    this.route.classList.toggle('off', !r);
    if (this.routeText.textContent !== r) this.routeText.textContent = r;
    const c = info.condition;
    const showW = c !== null && c !== undefined && !!info.weapon;
    this.weaponChip.classList.toggle('off', !showW);
    if (showW) {
      const nm = this.weaponChip.firstElementChild as HTMLElement;
      const label = info.weapon!.replace(/ \(\d+\)$/, '');
      if (nm.textContent !== label) nm.textContent = label;
      this.weaponBar.style.width = `${Math.max(0, Math.min(1, c!)) * 100}%`;
      this.weaponBar.style.background = c! > 0.5 ? '#6ad04a' : c! > 0.25 ? '#e8c040' : '#e84a3a';
    }
    const heat = info.heat ?? 0;
    this.heatChip.classList.toggle('off', heat <= 0 && !info.police);
    this.heatChip.classList.toggle('hot', !!info.police || heat >= 60);
    const ht = info.police ? 'POLICE' : heat >= 60 ? `WANTED ${Math.round(heat)}` : `HEAT ${Math.round(heat)}`;
    if (this.heatChip.textContent !== ht) this.heatChip.textContent = ht;
    const m = `\u00a3${info.pocket}`;
    if (this.money.textContent !== m) this.money.textContent = m;
    const l = `LVL ${info.level}`;
    if (this.levelText.textContent !== l) this.levelText.textContent = l;
    this.xpFill.style.width = `${Math.min(100, (info.xp / Math.max(1, info.xpNext)) * 100)}%`;
    if (this.objective.textContent !== info.objective) this.objective.textContent = info.objective;
    // The weapon chip shows what's in your hands; no need to say it twice.
    const w = '';
    if (this.weaponText.textContent !== w) this.weaponText.textContent = w;
    const b = info.boss;
    this.bossBar.classList.toggle('on', !!b);
    if (b) {
      const frac = Math.max(0, b.health / b.max);
      const name = `${b.name.toUpperCase()} \u2014 ${b.title}`;
      if (this.bossName.textContent !== name) this.bossName.textContent = name;
      this.bossFill.style.width = `${frac * 100}%`;
      this.bossTrailV = frac >= this.bossTrailV ? frac : Math.max(frac, this.bossTrailV - dt * 0.4);
      this.bossTrail.style.width = `${this.bossTrailV * 100}%`;
    } else {
      this.bossTrailV = 1;
    }
  }

  /** What you're doing in the house: a title, the current step and a progress bar. Null hides it. */
  setActivity(a: { title: string; label: string; frac: number; sleeping: boolean } | null): void {
    this.activity.classList.toggle('off', !a);
    this.sleepShade.classList.toggle('on', !!a?.sleeping);
    if (!a) return;
    if (this.activityTitle.textContent !== a.title) this.activityTitle.textContent = a.title;
    if (this.activityLabel.textContent !== a.label) this.activityLabel.textContent = a.label;
    this.activityFill.style.width = `${Math.round(a.frac * 100)}%`;
  }

  /** Needs that want attention (only those): small badges by the status strip. Tap one to see what's wrong. */
  setNeeds(list: { key: string; text: string; urgency: number; tip?: string }[]): void {
    const key = list.map((n) => `${n.key}:${n.text}:${n.urgency}`).join('|');
    if (key === this.needsKey) return;
    this.needsKey = key;
    this.needTips = list.map((n) => ({ key: n.key, tip: n.tip ?? n.text, urgency: n.urgency }));
    this.needsChips.replaceChildren(
      ...list.map((n) =>
        h(
          'button',
          { class: `status-chip need u${n.urgency}`, 'aria-label': n.tip ?? n.text, title: n.tip ?? n.text, onclick: (e: Event) => { e.stopPropagation(); this.showTip(n.tip ?? n.text, n.key); } },
          // Centred, splash-free versions of the painted icons (tools/icons/hg/badges.py), so they sit in the ring.
          h('span', { class: 'icon hg' }, h('img', { src: `/icons/hg/badge/${NEED_ICONS[n.key] ?? 'info'}.webp`, alt: '', draggable: 'false' })),
          h('span', { class: 'need-text', text: n.text }),
        ),
      ),
    );
    if (!this.tray.classList.contains('off')) this.fillTray();
  }

  /** A need's message, briefly, under the badges. */
  private showTip(text: string, key?: string): void {
    this.notes.show(text, 'need', { icon: NEED_ICONS[key ?? ''] ?? 'info', id: 'need-tip' });
  }

  /** What the phone's Messages app shows: what each need says, and recent messages. */
  messages(): { needs: { key: string; tip: string; urgency: number }[]; log: { text: string; kind: string; at: number; count?: number }[] } {
    return { needs: this.needTips, log: this.log };
  }

  /** Messages read on the phone: the dot on the phone button goes. */
  markRead(): void {
    this.unread = 0;
    this.bellBtn.classList.remove('has-new');
  }

  /** How many messages came in since you last looked. */
  unreadCount(): number {
    return this.unread;
  }

  /** The objective line, for the phone's Jobs app. */
  objectiveText(): string {
    return this.objective.textContent ?? '';
  }

  /** A message for the phone: no pop-up, the phone button shows a dot until you look. */
  remember(text: string, kind = 'info'): void {
    // Newest last in the log (shown newest first): a repeat moves to the end with a count, not a second line.
    const old = this.log.findIndex((m) => m.text === text);
    const count = old >= 0 ? (this.log[old].count ?? 1) + 1 : 1;
    if (old >= 0) this.log.splice(old, 1);
    this.log.push({ text, kind, at: Date.now(), count });
    if (this.log.length > 12) this.log.shift();
    if (this.tray.classList.contains('off')) {
      this.unread++;
      this.bellBtn.classList.add('has-new');
    } else this.fillTray();
  }

  private fillTray(): void {
    const needs = this.needTips.map((n) => h('div', { class: `notif need u${n.urgency}` }, icon(NEED_ICONS[n.key] ?? 'info'), h('span', { text: n.tip })));
    const recent = [...this.log].reverse().map((m) => h('div', { class: `notif ${m.kind}` }, h('span', { text: m.text })));
    this.tray.replaceChildren(
      h('div', { class: 'notif-head', text: 'Needs' }),
      ...(needs.length ? needs : [h('div', { class: 'notif empty', text: 'Nothing needs doing.' })]),
      h('div', { class: 'notif-head', text: 'Recent' }),
      ...(recent.length ? recent : [h('div', { class: 'notif empty', text: 'No messages yet.' })]),
    );
  }

  /** Indoors: the zoom button shows the view you're in (whole room, zoomed, close up) and moves to the next. */
  setZoomed(mode: 0 | 1 | 2): void {
    const names = ['Whole room', 'Zoomed', 'Close up'];
    this.zoomBtn.replaceChildren(icon(mode === 2 ? 'zoom-out' : 'zoom-in'), h('span', { class: 'zoom-mode', text: ['ROOM', 'ZOOM', 'CLOSE'][mode] }), h('span', { class: 'k', text: 'Z' }));
    this.zoomBtn.setAttribute('aria-label', `View: ${names[mode]}. Tap for ${names[(mode + 1) % 3].toLowerCase()}`);
    this.zoomBtn.classList.toggle('on', mode > 0);
  }

  /** District name card when you arrive somewhere. */
  showBanner(district: string, place: string): void {
    // One painted title, never two stacked on top of each other: the place's own painting where
    // there is one, else the district's with the place in words, else plain words. The other name
    // goes underneath as a small plain line.
    const placeArt = titleFor(place);
    const districtArt = placeArt ? null : titleFor(district);
    const big = placeArt
      ? h('div', { class: 'place-title has-art' }, titleArt(place, placeArt))
      : districtArt
        ? h('div', { class: 'place-title has-art' }, titleArt(district, districtArt))
        : h('div', { class: 'place-title', text: place || district });
    const smallText = placeArt ? (district !== place ? district : '') : districtArt ? place : place && district !== place ? district : '';
    const parts: HTMLElement[] = [big];
    if (smallText) parts.push(h('div', { class: 'place-sub', text: smallText }));
    this.banner.replaceChildren(...parts);
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  /** Small reward / pickup message at the side. */
  toast(text: string, kind: 'cash' | 'item' | 'info' | 'warn' = 'info', accent?: string): void {
    this.remember(text, kind);
    this.notes.show(text, kind, { accent });
  }

  setFpsVisible(v: boolean): void {
    this.fps.style.display = v ? 'block' : 'none';
  }

  /** Big centre-screen call-out. */
  notify(text: string, kind: 'big' | 'warn' | 'info' = 'info', art: string[] = []): void {
    // Anything longer than a call-out ("Save restored from backup") is a notification, not a shout.
    if (text.length > 22 && !art.length) {
      this.toast(text, kind === 'warn' ? 'warn' : 'info');
      return;
    }
    // Painted call-outs (FIGHT!, a boss's name and title) where there are graphics for them.
    const painted = art.filter((a) => hasTitle(a));
    const n = painted.length
      ? h('div', { class: `notice ${kind} has-art`, role: 'status', 'aria-label': text }, ...painted.map((a, i) => titleArt(i === 0 ? text : a.replace(/-/g, ' '), a, i === 0 ? 'notice-art' : 'notice-art sub')))
      : h('div', { class: `notice ${kind}`, text });
    this.notices.append(n);
    while (this.notices.children.length > 3) this.notices.firstElementChild?.remove();
    setTimeout(() => n.remove(), kind === 'big' ? 1600 : 1100);
  }

  /** You've been hit: flash the edges red, harder for bigger hits (0..1). */
  hurt(amount: number): void {
    this.hurtFlash = Math.min(1, Math.max(this.hurtFlash, 0.35 + amount * 0.65));
  }

  showCombo(hits: number): void {
    if (hits < 2) return;
    this.combo.textContent = `${hits} HIT COMBO`;
    this.combo.classList.remove('pop');
    void this.combo.offsetWidth; // restart the animation
    this.combo.classList.add('pop');
    this.comboTimer = 1.4;
  }

  /** Damage number rising from a point on screen. */
  floater(x: number, y: number, text: string, kind: 'dmg' | 'clean' | 'block'): void {
    const f = h('div', { class: `floater ${kind}`, text });
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.floaters.append(f);
    setTimeout(() => f.remove(), 800);
  }

  // ---- speech bubbles over your crew's heads ----
  private bubbles: { f: Fighter; el: HTMLElement; until: number }[] = [];
  private bubbleLayer: HTMLElement | null = null;
  private clock = 0;

  /** A crew member says something: a bubble over their head for a few seconds. */
  speech(f: Fighter, name: string, text: string): void {
    if (!this.bubbleLayer) {
      this.bubbleLayer = h('div', { class: 'speech-layer' });
      this.el.append(this.bubbleLayer);
    }
    for (const b of this.bubbles.filter((x) => x.f === f)) b.until = 0;
    const el = h('div', { class: 'speech' }, h('b', { text: name }), h('span', { text }));
    this.bubbleLayer.append(el);
    this.bubbles.push({ f, el, until: this.clock + Math.min(6, 2.2 + text.length * 0.045) });
  }

  /** Keep bubbles over heads (call every frame with the renderer's projection). */
  updateBubbles(project: (x: number, y: number, z: number) => { x: number; y: number } | null): void {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (this.clock > b.until) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      const act = b.f.activity ?? '';
      const pt = project(b.f.pos.x, b.f.pos.y + (act === 'lie' ? 1.0 : act.startsWith('sit') || act === 'eat' ? 1.55 : 2.05), b.f.pos.z);
      if (!pt) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      b.el.style.transform = `translate(${Math.round(pt.x)}px, ${Math.round(pt.y)}px) translate(-50%, -100%)`;
    }
  }

  /** Red arrows at the screen edge for anyone coming at you from outside the view (screen pixels). */
  private markers: HTMLElement[] = [];
  private markerLayer: HTMLElement | null = null;
  updateMarkers(list: { y: number; side: -1 | 1; near: boolean }[]): void {
    if (!this.markerLayer) {
      this.markerLayer = h('div', { class: 'edge-markers' });
      this.el.append(this.markerLayer);
    }
    while (this.markers.length < list.length) {
      const m = h('div', { class: 'edge-marker' });
      this.markerLayer.append(m);
      this.markers.push(m);
    }
    this.markers.forEach((m, i) => {
      const e = list[i];
      if (!e) {
        m.style.display = 'none';
        return;
      }
      m.style.display = '';
      m.classList.toggle('left', e.side < 0);
      m.classList.toggle('near', e.near);
      m.style.top = `${Math.round(e.y)}px`;
    });
  }

  clearBubbles(): void {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
  }

  update(dt: number, player: Fighter, enemy: Fighter | null): void {
    this.clock += dt;
    // The red edge: a flash on each hit, fading in about half a second, and a slow pulse when nearly out.
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    const v = player.vitals;
    const low = !player.isKO && v.health < v.maxHealth * 0.25 ? 0.22 + 0.12 * Math.sin(this.clock * 4) : 0;
    this.hurtEdge.style.opacity = Math.max(this.hurtFlash, low).toFixed(3);
    this.updateBars(this.player, player, dt);
    const was = this.enemy.root.style.visibility;
    this.enemy.root.style.visibility = enemy ? 'visible' : 'hidden';
    if (was !== this.enemy.root.style.visibility) this.layout();
    this.vs.style.visibility = enemy ? 'visible' : 'hidden';
    if (enemy) this.updateBars(this.enemy, enemy, dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo.textContent = '';
    }

    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps.textContent = `${Math.round(this.fpsFrames / this.fpsAcc)} fps`;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  private updateBars(b: BarSet, f: Fighter, dt: number): void {
    const v = f.vitals;
    const hp = Math.max(0, v.health / v.maxHealth);
    const rec = Math.max(0, Math.min(1 - hp, v.recoverable / v.maxHealth));
    const st = Math.max(0, v.stamina / v.maxStamina);

    // Damage trail: holds briefly, then slides down to the real value.
    if (hp >= b.trail) {
      b.trail = hp;
      b.trailHold = 0;
    } else {
      b.trailHold += dt;
      if (b.trailHold > 0.45) b.trail = Math.max(hp, b.trail - dt * 0.6);
    }

    b.name.textContent = f.name.toUpperCase();
    const second = f.secondaryStyle ? ` \u00b7 swap: ${(f.usingSecondary ? f.primaryStyle : f.secondaryStyle).name}` : '';
    // Named grunts show what they are ("Street Thug") where everyone else shows their style.
    const styleText = (f.tag ?? f.style.name) + second;
    if (b.style.textContent !== styleText) b.style.textContent = styleText;
    b.hpFill.style.width = `${hp * 100}%`;
    // The recoverable segment sits just past the current health, on whichever side the bar fills from.
    b.hpRecover.style[b.side === 'left' ? 'left' : 'right'] = `${hp * 100}%`;
    b.hpRecover.style.width = `${rec * 100}%`;
    b.hpTrail.style.width = `${b.trail * 100}%`;
    b.hpText.textContent = `${Math.ceil(v.health)} / ${Math.round(v.maxHealth)}`;
    b.stFill.style.width = `${st * 100}%`;
    b.stText.textContent = `${Math.floor(v.stamina)}`;
    b.root.classList.toggle('exhausted', v.fatigue === 'exhausted');
    b.root.classList.toggle('tired', v.fatigue === 'tired');
    b.root.classList.toggle('ko', f.isKO);
    b.fatigue.textContent = f.isKO ? 'K.O.' : v.fatigue === 'exhausted' ? 'EXHAUSTED' : v.fatigue === 'tired' ? 'TIRED' : '';
  }
}
