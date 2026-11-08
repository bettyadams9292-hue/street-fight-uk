import type { Progress } from '../progress/Progress';
import { MOVE_UNLOCKS, MOVE_UNLOCK_IDS, UPGRADES, UPGRADE_IDS, STYLE_LESSONS, effectiveRank, type UpgradeId } from '../progress/catalogue';
import { STYLES } from '../data/styles';
import type { StyleId } from '../styles/StyleData';
import {
  FATIGUE_LIMIT,
  GYM_KIT,
  GYM_KIT_LIST,
  MAX_TRAINING_RANK,
  SPAR_TRAINS,
  buyGymKit,
  currentFatigue,
  sellGymKit,
  xpForRank,
  type GymKitDef,
  type RepGrade,
} from '../training/gym';
import {
  FIGHT_GYMS,
  GYM_OF_STYLE,
  MAX_STYLE_RANK,
  STYLE_XP,
  nextRankNeeds,
  rankUpStyle,
  styleRank,
  type DrillCombo,
  type FightGym,
} from '../training/styleGyms';
import { cycleRow, menuButton } from './controls';
import { h } from './dom';
import { panelScreen, result, shopRow } from './hub';
import { previewCanvas } from './propPreview';
import type { Screen } from './UIManager';

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

function bar(value: number, max: number, cls = ''): HTMLElement {
  const b = h('div', { class: `stat-bar ${cls}` }, h('i', {}));
  (b.firstChild as HTMLElement).style.width = `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
  return b;
}

const pips = (n: number, max: number) => `${'▮'.repeat(n)}${'▯'.repeat(Math.max(0, max - n))}`;

/** What each style rank gives, for the coach and the board. */
export const RANK_TEXT = ['', 'The style: its moves, two-hit strings, its defence', 'Its special moves', 'Full combo strings, clinch power move, submissions', '+5% damage with it', 'Mastery: another +5%'];

function fatigueRow(p: Progress): HTMLElement {
  const f = Math.round(currentFatigue(p.save.gym, p.save.playTime));
  return h('div', { class: 'stat-row' }, h('span', { text: 'Fatigue' }), bar(f, 100, f >= FATIGUE_LIMIT ? 'warn' : ''), h('em', { text: `${f}%` }));
}

// ---- the coach's board in the home gym -----------------------------------------------------------

export function coachBoardScreen(progress: Progress, close: () => void, changed: () => void): Screen {
  return panelScreen('Training plan', progress, (msg) => {
    const s = progress.save;
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: 'You get stronger by training on the kit in this gym, not by buying it. Each session costs fatigue; rest on the sofa or eat to recover. Higher ranks take much more work, and ranks 6-10 count for half.' }),
      fatigueRow(progress),
      h('h3', { text: 'Body (home gym)' }),
    ];
    for (const id of UPGRADE_IDS) {
      const def = UPGRADES[id];
      const rank = s.upgrades[id];
      const kit = GYM_KIT_LIST.filter((k) => k.trains === id).map((k) => `${k.name}${s.gym.owned.includes(k.id) ? '' : ' (not owned)'}`);
      if (id === SPAR_TRAINS) kit.push('Sparring with Mo');
      const xp = s.gym.xp[id] ?? 0;
      const need = rank < MAX_TRAINING_RANK ? xpForRank(rank) : 0;
      rows.push(h('div', { class: 'train-row' },
        h('div', { class: 'what' }, h('b', { text: `${def.name}  ${pips(rank, MAX_TRAINING_RANK)}` }), h('span', { text: `${def.per}. Now worth ${effectiveRank(rank)} ranks. Trained by: ${kit.join(', ') || 'nothing yet'}` })),
        rank >= MAX_TRAINING_RANK ? h('em', { text: 'Top rank' }) : h('div', { class: 'train-xp' }, bar(xp, need), h('em', { text: `${xp}/${need} XP` })),
      ));
    }
    rows.push(h('h3', { text: 'Techniques (bought here)' }));
    for (const id of MOVE_UNLOCK_IDS) {
      const def = MOVE_UNLOCKS[id];
      const have = s.moves.includes(id);
      const locked = !!def.requires && !progress.has(def.requires);
      rows.push(shopRow(def.name, locked ? `${def.text} (${def.requiresText})` : def.text, have ? 'Learned' : locked ? 'Locked' : `£${def.cost}`, have || locked ? null : () => result(progress.buyMove(id), `Learned ${def.name.toLowerCase()}`, msg, changed), have));
    }
    rows.push(h('h3', { text: 'Fighting styles (learned at the fighting gyms)' }));
    for (const l of STYLE_LESSONS) {
      const r = styleRank(progress, l.style);
      const gym = GYM_OF_STYLE[l.style];
      rows.push(h('div', { class: 'shop-row' + (r ? ' owned' : '') }, h('div', { class: 'what' }, h('b', { text: `${STYLES[l.style].name}  ${pips(r, MAX_STYLE_RANK)}` }), h('span', { text: `${gym?.name ?? ''}${r ? ` · next: ${RANK_TEXT[r + 1] ?? 'mastered'}` : ' · not learned'}` })), h('span', { text: '' })));
    }
    const learned = s.styles.learned;
    rows.push(
      h('h3', { text: 'Your styles' }),
      cycleRow<StyleId>('Main style', learned.map((id) => ({ value: id, label: STYLES[id].name })), s.styles.primary, (v) => {
        progress.setStyles(v, s.styles.secondary === v ? null : s.styles.secondary);
        changed();
      }),
      cycleRow<StyleId | null>('Swap style (Tab)', [{ value: null, label: 'None' }, ...learned.map((id) => ({ value: id as StyleId | null, label: STYLES[id].name }))], s.styles.secondary, (v) => {
        progress.setStyles(s.styles.primary, v);
        changed();
      }),
    );
    return rows;
  }, close);
}

// ---- Iron Temple ---------------------------------------------------------------------------------

export function gymStoreScreen(progress: Progress, close: () => void, saved: () => void, startId = 'dumbbells'): Screen {
  let sel = GYM_KIT[startId] ? startId : 'dumbbells';
  let armed = false;
  return panelScreen('Iron Temple Fitness', progress, (msg, rebuild) => {
    const g = progress.save.gym;
    const def = GYM_KIT[sel];
    const owned = g.owned.includes(def.id);
    const list = h('div', { class: 'prop-list' }, ...GYM_KIT_LIST.map((k) =>
      h('button', { class: `prop-item${k.id === sel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((sel = k.id), (armed = false), rebuild()) },
        h('b', { text: k.name }), h('span', { text: `${money(k.price)} · trains ${k.attribute.toLowerCase()}${g.owned.includes(k.id) ? ' · in your gym' : ''}` }))));
    const rank = progress.save.upgrades[def.trains];
    const detail = h('div', { class: 'prop-detail' },
      previewCanvas(def.id, ''),
      h('h3', { text: `${def.name} — ${money(def.price)}` }),
      h('p', { class: 'hint', text: `${def.blurb} Trains ${UPGRADES[def.trains].name} (${def.attribute}); you're rank ${rank}/${MAX_TRAINING_RANK}. Delivered and set up in your home gym.` }),
      h('p', { class: 'hint', text: 'Buying it doesn’t make you stronger: training on it does, a session at a time.' }),
      owned
        ? h('div', { class: 'row-actions' }, h('span', { class: 'owned-tag', text: 'In your gym' }), menuButton(`Sell back ${money(def.price / 2)}`, () => {
          const r = sellGymKit(progress, def.id);
          if (r.ok) {
            saved();
            msg(`Sold for ${money(r.refund)}`);
          } else msg(r.reason, true);
          rebuild();
        }, undefined, 'small'))
        : menuButton(armed ? `Confirm ${money(def.price)}` : `Buy ${money(def.price)}`, () => {
          if (!armed) {
            armed = true;
            return rebuild();
          }
          armed = false;
          result(buyGymKit(progress, def.id), `${def.name} delivered to your home gym`, msg, saved);
          rebuild();
        }, armed ? 'Click again to confirm' : undefined),
    );
    return [h('p', { class: 'hint', text: 'Kit for the home gym at 14 Tanner Road. One of each fits.' }), h('div', { class: 'prop-shop' }, list, detail)];
  }, close);
}

