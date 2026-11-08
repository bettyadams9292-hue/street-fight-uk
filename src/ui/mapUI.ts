import type { AreaId, Progress } from '../progress/Progress';
import {
  MAP_H,
  MAP_W,
  MARKER_LABELS,
  along,
  junctions,
  lockReason,
  markers,
  place,
  places,
  playerPoint,
  roadPoints,
  roads,
  route,
  travelOptions,
  unlocked,
  type MapMarker,
  type MarkerKind,
  type Pt,
  type TravelOption,
} from '../map/worldMap';
import { h } from './dom';
import { icon, iconPaths, type IconName } from './icons';
import type { Screen } from './UIManager';

/**
 * The town map. A drawn British town (districts, main roads, side streets,
 * the canal and the river, parks), with a marker for every place in the game.
 * Drag or use the arrow keys to pan, scroll or pinch to zoom, click a marker
 * for its card, and travel from the card (always with a confirm step).
 */

export interface MapOptions {
  progress: Progress;
  /** Where you are now. */
  here: { area: AreaId; x: number };
  /** False in a fight / with the police on you: no cabs or heading home. */
  calm: boolean;
  /** Do the travel the player confirmed. */
  travel(area: AreaId, option: TravelOption): void;
  /** The route destination changed (null: cleared). */
  setDestination(area: AreaId | null): void;
  close(): void;
  /** Open with this place selected. */
  select?: AreaId;
}

const KIND_ICON: Record<MarkerKind, IconName> = {
  home: 'home', mission: 'mission', boss: 'check', side: 'side', shop: 'shop', clothes: 'clothes', pawn: 'pawn', gym: 'gym', pub: 'pub',
  casino: 'casino', cars: 'cars', bikes: 'bikes', property: 'property', contact: 'contact', street: 'street', parked: 'parked',
};

const KIND_COLOUR: Record<MarkerKind, string> = {
  home: '#2f9e5b', mission: '#e0302a', boss: '#6d6a64', side: '#e08a1e', shop: '#3d7fd1', clothes: '#c0508a', pawn: '#b98c2c',
  gym: '#d24b2a', pub: '#8a5a2b', casino: '#7a3fb0', cars: '#2b8a8a', bikes: '#4f8a2b', property: '#2f9e5b', contact: '#d6a51f',
  street: '#e9e6df', parked: '#2f9e5b',
};

type FilterId = 'story' | 'shops' | 'gyms' | 'pubs' | 'yours' | 'streets';
const FILTERS: { id: FilterId; label: string; icon: IconName; kinds: MarkerKind[] }[] = [
  { id: 'story', label: 'Story', icon: 'mission', kinds: ['mission', 'boss', 'side'] },
  { id: 'shops', label: 'Shops', icon: 'shop', kinds: ['shop', 'clothes', 'pawn', 'casino', 'cars', 'bikes'] },
  { id: 'gyms', label: 'Gyms', icon: 'gym', kinds: ['gym'] },
  { id: 'pubs', label: 'Pubs & people', icon: 'pub', kinds: ['pub', 'contact'] },
  { id: 'yours', label: 'Yours', icon: 'home', kinds: ['home', 'property', 'parked'] },
  { id: 'streets', label: 'Streets', icon: 'street', kinds: ['street'] },
];

const MIN_W = 520;
const MAX_W = MAP_W * 1.08;

