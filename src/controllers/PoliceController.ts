/**
 * The police in play, out of Game.ts: the OLD BILL screen when they turn up (bung, come quietly, fight), the
 * charge sheet once you're booked in (bail, a mate's bail, Kerrigan's paperwork, or your time in the cell), the
 * clock on a sentence, and Sgt Hollis's front counter. The rules live in progress/record.ts, progress/cops.ts and
 * world/custody.ts; this is the wiring between them and the screens (ui/policeUI.ts).
 */
import type { AreaId, Progress } from '../progress/Progress';
import type { World } from '../world/World';
import type { Screen } from '../ui/UIManager';
import { custodyRecord, frontCounter, policeStop } from '../ui/policeUI';
import { canPayBail, crewToRing, losePaperwork, payBail, release, ringCrew, sentenceSeconds, serveTime, timeLeft, type Booking } from '../world/custody';
import { owedFor } from '../progress/cops';
import { CRIME_NAME, settlePrice } from '../progress/record';
import { COMPANIONS } from '../companions/companions';

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export interface PoliceHost {
  progress(): Progress | null;
  world(): World | null;
  /** Put a screen up (or take every screen down with null). */
  show(screen: Screen | null): void;
  /** Take the screen down and play on. */
  resume(): void;
  toast(text: string, kind: 'info' | 'cash' | 'warn'): void;
  notify(text: string, kind: 'warn'): void;
  save(): void;
  /** Book the player in after `delay` seconds and show the charge sheet. */
  nicked(delay: number): void;
  goTo(area: AreaId, entry: string): void;
}

export class PoliceController {
  constructor(private readonly host: PoliceHost) {}

  frontDesk(close: () => void): Screen {
    const p = this.host.progress()!;
    const s = p.save;
    const districts = [...new Set([...s.record.map((e) => e.district), ...Object.entries(s.districtHeat).filter(([, h]) => h.police > 0).map(([d]) => d)])];
    const lines: { text: string; big?: boolean }[] = [{ text: s.record.length ? 'Sgt Hollis pulls up your file.' : 'Sgt Hollis types your name in. Nothing comes up.', big: true }];
    for (const e of [...s.record].reverse().slice(0, 6)) lines.push({ text: `${CRIME_NAME[e.crime]}, ${e.district}` });
    if (s.record.length > 6) lines.push({ text: `…and ${s.record.length - 6} more.` });
    const buttons: { label: string; sub?: string; go: () => void }[] = [];
    for (const d of districts.slice(0, 4)) {
      const price = settlePrice(s.record, d, p.heatIn(d).police);
      buttons.push({
        label: `Settle up: ${d} (\u00a3${price})`,
        sub: 'Pays the fines: police heat and the record there wiped',
        go: () => {
          if (!p.pay(price)) {
            this.host.toast(`You need \u00a3${price}: cash, or your card.`, 'warn');
            return;
          }
          s.record = s.record.filter((e) => e.district !== d);
          p.setHeat('police', 0, d);
          if (d === p.here) s.heat = 0;
          this.host.save();
          this.host.toast(`Fines paid in ${d}: \u00a3${price}. Clean slate there.`, 'cash');
          this.host.show(this.frontDesk(close));
        },
      });
    }
    buttons.push({ label: 'Leave', go: close });
    return frontCounter({
      sergeant: 'Sgt Hollis, front counter',
      empty: !s.record.length,
      file: lines.slice(1).map((l) => l.text),
      choices: buttons.map((b) => ({ ...b, tone: b.label === 'Leave' ? 'calm' : 'cost' })),
    });
  }

  /**
   * The police have turned up (progress/cops.ts): offer the lead officer a bung (a bent one takes it and they walk
   * off; a straight one adds bribery to your record and they come at you harder), come quietly (nicked, no
   * beating), or have it out.
   */
  oldBill(count: number, lead: string, known: 'bent' | 'straight' | null): Screen {
    const w = this.host.world()!;
    const price = w.bungPrice();
    const resume = () => {
      this.host.resume();
    };
    const lines: { text: string; big?: boolean }[] = [
      { text: `${lead}${count > 1 ? ` and ${count - 1 === 1 ? 'another officer' : `${count - 1} more`}` : ''}. "Right, you. Stay where you are."`, big: true },
    ];
    if (known === 'bent') lines.push({ text: `You know ${lead}: he took your money last time.` });
    else if (known === 'straight') lines.push({ text: `You know ${lead}: he knocked back a bung before. He\u2019ll do it again.` });
    else lines.push({ text: 'Some of them can be bought. You can\u2019t tell which till you try.' });
    lines.push({ text: `A bung to look the other way: \u00a3${price}. If he\u2019s straight, that\u2019s bribery on your record and they come at you harder.` });
    lines.push({ text: 'Come quietly and you\u2019re booked in without a beating. Have it out, and if they put you down you\u2019re nicked anyway.' });
    const buttons: { label: string; sub?: string; go: () => void }[] = [
      {
        label: 'Offer a bung',
        sub: `\u00a3${price} cash in hand`,
        go: () => {
          const r = w.bung();
          resume();
          if (r === 'broke') this.host.toast(`You haven\u2019t got \u00a3${price}. "Nice try."`, 'warn');
          else if (r === 'taken') {
            this.host.toast(`${lead} pockets the \u00a3${price}. "Never saw you." Off they go.`, 'cash');
            this.host.save();
          } else {
            this.host.notify('BRIBERY', 'warn');
            this.host.toast(`${lead}: "Trying to bribe an officer? That\u2019s going on your sheet." They\u2019re not happy.`, 'warn');
            this.host.save();
          }
        },
      },
      {
        label: 'Come quietly',
        sub: 'Booked in at the station, no beating',
        go: () => {
          // Straight to the charge sheet: the game's paused for this screen, so nothing queued would ever show.
          this.host.resume();
          this.host.nicked(0);
        },
      },
      { label: 'Have it out', sub: 'Fight your way out', go: resume },
    ];
    const tones: ('cost' | 'calm' | 'danger')[] = ['cost', 'calm', 'danger'];
    return policeStop({
      lead,
      count,
      said: '“Right, you. Stay where you are.”',
      know: lines[1].text,
      facts: lines.slice(2).map((l) => l.text),
      choices: buttons.map((b, i) => ({ ...b, tone: tones[i] })),
    });
  }

