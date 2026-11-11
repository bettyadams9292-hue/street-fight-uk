import {
  ACCESSORIES,
  BOTTOM_STYLES,
  CLOTHING_COLOURS,
  FACE_SCARS,
  ARM_SCARS,
  FACIAL_HAIR,
  HAIR_COLOURS,
  HAIR_STYLES,
  DETAIL_SLIDERS,
  type DetailKey,
  INK_COLOURS,
  LABELS,
  SHOE_STYLES,
  SKIN_TONES,
  TATTOO_DESIGNS,
  TATTOO_SLOTS,
  TOP_STYLES,
  defaultAppearance,
  randomAppearance,
  type Accessory,
  type BodyType,
  type CharacterAppearance,
} from '../character/Appearance';
import {
  BACKGROUNDS,
  CURRENT_STAGE,
  BACKGROUND_IDS,
  CREATION_BASE,
  CREATION_POINTS,
  canAdd,
  canRemove,
  createCharacter,
  emptyAllocation,
  finalAttributes,
  pointsLeft,
  type BackgroundId,
  type PlayerCharacter,
} from '../character/Character';
import type { StudioFraming } from '../render/StudioView';
import { ATTRIBUTE_NAMES, Stats, type AttributeName, type Attributes } from '../stats/Stats';
import { cycleRow, menuButton, sliderRow, stepperRow, swatchRow } from './controls';
import { h } from './dom';
import type { Screen } from './UIManager';

type Tab = 'body' | 'face' | 'hair' | 'skin' | 'clothes' | 'fighter';

const TAB_LABELS: Record<Tab, string> = { body: 'Body', face: 'Face', hair: 'Hair', skin: 'Skin & ink', clothes: 'Clothes', fighter: 'Fighter' };
const TAB_FRAMING: Record<Tab, StudioFraming> = { body: 'full', face: 'face', hair: 'face', skin: 'upper', clothes: 'full', fighter: 'full' };

export const ATTRIBUTE_LABELS: Record<AttributeName, string> = {
  strength: 'Strength',
  speed: 'Speed',
  endurance: 'Endurance',
  agility: 'Agility',
  defence: 'Defence',
  technique: 'Technique',
};

export const ATTRIBUTE_HINTS: Record<AttributeName, string> = {
  strength: 'Damage and knocking opponents off balance',
  speed: 'Attack and movement speed',
  endurance: 'Stamina, its recovery, and health',
  agility: 'Stepping in and out of the screen, getting up faster',
  defence: 'Damage taken, blocking cost, health',
  technique: 'Clean hits and counter timing',
};

const opts = <T extends string>(list: readonly T[], labels: Record<string, string> = LABELS) => list.map((v) => ({ value: v, label: labels[v] ?? v }));
const sign = (v: number) => (v > 0 ? `+${Math.round(v * 100)}` : `${Math.round(v * 100)}`);

export interface CreatorCallbacks {
  /** Appearance changed: update the live preview. */
  preview: (a: CharacterAppearance) => void;
  frame: (f: StudioFraming) => void;
  rotate: (delta: number) => void;
  /** Finished. In 'new' mode a full character; in 'edit' mode just the look. */
  done: (result: { character?: PlayerCharacter; appearance: CharacterAppearance }) => void;
  cancel: () => void;
}

/**
 * Character creation (and look editing). The model on the right updates
 * live; drag it, or use the arrows under the panel, to turn it round.
 */