/** A seeded random number from a string, for the town's decoration. */
function rngFor(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pts = (list: Pt[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** Static artwork: water, parks, district wash, side streets, blocks, main roads, roundabouts, labels. */
function townSvg(progress: Progress): string {
  const rs = roads();
  const out: string[] = [];
  out.push(`<defs>
    <pattern id="mp-grain" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#1a1d23"/><circle cx="2" cy="3" r=".6" fill="#20242b"/><circle cx="6" cy="6" r=".5" fill="#171a1f"/></pattern>
    <pattern id="mp-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="rgba(0,0,0,0)"/><path d="M0 0v14" stroke="rgba(0,0,0,.35)" stroke-width="5"/></pattern>
    <radialGradient id="mp-vignette" cx="50%" cy="50%" r="70%"><stop offset="60%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.45)"/></radialGradient>
  </defs>`);
  out.push(`<rect x="-400" y="-400" width="${MAP_W + 800}" height="${MAP_H + 800}" fill="url(#mp-grain)"/>`);
  // Water: the canal through the works and docks, the River Brack past Riverside.
  out.push(`<path class="mp-water" d="M1380 470 C1600 520 1700 640 1860 560 S 1990 300 2080 250 S 2350 270 2700 300"/>`);
  out.push(`<path class="mp-river" d="M2700 700 C 2560 840 2580 980 2600 1100 S 2520 1420 2380 1600 L 2300 1800"/>`);
  out.push(`<text class="mp-water-label" x="1700" y="540" transform="rotate(-8 1700 540)">GRAND UNION CANAL</text>`);
  out.push(`<text class="mp-water-label" x="2580" y="1180" transform="rotate(80 2580 1180)">RIVER BRACK</text>`);
  // Parks and pitches.
  out.push(`<ellipse class="mp-park" cx="470" cy="730" rx="190" ry="110" transform="rotate(30 470 730)"/>`);
  out.push(`<ellipse class="mp-park" cx="760" cy="980" rx="90" ry="50"/>`);
  out.push(`<rect class="mp-park" x="140" y="250" width="160" height="300" rx="14"/><rect class="mp-pitch" x="165" y="300" width="110" height="200"/><path class="mp-pitch" d="M165 400h110"/><circle class="mp-pitch" cx="220" cy="400" r="22"/>`);
  out.push(`<ellipse class="mp-park" cx="2260" cy="1040" rx="60" ry="40"/>`);
  // District wash under each street; locked districts get a hatch.
  for (const r of rs) {
    const open = unlocked(progress, r.id);
    out.push(`<polyline class="mp-zone" points="${pts(r.pts)}" stroke="${r.tint}"/>`);
    if (!open) out.push(`<polyline class="mp-zone-lock" points="${pts(r.pts)}"/>`);
  }
  // Side streets and blocks, seeded per street so the town is the same every time.
  const roadSamples: Pt[] = [];
  for (const r of rs) for (let t = 0; t <= 1; t += 0.02) roadSamples.push(along(r.pts, t));
  const nearRoad = (p: Pt, d: number) => roadSamples.some((q) => Math.abs(q.x - p.x) < d && Math.abs(q.y - p.y) < d && Math.hypot(q.x - p.x, q.y - p.y) < d);
  const minor: string[] = [];
  const blocks: string[] = [];
  for (const r of rs) {
    const rng = rngFor(r.id);
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const a = along(r.pts, Math.max(0, t - 0.01));
      const b = along(r.pts, Math.min(1, t + 0.01));
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const c = along(r.pts, t);
      for (const side of [-1, 1]) {
        if (rng() < 0.55) {
          const l = 60 + rng() * 70;
          minor.push(`M${c.x.toFixed(1)} ${c.y.toFixed(1)}l${(nx * side * l).toFixed(1)} ${(ny * side * l).toFixed(1)}`);
        }
        for (let k = 0; k < 2; k++) {
          const off = 34 + k * 46 + rng() * 10;
          const along2 = (rng() - 0.5) * 50;
          const p = { x: c.x + nx * side * off + (dx / len) * along2, y: c.y + ny * side * off + (dy / len) * along2 };
          if (nearRoad(p, 26)) continue;
          const w = 22 + rng() * 26;
          const hh = 14 + rng() * 18;
          blocks.push(`<rect x="${(p.x - w / 2).toFixed(1)}" y="${(p.y - hh / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="2" transform="rotate(${ang.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})"/>`);
        }
      }
    }
  }
  out.push(`<path class="mp-minor" d="${minor.join('')}"/>`);
  out.push(`<g class="mp-blocks">${blocks.join('')}</g>`);
  // Roads: dark casing, then the carriageway, then centre lines on main roads.
  for (const r of rs) out.push(`<polyline class="mp-casing ${r.road}" points="${pts(r.pts)}"/>`);
  for (const r of rs) out.push(`<polyline class="mp-road ${r.road}" points="${pts(r.pts)}"/>`);
  for (const r of rs) if (r.road === 'main') out.push(`<polyline class="mp-centre" points="${pts(r.pts)}"/>`);
  for (const j of junctions()) out.push(`<circle class="mp-rbt" cx="${j.x.toFixed(1)}" cy="${j.y.toFixed(1)}" r="17"/><circle class="mp-rbt-in" cx="${j.x.toFixed(1)}" cy="${j.y.toFixed(1)}" r="7"/>`);
  // District names (big) and street names (along the road).
  const districts = new Map<string, Pt[]>();
  for (const r of rs) districts.set(r.district, [...(districts.get(r.district) ?? []), along(r.pts, 0.5)]);
  for (const [name, list] of districts) {
    const c = { x: list.reduce((n, p) => n + p.x, 0) / list.length, y: list.reduce((n, p) => n + p.y, 0) / list.length };
    out.push(`<text class="mp-district" x="${c.x.toFixed(0)}" y="${(c.y - 70).toFixed(0)}">${esc(name.toUpperCase())}</text>`);
  }
  for (const r of rs) {
    const a = along(r.pts, 0.38);
    const b = along(r.pts, 0.62);
    let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const c = along(r.pts, 0.5);
    out.push(`<text class="mp-street" x="${c.x.toFixed(1)}" y="${(c.y + 4).toFixed(1)}" transform="rotate(${ang.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})">${esc(r.name)}</text>`);
  }
  out.push(`<rect class="mp-vig" x="-400" y="-400" width="${MAP_W + 800}" height="${MAP_H + 800}" fill="url(#mp-vignette)"/>`);
  return out.join('');
}

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mapScreen(o: MapOptions): Screen {
  const p = o.progress;
  const el = h('div', { class: 'screen map-screen' });
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const art = document.createElementNS(NS, 'g');
  art.innerHTML = townSvg(p);
  const routeG = document.createElementNS(NS, 'g');
  const markG = document.createElementNS(NS, 'g');
  const youG = document.createElementNS(NS, 'g');
  svg.append(art, routeG, markG, youG);

  const here = playerPoint(o.here.area, o.here.x);
  let selected: AreaId | null = null;
  let selKey: string | null = null;
  let confirm: TravelOption | null = null;
  const filters = new Set<FilterId>(FILTERS.map((f) => f.id));
  // View: centre and visible width in map units; `target` eases towards.
  const view = { x: here.x, y: here.y, w: 1500 };
  const target = { ...view };
  let dest: AreaId | null = p.save.destination;

  // ---- markers ----
  const allMarkers = markers(p);
  const markerEls = new Map<string, SVGGElement>();
  const markerOf = new Map<string, MapMarker>();
  const tip = h('div', { class: 'map-tip' });
  for (const m of allMarkers) {
    const g = document.createElementNS(NS, 'g');
    const open = unlocked(p, m.area);
    const street = m.kind === 'street';
    const visited = p.save.visited.includes(m.area);
    g.setAttribute('class', `mp-marker k-${m.kind}${open ? '' : ' locked'}${street ? ' street' : ''}${!visited && open ? ' new' : ''}`);
    const col = KIND_COLOUR[m.kind];
    g.innerHTML = street
      ? `<circle class="pin" r="9" fill="#0d0f13" stroke="${open ? col : '#5b5852'}" stroke-width="3"/>`
      : `<circle class="halo" r="22"/><circle class="pin" r="16" fill="${open ? col : '#3a3936'}" stroke="#0d0f13" stroke-width="3"/>` +
        `<g transform="translate(-9.5 -9.5) scale(.8)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconPaths(KIND_ICON[m.kind])}</g>` +
        (open ? '' : `<g transform="translate(7 -20) scale(.5)"><circle cx="12" cy="12" r="12" fill="#0d0f13"/><g fill="none" stroke="#f2c230" stroke-width="2.6" stroke-linecap="round">${iconPaths('lock')}</g></g>`);
    g.addEventListener('pointerenter', (e) => showTip(m, e as PointerEvent));
    g.addEventListener('pointerleave', () => tip.classList.remove('on'));
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dragMoved) return;
      select(m.area, m.key, false);
    });
    markG.append(g);
    markerEls.set(m.key, g);
    markerOf.set(m.key, m);
  }
  youG.innerHTML = `<g class="mp-you"><circle class="ring" r="26"/><circle r="13" fill="#f2c230" stroke="#0d0f13" stroke-width="3"/><g transform="translate(-7 -7) scale(.58)" fill="#0d0f13" stroke="#0d0f13" stroke-width="2" stroke-linejoin="round">${iconPaths('you')}</g><text y="-26" class="mp-you-label">YOU</text></g>`;

  function showTip(m: MapMarker, e: PointerEvent): void {
    const open = unlocked(p, m.area);
    tip.replaceChildren(h('b', { text: m.label }), h('span', { text: `${MARKER_LABELS[m.kind]}${open ? '' : ' · locked'}` }));
    const r = el.getBoundingClientRect();
    tip.style.left = `${e.clientX - r.left + 14}px`;
    tip.style.top = `${e.clientY - r.top + 14}px`;
    tip.classList.add('on');
  }

  function visibleMarkers(): MapMarker[] {
    const kinds = new Set(FILTERS.filter((f) => filters.has(f.id)).flatMap((f) => f.kinds));
    return allMarkers.filter((m) => kinds.has(m.kind));
  }

  // ---- route ----
  function drawRoute(): void {
    routeG.innerHTML = '';
    if (!dest) return;
    const r = route(p, o.here.area, dest);
    if (!r) return;
    const streets = [o.here.area, ...r].filter((a) => roadPoints(a));
    const parts = streets.map((a) => `<polyline class="mp-route" points="${pts(roadPoints(a)!)}"/>`);
    const d = place(dest).at;
    parts.push(`<g class="mp-dest" transform="translate(${d.x} ${d.y})"><circle r="30"/></g>`);
    routeG.innerHTML = parts.join('');
  }

  // ---- view ----
  function apply(): void {
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width > 0 ? rect.height / rect.width : 0.6;
    const vh = view.w * aspect;
    svg.setAttribute('viewBox', `${(view.x - view.w / 2).toFixed(1)} ${(view.y - vh / 2).toFixed(1)} ${view.w.toFixed(1)} ${vh.toFixed(1)}`);
    // Markers stay the same size on screen whatever the zoom.
    const k = rect.width > 0 ? view.w / rect.width : 1;
    const shown = new Set(visibleMarkers().map((m) => m.key));
    for (const [key, g] of markerEls) {
      const m = markerOf.get(key)!;
      const s = m.kind === 'street' ? k * 0.9 : k;
      g.setAttribute('transform', `translate(${m.at.x.toFixed(1)} ${m.at.y.toFixed(1)}) scale(${(s * (key === selKey ? 1.25 : 1)).toFixed(3)})`);
      g.style.display = shown.has(key) ? '' : 'none';
      g.classList.toggle('sel', key === selKey);
    }
    (youG.firstElementChild as SVGGElement).setAttribute('transform', `translate(${here.x.toFixed(1)} ${here.y.toFixed(1)}) scale(${k.toFixed(3)})`);
    const dg = routeG.querySelector('.mp-dest') as SVGGElement | null;
    if (dg && dest) {
      const d = place(dest).at;
      dg.setAttribute('transform', `translate(${d.x} ${d.y}) scale(${k.toFixed(3)})`);
    }
    svg.classList.toggle('far', view.w > 1900);
    svg.classList.toggle('near', view.w < 1000);
    zoomFill.style.height = `${((MAX_W - view.w) / (MAX_W - MIN_W)) * 100}%`;
  }

  const clampView = (v: { x: number; y: number; w: number }) => {
    v.w = Math.max(MIN_W, Math.min(MAX_W, v.w));
    v.x = Math.max(0, Math.min(MAP_W, v.x));
    v.y = Math.max(0, Math.min(MAP_H, v.y));
  };

  function zoomBy(f: number, at?: Pt): void {
    const before = target.w;
    target.w = Math.max(MIN_W, Math.min(MAX_W, target.w * f));
    if (at) {
      const r = target.w / before;
      target.x = at.x + (target.x - at.x) * r;
      target.y = at.y + (target.y - at.y) * r;
    }
    clampView(target);
  }

  function flyTo(pt: Pt, w?: number): void {
    target.x = pt.x;
    target.y = pt.y;
    if (w) target.w = w;
    clampView(target);
  }

  /** Screen point to map point. */
  function toMap(cx: number, cy: number): Pt {
    const r = svg.getBoundingClientRect();
    const aspect = r.height / r.width;
    const vh = view.w * aspect;
    return { x: view.x - view.w / 2 + ((cx - r.left) / r.width) * view.w, y: view.y - vh / 2 + ((cy - r.top) / r.height) * vh };
  }

  // ---- pointer: drag to pan, wheel and pinch to zoom ----
  const pointers = new Map<number, { x: number; y: number }>();
  let dragMoved = false;
  let pinch0 = 0;
  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  svg.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const r = svg.getBoundingClientRect();
    const k = view.w / r.width;
    if (pointers.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
      view.x -= dx * k;
      view.y -= dy * k;
      clampView(view);
      Object.assign(target, view);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) {
        const mid = toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
        target.w = view.w;
        zoomBy(pinch0 / d, mid);
        Object.assign(view, target);
      }
      pinch0 = d;
      dragMoved = true;
    }
    apply();
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = 0;
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(Math.exp(e.deltaY * 0.0012), toMap(e.clientX, e.clientY));
  }, { passive: false });
  // Clicking empty map clears the selection.
  svg.addEventListener('click', () => {
    if (dragMoved) return;
    if (selected) {
      selected = null;
      selKey = null;
      confirm = null;
      renderPanel();
      apply();
    }
  });

  // ---- keyboard: arrows/WASD pan, +/- zoom, [ ] step through places ----
  const held = new Set<string>();
  const keyDown = (e: KeyboardEvent) => {
    if (!el.isConnected) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) held.add(e.code);
    if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'KeyZ') zoomBy(0.8);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'KeyX') zoomBy(1.25);
    if (e.code === 'BracketRight' || e.code === 'PageDown') step(1);
    if (e.code === 'BracketLeft' || e.code === 'PageUp') step(-1);
    if (e.code === 'KeyC') flyTo(here, 1200);
  };
  const keyUp = (e: KeyboardEvent) => held.delete(e.code);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  let last = performance.now();
  const tick = (now: number) => {
    if (!el.isConnected) {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const speed = target.w * 0.9 * dt;
    if (held.has('ArrowLeft') || held.has('KeyA')) target.x -= speed;
    if (held.has('ArrowRight') || held.has('KeyD')) target.x += speed;
    if (held.has('ArrowUp') || held.has('KeyW')) target.y -= speed;
    if (held.has('ArrowDown') || held.has('KeyS')) target.y += speed;
    clampView(target);
    const e = 1 - Math.exp(-dt * 12);
    const moved = Math.abs(target.x - view.x) + Math.abs(target.y - view.y) + Math.abs(target.w - view.w) > 0.05;
    if (moved) {
      view.x += (target.x - view.x) * e;
      view.y += (target.y - view.y) * e;
      view.w += (target.w - view.w) * e;
      apply();
    }
    requestAnimationFrame(tick);
  };

  /** Next/previous place on the map (keyboard and gamepad). */
  function step(d: number): void {
    const list = visibleMarkers().filter((m) => m.kind !== 'boss');
    if (!list.length) return;
    const i = list.findIndex((m) => m.key === selKey);
    const m = list[(i + d + list.length) % list.length];
    select(m.area, m.key, true);
  }

  // ---- selection and the info card ----
  function select(area: AreaId, key: string, fly: boolean): void {
    selected = area;
    selKey = key;
    confirm = null;
    renderPanel();
    if (fly) flyTo(markerOf.get(key)?.at ?? place(area).at, Math.min(target.w, 1300));
    apply();
  }

  const panel = h('aside', { class: 'map-panel' });
  function renderPanel(): void {
    if (!selected) {
      panel.replaceChildren(...overviewCard());
      return;
    }
    const pl = place(selected);
    const m = selKey ? markerOf.get(selKey) : null;
    const kind: MarkerKind = m?.kind ?? pl.kind;
    const open = unlocked(p, selected);
    const lock = open ? null : lockReason(p, selected);
    const visited = p.save.visited.includes(selected);
    const isHere = selected === o.here.area || (selected === 'basement' && o.here.area === 'home');
    const chips: HTMLElement[] = [];
    if (isHere) chips.push(h('span', { class: 'chip-tag here', text: 'You are here' }));
    if (!open) chips.push(h('span', { class: 'chip-tag locked' }, icon('lock'), 'Locked'));
    else if (!visited) chips.push(h('span', { class: 'chip-tag new', text: 'Not visited yet' }));
    if (dest === selected) chips.push(h('span', { class: 'chip-tag dest' }, icon('route'), 'Destination'));
    const title = m && m.kind !== 'street' && !m.key.startsWith('place:') ? m.label : pl.name;
    const typeText = kind === 'street' ? `Street · ${pl.district}` : `${MARKER_LABELS[kind]} · ${pl.district}`;
    const head = h('div', { class: 'mp-card-head' },
      h('span', { class: 'mp-card-icon' }, icon(KIND_ICON[kind])),
      h('div', {}, h('h3', { text: title }), h('div', { class: 'mp-type', text: typeText })),
      h('button', { class: 'icon-btn', 'aria-label': 'Close card', onclick: () => { selected = null; selKey = null; confirm = null; renderPanel(); apply(); } }, icon('close')),
    );
    (head.querySelector('.mp-card-icon') as HTMLElement).style.background = open ? KIND_COLOUR[kind] === '#e9e6df' ? '#3a3f48' : KIND_COLOUR[kind] : '#3a3936';
    const body: HTMLElement[] = [head, h('div', { class: 'mp-chips' }, ...chips), h('p', { class: 'mp-blurb', text: m && m.key.startsWith('boss:') ? `On ${pl.name}, ${pl.district}.` : pl.blurb })];
    if (lock) body.push(h('div', { class: 'mp-lock' }, icon('lock'), h('span', { text: lock })));
    if (pl.activities.length) body.push(h('div', { class: 'mp-sub', text: 'Things to do' }), h('ul', { class: 'mp-list' }, ...pl.activities.map((a) => h('li', { text: a }))));
    if (pl.people.length) body.push(h('div', { class: 'mp-sub', text: 'People' }), h('ul', { class: 'mp-list' }, ...pl.people.map((a) => h('li', { text: a }))));
    // Travel.
    const opts = travelOptions(p, o.here.area, selected, o.calm);
    const acts: HTMLElement[] = [];
    if (confirm) {
      const c = confirm;
      acts.push(
        h('div', { class: 'mp-confirm', text: c.kind === 'cab' ? `Take a cab to ${pl.name} for £${c.cost}?` : `Head home to 14 Tanner Road?` }),
        h('div', { class: 'mp-confirm-row' },
          actionBtn('Go', c.kind === 'cab' ? 'cab' : 'home', () => o.travel(selected!, c), 'primary'),
          actionBtn('Cancel', 'back', () => { confirm = null; renderPanel(); }),
        ),
      );
    } else {
      for (const t of opts) {
        if (t.kind === 'here') continue;
        if (t.kind === 'walk') {
          const isDest = dest === selected;
          acts.push(actionBtn(isDest ? 'Clear destination' : 'Set as destination', 'route', () => {
            dest = isDest ? null : selected;
            o.setDestination(dest);
            drawRoute();
            apply();
            renderPanel();
          }, '', t.ok || isDest ? undefined : t.why, !t.ok && !isDest, t.ok ? t.label : undefined));
          continue;
        }
        acts.push(actionBtn(t.kind === 'cab' ? 'Take a cab' : 'Head home', t.kind === 'cab' ? 'cab' : 'home', () => { confirm = t; renderPanel(); }, t.ok ? 'primary' : '', t.ok ? undefined : t.why, !t.ok, t.ok ? t.label : undefined));
      }
      if (isHere) acts.push(h('div', { class: 'mp-here-note', text: 'You’re here now.' }));
    }
    body.push(h('div', { class: 'mp-actions' }, ...acts));
    panel.replaceChildren(h('div', { class: 'mp-card' }, ...body));
    const first = panel.querySelector('button.primary:not([disabled])') as HTMLButtonElement | null;
    first?.focus({ preventScroll: true });
  }

  function actionBtn(label: string, ic: IconName, fn: () => void, cls = '', why?: string, disabled = false, sub?: string): HTMLElement {
    const b = h('button', { class: `act-btn ${cls}`, 'data-nav': true, onclick: () => fn() }, icon(ic), h('span', { class: 'lbl' }, h('b', { text: label }), why ? h('small', { class: 'why', text: why }) : sub ? h('small', { text: sub }) : null));
    if (disabled) b.setAttribute('disabled', '');
    return b;
  }

  /** With nothing selected: where you are, your destination, and the districts list. */
  function overviewCard(): HTMLElement[] {
    const cur = place(o.here.area);
    const next = allMarkers.find((m) => m.kind === 'mission');
    const rows: HTMLElement[] = [];
    rows.push(h('div', { class: 'mp-card' },
      h('div', { class: 'mp-sub', text: 'You are at' }),
      h('h3', { text: cur.name }),
      h('div', { class: 'mp-type', text: cur.district }),
      dest ? h('div', { class: 'mp-dest-line' }, icon('route'), h('span', { text: `Heading for ${place(dest).name}` })) : null,
      next ? actionBtn('Main mission', 'mission', () => select(next.area, next.key, true), '', undefined, false, next.label) : null,
    ));
    const list = places().filter((x) => x.street).sort((a, b) => Number(unlocked(p, b.id)) - Number(unlocked(p, a.id)));
    rows.push(h('div', { class: 'mp-card mp-districts' },
      h('div', { class: 'mp-sub', text: 'Districts' }),
      ...list.map((x) => {
        const open = unlocked(p, x.id);
        return h('button', { class: `mp-district-btn${open ? '' : ' locked'}`, 'data-nav': true, onclick: () => select(x.id, `street:${x.id}`, true) },
          open ? icon('pin') : icon('lock'), h('span', { text: x.district }), h('small', { text: x.name }));
      }),
    ));
    return rows;
  }

  // ---- chrome: header, filters, zoom ----
  const zoomFill = h('i');
  const filterBar = h('div', { class: 'map-filters' }, ...FILTERS.map((f) => {
    const b = h('button', { class: 'chip on', 'aria-pressed': 'true', onclick: () => {
      if (filters.has(f.id)) filters.delete(f.id);
      else filters.add(f.id);
      b.classList.toggle('on', filters.has(f.id));
      b.setAttribute('aria-pressed', String(filters.has(f.id)));
      apply();
    } }, icon(f.icon), h('span', { text: f.label }));
    return b;
  }));
  const s = p.save;
  el.append(
    h('header', { class: 'map-head' },
      h('div', { class: 'map-title' }, icon('map'), h('h2', { text: 'Map' }), h('span', { class: 'map-where', text: `${place(o.here.area).name}, ${place(o.here.area).district}` })),
      h('span', { class: 'wallet', text: `£${s.cash.pocket} on you · £${s.cash.bank} in the tin` }),
      h('button', { class: 'icon-btn close', 'aria-label': 'Close map', title: 'Close (Esc / M)', onclick: () => o.close() }, icon('close')),
    ),
    h('div', { class: 'map-body' },
      h('div', { class: 'map-view' }, svg, tip,
        h('div', { class: 'map-zoom' },
          h('button', { class: 'icon-btn', 'aria-label': 'Zoom in', title: 'Zoom in (+)', onclick: () => zoomBy(0.75) }, icon('plus')),
          h('div', { class: 'zoom-track' }, zoomFill),
          h('button', { class: 'icon-btn', 'aria-label': 'Zoom out', title: 'Zoom out (−)', onclick: () => zoomBy(1.33) }, icon('minus')),
          h('button', { class: 'icon-btn', 'aria-label': 'Centre on me', title: 'Centre on me (C)', onclick: () => flyTo(here, 1200) }, icon('target')),
        ),
        filterBar,
        h('div', { class: 'map-hint', text: o.calm ? 'Drag to move · scroll or pinch to zoom · click a place' : 'You’re in a fight: no cabs until it’s over' }),
      ),
      panel,
    ),
  );

  return {
    el,
    onShow: () => {
      drawRoute();
      if (o.select) {
        const key = markerOf.has(`place:${o.select}`) ? `place:${o.select}` : `street:${o.select}`;
        selected = o.select;
        selKey = key;
        const at = markerOf.get(key)?.at;
        if (at) Object.assign(view, { x: at.x, y: at.y, w: 1100 }), Object.assign(target, view);
      }
      renderPanel();
      requestAnimationFrame(() => {
        apply();
        last = performance.now();
        requestAnimationFrame(tick);
      });
    },
    onBack: () => {
      if (confirm) {
        confirm = null;
        renderPanel();
      } else if (selected) {
        selected = null;
        selKey = null;
        renderPanel();
        apply();
      } else o.close();
    },
    onAction: (a, source) => {
      if (a === 'map' || a === 'pause') {
        o.close();
        return true;
      }
      // Keyboard arrows pan (see keyDown). Gamepad D-pad: up/down step through places.
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
        if (source === 'keyboard') return true;
        if (a === 'up' || a === 'down') {
          step(a === 'down' ? 1 : -1);
          return true;
        }
      }
      return false;
    },
  };
}