// ---- fighting gym coach -----------------------------------------------------------------------------

export function styleCoachScreen(progress: Progress, close: () => void, saved: () => void, gymId: FightGym['id']): Screen {
  const gym = FIGHT_GYMS.find((g) => g.id === gymId)!;
  let armed: string | null = null;
  return panelScreen(gym.name, progress, (msg, rebuild) => {
    const s = progress.save;
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: `${gym.coach}: “${gym.blurb}” Drill on the pads to earn drill XP, then come and see me for the next rank. Ranks need drill XP, training points (one per level-up) and the fee.` }),
      h('p', { class: 'hint', text: `Training points: ${s.trainingPoints}. Taking any style to rank 3 also gives +1 Technique (up to +4): learn more than one.` }),
    ];
    for (const style of gym.styles) {
      const r = styleRank(progress, style);
      const need = nextRankNeeds(progress, style);
      const prog = s.styleTraining[style] ?? { rank: 0, xp: 0 };
      rows.push(h('h3', { text: `${STYLES[style].name}  ${pips(r, MAX_STYLE_RANK)}` }), h('p', { class: 'hint', text: STYLES[style].blurb }));
      for (let i = 1; i <= MAX_STYLE_RANK; i++) rows.push(h('div', { class: `rank-line${i <= r ? ' done' : ''}` }, h('span', { text: `Rank ${i}` }), h('span', { text: RANK_TEXT[i] })));
      if (!need) {
        rows.push(h('p', { class: 'hint', text: 'Mastered.' }));
        continue;
      }
      const locked = need.requires && !progress.has(need.requires);
      const lacks: string[] = [];
      if (locked) lacks.push(need.requiresText ?? 'Not yet');
      if (prog.xp < need.xp) lacks.push(`drill XP ${prog.xp}/${need.xp}`);
      if (s.trainingPoints < need.points) lacks.push(`${need.points} training point${need.points > 1 ? 's' : ''}`);
      if (s.cash.pocket + s.cash.bank < need.cash) lacks.push(money(need.cash));
      if (need.xp) rows.push(h('div', { class: 'stat-row' }, h('span', { text: 'Drill XP' }), bar(prog.xp, need.xp), h('em', { text: `${prog.xp}/${need.xp}` })));
      const label = need.rank === 1 ? `Learn ${STYLES[style].name} — ${money(need.cash)}` : `Rank ${need.rank} — ${money(need.cash)}${need.points ? ` + ${need.points} pt` : ''}`;
      const key = `${style}:${need.rank}`;
      const btn = menuButton(armed === key ? `Confirm: ${label}` : label, () => {
        if (lacks.length) return msg(`Still need: ${lacks.join(', ')}`, true);
        if (armed !== key) {
          armed = key;
          return rebuild();
        }
        armed = null;
        result(rankUpStyle(progress, style, gymId), need.rank === 1 ? `${STYLES[style].name} learned. Pick it on the coach’s board at home (or here).` : `${STYLES[style].name} rank ${need.rank}: ${RANK_TEXT[need.rank]}`, msg, saved);
        rebuild();
      }, lacks.length ? `Need: ${lacks.join(', ')}` : armed === key ? 'Click again to confirm' : undefined);
      if (lacks.length) btn.classList.add('dim');
      rows.push(btn);
    }
    const learned = s.styles.learned;
    rows.push(
      h('h3', { text: 'Your styles' }),
      cycleRow<StyleId>('Main style', learned.map((id) => ({ value: id, label: STYLES[id].name })), s.styles.primary, (v) => {
        progress.setStyles(v, s.styles.secondary === v ? null : s.styles.secondary);
        saved();
      }),
    );
    void STYLE_XP;
    return rows;
  }, close);
}

