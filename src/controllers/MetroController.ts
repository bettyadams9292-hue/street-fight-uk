/**
 * The Metro in play, out of Game.ts: what a station visit is when you arrive, what the board and the train's doors
 * say when you use them, and a ride (paid, checked, a cut to the other platform). The rules live in
 * travel/metro.ts (timetable, refusals, fares); this is the wiring between them and the screens. Game hands it what
 * it needs as a small host, so nothing here reaches into Game's own state.
 */
import type { AreaId, Progress } from '../progress/Progress';
import { arriveBy, boardWhen, enterStation, metroArea, metroVisit, payRide, rideRefusal, setMetroVisit, stationAt, trainAt } from '../travel/metro';
import { stationOf, stopsBetween, STATIONS, type StationId } from '../travel/subway';
import { trainScreen } from '../ui/metroUI';
import type { Screen } from '../ui/UIManager';

export interface MetroHost {
  progress(): Progress | null;
  /** Leave whatever screen is up and go back to play. */
  backToPlay(): void;
  /** Close every screen and play on (a ride has started). */
  play(): void;
  toast(text: string, kind: 'info' | 'cash' | 'warn'): void;
  /** Move to an area at an arrival spot, keeping health and stamina. */
  goTo(area: AreaId, entry: string): void;
}

export class MetroController {
  constructor(private readonly host: MetroHost) {}

  /** Arriving anywhere: a station visit if it's a station (off a train you're on the platform with it still in). */
  arrive(area: AreaId, entry: string, p: Progress): void {
    const here = stationAt(area);
    setMetroVisit(here ? (entry === 'platform' ? arriveBy(here) : enterStation(p, here)) : null);
  }

  /** The departure board: when the next train is. */
  board(): void {
    const st = trainAt(metroVisit());
    this.host.backToPlay();
    const when = boardWhen(st);
    this.host.toast(st.boardable ? 'The train’s in. Mind the gap.' : when === 'Due' || when === 'Arriving' ? 'Next train: due now. Stand behind the yellow line.' : `Next train: ${when}. Wait on the platform.`, 'info');
  }

  /** At the train's doors: the destinations screen, or why you can't get on. */
  doors(area: string, close: () => void): Screen | null {
    const p = this.host.progress();
    const here = stationAt(area);
    if (!p || !here) {
      this.host.backToPlay();
      return null;
    }
    if (!trainAt(metroVisit()).boardable) {
      this.host.backToPlay();
      const other = STATIONS.find((s) => s.id !== here)!.id;
      this.host.toast(rideRefusal(p, here, other) ?? 'No train in.', 'info');
      return null;
    }
    return trainScreen(p, here, (to) => this.ride(here, to), close);
  }

  /** Ride: everything checked and paid in the travel layer (payRide), then off at the other platform. */
  ride(from: StationId, to: StationId): string | null {
    const p = this.host.progress();
    if (!p) return null;
    const r = payRide(p, from, to);
    if (!r.ok) return r.reason;
    this.host.play();
    const stops = stopsBetween(from, to).length - 1;
    this.host.toast(`${stops} stop${stops === 1 ? '' : 's'} to ${stationOf(to).name}. £${r.paid} fare.`, 'cash');
    this.host.goTo(metroArea(to), 'platform');
    return null;
  }
}