  /** Doing time in the cell: the clock on the objective plate, and the door unlocked when it's up. */
  updateSentence(): void {
    const p = this.host.progress();
    if (!p?.save.police.serving) return;
    const left = timeLeft(p);
    if (left > 0) return;
    release(p);
    this.host.save();
    this.host.toast('Time done. The cell door clanks open: you\u2019re free to go.', 'info');
  }

  /**
   * The charge sheet after you're nicked (world/custody.ts): what they've got you for, what they took, and
   * bail. Pay it and you're let out of custody at the Kirkgate Constabulary; or do a night in the cells and
   * the court takes a smaller fine in the morning.
   */
  chargeSheet(b: Booking): Screen {
    const p = this.host.progress()!;
    const lines: { text: string; big?: boolean }[] = [{ text: `You\u2019re nicked. Booked in at Kirkgate Constabulary.`, big: true }];
    if (b.charges.length) for (const c of b.charges) lines.push({ text: `Charge: ${CRIME_NAME[c.crime]} (${c.district})` });
    else lines.push({ text: 'Charge: wanted for questioning. They\u2019ve nothing they can make stick.' });
    lines.push({ text: `${b.seized ? `Seized: ${b.seized} stolen item${b.seized === 1 ? '' : 's'} (\u00a3${b.seizedValue}).` : 'Nothing stolen on you.'} They\u2019ve got your phone till you walk out.` });
    lines.push({ text: canPayBail(p, b) ? `Bail \u00a3${b.bail}. You\u2019re not leaving till it\u2019s paid.` : `Bail \u00a3${b.bail}, and you can\u2019t cover it: you\u2019ll do ${clock(sentenceSeconds(p, b))} in the cell.` });
    const ring = crewToRing(p);
    const mate = ring.length ? (COMPANIONS[p.save.companions.following.find((id) => ring.includes(id)) ?? ring[0]]) : null;
    if (mate) lines.push({ text: `${mate.nickname} would pay it: you\u2019d owe \u00a3${owedFor(b.bail)}.` });
    if (b.bent) lines.push({ text: `${b.sarge}\u2019s on the desk: "\u00a3${b.paperwork} and this paperwork goes missing."` });
    const out = (msg: string, entry: 'cell' | 'door') => {
      this.host.save();
      this.host.goTo('police_station' as AreaId, entry);
      this.host.toast(msg, 'info');
    };
    const buttons: { label: string; sub?: string; go: () => void }[] = [];
    if (b.bent && p.canAfford(b.paperwork)) {
      buttons.push({
        label: 'Lose the paperwork',
        sub: `\u00a3${b.paperwork} to ${b.sarge}: charges gone, and he\u2019s your contact after`,
        go: () => {
          losePaperwork(p, b);
          out(`${b.sarge} feeds the charge sheet to the shredder. "You owe me one. I\u2019ll be in touch." He\u2019s on your phone now (Heat app).`, 'door');
        },
      });
    }
    if (canPayBail(p, b)) {
      buttons.push({
        label: 'Pay bail',
        sub: `\u00a3${b.bail} cash, then your card`,
        go: () => {
          payBail(p, b);
          out(`Bail paid: \u00a3${b.bail}. "Don\u2019t let us see you back here."`, 'door');
        },
      });
    }
    if (mate) {
      buttons.push({
        label: 'Ring for bail',
        sub: `${mate.nickname} pays; you owe \u00a3${owedFor(b.bail)}`,
        go: () => {
          ringCrew(p, b, mate.id);
          out(`${mate.nickname} turns up with the \u00a3${b.bail}. "You owe me. Don\u2019t forget it." They won\u2019t come out with you till you\u2019ve paid them back.`, 'door');
        },
      });
    }
    // No way round the bill: pay it (or have it paid), or, if you can't, do your time in the cell.
    if (!canPayBail(p, b)) {
      const secs = sentenceSeconds(p, b);
      buttons.push({
        label: 'Do your time',
        sub: `You can’t pay. ${clock(secs)} in the cell, locked in`,
        go: () => {
          serveTime(p, b);
          out(`The door slams. ${clock(secs)} to do. Nobody’s coming.`, 'cell');
        },
      });
    }
    const notes = lines.filter((l) => /would pay it|on the desk/.test(l.text)).map((l) => l.text);
    return custodyRecord({
      ref: `KC/${String(p.save.trips).padStart(4, '0')}/${String(p.save.record.length + 1).padStart(2, '0')}`,
      charges: b.charges.map((c) => ({ what: CRIME_NAME[c.crime], where: c.district })),
      seized: `${b.seized ? `${b.seized} stolen item${b.seized === 1 ? '' : 's'} (£${b.seizedValue})` : 'Nothing stolen'}; your phone, till you walk out`,
      bail: b.bail,
      time: canPayBail(p, b) ? 0 : sentenceSeconds(p, b),
      notes,
      choices: buttons.map((x) => ({ ...x, tone: /paperwork/i.test(x.label) ? 'danger' : /cells/i.test(x.label) ? 'calm' : 'cost' })),
    });
  }
}
