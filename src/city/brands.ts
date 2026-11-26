/**
 * The high street's brand book: how each business presents itself. Every named shop has its own fascia (colours,
 * lettering, case), a line of window vinyl, posters in the window and sometimes a banner, so the street reads as a
 * real British high street rather than one sign style per kind of shop. Shops with no entry of their own get their
 * kind's look and posters, varied by name, so two bookies or two chicken shops still differ.
 *
 * Pure data: drawn by render/brandArt.ts (signs, posters, vinyl, banners) and laid out by city/street.ts.
 */
import type { InteriorKind } from './street';

/** The lettering a fascia is set in (render/brandArt.ts maps these to fonts). */
export type BrandFace = 'heavy' | 'condensed' | 'stencil' | 'serif' | 'serifItalic' | 'script' | 'rounded' | 'italic';

export interface Brand {
  /** Fascia background, lettering, and the accent for stripes, posters and stickers. */
  bg: string;
  fg: string;
  accent: string;
  face: BrandFace;
  /** Set the name in lower case (modern chains). */
  lower?: boolean;
  /** Gold leaf signwriting (pubs, jewellers, barbers). */
  gilt?: boolean;
  /** A stripe of the accent along the bottom of the fascia. */
  stripe?: boolean;
  /** The line of vinyl along the bottom of the glass. */
  tagline: string;
  /** Posters in the window: short, as real window cards are. */
  posters: string[];
  /** A banner hung inside the top of the glass. */
  banner?: string;
}

const B = (bg: string, fg: string, accent: string, face: BrandFace, tagline: string, posters: string[], o: Partial<Brand> = {}): Brand => ({ bg, fg, accent, face, tagline, posters, ...o });

