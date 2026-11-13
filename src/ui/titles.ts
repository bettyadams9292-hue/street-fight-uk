/**
 * Painted title graphics (public/art/titles/<slug>.webp): menu buttons, headings, place names, boss
 * names, fight call-outs. Each is shown as an <img> with the words as its alt text; where there's no
 * graphic for a name (or it fails to load) the plain text is shown instead, so nothing is ever blank.
 */
import { h } from './dom';

/** Every graphic in public/art/titles (tests/titles.test.ts keeps this in step with the folder). */
export const TITLE_SLUGS: ReadonlySet<string> = new Set([
  'abandoned-factory',
  'ambience-volume',
  'arch-the-big-boss',
  'arch-the-boss',
  'arch-the-brute',
  'arch-the-dragon',
  'arch-the-gangster',
  'arch-the-hitman',
  'arch-the-kingpin',
  'arch-the-psycho',
  'arch-the-samurai',
  'arch-the-terror',
  'audio',
  'back',
  'back-alleys',
  'big-agnes-rudd',
  'big-dunc',
  'big-lenny-shaw',
  'blackfriars',
  'brixton',
  'broadway',
  'camden',
  'canal-docks',
  'canal-side-works',
  'carl-briggs',
  'cassius-thorne',
  'character',
  'continue',
  'controls',
  'covent-garden',
  'dean-ledger-pryce',
  'deep-line',
  'difficulty',
  'display',
  'dr-imogen-vale',
  'east-end',
  'easy',
  'effects-volume',
  'exit',
  'fight',
  'former-champ',
  'frame-rate-counter',
  'game',
  'game-over',
  'gaz-mullins',
  'graphics-quality',
  'greenwich',
  'hackney',
  'hale-house',
  'hard',
  'high',
  'high-street',
  'hollins-estate',
  'home',
  'kasia-nowak',
  'kingsway-precinct',
  'kirkgate-ground',
  'kirkgate-leisure',
  'leicester-square',
  'level-complete',
  'lighting-and-glow',
  'logo-badge',
  'london-streets',
  'low',
  'market-square',
  'master-volume',
  'maureen-doyle',
  'medium',
  'menu-character',
  'menu-continue',
  'menu-controls',
  'menu-new-game',
  'menu-settings',
  'menu-training-ground',
  'mission-failed',
  'morwenna-pike',
  'multi-storey-car-park',
  'neon-mile',
  'new-game',
  'normal',
  'notting-hill',
  'old-market',
  'options',
  'owner-of-velvet',
  'pause',
  'pawn-and-gold',
  'piccadilly',
  'ready',
  'reset-to-defaults',
  'resume',
  'ring-road-subway',
  'runs-the-pit',
  'screen-shake',
  'settings',
  'shopping-centre',
  'shoreditch',
  'show-hitboxes',
  'silas-crane',
  'silas-crowther',
  'simone-achebe',
  'sir-edmund-lascelles',
  'soho',
  'story-mode',
  'stratford',
  'sully-kane',
  'tanner-road-estate',
  'the-arena',
  'the-boss',
  'the-chairman',
  'the-docks',
  'the-dockyard',
  'the-dockyard-bruiser',
  'the-estate-king',
  'the-forgemaster',
  'the-gaffer',
  'the-harbourmaster',
  'the-industrial-enforcer',
  'the-kingmaker',
  'the-market',
  'the-market-boss',
  'the-millowner',
  'the-palace',
  'the-pit',
  'the-planner',
  'the-precinct-enforcer',
  'the-ratcatcher',
  'the-red-lion',
  'the-river',
  'the-shard',
  'the-stadium',
  'the-tower',
  'the-underground',
  'the-underground-king',
  'threads',
  'top-boy-of-the-firm',
  'touch-controls',
  'tower-bridge',
  'training',
  'training-ground',
  'tyrone-fairclough',
  'victor-hale',
  'vince-rourke',
  'waterloo',
  'wembley',
  'westgate-industrial-estate',
  'westminster',
  'you-win',
]);

/** "Tanner Road Estate" → "tanner-road-estate"; "Pawn & Gold" → "pawn-and-gold"; "Del's" → "dels". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function hasTitle(slug: string | null | undefined): slug is string {
  return !!slug && TITLE_SLUGS.has(slug);
}

export function titleUrl(slug: string): string {
  return `/art/titles/${slug}.webp`;
}

/**
 * The graphic for `slug` (or for the text itself, slugified) with `text` as its alt text; the text in
 * a span if there's no such graphic. `cls` goes on whichever is returned.
 */
export function titleArt(text: string, slug: string | null = slugify(text), cls = ''): HTMLElement {
  if (!hasTitle(slug)) return h('span', { class: `title-text ${cls}`.trim(), text });
  const img = h('img', { class: `title-art ${cls}`.trim(), src: titleUrl(slug), alt: text, draggable: 'false', decoding: 'async' }) as HTMLImageElement;
  // A missing or broken file: put the words back.
  img.addEventListener('error', () => img.replaceWith(h('span', { class: `title-text ${cls}`.trim(), text })), { once: true });
  return img;
}

/** The graphic for a place or name: its slug, or without a leading "the" ("The Neon Mile" → neon-mile). */
export function titleFor(text: string): string | null {
  const s = slugify(text);
  if (TITLE_SLUGS.has(s)) return s;
  const bare = s.replace(/^the-/, '');
  return TITLE_SLUGS.has(bare) ? bare : null;
}

/** The first of several candidate graphics that exists, e.g. ['you-win', 'level-complete']. */
export function firstTitle(...slugs: string[]): string | null {
  return slugs.find((s) => TITLE_SLUGS.has(s)) ?? null;
}
