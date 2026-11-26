/**
 * Maps, the phone's map app: a dark map in the style of a phone's own maps app. A blue dot for you, pins for
 * places, a search bar and filter chips on top, and a sheet at the bottom you pull up: places to search, or the
 * place you tapped with Directions (the route shows on the map in blue), a cab, or the way home.
 */
import { h } from '../dom';
import type { AreaId, Progress } from '../../progress/Progress';
import {
  MAP_H, MAP_W, along, junctions, markers, place, playerPoint, roadPoints, roads, route, travelOptions, unlocked, lockReason,
  blurb, type MapMarker, type MarkerKind, type Pt, type TravelOption,
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
};
/** Pin colours, as a maps app does by kind of place. */
const KIND_COLOUR: Record<MarkerKind, string> = {
  home: '#34c759', mission: '#ff3b30', boss: '#8e8e93', side: '#ff9500', shop: '#0a84ff', clothes: '#ff2d55', pawn: '#ffcc00', gym: '#ff453a',
  pub: '#a2845e', casino: '#bf5af2', cars: '#64d2ff', bikes: '#30d158', property: '#34c759', contact: '#ffd60a', street: '#8e8e93', parked: '#34c759', police: '#0a3d91',
};
type Chip = 'all' | 'story' | 'shops' | 'gyms' | 'pubs' | 'yours';
const CHIPS: { id: Chip; label: string; kinds: MarkerKind[] }[] = [
  { id: 'all', label: 'All', kinds: [] },
  { id: 'story', label: 'Story', kinds: ['mission', 'boss', 'side'] },
  { id: 'shops', label: 'Shops', kinds: ['shop', 'clothes', 'pawn', 'casino', 'cars', 'bikes'] },
  { id: 'gyms', label: 'Gyms', kinds: ['gym'] },
  { id: 'pubs', label: 'Pubs', kinds: ['pub', 'contact'] },
  { id: 'yours', label: 'Yours', kinds: ['home', 'property', 'parked'] },
];

/** The town itself, drawn in the dark maps palette (water, parks, blocks, roads, names). */
function townArt(p: Progress): string {
  const rs = roads();
  const o: string[] = [];
  o.push(`<rect x="-600" y="-600" width="${MAP_W + 1200}" height="${MAP_H + 1200}" class="pm-land"/>`);
  o.push(`<path class="pm-water" d="M1380 470 C1600 520 1700 640 1860 560 S 1990 300 2080 250 S 2350 270 2700 300"/>`);
  o.push(`<path class="pm-water river" d="M2700 700 C 2560 840 2580 980 2600 1100 S 2520 1420 2380 1600 L 2300 1800"/>`);
  o.push(`<ellipse class="pm-park" cx="470" cy="730" rx="190" ry="110" transform="rotate(30 470 730)"/><ellipse class="pm-park" cx="760" cy="980" rx="90" ry="50"/><rect class="pm-park" x="140" y="250" width="160" height="300" rx="14"/><ellipse class="pm-park" cx="2260" cy="1040" rx="60" ry="40"/>`);
  // Locked districts are greyed, as a maps app shows places it has no data for.
  for (const r of rs) if (!unlocked(p, r.id)) o.push(`<polyline class="pm-lockzone" points="${pts(r.pts)}"/>`);
  for (const r of rs) o.push(`<polyline class="pm-casing ${r.road}" points="${pts(r.pts)}"/>`);
  for (const r of rs) o.push(`<polyline class="pm-road ${r.road}" points="${pts(r.pts)}"/>`);
  for (const j of junctions()) o.push(`<circle class="pm-rbt" cx="${j.x.toFixed(1)}" cy="${j.y.toFixed(1)}" r="15"/>`);
  o.push(`<text class="pm-water-label" x="1700" y="540" transform="rotate(-8 1700 540)">Grand Union Canal</text><text class="pm-water-label" x="2580" y="1180" transform="rotate(80 2580 1180)">River Brack</text>`);
  const districts = new Map<string, Pt[]>();
  for (const r of rs) districts.set(r.district, [...(districts.get(r.district) ?? []), along(r.pts, 0.5)]);
  for (const [name, list] of districts) {
    const c = { x: list.reduce((n, q) => n + q.x, 0) / list.length, y: list.reduce((n, q) => n + q.y, 0) / list.length };
    o.push(`<text class="pm-district" x="${c.x.toFixed(0)}" y="${(c.y - 64).toFixed(0)}">${esc(name.toUpperCase())}</text>`);
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
  art.innerHTML = townArt(p);
  const routeG = document.createElementNS(NS, 'g');
  const pinG = document.createElementNS(NS, 'g');
  const youG = document.createElementNS(NS, 'g');
  youG.innerHTML = `<circle class="pm-you-halo" r="34"/><circle class="pm-you-ring" r="15"/><circle class="pm-you" r="11"/>`;
  svg.append(art, routeG, pinG, youG);

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
      g.setAttribute('class', `pm-pin${open ? '' : ' locked'}${selected?.key === m.key ? ' sel' : ''}`);
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

  function drawRoute(): void {
    routeG.innerHTML = '';
    if (!dest) return;
    const r = route(p, d.here.area, dest);
    if (!r) return;
    const streets = [d.here.area, ...r].filter((a) => roadPoints(a));
    routeG.innerHTML = streets.map((a) => `<polyline class="pm-route" points="${pts(roadPoints(a)!)}"/>`).join('') +
      `<g transform="translate(${place(dest).at.x} ${place(dest).at.y})"><circle class="pm-dest" r="22"/></g>`;
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
      } }, on ? 'End route' : 'Directions', h('small', { text: on ? '' : walk.label.replace('Walk: ', '') })));
    }
    if (home) actions.push(h('button', { class: 'pm-act', disabled: !home.ok, onclick: () => d.travel(m.area, home) }, 'Go home', h('small', { text: home.ok ? 'On foot' : home.why ?? '' })));
    if (drive && !isHere) actions.push(h('button', { class: 'pm-act', disabled: !drive.ok, onclick: () => d.travel(m.area, drive) }, 'Drive', h('small', { text: drive.ok ? 'Your car · free' : drive.why ?? '' })));
    if (cab) actions.push(h('button', { class: 'pm-act', disabled: !cab.ok, onclick: () => d.travel(m.area, cab) }, `Cab £${cab.cost}`, h('small', { text: cab.ok ? `Duber · ${cab.miles?.toFixed(1)} mi` : cab.why ?? '' })));
    sheet.replaceChildren(
      grab,
      h('div', { class: 'pm-place' },
        h('div', { class: 'pm-placehead' },
          h('span', { class: 'pm-dot big', style: `background:${open ? KIND_COLOUR[m.kind] : '#48484a'}` }, h('img', { src: paintedIconUrl(KIND_ICON[m.kind]) ?? '', alt: '' })),
          h('div', {}, h('b', { text: m.label.replace(/^Yours: /, '') }), h('span', { text: isHere ? `${pl.district} · You’re here` : `${pl.district} · ${distText(Math.hypot(m.at.x - here.x, m.at.y - here.y))}` })),
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