/** Named businesses, by the brand part of their sign (before any " — "). */
export const BRANDS: Record<string, Brand> = {
  'JD STREETS': B('#101012', '#ffffff', '#f5c400', 'italic', 'KING OF THE STREETS', ['NEW IN: AIR RUNNERS', 'UP TO 50% OFF', '2 TEES FOR £25', 'STUDENTS 10% OFF'], { lower: true, banner: 'SALE NOW ON' }),
  WEATHERSPOONS: B('#1d2f4a', '#e8c36a', '#c8102e', 'serif', 'FOOD SERVED ALL DAY', ['CURRY CLUB THURSDAY', 'PINTS FROM £2.49', 'BREAKFAST FROM 8AM', 'REAL ALE FESTIVAL'], { gilt: true }),
  LADSBROKE: B('#c8102e', '#ffffff', '#ffffff', 'heavy', 'BET IN-PLAY ON EVERY MATCH', ['BET £10 GET £30', 'ACCA BOOST 50%', 'RACING LIVE TODAY', 'FREE BET FRIDAY'], { stripe: true }),
  'CASH DEGENERATOR': B('#ffd200', '#1a1a1a', '#d8141e', 'heavy', 'WE BUY · WE SELL · WE LOAN', ['WE BUY GOLD', 'CASH IN MINUTES', 'PHONES WANTED', 'CONSOLES FROM £99'], { banner: 'WE BUY ANYTHING' }),
  'THE GRAND GAMBLE': B('#3a0e14', '#ffd75a', '#ffd75a', 'serif', 'OPEN 24 HOURS · OVER 18s ONLY', ['ROULETTE', 'BLACKJACK', 'SLOTS', 'FREE MEMBERSHIP'], { gilt: true }),
  'H. STERLING': B('#14161c', '#d9b65a', '#d9b65a', 'serifItalic', 'FINE JEWELLERS SINCE 1962', ['DIAMONDS', 'WATCH REPAIRS', 'ENGAGEMENT RINGS', '0% FINANCE'], { gilt: true }),
  'SOFA SO GOOD': B('#2a4a3a', '#f4efe0', '#f2b134', 'rounded', 'SOFAS · BEDS · DINING', ['SOFAS FROM £299', 'FREE DELIVERY', 'BUY NOW PAY LATER', 'CLEARANCE'], { lower: true, banner: 'MASSIVE SOFA SALE' }),
  'ARNOLD SHARK': B('#1f4fa8', '#ffffff', '#ffd200', 'italic', 'NEW & USED · FINANCE ARRANGED', ['0% APR', 'PART-EX WELCOME', '12 MONTH WARRANTY', 'NO CREDIT? NO PROBLEM'], { stripe: true }),
  HALFRAUDS: B('#e86a10', '#ffffff', '#1a1a1a', 'heavy', 'BIKES · SCOOTERS · MOTOS', ['E-BIKES IN STOCK', 'FREE BIKE CHECK', 'CYCLE TO WORK', 'HELMETS FROM £15']),
  'B&THC': B('#2a8a3a', '#ffffff', '#c8f06a', 'rounded', 'HYDROPONICS · LIGHTING · VENTILATION', ['LED GROW LIGHTS', 'NUTRIENTS 3 FOR 2', 'TENTS & FANS', 'EXPERT ADVICE']),
  PUREGRAFT: B('#9a1c1c', '#ffffff', '#ffffff', 'condensed', 'HOME GYM EQUIPMENT', ['DUMBBELLS IN STOCK', 'RACKS & BENCHES', 'FREE FITTING', 'BUILD YOUR GYM'], { stripe: true }),
  WRONGMOVE: B('#24272c', '#f2c230', '#f2c230', 'rounded', 'SALES · LETTINGS · MANAGEMENT', ['FREE VALUATION', 'PROPERTIES WANTED', 'TO LET', 'SOLD IN 7 DAYS'], { lower: true }),
  PRIMEARK: B('#0a7ac2', '#ffffff', '#ffffff', 'heavy', 'AMAZING FASHION, AMAZING PRICES', ['JEANS £8', 'HOODIES £10', 'NEW SEASON', 'KIDS 2 FOR £5']),
  DEBTENHAMS: B('#1b1b1b', '#ffffff', '#d8141e', 'serif', 'EVERYTHING MUST GO', ['CLOSING DOWN', 'UP TO 70% OFF', 'LAST FEW DAYS', 'ALL STOCK REDUCED'], { banner: 'CLOSING DOWN SALE' }),
  CURRUPTYS: B('#5a1a8a', '#ffffff', '#ffd200', 'heavy', 'TECH FOR LESS', ['4K TVs FROM £199', 'LAPTOPS', 'PRICE PROMISE', 'TRADE IN YOUR OLD TECH'], { lower: true }),
  DEBT365: B('#1f6a3a', '#ffe600', '#ffe600', 'heavy', 'BET LIVE · CASH OUT', ['BET BUILDER', 'IN-PLAY ODDS', 'FOOTBALL LIVE', 'NEW CUSTOMER OFFER']),
  POUNDTOWN: B('#d81e1e', '#ffe600', '#ffe600', 'heavy', 'EVERYTHING £1', ['CLEANING', 'SWEETS', 'PARTY', 'PET'], { banner: 'EVERYTHING £1' }),
  CARPETWRONG: B('#e2001a', '#ffffff', '#ffffff', 'heavy', 'CARPETS · FLOORING · BEDS', ['FREE FITTING', 'ROLL ENDS', 'HALF PRICE']),
  'BODGIT & SCARPER': B('#f28c00', '#1a1a1a', '#1a1a1a', 'heavy', 'TRADE COUNTER', ['PAINT 2 FOR £20', 'TIMBER CUT TO SIZE', 'TRADE PRICES']),
  'BODGIT & SONS': B('#f28c00', '#1a1a1a', '#1a1a1a', 'heavy', 'BUILDERS MERCHANTS', ['TRADE PRICES', 'SAND & CEMENT', 'OPEN 7AM']),
  'STASH CONVERTERS': B('#6b2d82', '#ffffff', '#ffd200', 'heavy', 'WE BUY & SELL', ['CONSOLES', 'PHONES', 'GOLD', 'TOOLS']),
  'PUFF & CONNECT': B('#13a3a8', '#ffffff', '#ff3d6e', 'rounded', 'VAPES · PHONES · REPAIRS', ['VAPES 3 FOR £15', 'SCREEN REPAIRS', 'UNLOCKING', 'CASES £5'], { lower: true }),
  'BOOZE BROTHERS': B('#1f6a3a', '#ffffff', '#ffd200', 'condensed', 'BEERS · WINES · SPIRITS', ['3 FOR £10', 'CRATES ON OFFER', 'ICE COLD', 'LOTTERY HERE']),
  'ABRA KEBABRA': B('#9a2a1a', '#ffe08a', '#ffe08a', 'script', 'KEBABS · PIZZA · BURGERS', ['MIXED KEBAB £8', 'CHIPS & CHEESE', 'OPEN TIL 3AM', 'WE DELIVER']),
  'DONER DYNASTY': B('#d84a1a', '#ffffff', '#ffd200', 'heavy', 'GRILL HOUSE', ['LARGE DONER £7', 'FAMILY DEAL', 'OPEN LATE']),
  'THE CODFATHER': B('#1f4f8a', '#ffffff', '#ffd200', 'serifItalic', 'TRADITIONAL FISH & CHIPS', ['COD & CHIPS £9.50', 'MUSHY PEAS', 'FRIDAY SPECIAL']),
  'CLUCKIN’ HELL': B('#d84a1a', '#ffe600', '#1a1a1a', 'heavy', 'FINGER LICKIN’ FIERY', ['2 PC MEAL £3.99', 'WINGS 10 FOR £5', 'HOT HOT HOT']),
  'THE MUNCH BOX': B('#d84a1a', '#ffffff', '#1a1a1a', 'rounded', 'BURGERS · PIZZA · SHAKES', ['MUNCH BOX £10', 'MEAL DEAL', 'STUDENT DEAL']),
  'NAILED IT': B('#c060a0', '#ffffff', '#ffe6f2', 'script', 'NAILS · LASHES · BROWS', ['GEL NAILS £20', 'ACRYLICS', 'WALK-INS WELCOME', 'LASH LIFT']),
  'FIRM DIRECT': B('#b3121b', '#ffffff', '#1a1a1a', 'condensed', 'FIGHT KIT · SPORTSWEAR', ['BOXING GLOVES', 'KIT FROM £15', 'TRAINERS']),
  'SHORTS DIRECT': B('#1d1d6b', '#ffffff', '#d8141e', 'heavy', 'HUGE REDUCTIONS', ['MUGS £1', 'TRAINERS', 'MASSIVE SAVINGS'], { stripe: true }),
  'PEAKY BARBERS': B('#1f2a44', '#d9b65a', '#d9b65a', 'serif', 'WALK-INS WELCOME', ['SKIN FADE £15', 'BEARD TRIM £8', 'KIDS £10', 'HOT TOWEL SHAVE'], { gilt: true }),
  'NEXO CUTZ BARBERS': B('#111114', '#ffffff', '#d8141e', 'condensed', 'WALK-INS WELCOME', ['SKIN FADE £15', 'BEARD TRIM £8', 'KIDS £10']),
  'INK & IRON TATTOO': B('#141418', '#e8e4d8', '#c8102e', 'stencil', 'WALK-INS · NO UNDER 18s', ['FLASH £50', 'PIERCING', 'COVER-UPS', 'BOOK NOW']),
  'INK & IRON': B('#141418', '#e8e4d8', '#c8102e', 'stencil', 'WALK-INS · NO UNDER 18s', ['FLASH £50', 'PIERCING', 'COVER-UPS']),
  'PUNCH & CRUNCH': B('#7a1414', '#ffffff', '#ffffff', 'stencil', 'BOXING SINCE 1979', ['CLASSES DAILY', 'FIRST SESSION FREE', 'KIDS BOXING']),
  'ROUGH & TUMBLE': B('#1f2a44', '#ffffff', '#e8c36a', 'stencil', 'WRESTLING & GRAPPLING', ['OPEN MAT FRIDAY', 'NO-GI CLASSES', 'ALL LEVELS']),
  'FISTS FIRST': B('#e8e0d0', '#1a1a1a', '#c8102e', 'condensed', 'KARATE & MUAY THAI', ['KIDS CLASSES', 'GRADINGS', 'TRIAL £5']),
  'CASH 4 U PAWN': B('#ffd200', '#c8102e', '#c8102e', 'heavy', 'CASH FOR GOLD', ['WE BUY GOLD', 'CASH TODAY'], { banner: 'CASH 4 U' }),
};