// ---- the training mini-game (home gym kit) -----------------------------------------------------------

/**
 * Rep timing: a marker sweeps a bar; hit the action button inside the zone.
 * Perfect (centre), good (zone) or miss. Ten reps a session.
 */
export class RepGame {
  readonly el: HTMLElement;
  readonly grades: RepGrade[] = [];
  done = false;
  private pos = 0;
  private dirn = 1;
  private zone = 0.5;
  private repT = 0;
  private cooldown = 0;
  private flash: HTMLElement;
  private marker: HTMLElement;
  private zoneEl: HTMLElement;
  private perfectEl: HTMLElement;
  private count: HTMLElement;
  private readonly speed: number;
  private readonly width: number;

  constructor(readonly kit: GymKitDef | null, title: string, attribute: string, rank: number, private readonly reps = 10, private readonly onEnd: () => void, private readonly onCancel: () => void) {
    this.speed = 0.75 + rank * 0.06;
    this.width = Math.max(0.12, 0.24 - rank * 0.01);
    this.marker = h('i', { class: 'rep-marker' });
    this.zoneEl = h('b', { class: 'rep-zone' });
    this.perfectEl = h('b', { class: 'rep-perfect' });
    this.flash = h('div', { class: 'rep-flash' });
    this.count = h('div', { class: 'rep-count' });
    const hit = h('button', { class: 'editor-btn ok rep-hit', text: 'Rep!', onclick: (e: Event) => (e.preventDefault(), this.press()) });
    this.el = h('div', { class: 'training-overlay' },
      h('div', { class: 'editor-title', text: title }),
      h('div', { class: 'hint', text: `Training ${attribute}. Press Space, E or tap “Rep!” when the marker is in the green: centre for a perfect rep.` }),
      h('div', { class: 'rep-bar' }, this.zoneEl, this.perfectEl, this.marker),
      this.count,
      this.flash,
      h('div', { class: 'editor-pad' }, hit, h('button', { class: 'editor-btn', text: 'Stop', onclick: (e: Event) => (e.preventDefault(), this.finish(true)) })),
    );
    this.newRep();
  }

