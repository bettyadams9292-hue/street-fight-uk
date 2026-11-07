import { ARCHETYPES, type ArchetypeId } from '../ai/archetypes';
import { TRAINING_MODE_LABELS, type TrainingOpponent } from '../core/TrainingMode';
import type { Fighter } from '../fighter/Fighter';
import { h } from './dom';

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

  constructor(actions: { setMode: (m: TrainingOpponent) => void; nextOpponent: () => void; reset: () => void; pause: () => void }) {
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
    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-top' }, this.player.root, h('div', { class: 'vs', text: 'VS' }), this.enemy.root),
      h(
        'div',
        { class: 'training-bar' },
        h('span', { class: 'training-label', text: 'Partner:' }),
        ...modes,
        this.opponentButton,
        h('button', { class: 'chip', title: 'Key R', onclick: () => actions.reset() }, 'R \u00b7 Reset'),
      ),
      h('button', { class: 'pause-btn', 'aria-label': 'Pause', onclick: () => actions.pause() }, '\u275a\u275a'),
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
  setPrompt(text: string, submission: number | null): void {
    if (this.prompt.textContent !== text) this.prompt.textContent = text;
    this.prompt.style.display = text ? 'block' : 'none';
    this.subBar.style.display = submission === null ? 'none' : 'block';
    if (submission !== null) this.subFill.style.width = `${submission}%`;
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

  update(dt: number, player: Fighter, enemy: Fighter | null): void {
    this.updateBars(this.player, player, dt);
    this.enemy.root.style.visibility = enemy ? 'visible' : 'hidden';
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
