import { ARCHETYPES, type ArchetypeId } from '../ai/archetypes';
import { TRAINING_MODE_LABELS, type TrainingOpponent } from '../core/TrainingMode';
import type { Fighter } from '../fighter/Fighter';
import { h } from './dom';
import { icon, type IconName } from './icons';

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
export class Hud {
  readonly el: HTMLElement;
  private player = bars('left');
  private enemy = bars('right');
  private notices: HTMLElement;
  private combo: HTMLElement;
  private comboTimer = 0;
  private floaters: HTMLElement;
  private fps: HTMLElement;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private modeButtons = new Map<TrainingOpponent, HTMLButtonElement>();
  private opponentButton: HTMLButtonElement;
  private prompt: HTMLElement;
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
  private toasts: HTMLElement;
  private bagChip: HTMLElement;
  private weaponChip: HTMLElement;
  private weaponBar: HTMLElement;
  private heatChip: HTMLElement;
  private route: HTMLElement;
  private routeText: HTMLElement;
  private vs: HTMLElement;
  private needsChips: HTMLElement;
  private needsKey = '';
  private activity: HTMLElement;
  private activityTitle: HTMLElement;
  private activityLabel: HTMLElement;
  private activityFill: HTMLElement;
  private sleepShade: HTMLElement;

  constructor(actions: { setMode: (m: TrainingOpponent) => void; nextOpponent: () => void; reset: () => void; pause: () => void; map: () => void; inventory: () => void; character: () => void }) {
    const modes = (Object.keys(TRAINING_MODE_LABELS) as TrainingOpponent[]).map((m, i) => {
      const b = h('button', { class: 'chip', title: `Key ${i + 1}`, onclick: () => actions.setMode(m) }, `${i + 1} \u00b7 ${TRAINING_MODE_LABELS[m]}`) as HTMLButtonElement;
      this.modeButtons.set(m, b);
      return b;
    });
    this.opponentButton = h('button', { class: 'chip opponent', title: 'Key N: next opponent type', onclick: () => actions.nextOpponent() }) as HTMLButtonElement;
    this.notices = h('div', { class: 'notices' });
    this.combo = h('div', { class: 'combo' });
    this.floaters = h('div', { class: 'floaters' });
    this.fps = h('div', { class: 'fps' });
    this.prompt = h('div', { class: 'prompt' });
    this.subFill = h('div', { class: 'sub-fill' });
    this.subBar = h('div', { class: 'sub-bar' }, this.subFill);
    this.money = h('span', { class: 'money' });
    this.levelText = h('span', { class: 'lvl' });
    this.xpFill = h('div', { class: 'xp-fill' });
    this.objective = h('div', { class: 'objective' });
    this.weaponText = h('span', { class: 'weapon-held' });
    this.routeText = h('span');
    this.route = h('div', { class: 'route-line off' }, icon('route'), this.routeText);
    this.story = h(
      'div',
      { class: 'story-info' },
      h('div', { class: 'story-row' }, this.levelText, this.money, this.weaponText),
      h('div', { class: 'xp-bar' }, this.xpFill),
      this.objective,
      this.route,
    );
    this.vs = h('div', { class: 'vs', text: 'VS' });
    this.banner = h('div', { class: 'area-banner' });
    this.bossName = h('div', { class: 'boss-name' });
    this.bossFill = h('div', { class: 'fill hp' });
    this.bossTrail = h('div', { class: 'fill trail' });
    this.bossBar = h('div', { class: 'boss-bar' }, this.bossName, h('div', { class: 'bar health' }, this.bossTrail, this.bossFill));
    this.toasts = h('div', { class: 'toasts' });
    this.bagChip = h('div', { class: 'status-chip bag' });
    this.weaponBar = h('span');
    this.weaponChip = h('div', { class: 'status-chip weapon off' }, h('span', { class: 'wname' }), h('span', { class: 'bar' }, this.weaponBar));
    this.heatChip = h('div', { class: 'status-chip heat off' });
    this.needsChips = h('div', { class: 'needs-chips' });
    this.activityTitle = h('b');
    this.activityLabel = h('span');
    this.activityFill = h('div', { class: 'act-fill' });
    this.activity = h('div', { class: 'house-activity off' }, this.activityTitle, this.activityLabel, h('div', { class: 'act-bar' }, this.activityFill), h('small', { text: 'Esc or move to stop' }));
    this.sleepShade = h('div', { class: 'sleep-shade' });
    this.el = h(
      'div',
      { class: 'hud' },
      this.story,
      this.sleepShade,
      h('div', { class: 'status-strip' }, this.bagChip, this.weaponChip, this.heatChip, this.needsChips),
      this.activity,
      this.banner,
      this.bossBar,
      this.toasts,
      h('div', { class: 'hud-top' }, this.player.root, this.vs, this.enemy.root),
      h(
        'div',
        { class: 'training-bar' },
        h('span', { class: 'training-label', text: 'Partner:' }),
        ...modes,
        this.opponentButton,
        h('button', { class: 'chip', title: 'Key R', onclick: () => actions.reset() }, 'R \u00b7 Reset'),
      ),
      h(
        'div',
        { class: 'hud-buttons' },
        h('button', { class: 'hud-btn story-only', 'aria-label': 'Map', title: 'Map (M / Tab)', onclick: () => actions.map() }, icon('map'), h('span', { class: 'k', text: 'M' })),
        h('button', { class: 'hud-btn story-only', 'aria-label': 'Inventory', title: 'Inventory (I / B)', onclick: () => actions.inventory() }, icon('bag'), h('span', { class: 'k', text: 'I' })),
        h('button', { class: 'hud-btn story-only', 'aria-label': 'Character and crew', title: 'Character & crew (H)', onclick: () => actions.character() }, icon('contact'), h('span', { class: 'k', text: 'H' })),
        h('button', { class: 'hud-btn pause-btn', 'aria-label': 'Pause', title: 'Pause (Esc)', onclick: () => actions.pause() }, '\u275a\u275a'),
      ),
      h('div', { class: 'prompt-wrap' }, this.prompt, this.subBar),
      this.notices,
      this.combo,
      this.floaters,
      this.fps,
    );
  }