export function characterCreator(
  mode: 'new' | 'edit',
  cb: CreatorCallbacks,
  existing?: PlayerCharacter,
  startLook?: CharacterAppearance,
  /** Clothes not found yet ('top:bomber', 'acc:chain'...). Anything already worn stays available. */
  isLocked: (key: string) => boolean = () => false,
): Screen {
  let appearance: CharacterAppearance = structuredClone(existing?.appearance ?? startLook ?? defaultAppearance('male'));
  let name = existing?.name ?? '';
  let background: BackgroundId = existing?.background ?? 'estate_scrapper';
  const allocated: Attributes = existing ? { ...existing.allocated } : emptyAllocation();
  const tabs: Tab[] = mode === 'new' ? ['body', 'face', 'hair', 'skin', 'clothes', 'fighter'] : ['body', 'face', 'hair', 'skin', 'clothes'];
  let tab: Tab = 'body';

  const content = h('div', { class: 'creator-content' });
  const tabBar = h('div', { class: 'creator-tabs', 'data-nav': true, tabindex: 0, role: 'tablist', 'aria-label': 'Sections' });
  const tabButtons = new Map<Tab, HTMLButtonElement>();
  for (const t of tabs) {
    const b = h('button', { class: 'tab', role: 'tab', onclick: (e: Event) => { e.stopPropagation(); setTab(t); } }, TAB_LABELS[t]) as HTMLButtonElement;
    tabButtons.set(t, b);
    tabBar.append(b);
  }
  tabBar.addEventListener('nav-adjust', (e) => {
    const i = tabs.indexOf(tab) + (e as CustomEvent<number>).detail;
    setTab(tabs[(i + tabs.length) % tabs.length]);
  });

  const status = h('div', { class: 'creator-status' });
  const primary = menuButton(mode === 'new' ? 'Next' : 'Save look', () => onPrimary(), undefined, 'primary');
  const footer = h(
    'div',
    { class: 'creator-footer' },
    menuButton('Back', () => cb.cancel()),
    menuButton('Randomise look', () => {
      const body = appearance.body;
      appearance = randomAppearance(Math.random, body);
      update();
      render();
    }),
    primary,
  );

  const stage = h(
    'div',
    { class: 'creator-stage' },
    h('div', { class: 'turn-buttons' },
      h('button', { class: 'chip', 'aria-label': 'Turn left', onclick: () => cb.rotate(-0.5) }, '↺'),
      h('button', { class: 'chip', 'aria-label': 'Turn right', onclick: () => cb.rotate(0.5) }, '↻'),
    ),
  );
  // Drag to spin the model.
  let dragX: number | null = null;
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragX = e.clientX;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    cb.rotate((e.clientX - dragX) * 0.012);
    dragX = e.clientX;
  });
  const endDrag = () => (dragX = null);
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  const panel = h(
    'div',
    { class: 'creator-panel' },
    h('h2', { text: mode === 'new' ? 'Create your fighter' : 'Change your look' }),
    tabBar,
    content,
    status,
    footer,
  );
  const el = h('div', { class: 'screen creator' }, panel, stage);

  const update = () => cb.preview(structuredClone(appearance));

  function setTab(t: Tab): void {
    tab = t;
    for (const [k, b] of tabButtons) b.classList.toggle('on', k === t);
    cb.frame(TAB_FRAMING[t]);
    render();
    content.scrollTop = 0;
  }

  function onPrimary(): void {
    if (mode === 'edit') {
      cb.done({ appearance: structuredClone(appearance) });
      return;
    }
    const i = tabs.indexOf(tab);
    if (tab !== 'fighter') {
      setTab(tabs[i + 1]);
      return;
    }
    const left = pointsLeft(allocated);
    if (left > 0) {
      status.textContent = `Spend your last ${left} attribute point${left === 1 ? '' : 's'} first.`;
      status.classList.add('warn');
      return;
    }
    const character = createCharacter({ name: name || 'Unknown', appearance, background, allocated });
    cb.done({ character, appearance: character.appearance });
  }

  // ---- tab contents ---------------------------------------------------------------
  const set = <K extends keyof CharacterAppearance>(k: K, v: CharacterAppearance[K]) => {
    appearance = { ...appearance, [k]: v };
    update();
  };
  const setFace = (k: keyof CharacterAppearance['face'], v: number) => {
    appearance = { ...appearance, face: { ...appearance.face, [k]: v } };
    update();
  };
  const toggleAccessory = (acc: Accessory, on: boolean) => {
    // A cap and a head guard can't be worn together.
    const clash: Accessory | null = acc === 'cap' ? 'headguard' : acc === 'headguard' ? 'cap' : null;
    const list = appearance.accessories.filter((x) => x !== acc && !(on && x === clash));
    if (on) list.push(acc);
    set('accessories', list);
  };
  /** The fine shaping sliders for a section, starting at average. */
  const detailRows = (part: 'face' | 'body') => [
    h('p', { class: 'hint', text: part === 'face' ? 'Fine detail' : 'Shape' }),
    ...DETAIL_SLIDERS[part].map(([key, label]) =>
      sliderRow(label, appearance.detail?.[key] ?? 0, (v) => {
        appearance = { ...appearance, detail: { ...appearance.detail, [key]: v } };
        update();
      }, { min: -1, max: 1, step: 0.1, format: sign }),
    ),
  ];
  const faceSlider = (label: string, key: keyof CharacterAppearance['face']) =>
    sliderRow(label, appearance.face[key], (v) => setFace(key, v), { min: -1, max: 1, step: 0.1, format: sign });

  function render(): void {
    status.textContent = '';
    status.classList.remove('warn');
    primary.querySelector('.label')!.textContent = mode === 'edit' ? 'Save look' : tab === 'fighter' ? 'Create fighter' : 'Next';
    const a = appearance;
    switch (tab) {
      case 'body':
        content.replaceChildren(
          cycleRow<BodyType>('Body', opts(['male', 'female'] as const), a.body, (v) => {
            // Switching body keeps your choices but swaps body-specific defaults.
            const d = defaultAppearance(v);
            const cur = appearance;
            appearance = { ...cur, body: v, height: d.height, facialHair: v === 'female' ? 'none' : cur.facialHair, top: v === 'female' && cur.top === 'none' ? 'vest' : cur.top };
            update();
            render();
          }),
          sliderRow('Muscle', a.muscle, (v) => set('muscle', v)),
          sliderRow('Weight', a.weight, (v) => set('weight', v)),
          sliderRow('Height', a.height, (v) => set('height', v), { min: 0.93, max: 1.07, step: 0.01, format: (v) => `${Math.round(177 * v)} cm` }),
          ...detailRows('body'),
          h('p', { class: 'hint', text: 'Height and build are cosmetic: your attributes decide how you fight.' }),
        );
        break;
      case 'face':
        content.replaceChildren(
          faceSlider('Head width', 'headWidth'),
          faceSlider('Jaw', 'jaw'),
          faceSlider('Nose', 'nose'),
          faceSlider('Brow', 'brow'),
          faceSlider('Eye spacing', 'eyeSpacing'),
          faceSlider('Ears', 'ears'),
          ...detailRows('face'),
          menuButton('Random face', () => {
            const r = randomAppearance();
            const detail: Partial<Record<DetailKey, number>> = { ...appearance.detail };
            for (const [k] of DETAIL_SLIDERS.face) detail[k] = Math.round((Math.random() * 1.2 - 0.6) * 10) / 10;
            appearance = { ...appearance, face: r.face, detail };
            update();
            render();
          }),
        );
        break;
      case 'hair':
        content.replaceChildren(
          cycleRow('Hairstyle', opts(HAIR_STYLES), a.hair, (v) => set('hair', v)),
          swatchRow('Hair colour', HAIR_COLOURS, a.hairColour, (v) => set('hairColour', v)),
          sliderRow('Greying', a.greying, (v) => set('greying', v)),
          a.body === 'male'
            ? cycleRow('Facial hair', opts(FACIAL_HAIR), a.facialHair, (v) => set('facialHair', v))
            : h('p', { class: 'hint', text: 'Facial hair is available on the male body.' }),
        );
        break;
      case 'skin':
        content.replaceChildren(
          swatchRow('Skin tone', SKIN_TONES, a.skinTone, (v) => set('skinTone', v)),
          h('h3', { text: 'Tattoos' }),
          ...TATTOO_SLOTS.map((slot) =>
            cycleRow(LABELS[slot], opts(TATTOO_DESIGNS.filter((d) => d !== 'sleeve' || slot.includes('Arm'))), a.tattoos[slot], (v) => {
              appearance = { ...appearance, tattoos: { ...appearance.tattoos, [slot]: v } };
              update();
            }),
          ),
          swatchRow('Ink colour', INK_COLOURS, a.inkColour, (v) => set('inkColour', v)),
          h('p', { class: 'hint', text: 'Tattoos show where your clothes don’t cover. Try a vest or T-shirt.' }),
          h('h3', { text: 'Scars' }),
          cycleRow('Face', opts(FACE_SCARS), a.faceScar, (v) => set('faceScar', v)),
          cycleRow('Arms', opts(ARM_SCARS), a.armScar, (v) => set('armScar', v)),
        );
        break;
      case 'clothes': {
        const topLabels = { ...LABELS, none: 'Bare chest' };
        content.replaceChildren(
          cycleRow('Top', opts(TOP_STYLES.filter((t) => (a.body === 'male' || t !== 'none') && (!isLocked(`top:${t}`) || t === a.top)), topLabels), a.top, (v) => set('top', v)),
          swatchRow('Top colour', CLOTHING_COLOURS, a.topColour, (v) => set('topColour', v)),
          cycleRow('Bottoms', opts(BOTTOM_STYLES.filter((t) => !isLocked(`bottoms:${t}`) || t === a.bottoms)), a.bottoms, (v) => set('bottoms', v)),
          swatchRow('Bottoms colour', CLOTHING_COLOURS, a.bottomsColour, (v) => set('bottomsColour', v)),
          cycleRow('Shoes', opts(SHOE_STYLES.filter((t) => !isLocked(`shoes:${t}`) || t === a.shoes)), a.shoes, (v) => set('shoes', v)),
          swatchRow('Shoes colour', CLOTHING_COLOURS, a.shoesColour, (v) => set('shoesColour', v)),
          h('h3', { text: 'Accessories' }),
          ...ACCESSORIES.filter((acc) => !isLocked(`acc:${acc}`) || a.accessories.includes(acc)).map((acc) =>
            cycleRow(LABELS[acc], [{ value: false, label: 'Off' }, { value: true, label: 'On' }], a.accessories.includes(acc), (on) => {
              toggleAccessory(acc, on);
              if ((acc === 'cap' || acc === 'headguard') && on) render();
            }),
          ),
          cycleRow('Metal', [{ value: 'gold' as const, label: 'Gold' }, { value: 'silver' as const, label: 'Silver' }], a.chainColour, (v) => set('chainColour', v)),
          h('p', { class: 'hint', text: lockedCount() ? 'These are your own clothes. Jackets, trainers, chains and more are sold at Threads on the High Street (or found), and you wear them from your inventory.' : '' }),
        );
        break;
      }
      case 'fighter':
        content.replaceChildren(...fighterTab());
        break;
    }
  }

  function lockedCount(): number {
    return [...TOP_STYLES.map((t) => `top:${t}`), ...ACCESSORIES.map((x) => `acc:${x}`)].filter((k) => isLocked(k)).length;
  }

  function fighterTab(): HTMLElement[] {
    const nameInput = h('input', { type: 'text', class: 'name-input', maxlength: 16, placeholder: 'Your fighting name', value: name, 'data-nav': true, 'aria-label': 'Name' }) as HTMLInputElement;
    nameInput.addEventListener('input', () => (name = nameInput.value));

    const bgInfo = h('div', { class: 'bg-info' });
    const points = h('div', { class: 'points' });
    const derived = h('div', { class: 'derived' });
    const steppers: { refresh: () => void }[] = [];

    const refreshAll = () => {
      const bg = BACKGROUNDS[background];
      const left = pointsLeft(allocated);
      points.textContent = left > 0 ? `${left} of ${CREATION_POINTS} points left to spend` : 'All points spent';
      points.classList.toggle('done', left === 0);
      const bonus = Object.entries(bg.bonus).map(([k, v]) => `+${v} ${ATTRIBUTE_LABELS[k as AttributeName]}`).join(', ');
      const pending = bg.perk.activeFromStage > CURRENT_STAGE ? ` (takes effect from Stage ${bg.perk.activeFromStage})` : '';
      bgInfo.replaceChildren(
        h('p', { class: 'blurb', text: bg.blurb }),
        h('p', {}, h('b', { text: 'Bonus: ' }), bonus),
        h('p', {}, h('b', { text: 'Perk: ' }), bg.perk.text + pending),
        h('p', {}, h('b', { text: 'Starting cash: ' }), `£${bg.startingMoney}`),
      );
      const stats = new Stats(finalAttributes(allocated, background), 1);
      derived.replaceChildren(...derivedStats(stats));
      for (const s of steppers) s.refresh();
    };

    const rows = ATTRIBUTE_NAMES.map((attr) => {
      const s = stepperRow(
        ATTRIBUTE_LABELS[attr],
        () => finalAttributes(allocated, background)[attr],
        (d) => {
          allocated[attr] += d;
          refreshAll();
        },
        {
          canDec: () => canRemove(allocated, attr),
          canInc: () => canAdd(allocated, attr),
          detail: () => {
            const b = BACKGROUNDS[background].bonus[attr];
            return `${ATTRIBUTE_HINTS[attr]}${b ? ` (includes +${b} background)` : ''}`;
          },
        },
      );
      steppers.push(s);
      return s.row;
    });

    refreshAll();
    return [
      h('div', { class: 'setting-row' }, h('span', { class: 'name', text: 'Name' }), nameInput),
      cycleRow('Background', BACKGROUND_IDS.map((id) => ({ value: id, label: BACKGROUNDS[id].name })), background, (v) => {
        background = v;
        refreshAll();
      }),
      bgInfo,
      h('h3', { text: 'Attributes' }),
      points,
      ...rows,
      h('p', { class: 'hint', text: `Each attribute starts at ${CREATION_BASE}. You can raise any to 10 now; your background bonus goes on top. Levelling up gives more points later.` }),
      h('h3', { text: 'What that gives you' }),
      derived,
    ];
  }

  setTab('body');
  update();

  return {
    el,
    onBack: () => cb.cancel(),
  };
}

/** Readable summary of what a set of stats does in a fight. */
export function derivedStats(s: Stats): HTMLElement[] {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const mult = (v: number) => `×${v.toFixed(2)}`;
  const rows: [string, string][] = [
    ['Max health', `${Math.round(s.maxHealth)}`],
    ['Max stamina', `${Math.round(s.maxStamina)}`],
    ['Stamina recovery', `${s.staminaRegenPerSecond.toFixed(1)} / sec`],
    ['Damage', mult(s.damageMultiplier)],
    ['Attack speed', mult(s.attackSpeed)],
    ['Move speed', mult(s.moveSpeedMultiplier)],
    ['Damage blocked by Defence', pct(s.defenceReduction)],
    ['Clean hit chance', pct(s.cleanHitChance)],
  ];
  return rows.map(([k, v]) => h('div', { class: 'derived-row' }, h('span', { text: k }), h('b', { text: v })));
}