/** Each kind of shop's look and window, for shops with no entry of their own. */
const KIND: Record<InteriorKind, Brand> = {
  pub: B('#3a1512', '#e8c36a', '#e8c36a', 'serif', 'FREE HOUSE · REAL ALES', ['SKY SPORTS HERE', 'QUIZ NIGHT TUESDAY', 'KARAOKE FRIDAY', 'SUNDAY ROAST £12'], { gilt: true }),
  club: B('#16081f', '#ff5ac8', '#ff5ac8', 'heavy', 'OVER 21s · DRESS CODE APPLIES', ['DJs EVERY SATURDAY', 'STUDENT NIGHT', '£2 SHOTS']),
  takeaway: B('#b3261e', '#fff3d6', '#ffd200', 'heavy', 'OPEN LATE · FREE DELIVERY', ['MEAL DEAL £5.99', 'FAMILY BUCKET', 'OPEN TIL 2AM', 'HALAL']),
  cafe: B('#3d2a1c', '#f2e2c4', '#f2e2c4', 'serifItalic', 'BREAKFAST SERVED ALL DAY', ['FULL ENGLISH £6.50', 'BACON BAP £3', 'TEA & TOAST', 'TAKEAWAY']),
  bookies: B('#12452a', '#ffffff', '#ffd200', 'heavy', 'RACING · FOOTBALL · LIVE ODDS', ['BET £5 GET £20', 'BEST ODDS GUARANTEED', 'ALL THE RACING LIVE', 'CASH OUT']),
  gadgets: B('#1c2a4a', '#7fd4ff', '#7fd4ff', 'rounded', 'PHONES · REPAIRS · UNLOCKING', ['SCREENS FIXED IN 1 HOUR', 'WE BUY PHONES', 'SIM ONLY £5', 'CASES & CHARGERS']),
  clothes: B('#111111', '#ffffff', '#d8141e', 'condensed', 'NEW SEASON IN STORE', ['UP TO 50% OFF', 'NEW IN', '3 FOR 2', 'SALE']),
  furniture: B('#2f4a3a', '#f2e8d0', '#f2b134', 'serif', 'FURNITURE · LIGHTING · DECOR', ['FREE DELIVERY', 'SALE NOW ON', 'BEDS FROM £149']),
  pawn: B('#1a1a1a', '#e2b93b', '#e2b93b', 'heavy', 'WE BUY GOLD · INSTANT CASH', ['CASH FOR GOLD', 'LOANS ON JEWELLERY', 'PHONES WANTED']),
  jeweller: B('#0f1a2a', '#f2e2b0', '#f2e2b0', 'serifItalic', 'WATCHES · RINGS · REPAIRS', ['WATCH BATTERIES £5', 'EARS PIERCED', 'GOLD BOUGHT'], { gilt: true }),
  casino: B('#3a0d12', '#ffd75a', '#ffd75a', 'serif', 'OPEN 24 HOURS', ['SLOTS', 'ROULETTE']),
  office: B('#2a3340', '#dfe6ee', '#dfe6ee', 'serif', '', []),
  gym: B('#16171a', '#e03a2f', '#e03a2f', 'stencil', 'NO CONTRACTS · OPEN 6AM', ['JOIN FOR £0', 'CLASSES DAILY', 'PERSONAL TRAINING']),
  offlicence: B('#5a1a6a', '#ffe94a', '#ffe94a', 'heavy', 'BEERS · WINES · SPIRITS', ['4 CANS £5', '3 FOR £10', 'LOTTERY', 'ICE COLD']),
  bikes: B('#1d3a1d', '#c8f06a', '#c8f06a', 'heavy', 'SALES · SERVICE · PARTS', ['MOTS DONE', 'FINANCE AVAILABLE', 'HELMETS']),
  cars: B('#10203a', '#ffffff', '#ffd200', 'italic', 'QUALITY USED CARS', ['PART-EX WELCOME', 'FINANCE ARRANGED', 'WARRANTY ON ALL CARS']),
  plants: B('#1f4a2b', '#e6f2d0', '#e6f2d0', 'serif', 'PLANTS · COMPOST · TOOLS', ['3 FOR £10 BEDDING', 'COMPOST 2 FOR £8', 'CHRISTMAS TREES']),
  salon: B('#7a2a5a', '#ffe6f2', '#ffe6f2', 'script', 'WALK-INS WELCOME', ['CUT & BLOW DRY £25', 'NAILS FROM £15', 'LASHES', 'BROWS']),
  general: B('#c0262a', '#ffe94a', '#ffe94a', 'heavy', 'OPEN 7 DAYS · 7AM TIL LATE', ['PAYPOINT', 'LOTTERY', 'HOT DRINKS', 'NEWSPAPERS']),
};