  setMode(mode: TrainingOpponent, archetype: ArchetypeId): void {
    for (const [m, b] of this.modeButtons) b.classList.toggle('on', m === mode);
    this.opponentButton.textContent = `N \u00b7 ${ARCHETYPES[archetype].name} \u203a`;
    this.opponentButton.classList.toggle('on', mode === 'spar');
  }

  /** Context prompt above the training bar (grapple options, finisher, escapes). */
  setPrompt(text: string, submission: number | null, interact = false): void {
    if (this.prompt.textContent !== text) this.prompt.textContent = text;
    this.prompt.classList.toggle('interact', interact);
    this.prompt.style.display = text ? 'block' : 'none';
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
      // Only worth showing when your pockets are nearly full.
      const t = info.slots.used >= info.slots.cap ? 'POCKETS FULL' : `POCKETS ${info.slots.used}/${info.slots.cap}`;
      if (this.bagChip.textContent !== t) this.bagChip.textContent = t;
      this.bagChip.classList.toggle('full', info.slots.used >= info.slots.cap);
      this.bagChip.classList.toggle('off', info.slots.used < info.slots.cap - 1);
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

  /** Needs that want attention (only those): small chips by the status strip. */
  setNeeds(list: { key: string; text: string; urgency: number }[]): void {
    const key = list.map((n) => `${n.key}:${n.text}:${n.urgency}`).join('|');
    if (key === this.needsKey) return;
    this.needsKey = key;
    this.needsChips.replaceChildren(...list.map((n) => h('div', { class: `status-chip need u${n.urgency}`, title: 'Needs (H for details)' }, icon(NEED_ICONS[n.key] ?? 'info'), h('span', { text: n.text }))));
  }

  /** District name card when you arrive somewhere. */
  showBanner(district: string, place: string): void {
    this.banner.replaceChildren(h('div', { class: 'district', text: district.toUpperCase() }), h('div', { class: 'place', text: place }));
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  /** Small reward / pickup message at the side. */
  toast(text: string, kind: 'cash' | 'item' | 'info' | 'warn' = 'info', accent?: string): void {
    const t = h('div', { class: `toast ${kind}`, text });
    if (accent) t.style.borderLeftColor = accent;
    this.toasts.append(t);
    while (this.toasts.children.length > 5) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.remove(), 2600);
  }

  setFpsVisible(v: boolean): void {
    this.fps.style.display = v ? 'block' : 'none';
  }

  /** Big centre-screen call-out. */
  notify(text: string, kind: 'big' | 'warn' | 'info' = 'info'): void {
    const n = h('div', { class: `notice ${kind}`, text });
    this.notices.append(n);
    while (this.notices.children.length > 3) this.notices.firstElementChild?.remove();
    setTimeout(() => n.remove(), kind === 'big' ? 1600 : 1100);
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

  clearBubbles(): void {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
  }

  update(dt: number, player: Fighter, enemy: Fighter | null): void {
    this.clock += dt;
    this.updateBars(this.player, player, dt);
    this.enemy.root.style.visibility = enemy ? 'visible' : 'hidden';
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
    const styleText = f.style.name + second;
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
