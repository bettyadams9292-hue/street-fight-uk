/**
 * Saves: the three slots, what's in each and when it was saved, and what you can do with them. Save here, load,
 * download a backup file (`.hgsave`), bring one back in, or empty a slot; anything that would lose a fighter asks
 * first. Built on the result-card look (`.sv-*` in theme.css): squared plates, a ledger per slot, one red action.
 */
import { h } from './dom';
import type { Screen } from './UIManager';
import type { SlotInfo, Slot } from '../save/SaveStore';
import { LEVELS } from '../world/levels';
import type { AreaId } from '../progress/Progress';

export interface SavesActions {
  slots(): SlotInfo[];
  /** The slot in use (null on the main menu with no game loaded yet). */
  current(): Slot | null;
  /** In a game: save it now into its own slot. */
  saveNow: (() => boolean) | null;
  /** In a game: save it into another slot (and keep playing from there). */
  saveTo: ((slot: Slot) => boolean) | null;
  load(slot: Slot): void;
  /** Start a new fighter in an empty slot. */
  fresh(slot: Slot): void;
  exportSlot(slot: Slot): boolean;
  /** Pick a file and check it; null when it's fine, or why not. */
  importFile(slot: Slot, done: (msg: string, bad: boolean) => void): void;
  remove(slot: Slot): void;
  close(): void;
}

const when = (iso: string | null): string => {
  if (!iso) return 'Never saved';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Saved';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function savesScreen(a: SavesActions): Screen {
  const el = h('div', { class: 'screen sv-screen', role: 'dialog', 'aria-label': 'Saves' });
  let note: { text: string; bad: boolean } | null = null;
  let confirm: { slot: Slot; what: string; yes: string; go: () => void } | null = null;
  const msg = (text: string, bad = false): void => {
    note = { text, bad };
    build();
  };
  const ask = (slot: Slot, what: string, yes: string, go: () => void): void => {
    confirm = { slot, what, yes, go };
    build();
  };
  const btn = (label: string, go: () => void, cls = ''): HTMLElement => h('button', { class: `sv-btn ${cls}`, 'data-nav': true, onclick: go }, label);

  const card = (s: SlotInfo): HTMLElement => {
    const cur = a.current() === s.slot;
    const empty = !s.name;
    const place = s.area && LEVELS[s.area as AreaId] ? LEVELS[s.area as AreaId].district : '';
    const actions: HTMLElement[] = [];
    if (confirm && confirm.slot === s.slot) {
      const c = confirm;
      actions.push(
        btn(c.yes, () => {
          confirm = null;
          c.go();
        }, 'danger'),
        btn('Keep it', () => {
          confirm = null;
          build();
        }),
      );
    } else if (empty) {
      if (a.saveTo && !cur) actions.push(btn('Save here', () => msg(a.saveTo!(s.slot) ? `Saved into slot ${s.slot}. You’re playing from it now.` : 'Couldn’t save: storage is full or blocked.', false), 'primary'));
      actions.push(btn('New fighter here', () => a.fresh(s.slot)));
      actions.push(btn('Bring in a file', () => a.importFile(s.slot, msg)));
    } else {
      if (cur && a.saveNow) actions.push(btn('Save now', () => msg(a.saveNow!() ? 'Saved.' : 'Couldn’t save: storage is full or blocked. Download a backup.', !a.saveNow), 'primary'));
      if (!cur) actions.push(btn(a.current() ? 'Load' : 'Play', () => (a.saveNow ? ask(s.slot, `Leave this game (it saves first) and load ${s.name}?`, 'Load', () => a.load(s.slot)) : a.load(s.slot)), 'primary'));
      if (!cur && a.saveTo) actions.push(btn('Save over', () => ask(s.slot, `Save this game over ${s.name} (level ${s.level})? ${s.name} goes.`, 'Save over', () => msg(a.saveTo!(s.slot) ? `Saved into slot ${s.slot}.` : 'Couldn’t save.', false))));
      actions.push(btn('Download', () => msg(a.exportSlot(s.slot) ? 'Backup downloaded. Keep it somewhere safe.' : 'Nothing to download.', false)));
      actions.push(btn('Bring in a file', () => ask(s.slot, `A file brought in here replaces ${s.name} (kept as this slot’s backup).`, 'Choose file', () => a.importFile(s.slot, msg))));
      if (!cur) actions.push(btn('Delete', () => ask(s.slot, `Delete ${s.name} for good? This can’t be undone unless you’ve downloaded a backup.`, 'Delete', () => { a.remove(s.slot); msg(`Slot ${s.slot} emptied.`); }), 'quiet'));
    }
    return h(
      'section',
      { class: `sv-slot${cur ? ' current' : ''}${empty ? ' empty' : ''}`, 'aria-label': `Slot ${s.slot}` },
      h('div', { class: 'sv-head' }, h('span', { class: 'sv-num', text: String(s.slot) }), h('span', { class: 'sv-name', text: empty ? 'Empty' : s.name }), cur ? h('span', { class: 'sv-tag', text: 'Playing' }) : null),
      empty
        ? h('p', { class: 'sv-meta', text: 'Nothing saved here.' })
        : h('p', { class: 'sv-meta', text: `Level ${s.level}${place ? `, ${place}` : ''}. ${when(s.savedAt)}.` }),
      s.damaged ? h('p', { class: 'sv-warn', text: 'The last save here was damaged: its backup will load.' }) : null,
      confirm && confirm.slot === s.slot ? h('p', { class: 'sv-ask', text: confirm.what }) : null,
      h('div', { class: 'sv-actions' }, ...actions),
    );
  };

  const build = (): void => {
    el.replaceChildren(
      h(
        'div',
        { class: 'sv-card' },
        h('div', { class: 'oc-tape', 'aria-hidden': 'true' }),
        h('p', { class: 'oc-kicker', text: 'Saved in this browser. Download a backup to keep it safe if the browser’s data is cleared.' }),
        h('h2', { class: 'oc-title sv-title', text: 'Saves' }),
        note ? h('p', { class: `sv-note${note.bad ? ' bad' : ''}`, role: 'status', text: note.text }) : null,
        h('div', { class: 'sv-slots' }, ...a.slots().map(card)),
        h('nav', { class: 'oc-actions' }, h('button', { class: 'oc-act', 'data-nav': true, onclick: () => a.close() }, h('span', { class: 'oc-act-label', text: 'Back' }))),
      ),
    );
  };
  build();
  // Focusing the first button scrolls it into view; open at the top so the title and the note show too.
  setTimeout(() => { el.scrollTop = 0; }, 80);
  return { el, onBack: () => a.close() };
}

/** Save a text file to the device (a download on desktop, the share or files sheet on a phone). */
export function downloadText(name: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/** Ask for a file and read it as text. */
export function pickTextFile(got: (text: string | null) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.hgsave,.json,application/json';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return got(null);
    if (f.size > 5_000_000) return got(null);
    f.text().then(got, () => got(null));
  };
  input.click();
}