/** Keyword looks for the many independent shops (the generic names the streets are filled with). */
const KEYWORD: [RegExp, Partial<Brand>][] = [
  [/HARDWARE/, { bg: '#2a3a5a', fg: '#ffffff', accent: '#f28c00', tagline: 'KEYS CUT · PAINT · TOOLS', posters: ['KEYS CUT WHILE U WAIT', 'PAINT MIXED', 'GAS BOTTLES'] }],
  [/POUND/, { bg: '#1d4ea8', fg: '#ffe600', accent: '#ffe600', tagline: 'EVERYTHING £1', posters: ['CLEANING £1', 'SWEETS £1', 'PARTY'], banner: 'EVERYTHING £1' }],
  [/STORES/, { bg: '#c0262a', fg: '#ffffff', accent: '#ffe94a', tagline: 'GROCERIES · NEWS · OFF LICENCE', posters: ['MILK 2 FOR £2.50', 'PAYPOINT', 'LOTTERY'] }],
  [/FOOD COURT/, { bg: '#d84a1a', fg: '#ffffff', accent: '#ffd200', tagline: 'EAT IN OR TAKEAWAY', posters: ['MEAL DEAL £5', 'NOODLES', 'BURGERS'] }],
  [/FRIED CHICKEN/, { bg: '#d8141e', fg: '#ffe600', accent: '#1a1a1a', face: 'heavy', tagline: 'HALAL · OPEN TIL LATE', posters: ['2 PC MEAL £3.49', 'WINGS 6 FOR £3', 'STUDENT DEAL'] }],
  [/KEBAB/, { bg: '#1a3a7a', fg: '#ffffff', accent: '#ffd200', tagline: 'KEBABS · PIZZA · BURGERS', posters: ['DONER £6', 'PIZZA 2 FOR £15', 'OPEN TIL 3AM'] }],
  [/COFFEE/, { bg: '#2a1a12', fg: '#f2e2c4', accent: '#c8a06a', face: 'rounded', lower: true, tagline: 'FRESHLY ROASTED', posters: ['FLAT WHITE £2.80', 'LOYALTY CARD', 'PASTRIES'] }],
  [/CAFE/, { bg: '#2a5a3a', fg: '#ffffff', accent: '#ffd200', tagline: 'BREAKFAST ALL DAY', posters: ['FULL ENGLISH £6', 'TEA 90p', 'SANDWICHES'] }],
  [/NAILS/, { bg: '#e8a0c0', fg: '#3a1a2a', accent: '#3a1a2a', tagline: 'NAILS · LASHES · WAXING', posters: ['GEL £18', 'ACRYLICS £25', 'WALK-INS'] }],
  [/HAIR/, { bg: '#1a1a1a', fg: '#f2d8e0', accent: '#f2d8e0', face: 'script', tagline: 'HAIR & BEAUTY', posters: ['CUT & FINISH £30', 'COLOUR FROM £45', 'BRIDAL'] }],
  [/BOOZE|OFF LICENCE/, { tagline: 'BEERS · WINES · SPIRITS', posters: ['4 CANS £5', '3 FOR £10', 'ICE COLD'] }],
  [/GREEN FINGERS|GARDEN/, { tagline: 'PLANTS · COMPOST · TOOLS', posters: ['BEDDING 3 FOR £10', 'COMPOST', 'SHEDS'] }],
  [/TECH|PHONE/, { tagline: 'PHONES · REPAIRS · ACCESSORIES', posters: ['SCREENS FIXED', 'WE BUY PHONES', 'CASES £5'] }],
  [/FASHION|THREADS/, { tagline: 'NEW SEASON IN STORE', posters: ['UP TO 50% OFF', 'NEW IN', 'DENIM £20'] }],
  [/MOTORS/, { tagline: 'QUALITY USED CARS', posters: ['PART-EX', 'FINANCE', 'MOT INCLUDED'] }],
  [/MOTO/, { tagline: 'SCOOTERS · MOTORBIKES · PARTS', posters: ['CBT TRAINING', 'HELMETS', 'SERVICING'] }],
];

