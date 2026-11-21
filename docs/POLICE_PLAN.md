# Police plan: the station, arrests, bail and bent cops

Hand-over from Leeko's Claude (20 Nov 2026), for whoever picks this up next. Leeko wants the game to go
this way. Read CLAUDE.md first; this builds on #66 (mugging) and #67 (district heat).

## Status (20 Nov 2026)

**Step 1 is built** (record, custody, bail, the station, the front counter). Numbers used are the plan's
starting points, all in `src/progress/record.ts`, for Leeko to check:

- Bail by worst charge: mugging £150, assault £300, robbery £600, assaulting an officer £1,200; +50% per
  extra charge, +25% per past arrest, +10% of seized goods, capped at £900 + £150 a level. Wanted with no
  record: £100.
- Night in the cells: a court fine of 40% of bail, 4 trips pass, police heat -15 everywhere else.
- Crimes are spent after 60 trips; the record keeps the last 30.
- Front counter, settling a district: £8 per point of its police heat + £60 per severity point on file.

What's built:
- `save.record` (`progress/record.ts`): `Progress.logCrime`, called on a mugging (`World.mug`), an assault
  (the `assault` KO), a shop robbery (`Game.robShop`) and an officer put down (`World`'s `fighter:ko`).
- Getting nicked (`Game`, `player:defeated`): `book()` in `world/custody.ts` seizes stolen goods, reads the
  charges (`chargesFor`), prices bail; the charge sheet (`Game.chargeSheet`) offers Pay bail or Night in the
  cells, then you're in the Central Police Station (entry `door` after bail, `cell` after a night).
- Central Police Station (`police_station` in `world/interiors.ts`): on Market Square at x 25.5 (the old
  bakery frontage, now POLICE), the front counter with Sgt Hollis (`Game.frontDesk`), a map pin (`police`
  marker and icon), a cab stop, and GraftWiki's "Getting nicked" article.
- `tests/police.test.ts`.

**The station is furnished (#78)** from the owner's police sets: holding cells, interview room, custody and
charge desks and the rest. Its door always takes you home.

**Step 2 is built (21 Nov 2026).** The numbers are in `src/progress/cops.ts`, for Leeko to check:

- **Officers:** each district has 6 named officers (`roster`), the same every game, met in turn. Bent: 30% on
  the rough estates (Back Alleys, Kingsway, Canal Docks, Hollins, the Factory, the Industrial Quarter, Dunc's),
  8% in the City Centre, Ashcombe Park and the Riverside Centre, 1 in 6 elsewhere. Every district has at least
  one bent officer.
- **When they turn up** (999 call, alarm, waiting on arrival), the OLD BILL screen (`Game.oldBill`):
  - Offer a bung (`World.bung`): £40 + £2.50 a point of police heat, +50% for each officer past the first.
    - A bent officer takes it: they walk off and the district's police heat drops 30.
    - A straight one refuses: bribery goes on your record, +15 police heat, and they hit 25% harder and take
      15% less.
    - Either way you remember him (`save.police.known`), and the screen says so next time.
  - Come quietly: nicked with no beating.
  - Have it out.
- **In custody:**
  - The desk keeps your phone till you walk out of the station (`save.police.custody`): no cabs and no
    maps, so you can't get out of custody by cab.
  - Sgt Kerrigan has the custody desk 40% of nights (`sargeOnDuty`, fixed per arrest). For half the bail (at
    least £50) he loses the paperwork, and he's your contact after that.
  - Ring for bail: one of your crew pays. You owe them bail +25%, taken from the tin (then your pockets) when
    you get home, and they won't follow you till you're square.
  - Stolen goods go into the property store (`save.police.seized`, the latest haul).
- **Kerrigan as a contact** (phone, Heat app):
  - Cool a district: £5 a point of its police heat, at least £50.
  - Get the seized gear back to your stash, still stolen: 30% of its value, at least £40.
  - He rings ahead when police would be waiting for you: 25 s instead of 6.
  - Each favour has a 6% chance he's caught. Then +25 police heat in every district, and he's gone for good.
- **Painted titles** for the new buttons: Offer a bung, Come quietly, Have it out, Lose the paperwork, Pay bail,
  Ring for bail, Night in the cells, Leave; headings OLD BILL and FRONT COUNTER. Made with
  `tools/icons/hg/kit_from_titles.py` (rebuilds the lettering kit from the existing buttons).
- `tests/police.test.ts` covers it.

**Still to do:**
- Models: an officer's uniform (hi-vis, stab vest) and the station front and blue lamp on Market Square. The
  pack's front is too deep for the street's walking lanes.
- The front counter's "Settle up: <district>" buttons are plain lettering (one per district, with a price).
- A small tell for bent officers before you've tried them (Leeko to decide; for now you only know after).

## What's there already

- **Heat** (`src/progress/heat.ts`, #67): police, locals and gang heat per district, 0–100, cooling each
  trip. `save.heat` is the police reading where you are. Raise heat with `Progress.addHeatOf`, never by
  writing `save.heat`.
- **Police turning up:**
  - When you walk in with police heat of 40 or more, they may be waiting for you (the end of the `World`
    constructor).
  - A 999 call after a mugging (`World.mug`, `policeCallChance`).
  - The shop alarm after a robbery (`World.raiseAlarm`).
  - Officers are the `police` archetype (`src/ai/archetypes.ts`): one kind, all the same, no names.
- **Getting nicked** (`Game.ts`, `ev.on('player:defeated')`):
  - Triggers when the police put you down, or you lose any fight at `ARREST_HEAT` (60) or more.
  - `arrest()` in `src/world/robbery.ts` takes your stolen goods and a fine (`arrestFine`: 15% of the cash
    on you plus 5% of the tin, at least £25, capped by level), then wipes that district's police heat.
  - Then the NICKED screen and you walk home. There's no station, no charge and no choice.
  - The NICKED screen still says "Your heat is back to nothing". Since #67 that's only true of the district
    you were nicked in.
- **Crimes that exist:**
  - robbing Threads, the pawn shop or the pub (`robShop`);
  - mugging a passer-by (`World.mug`);
  - assault (putting down a mugging victim or a have-a-go hero, the `assault` event).
- **Nothing records which crimes you've done.** Only heat and `save.stats.robberies` / `arrests`.
- **Pawn shop:** one, Pawn & Gold, in the City Centre (`levels.ts` exit `pawn_door` to area `pawn_shop`, shop
  id `pawn`). Its prices come from `pawnOffer` in `src/items/shops.ts`: 55% of value for valuables and
  collectibles, 60% for misc, 35% for everything else, then ×0.6 if stolen. It can be robbed (`ROBBABLE.pawn`).

## What Leeko asked for

1. **A police station** you can see and go into.
2. **Getting arrested** properly: taken to the station, booked, held.
3. **Bail** to get out, priced by how serious the crime was.
4. **Good cops and bent cops:** some officers can be paid off, most can't.
5. **A pawn shop in the first district** (the High Street), giving the worst rates in the game per item, so
   the City Centre's Pawn & Gold is worth the trip.

## Suggested design (check the numbers with Leeko before building)

### A record of what you've done

- Add `save.record`: a list of `{ crime, district, trips }`, kept short (about the last 30), plus counts
  by crime.
- Crimes:

  | Crime | Severity |
  |---|---|
  | `mugging` | 1 |
  | `assault` | 2 |
  | `robbery` | 3 |
  | `assault_police` (putting an officer down) | 4 |
  | `bribery` (offering a straight cop money) | 2 |

- Log one wherever heat is already added: `World.mug`, the `assault` KO, `robShop`, and a police KO in
  `World`'s `fighter:ko` handler.
- Spent crimes drop off as they age (by trips), like heat does.

### Arrest flow

- **Defeated by police or wanted:** don't walk home. Wake up in a custody cell at the station: a new deep room,
  `world/rooms.ts` `deepRoom`.
- **The charge sheet** is a panel in the game's style:
  - what they've got you for (the record entries from the district you were nicked in, or the worst recent ones);
  - stolen goods seized (as now);
  - the bail price.
- **Choices:**
  - **Pay bail** from the cash on you and the tin. You walk out of the station's front door into its street.
  - **Ring someone** (a crew member, see `companions/`). They pay, and you owe them, or it costs loyalty.
  - **Night in the cells.** No bail. Time passes (several trips, needs drop) and a smaller court fine is taken
    later. Police heat in that district goes to zero, plus some everywhere.
- **Bail price, a starting point:**
  - The worst crime on the sheet sets the base: £150 / £300 / £600 / £1,200 for severity 1–4.
  - +50% for each other crime on the sheet.
  - ×(1 + 0.25 × past arrests).
  - +10% of what the seized goods were worth.
  - Capped by level, like `arrestFine`.
  - Add it to `docs/ECONOMY.md` and run `npx tsx tools/economy/model.ts`, so bail stays painful but payable at
    each stage.

### Good cops and bent cops

- Give each officer a name and a nature when they spawn (`World.updatePolice`):
  - **Straight** (most).
  - **Bent:** about 1 in 6, more in rough districts (Back Alleys, Kingsway, Docks), fewer in the City Centre.
- You can't tell which is which at a glance. A small tell could show after you've met them (Leeko to decide).
- **Before it's a fight:** when officers turn up (999 call, waiting on arrival), you get a moment to "Have a
  word". Offer a bung (a price shown).
  - **Bent:** the bung is accepted. They walk off and some police heat drops. Your locals heat doesn't change.
  - **Straight:** refused. Bribery goes on your record, +police heat, and the fight starts angrier.
- **In custody:** a bent desk sergeant can lose the paperwork for cash. That's cheaper than bail, but they
  remember you. Later they're a contact who can, for a price:
  - tip you off when heat's coming;
  - lower a district's police heat;
  - get seized goods back.
  - Risk: now and then one gets caught, and that's a big police heat spike everywhere.
- Keep fights fair: a bent cop still fights like a cop if it comes to that.

### The police station

- **Where:** a building on the City Centre street (an exit like `pawn_door`, probably at an unused frontage in
  `levels.ts`). Inside, a deep room:
  - front desk, waiting benches, noticeboard;
  - through a locked door, the custody desk and cells.
- **Approved models:** check `src/render/approved/` and the asset sheet before building props from boxes.
  Rows needed (add them to `docs/ASSETS_NEEDED.*` if they're missing):
  - police officer uniform (hi-vis, stab vest);
  - station front and blue lamp;
  - custody desk;
  - cell door and bench.
- **Front desk (out of custody):** see your record and pay off old fines early (clears that district's police
  heat for money). A bent sergeant there is where the paperwork deals happen.
- **Map:** a pin, a Maps entry, a cab stop, and a GraftWiki article (`ui/phone/wikiApp.ts`, add a `police`
  page). The Heat app (`Phone.heat()`) can link to it.

### High Street pawn shop

- **Where:** a second pawnbroker on the High Street, the first district, with a scruffy name like "Cash 4 U"
  or "QuickCash".
  - It needs a shop id, an exit door, an interior (copy the `pawn_shop` area and its stations), and a sign so
    `layoutFor` in `city/street.ts` stocks its window as a pawn shop.
- **Rates:** give `pawnOffer` a per-shop rate (for example a `PAWN_RATE` map: `pawn` 1.0, the High Street one
  about 0.6), so it pays the worst in the game per item.
  - The bag's "Where to sell it" button (`inventoryUI.ts`) should name both shops.
  - The shop panel should make the difference clear, e.g. "Pawn & Gold in the City Centre pays more".
- **Robbing it:** decide with Leeko whether it can be robbed like Pawn & Gold.
- **Tests:** in `tests/economy.test.ts` or `tests/stage5.test.ts`, check it pays less than Pawn & Gold for
  every item, and still something.

## Ground rules (from CLAUDE.md)

- Branch and PR into `dev`. Merge only when the person you're working for says "merge".
- Run `npm run typecheck` and `npm test`.
- Check UI at 390×700 (Leeko plays on an iPhone held upright) and 844×390.
- New `menuButton`s need a painted title (`tools/titles/gen.py`, `TITLE_SLUGS`).
- Put new styling in `theme.css`.
- Add a CLAUDE.md work-log line when the PR is merged.
- Talk to the player in plain words in the game's voice, like the mugging and pussy-out toasts.
