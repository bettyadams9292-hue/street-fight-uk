/**
 * Jobs on screen (src/jobs): a contact's board (their standing with you, their own chain job, the jobs going),
 * a passer-by's offer, and the card every job is shown on.
 */
import { h } from './dom';
import { menuButton } from './controls';
import { panelScreen } from './hub';
import type { Screen } from './UIManager';
import type { Progress } from '../progress/Progress';
import { ITEMS } from '../items/items';
import {
  areaName, boardOf, chainJob, CHAINS, CONTACTS, contactOpen, JOB_KIND_NAME, objectiveOf, standingWith, tierOf, timeLeft, TIERS,
  type ContactId, type Job,
} from '../jobs/jobs';

export interface JobActions {
  /** Take this job (true if it's yours now: the screen closes). */
  take(job: Job): { ok: boolean; reason?: string };
  /** Hand back the money or the goods, and get paid. */
  handIn(): string | null;
  /** Give up the job you're on. */
  drop(): string | null;
}

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

/** What a job pays, in short chips: cash, XP, items, and what it costs or risks. */
function payChips(job: Job): HTMLElement {
  const chips: HTMLElement[] = [];
  if (job.kind === 'deal') {
    chips.push(h('span', { class: 'job-chip cost', text: `Costs ${money(job.cost ?? 0)}` }), h('span', { class: 'job-chip cash', text: `Sells for ${money(job.cash)}` }));
  } else if (job.kind === 'debt') {
    chips.push(h('span', { class: 'job-chip', text: `Owes ${money(job.owed ?? 0)}` }), h('span', { class: 'job-chip cash', text: `Your cut ${money(job.cash)}` }));
  } else chips.push(h('span', { class: 'job-chip cash', text: money(job.cash) }));
  chips.push(h('span', { class: 'job-chip', text: `${job.xp} XP` }));
  for (const id of job.items) chips.push(h('span', { class: 'job-chip item', text: `+ ${ITEMS[id]?.name ?? id}` }));
  if (job.seconds) chips.push(h('span', { class: 'job-chip time', text: `${Math.round(job.seconds / 60)} min` }));
  const heat = job.heat.police ?? 0;
  if (heat >= 8) chips.push(h('span', { class: 'job-chip risk', text: 'Police heat' }));
  if (job.kind === 'sort' || job.kind === 'recover') chips.push(h('span', { class: 'job-chip risk', text: job.mates ? `A fight: ${job.target} and ${job.mates}` : 'A fight' }));
  return h('div', { class: 'job-chips' }, ...chips);
}

export function jobCard(job: Job, action: HTMLElement | null, special = false): HTMLElement {
  return h('div', { class: `job-card${special ? ' special' : ''}` },
    h('div', { class: 'job-head' },
      h('b', { class: 'job-title', text: job.title }),
      h('span', { class: 'job-kind', text: special ? `${JOB_KIND_NAME[job.kind]} · their own job` : JOB_KIND_NAME[job.kind] }),
    ),
    h('span', { class: 'job-where', text: areaName(job.area) }),
    h('p', { class: 'job-brief', text: job.brief }),
    payChips(job),
    action ? h('div', { class: 'row-actions' }, action) : null,
  );
}

/** How you stand with them: what they call you, and how far to the next step. */
function standingBar(p: Progress, id: ContactId): HTMLElement {
  const n = standingWith(p, id);
  const t = tierOf(n);
  const lo = TIERS[t.index].at;
  const pct = t.next === null ? 100 : Math.round(((n - lo) / (t.next - lo)) * 100);
  return h('div', { class: 'job-standing' },
    h('div', { class: 'job-standing-head' }, h('b', { text: t.name }), h('span', { text: t.next === null ? `Standing ${n}` : `Standing ${n}: ${t.next - n} more to ${TIERS[t.index + 1].name}` })),
    h('div', { class: 'job-bar' }, h('i', { style: `width:${pct}%` })),
    h('small', { text: t.mult > 1 ? `Their jobs pay ${Math.round((t.mult - 1) * 100)}% more.` : 'Do their work and they’ll pay you more.' }),
  );
}