  private newRep(): void {
    this.zone = 0.25 + Math.random() * 0.5;
    this.repT = 0;
    this.zoneEl.style.left = `${(this.zone - this.width / 2) * 100}%`;
    this.zoneEl.style.width = `${this.width * 100}%`;
    this.perfectEl.style.left = `${(this.zone - this.width / 6) * 100}%`;
    this.perfectEl.style.width = `${(this.width / 3) * 100}%`;
    this.count.textContent = `Rep ${Math.min(this.reps, this.grades.length + 1)} of ${this.reps}`;
  }

  press(): void {
    if (this.done || this.cooldown > 0) return;
    const d = Math.abs(this.pos - this.zone);
    const g: RepGrade = d <= this.width / 6 ? 'perfect' : d <= this.width / 2 ? 'good' : 'miss';
    this.grade(g);
  }

  private grade(g: RepGrade): void {
    this.grades.push(g);
    this.flash.textContent = g === 'perfect' ? 'Perfect!' : g === 'good' ? 'Good' : 'Missed';
    this.flash.className = `rep-flash ${g}`;
    this.cooldown = 0.35;
    if (this.grades.length >= this.reps) this.finish(false);
    else this.newRep();
  }

  /** Call every frame. */
  update(dt: number): void {
    if (this.done) return;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }
    this.pos += this.dirn * this.speed * dt;
    if (this.pos > 1) {
      this.pos = 1;
      this.dirn = -1;
    } else if (this.pos < 0) {
      this.pos = 0;
      this.dirn = 1;
    }
    this.marker.style.left = `${this.pos * 100}%`;
    this.repT += dt;
    if (this.repT > 3.2) this.grade('miss');
  }

  finish(stopped: boolean): void {
    if (this.done) return;
    this.done = true;
    if (stopped && !this.grades.length) this.onCancel();
    else this.onEnd();
  }
}

