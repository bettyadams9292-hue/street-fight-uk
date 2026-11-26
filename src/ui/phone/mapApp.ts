/**
 * Maps, the phone's map app: a dark map in the style of a phone's own maps app. A blue dot for you, pins for
 * places, a search bar and filter chips on top, and a sheet at the bottom you pull up: places to search, or the
 * place you tapped with Directions (the route shows on the map in blue), a cab, or the way home.
 */
import { riskWord } from '../../travel/onFoot';
import { h } from '../dom';
import type { AreaId, Progress } from '../../progress/Progress';
import {
  MAP_H, MAP_W, along, junctions, markers, place, playerPoint, roadPoints, roads, route, travelOptions, unlocked, lockReason,
  blurb, districts, districtBorders, MARKER_LABELS, type MapMarker, type MarkerKind, type Pt, type TravelOption,
} from '../../map/worldMap';
import { paintedIconUrl, type IconName } from '../icons';

export interface MapAppDeps {
  progress: Progress;
  here: { area: AreaId; x: number };
  calm: boolean;
  select?: AreaId;
  travel(area: AreaId, opt: TravelOption): void;
  setDestination(area: AreaId | null): void;
}

const NS = 'http://www.w3.org/2000/svg';
const pts = (list: Pt[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const KIND_ICON: Record<MarkerKind, IconName> = {
  home: 'home', mission: 'mission', boss: 'check', side: 'side', shop: 'shop', clothes: 'clothes', pawn: 'pawn', gym: 'gym', pub: 'pub',
  casino: 'casino', cars: 'cars', bikes: 'bikes', property: 'property', contact: 'contact', street: 'street', parked: 'parked', police: 'police',
  atm: 'valuable', mods: 'edit', lockup: 'key',
};
/** Pin colours, as a maps app does by kind of place. */
const KIND_COLOUR: Record<MarkerKind, string> = {
  home: '#34c759', mission: '#ff3b30', boss: '#8e8e93', side: '#ff9500', shop: '#0a84ff', clothes: '#ff2d55', pawn: '#ffcc00', gym: '#ff453a',
  pub: '#a2845e', casino: '#bf5af2', cars: '#64d2ff', bikes: '#30d158', property: '#34c759', contact: '#ffd60a', street: '#8e8e93', parked: '#34c759', police: '#0a3d91',
  atm: '#1d6fd1', mods: '#ff9f0a', lockup: '#c7a03b',
};
/**
 * Pins that only show once you zoom in (or pick their chip): the many shops and people. Zoomed out you see the
 * story, home, your car and the lock-up, so the town reads at a glance instead of as a pile of pins.
 */
const MINOR: ReadonlySet<MarkerKind> = new Set(['shop', 'clothes', 'pawn', 'pub', 'casino', 'cars', 'bikes', 'contact', 'police', 'gym', 'atm', 'mods', 'property']);
/** Map units per screen pixel above which the minor pins hide. */
const DECLUTTER_K = 1.9;
type Chip = 'all' | 'story' | 'shops' | 'money' | 'motors' | 'gyms' | 'pubs' | 'yours';
const CHIPS: { id: Chip; label: string; kinds: MarkerKind[] }[] = [
  { id: 'all', label: 'All', kinds: [] },
  { id: 'story', label: 'Story', kinds: ['mission', 'boss', 'side', 'lockup'] },
  { id: 'shops', label: 'Shops', kinds: ['shop', 'clothes', 'pawn', 'casino', 'cars', 'bikes'] },
  { id: 'money', label: 'Money', kinds: ['atm', 'pawn'] },
  { id: 'motors', label: 'Motors', kinds: ['cars', 'mods', 'bikes', 'parked'] },
  { id: 'gyms', label: 'Gyms', kinds: ['gym'] },
  { id: 'pubs', label: 'Pubs', kinds: ['pub', 'contact'] },
  { id: 'yours', label: 'Yours', kinds: ['home', 'property', 'parked'] },
];

/** The town itself, drawn in the dark maps palette (water, parks, blocks, roads, names). */
function townArt(p: Progress, hereDistrict: string): string {
  const rs = roads();
  const o: string[] = [];
  o.push(`<rect x="-600" y="-600" width="${MAP_W + 1200}" height="${MAP_H + 1200}" class="pm-land"/>`);
  o.push(`<path class="pm-water" d="M1380 470 C1600 520 1700 640 1860 560 S 1990 300 2080 250 S 2350 270 2700 300"/>`);
  o.push(`<path class="pm-water river" d="M2700 700 C 2560 840 2580 980 2600 1100 S 2520 1420 2380 1600 L 2300 1800"/>`);
  o.push(`<ellipse class="pm-park" cx="470" cy="730" rx="190" ry="110" transform="rotate(30 470 730)"/><ellipse class="pm-park" cx="760" cy="980" rx="90" ry="50"/><rect class="pm-park" x="140" y="250" width="160" height="300" rx="14"/><ellipse class="pm-park" cx="2260" cy="1040" rx="60" ry="40"/>`);
  // Each district is a shaded band along its own streets (so it sits exactly where it is in the game), yours lit,
  // locked ones hatched. Where one district's street runs into the next, a white bar marks the boundary.
  o.push(`<defs><pattern id="pm-hatch" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="26" height="26" fill="#1c1c1f"/><rect width="9" height="26" fill="#3a3a3e"/></pattern></defs>`);
  const ds = districts(p);
  for (const dd of ds) {
    const cls = `pm-zone${dd.name === hereDistrict ? ' here' : ''}${dd.open ? '' : ' locked'}`;
    for (const r of dd.roads) o.push(`<polyline class="${cls}" points="${pts(r)}"/>`);
  }
  for (const r of rs) if (!unlocked(p, r.id)) o.push(`<polyline class="pm-lockzone" points="${pts(r.pts)}"/>`);
  for (const r of rs) o.push(`<polyline class="pm-casing ${r.road}" points="${pts(r.pts)}"/>`);
  for (const r of rs) o.push(`<polyline class="pm-road ${r.road}" points="${pts(r.pts)}"/>`);
  for (const j of junctions()) o.push(`<circle class="pm-rbt" cx="${j.x.toFixed(1)}" cy="${j.y.toFixed(1)}" r="15"/>`);
  for (const b of districtBorders()) {
    const nx = -Math.sin(b.ang) * 46;
    const ny = Math.cos(b.ang) * 46;
    o.push(`<line class="pm-border" x1="${(b.at.x - nx).toFixed(1)}" y1="${(b.at.y - ny).toFixed(1)}" x2="${(b.at.x + nx).toFixed(1)}" y2="${(b.at.y + ny).toFixed(1)}"/>`);
  }
  o.push(`<text class="pm-water-label" x="1700" y="540" transform="rotate(-8 1700 540)">Grand Union Canal</text><text class="pm-water-label" x="2580" y="1180" transform="rotate(80 2580 1180)">River Brack</text>`);
  // District names above their band, with what state each is in: where you are, or what opens it.
  for (const dd of ds) {
    // Locked ones just say so; what opens them is on the place card (the full reason doesn't fit between districts).
    const sub = dd.name === hereDistrict ? 'YOU’RE HERE' : dd.open ? '' : 'LOCKED';
    o.push(`<text class="pm-district${dd.open ? '' : ' locked'}${dd.name === hereDistrict ? ' here' : ''}" x="${dd.label.x.toFixed(0)}" y="${dd.label.y.toFixed(0)}">${esc(dd.name.toUpperCase())}</text>`);
    if (sub) o.push(`<text class="pm-district-sub${dd.open ? '' : ' locked'}" x="${dd.label.x.toFixed(0)}" y="${(dd.label.y + 24).toFixed(0)}">${sub}</text>`);
  }
  for (const r of rs) {
    const a = along(r.pts, 0.38);
    const b = along(r.pts, 0.62);
    let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const c = along(r.pts, 0.5);
    o.push(`<text class="pm-street" x="${c.x.toFixed(1)}" y="${(c.y + 4).toFixed(1)}" transform="rotate(${ang.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})">${esc(r.name)}</text>`);
  }
  return o.join('');
}

export function mapApp(d: MapAppDeps): HTMLElement {
  const p = d.progress;
  const here = playerPoint(d.here.area, d.here.x);
  const all = markers(p).filter((m) => m.kind !== 'street');
  let chip: Chip = 'all';
  let query = '';
  let selected: MapMarker | null = null;
  let dest: AreaId | null = p.save.destination;
  let sheetUp = false;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pm-svg');
  const art = document.createElementNS(NS, 'g');
  art.innerHTML = townArt(p, place(d.here.area).district);
  const routeG = document.createElementNS(NS, 'g');
  const pinG = document.createElementNS(NS, 'g');
  const youG = document.createElementNS(NS, 'g');
  youG.innerHTML = `<circle class="pm-you-halo" r="34"/><circle class="pm-you-ring" r="15"/><circle class="pm-you" r="11"/>` +
    `<g class="pm-tag you" transform="translate(0 30)"><rect x="-27" y="0" width="54" height="20" rx="10"/><text x="0" y="14">YOU</text></g>`;
  // The destination: a flag with its name on, drawn at the place and scaled like the pins.
  const destG = document.createElementNS(NS, 'g');
  svg.append(art, routeG, pinG, destG, youG);

  // View: centre and width in map units.
  // w 0: fitted to the phone on the first layout (about 2.4 map units a pixel).
  const view = { x: here.x, y: here.y, w: 0 };
  const sideways = () => root.getBoundingClientRect().width > root.getBoundingClientRect().height;
  const apply = () => {
    const r = svg.getBoundingClientRect();
    if (!view.w) {
      if (!r.width) return;
      view.w = r.width * 2.4;
    }
    const aspect = r.width ? r.height / r.width : 1.6;
    const vh = view.w * aspect;
    svg.setAttribute('viewBox', `${(view.x - view.w / 2).toFixed(1)} ${(view.y - vh / 2).toFixed(1)} ${view.w.toFixed(1)} ${vh.toFixed(1)}`);
    const k = r.width ? view.w / r.width : 1;
    youG.setAttribute('transform', `translate(${here.x} ${here.y}) scale(${k.toFixed(3)})`);
    for (const g of Array.from(pinG.children) as SVGGElement[]) {
      const m = all.find((x) => x.key === g.dataset.key)!;
      g.setAttribute('transform', `translate(${m.at.x.toFixed(1)} ${m.at.y.toFixed(1)}) scale(${(k * (selected?.key === m.key ? 1.3 : 1)).toFixed(3)})`);
    }
    routeG.querySelectorAll<SVGElement>('.pm-route').forEach((e) => e.setAttribute('stroke-width', String(Math.max(10, 7 * k))));
    routeG.querySelectorAll<SVGElement>('.pm-chev').forEach((e) => e.setAttribute('transform', `${e.dataset.at} scale(${k.toFixed(3)})`));
    if (dest) destG.setAttribute('transform', `translate(${place(dest).at.x.toFixed(1)} ${place(dest).at.y.toFixed(1)}) scale(${k.toFixed(3)})`);
    svg.classList.toggle('far', k > DECLUTTER_K);
  };
  const clampView = () => {
    view.w = Math.max(320, Math.min(MAP_W * 1.1, view.w));
    view.x = Math.max(-200, Math.min(MAP_W + 200, view.x));
    view.y = Math.max(-200, Math.min(MAP_H + 200, view.y));
  };

  function drawPins(): void {
    const kinds = new Set(CHIPS.find((c) => c.id === chip)!.kinds);
    pinG.innerHTML = '';
    for (const m of all) {
      if (chip !== 'all' && !kinds.has(m.kind)) continue;
      const g = document.createElementNS(NS, 'g') as SVGGElement;
      g.dataset.key = m.key;
      const open = unlocked(p, m.area);
      const icon = paintedIconUrl(KIND_ICON[m.kind]);
      g.setAttribute('class', `pm-pin${open ? '' : ' locked'}${selected?.key === m.key ? ' sel' : ''}${chip === 'all' && MINOR.has(m.kind) ? ' minor' : ''}`);
      g.innerHTML = `<path class="pm-pin-body" d="M0 0 C -6 -9 -16 -15 -16 -26 A 16 16 0 1 1 16 -26 C 16 -15 6 -9 0 0 Z" fill="${open ? KIND_COLOUR[m.kind] : '#48484a'}"/>` +
        `<circle cx="0" cy="-26" r="12" fill="#fff"/>` + (icon ? `<image href="${icon}" x="-11" y="-37" width="22" height="22"/>` : '');
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        pick(m);
      });
      pinG.append(g);
    }
    apply();
  }

  /** Zoom to the whole route, you to there, clear of the sheet. */
  function fitRoute(): void {
    if (!dest) return;
    const r = route(p, d.here.area, dest);
    const ptsAll: Pt[] = [here, place(dest).at, ...((r ?? []).flatMap((a) => roadPoints(a) ?? []))];
    const xs = ptsAll.map((q) => q.x);
    const ys = ptsAll.map((q) => q.y);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width ? rect.height / rect.width : 1.6;
    // The free part: the top 58% upright, the left 52% sideways.
    const fw = sideways() ? 0.52 : 1;
    const fh = sideways() ? 1 : 0.58;
    view.w = Math.max(bw / fw, bh / fh / aspect) * 1.25;
    clampView();
    const vh = view.w * aspect;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    view.x = sideways() ? cx + view.w * (0.5 - fw / 2) : cx;
    view.y = sideways() ? cy : cy + vh * (0.5 - fh / 2);
    apply();
  }

  /**
   * The way there as one line from you to the place: each street on the route taken in the direction you'll walk
   * it (from the end nearest where the last one left off), your own street only from where you stand.
   */
  function routePath(): Pt[] {
    if (!dest) return [];
    const r = route(p, d.here.area, dest);
    if (!r) return [];
    const path: Pt[] = [here];
    const near = (list: Pt[], q: Pt) => list.reduce((bi, s, i) => (Math.hypot(s.x - q.x, s.y - q.y) < Math.hypot(list[bi].x - q.x, list[bi].y - q.y) ? i : bi), 0);
    const streets = [d.here.area, ...r].filter((a) => roadPoints(a));
    streets.forEach((a, n) => {
      let list = roadPoints(a)!.slice();
      const last = path[path.length - 1];
      if (n === 0) {
        // From where you stand towards the end that leads on (the next street, or the place itself).
        const next = streets[1] ? roadPoints(streets[1])! : [place(dest!).at];
        const toward = next[near(next, list[list.length - 1])];
        const endA = Math.hypot(list[0].x - toward.x, list[0].y - toward.y);
        const endB = Math.hypot(list[list.length - 1].x - toward.x, list[list.length - 1].y - toward.y);
        if (endA < endB) list.reverse();
        list = list.slice(near(list, here));
      } else if (Math.hypot(list[list.length - 1].x - last.x, list[list.length - 1].y - last.y) < Math.hypot(list[0].x - last.x, list[0].y - last.y)) list.reverse();
      // The last street only as far as the place (a street destination is its middle, not its far end).
      if (n === streets.length - 1) list = list.slice(0, near(list, place(dest!).at) + 1);
      path.push(...list);
    });
    path.push(place(dest).at);
    return path;
  }

  function drawRoute(): void {
    routeG.innerHTML = '';
    destG.innerHTML = '';
    if (!dest) return;
    const path = routePath();
    if (path.length < 2) return;
    // Chevrons along the way, pointing the way you're going.
    const chev: string[] = [];
    let carry = 60;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      for (let t = carry; t < len; t += 150) {
        const x = a.x + ((b.x - a.x) * t) / len;
        const y = a.y + ((b.y - a.y) * t) / len;
        chev.push(`<path class="pm-chev" data-at="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})" d="M-5 -6 L3 0 L-5 6"/>`);
        carry = t + 150 - len;
      }
      if (carry >= len) carry -= len;
    }
    routeG.innerHTML = `<polyline class="pm-route" points="${pts(path)}"/>` + chev.join('');
    const name = place(dest).name;
    const w = Math.min(220, 18 + name.length * 8.2);
    destG.innerHTML = `<path class="pm-flagpole" d="M0 0 L0 -44"/><path class="pm-flag" d="M0 -44 L24 -37 L0 -30 Z"/><circle class="pm-destdot" r="7"/>` +
      `<g class="pm-tag dest" transform="translate(0 -70)"><rect x="${(-w / 2).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="20" rx="10"/><text x="0" y="14">${esc(name.length > 24 ? `${name.slice(0, 23)}…` : name)}</text></g>`;
    apply();
  }

  // ---- the sheet ----
  const sheet = h('div', { class: 'pm-sheet' });
  const grab = h('button', { class: 'pm-grab', 'aria-label': 'Pull up', onclick: () => setSheet(!sheetUp) });
  const setSheet = (up: boolean) => {
    sheetUp = up;
    root.classList.toggle('sheet-up', up);
  };

  function fillSheet(): void {
    if (selected) return fillPlace(selected);
    const search = h('input', { class: 'pm-search', type: 'search', placeholder: 'Search Maps', value: query }) as HTMLInputElement;
    search.addEventListener('input', () => {
      query = search.value;
      list.replaceChildren(...results());
    });
    search.addEventListener('focus', () => setSheet(true));
    const list = h('div', { class: 'pm-list' }, ...results());
    sheet.replaceChildren(grab, h('div', { class: 'pm-searchrow' }, search), list);
  }

  function results(): HTMLElement[] {
    const q = query.trim().toLowerCase();
    const kinds = new Set(CHIPS.find((c) => c.id === chip)!.kinds);
    const rows = all
      .filter((m) => chip === 'all' || kinds.has(m.kind))
      .filter((m) => !q || m.label.toLowerCase().includes(q) || place(m.area).district.toLowerCase().includes(q))
      // Home and the route first, then open places nearest you, then the locked ones.
      .map((m) => ({ m, dist: Math.hypot(m.at.x - here.x, m.at.y - here.y), open: unlocked(p, m.area) }))
      .sort((a, b) => Number(b.m.kind === 'home') - Number(a.m.kind === 'home') || Number(b.m.area === dest) - Number(a.m.area === dest) || Number(b.open) - Number(a.open) || a.dist - b.dist);
    if (!rows.length) return [h('p', { class: 'pm-empty', text: 'No results' })];
    const out: HTMLElement[] = [];
    if (!q) out.push(h('div', { class: 'pm-head', text: chip === 'all' ? 'Places' : CHIPS.find((c) => c.id === chip)!.label }));
    for (const { m, dist, open } of rows.slice(0, 40)) {
      out.push(h('button', { class: `pm-row${open ? '' : ' locked'}`, onclick: () => pick(m) },
        h('span', { class: 'pm-dot', style: `background:${open ? KIND_COLOUR[m.kind] : '#48484a'}` }, h('img', { src: paintedIconUrl(KIND_ICON[m.kind]) ?? '', alt: '' })),
        h('span', { class: 'pm-rowtext' }, h('b', { text: m.label.replace(/^Yours: /, '') }), h('span', { text: `${place(m.area).district} · ${distText(dist)}${open ? '' : ' · locked'}` })),
      ));
    }
    return out;
  }

  const distText = (u: number) => `${(u / 400).toFixed(1)} mi`;

  function fillPlace(m: MapMarker): void {
    const pl = place(m.area);
    const open = unlocked(p, m.area);
    const opts = travelOptions(p, d.here.area, m.area, d.calm, d.here.x);
    const cab = opts.find((x) => x.kind === 'cab');
    const drive = opts.find((x) => x.kind === 'drive');
    const home = opts.find((x) => x.kind === 'home');
    const walk = opts.find((x) => x.kind === 'walk');
    const isHere = opts.some((x) => x.kind === 'here');
    const actions: HTMLElement[] = [];
    if (!isHere && open && walk?.ok) {
      const on = dest === m.area;
      actions.push(h('button', { class: `pm-act primary${on ? ' on' : ''}`, onclick: () => {
        dest = on ? null : m.area;
        d.setDestination(dest);
        drawRoute();
        if (dest) fitRoute();
        fillPlace(m);
        if (dest) setSheet(false);
      } }, on ? 'End route' : 'Directions', h('small', { text: on ? '' : walk.label.replace('Walk: ', '').replace(/, free, .*$/, '') })));
      // Or run it on your own (Game.startRun): free, along the streets; move to take over.
      actions.push(h('button', { class: 'pm-act', disabled: !d.calm, onclick: () => d.travel(m.area, walk) }, 'Run there', h('small', { text: d.calm ? `Free · ${riskWord(walk.risk ?? 0)}` : 'Not with a fight on' })));
    }
    if (home) actions.push(h('button', { class: 'pm-act', disabled: !home.ok, onclick: () => d.travel(m.area, home) }, 'Go home', h('small', { text: home.ok ? 'On foot' : home.why ?? '' })));
    if (drive && !isHere) actions.push(h('button', { class: 'pm-act', disabled: !drive.ok, onclick: () => d.travel(m.area, drive) }, 'Drive', h('small', { text: drive.ok ? 'Your car · free' : drive.why ?? '' })));
    if (cab) actions.push(h('button', { class: 'pm-act', disabled: !cab.ok, onclick: () => d.travel(m.area, cab) }, `Cab £${cab.cost}`, h('small', { text: cab.ok ? `Duber · ${cab.miles?.toFixed(1)} mi` : cab.why ?? '' })));
    sheet.replaceChildren(
      grab,
      h('div', { class: 'pm-place' },
        h('div', { class: 'pm-placehead' },
          h('span', { class: 'pm-dot big', style: `background:${open ? KIND_COLOUR[m.kind] : '#48484a'}` }, h('img', { src: paintedIconUrl(KIND_ICON[m.kind]) ?? '', alt: '' })),
          h('div', {}, h('b', { text: m.label.replace(/^Yours: /, '') }), h('span', { text: `${MARKER_LABELS[m.kind]} · ${pl.district} · ${isHere ? 'You’re here' : distText(Math.hypot(m.at.x - here.x, m.at.y - here.y))}${open ? '' : ' · Locked'}` })),
          h('button', { class: 'pm-x', 'aria-label': 'Close', onclick: () => { selected = null; drawPins(); fillSheet(); } }, '×'),
        ),
        actions.length ? h('div', { class: 'pm-acts' }, ...actions) : null,
        !open ? h('p', { class: 'pm-lock', text: lockReason(p, m.area) ?? 'Locked for now' }) : null,
        h('p', { class: 'pm-blurb', text: blurb(m.area) }),
      ),
    );
  }

  /** Bring a point into the part of the map the sheet doesn't cover. */
  function show(at: Pt): void {
    const r = svg.getBoundingClientRect();
    const vh = view.w * (r.width ? r.height / r.width : 1.6);
    if (sideways()) {
      view.x = at.x + view.w * 0.23;
      view.y = at.y;
    } else {
      view.x = at.x;
      view.y = at.y + vh * 0.2;
    }
    apply();
  }

  function pick(m: MapMarker): void {
    selected = m;
    show(m.at);
    drawPins();
    fillSheet();
    setSheet(false);
  }

  // ---- top: search pill (opens the sheet) and filter chips; right: locate ----
  const chips = h('div', { class: 'pm-chips' }, ...CHIPS.map((c) => h('button', { class: `pm-chip${c.id === chip ? ' on' : ''}`, onclick: (e: Event) => {
    chip = c.id;
    chips.querySelectorAll('.pm-chip').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
    selected = null;
    drawPins();
    fillSheet();
  } }, c.label)));
  const locate = h('button', { class: 'pm-locate', 'aria-label': 'Show where you are', onclick: () => {
    view.w = svg.getBoundingClientRect().width * 2.4;
    show(here);
  } }, h('span', { class: 'pm-arrow' }));

  const root = h('div', { class: 'pm-app' }, h('div', { class: 'pm-mapwrap' }, svg), chips, locate, sheet);

  // ---- pan and pinch ----
  const touches = new Map<number, { x: number; y: number }>();
  let pinch0 = 0;
  let w0 = view.w;
  let moved = false;
  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      w0 = view.w;
    }
  });
  svg.addEventListener('pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const r = svg.getBoundingClientRect();
    if (touches.size === 1) {
      const k = view.w / r.width;
      const dx = e.clientX - t.x;
      const dy = e.clientY - t.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      view.x -= dx * k;
      view.y -= dy * k;
    }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) view.w = (w0 * pinch0) / dist;
      moved = true;
    }
    clampView();
    apply();
  });
  const up = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch0 = 0;
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('click', () => {
    if (moved) return;
    // A tap on the map (not a pin) closes what's open.
    if (selected) {
      selected = null;
      drawPins();
      fillSheet();
    }
    setSheet(false);
  });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.w *= e.deltaY > 0 ? 1.12 : 0.89;
    clampView();
    apply();
  }, { passive: false });
  svg.addEventListener('dblclick', () => {
    view.w *= 0.6;
    clampView();
    apply();
  });

  drawPins();
  drawRoute();
  const first = d.select ? all.find((m) => m.area === d.select) : null;
  if (first) pick(first);
  else fillSheet();
  // Size the view once the phone has laid it out, and whenever it changes.
  requestAnimationFrame(() => {
    apply();
    if (selected) show(selected.at);
    else show(here);
  });
  new ResizeObserver(() => apply()).observe(svg);
  return root;
}