/** A contact: standing, the job you're doing for them, their own job, and what's going. */
export function contactScreen(p: Progress, id: ContactId, close: () => void, acts: JobActions, extra?: (msg: (t: string, bad?: boolean) => void, rebuild: () => void) => HTMLElement[]): Screen {
  const c = CONTACTS[id];
  return panelScreen(`${c.name} · ${c.role}`, p, (msg, rebuild) => {
    const s = p.save.jobs;
    if (!s.met.includes(id)) s.met.push(id);
    const rows: HTMLElement[] = [h('p', { class: 'quote', text: `“${c.line}”` }), standingBar(p, id)];
    if (!contactOpen(p, id)) {
      rows.push(h('p', { class: 'hub-warn', text: 'They don’t know you yet. Make a name for yourself first.' }));
      return rows;
    }
    const a = s.active;
    if (a && a.from === id) {
      const left = timeLeft(p);
      rows.push(h('div', { class: 'job-sec', text: 'The job you’re on' }));
      const done = a.stage === 'back';
      const hand = done
        ? menuButton('Hand it over', () => {
            const r = acts.handIn();
            if (r) msg(r);
            rebuild();
          }, undefined, '', undefined, undefined, 'hand-it-over')
        : menuButton('Drop the job', () => {
            const r = acts.drop();
            if (r) msg(r, true);
            rebuild();
          }, 'They’ll trust you a bit less', '', undefined, undefined, 'drop-the-job');
      rows.push(h('div', { class: `job-card active${done ? ' ready' : ''}` },
        h('div', { class: 'job-head' }, h('b', { class: 'job-title', text: a.title }), h('span', { class: 'job-kind', text: done ? 'Done: come for your money' : 'On it' })),
        h('p', { class: 'job-brief', text: `${objectiveOf(a)}${left !== null ? `. ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left.` : '.'}` }),
        h('div', { class: 'row-actions' }, hand),
      ));
      return rows;
    }
    const busy = !!a;
    if (busy) rows.push(h('p', { class: 'hub-warn', text: `You’re on a job for ${a!.giver}: ${a!.title}. Finish it or drop it before you take another.` }));
    const take = (job: Job) =>
      menuButton('Take the job', () => {
        const r = acts.take(job);
        if (!r.ok) {
          msg(r.reason ?? 'Not now', true);
          rebuild();
        }
      }, job.kind === 'deal' ? `Pay ${money(job.cost ?? 0)} for the package` : undefined, '', undefined, undefined, 'take-the-job');
    const ch = chainJob(p, id);
    const step = s.chain[id] ?? 0;
    if (ch.job) {
      rows.push(h('div', { class: 'job-sec', text: `${c.name.split(' ')[0]}’s own job (${step + 1} of ${CHAINS[id].length})` }));
      rows.push(jobCard(ch.job, busy ? null : take(ch.job), true));
    } else if (ch.locked) rows.push(h('p', { class: 'job-locked', text: ch.locked }));
    else if (step >= CHAINS[id].length) rows.push(h('p', { class: 'job-locked', text: `You’ve done all of ${c.name.split(' ')[0]}’s own jobs.` }));
    rows.push(h('div', { class: 'job-sec', text: 'Going' }));
    const board = boardOf(p, id);
    if (!board.length) rows.push(h('p', { class: 'ph-empty', text: 'Nothing going right now. Come back in a bit.' }));
    for (const job of board) rows.push(jobCard(job, busy ? null : take(job)));
    rows.push(h('small', { class: 'job-note', text: 'New jobs come up every few trips.' }));
    if (extra) rows.push(...extra(msg, rebuild));
    return rows;
  }, close);
}

/** A passer-by's job: take it or leave it. */
export function offerScreen(p: Progress, job: Job, name: string, accept: () => { ok: boolean; reason?: string }, close: () => void): Screen {
  return panelScreen(`${name} needs a hand`, p, (msg, rebuild) => {
    const busy = p.save.jobs.active;
    const rows: HTMLElement[] = [h('p', { class: 'quote', text: `“${job.brief}”` })];
    if (busy) rows.push(h('p', { class: 'hub-warn', text: `You’re on a job already: ${busy.title}. Finish it or drop it first.` }));
    rows.push(jobCard(job, busy ? null : menuButton('Take the job', () => {
      const r = accept();
      if (!r.ok) {
        msg(r.reason ?? 'Not now', true);
        rebuild();
      }
    }, 'Paid when it’s done', '', undefined, undefined, 'take-the-job')));
    rows.push(h('div', { class: 'row-actions' }, menuButton('Not now', close, undefined, '', undefined, undefined, 'not-now')));
    return rows;
  }, close);
}