// ---- the pad drill (fighting gyms) -----------------------------------------------------------------

const KEY_LABEL: Record<string, string> = { lp: 'J', hp: 'I', lk: 'K', hk: 'L' };
const BTN_NAME: Record<string, string> = { lp: 'Light punch', hp: 'Heavy punch', lk: 'Light kick', hk: 'Heavy kick' };

/** Throw the shown combo, button by button, before the clock runs out. Three combos a drill. */
export class DrillGame {
  readonly el: HTMLElement;
  readonly results: { len: number; clean: boolean }[] = [];
  done = false;
  private i = 0;
  private step = 0;
  private t = 0;
  private mistake = false;
  private seq: HTMLElement;
  private clock: HTMLElement;
  private flash: HTMLElement;

  constructor(private readonly combos: DrillCombo[], title: string, private readonly onEnd: () => void) {
    this.seq = h('div', { class: 'drill-seq' });
    this.clock = h('div', { class: 'stat-bar drill-clock' }, h('i', {}));
    this.flash = h('div', { class: 'rep-flash' });
    const pad = h('div', { class: 'editor-pad' }, ...(['lp', 'hp', 'lk', 'hk'] as const).map((b) => h('button', { class: 'editor-btn', text: `${KEY_LABEL[b]} · ${BTN_NAME[b]}`, onclick: (e: Event) => (e.preventDefault(), this.input(b)) })));
    this.el = h('div', { class: 'training-overlay' },
      h('div', { class: 'editor-title', text: title }),
      h('div', { class: 'hint', text: 'Throw the combination shown, in order, before the clock runs out (keys J, I, K, L or the buttons). These are the style’s real strings.' }),
      this.seq, this.clock, this.flash, pad,
      h('div', { class: 'editor-pad' }, h('button', { class: 'editor-btn', text: 'Stop', onclick: (e: Event) => (e.preventDefault(), this.end()) })),
    );
    this.show();
  }

  private get combo(): DrillCombo | undefined {
    return this.combos[this.i];
  }

  private show(): void {
    const c = this.combo;
    if (!c) return this.end();
    this.seq.replaceChildren(...c.buttons.map((b, k) => h('span', { class: `drill-step${k < this.step ? ' hit' : k === this.step ? ' next' : ''}`, text: `${KEY_LABEL[b]}  ${c.names[k]}` })));
  }

  /** A button pressed (key or tap). */
  input(b: string): void {
    const c = this.combo;
    if (!c || this.done) return;
    if (c.buttons[this.step] === b) {
      this.step++;
      if (this.step >= c.buttons.length) return this.next(true);
    } else {
      this.mistake = true;
      this.flash.textContent = 'Wrong button: start that one again';
      this.flash.className = 'rep-flash miss';
      this.step = 0;
    }
    this.show();
  }

  private next(clean: boolean): void {
    const c = this.combo!;
    this.results.push({ len: c.buttons.length, clean: clean && !this.mistake });
    this.flash.textContent = clean && !this.mistake ? 'Clean!' : clean ? 'Done (messy)' : 'Too slow';
    this.flash.className = `rep-flash ${clean && !this.mistake ? 'perfect' : 'good'}`;
    this.i++;
    this.step = 0;
    this.t = 0;
    this.mistake = false;
    if (this.i >= this.combos.length) this.end();
    else this.show();
  }

  update(dt: number): void {
    if (this.done || !this.combo) return;
    this.t += dt;
    const limit = 2 + this.combo.buttons.length * 1.1;
    (this.clock.firstChild as HTMLElement).style.width = `${Math.max(0, 100 - (this.t / limit) * 100)}%`;
    if (this.t > limit) this.next(false);
  }

  end(): void {
    if (this.done) return;
    this.done = true;
    this.onEnd();
  }
}

export type { UpgradeId };