/** Palettes for the independent shops of a kind, so two on one street don't match (picked by name). */
const KIND_PALETTES: [string, string, string][] = [
  ['#1f4f8a', '#ffffff', '#ffd200'], ['#8a1a1a', '#ffffff', '#ffe94a'], ['#1f5a3a', '#ffffff', '#ffd200'], ['#2a2a2e', '#ffd200', '#ffd200'],
  ['#5a2a6a', '#ffffff', '#ffe94a'], ['#e8e4d8', '#1a1a1a', '#c8102e'], ['#0f6a6a', '#ffffff', '#ffe94a'], ['#a04a10', '#ffffff', '#1a1a1a'],
];
const FACES: BrandFace[] = ['heavy', 'condensed', 'serif', 'rounded', 'italic', 'serifItalic'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The brand part of a sign: "B&THC — HYDROPONICS…" is B&THC. */
export const brandName = (label: string): string => label.split(/\s+[—–-]\s+/)[0].trim().toUpperCase();

/** A named business's own brand, if it has one. */
export function ownBrand(label: string): Brand | null {
  return BRANDS[brandName(label)] ?? null;
}

/**
 * How a shop presents itself: its own brand, else its kind's look with a palette, face and posters picked by name
 * (and the keyword look for the common independents: hardware, pound shops, chicken shops, cafés…). `colour` is the
 * level's own colour for the business, which an independent keeps as its fascia.
 */
export function brandFor(label: string, kind: InteriorKind, colour?: string): Brand {
  const own = ownBrand(label);
  if (own) return own;
  const t = label.toUpperCase();
  const h = hash(t);
  const base = KIND[kind];
  const [bg, fg, accent] = KIND_PALETTES[h % KIND_PALETTES.length];
  const traditional = kind === 'pub' || kind === 'jeweller' || kind === 'office' || kind === 'casino';
  const look: Brand = traditional
    ? { ...base }
    : { ...base, bg, fg, accent, face: kind === 'gym' ? 'stencil' : FACES[(h >>> 8) % FACES.length] };
  for (const [re, over] of KEYWORD) if (re.test(t)) {
    Object.assign(look, over);
    break;
  }
  if (colour) {
    look.bg = colour;
    look.fg = readableOn(colour);
  }
  // Rotate the posters so neighbours of one kind don't show the same card first.
  const r = h % Math.max(1, look.posters.length);
  look.posters = [...look.posters.slice(r), ...look.posters.slice(0, r)];
  return look;
}

/** Black or white, whichever reads on `bg`. */
export function readableOn(bg: string): string {
  const n = parseInt(bg.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#111111' : '#ffffff';
}
