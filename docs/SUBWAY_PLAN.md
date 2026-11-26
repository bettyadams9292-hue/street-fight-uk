# The Brack Metro: the subway as a way to get about

Leeko's direction (26 Nov 2026): the subway becomes transport. You go underground, pay at the barriers or hop
them, wait on the platform, ride to another station, and come up somewhere else in town. Underground has its own
scraps: on the platform while you wait, and in the carriage on the way.

The groundwork is in: `src/travel/subway.ts` (the line, stations, fares, hopping the barriers, scrap odds) and
`tests/subway.test.ts`. Nothing in the game uses it yet. This plan says what each step wires in.

## The line

One line, west to east, seven stations (`STATIONS`):

| Station | Street (`area`, x) | Zone | Opens |
|---|---|---|---|
| Tanner Road | Tanner Road Estate (`estate`, 33.9: the existing stairwell down) | 2 | from the start |
| High Street | The High Street (`high_street`, 40) | 1 | from the start |
| Market Square | Market Square (`city`, 40) | 1 | the Gaffer |
| Canal Docks | Canal Docks (`docks`, 30) | 2 | the Gaffer |
| Riverside | Riverside Shopping Centre (`mall`, 12) | 2 | Sully |
| Neon Mile | The Neon Mile (`nightlife`, 60) | 3 | the Ratcatcher |
| Deep Line | Deep Line (`underground`, 44): the old disused station, reopened | 3 | Big Dunc |

The Ring Road Subway (`subway`) stays the pedestrian underpass it is now; Tanner Road station's stairs are the
same stairwell, with the ticket hall off the underpass.

## Numbers (all in `src/travel/subway.ts`, for Leeko to check)

- **Fare:** £2.40 plus 90p a zone crossed (`fare`): £2.40–£4.20, always under a cab's £5 minimum.
- **Hopping the barriers** (`hopCaught`): caught 10% (zone 3) to 22% (zone 1) of the time, +7% per fare dodged on
  your record (up to +35%), +10% if the police are warming to you here and +25% if you're wanted; never more
  than 80%. Caught: a £50 penalty fare, +6 police heat where you are, and `fare_evasion` on your record
  (`HOP_CAUGHT`).
- **Waiting** (`waitSeconds`): 8–30 s by day, 20–60 s at night.
- **Riding** (`rideSeconds`): about 20 s a station, shown as a fade with the line map.
- **Scraps** (`platformScrap`, `carriageScrap`): none on your first ride (platform) or two (carriage); then
  6–16% on the platform by zone, +8% at night, + gang heat ÷ 400 (at most 60%); in the carriage 4% a stop,
  +8% at night (at most 45%).

## Steps

1. **Stations on the streets.** A gap in the frontage at each station's x for the stairs down (as the estate's
   stairwell: `isSubwayStairs` / `SUBWAY_GAP` in `world/strip.ts`, `LevelView.subwayEntrance`), a roundel sign
   on a post, an `exit` of kind `door` to the station's concourse. Map pins (a new `metro` marker kind) and a
   Metro layer chip in Maps.
2. **The concourse** (one interior, dressed per station: `station_<id>` in `world/interiors.ts`): ticket machines,
   a line map on the wall, the gate line with a member of staff, CCTV (the security set). USE at the barriers
   opens the gate screen: **Tap in** (pay `fare` to the station you pick) or **Hop the barrier** (an animation over
   the gate; roll `hopCaught`: caught is a short chase or a stop by staff or a BTP officer, then `HOP_CAUGHT`).
3. **The platform** (an interior: tiled walls, the platform edge, benches, the tunnel mouths, a dot-matrix
   departure board counting down `waitSeconds`). Roll `platformScrap` on arrival; a scrap is an encounter on the
   platform (`EncounterDef`, archetypes by district). The train comes in, doors open, USE to board.
4. **The ride.** Fade to a carriage interior with the line map lighting up station by station (`rideSeconds`).
   Roll `carriageScrap`: a fight in the carriage (a narrow strip with poles and seats), and the train stops at
   the next station so it has room. Arrive and you're on that station's platform; up the stairs to its street.
5. **Fare dodging on your record.** A `fare_evasion` charge in `progress/record.ts` (bail and court as a minor
   offence) and in GraftWiki's Getting nicked.
6. **Tutorial and wiki.** A `metro` hint the first time you're at a station, a GraftWiki article (fares, hopping,
   the line map), and the Metro in the phone's Maps card as a travel option (`travelOptions`: "Metro £2.40 ·
   from High Street", next to Run there, Drive and the cab).
7. **Economy.** Add fares to `tools/economy/model.ts`; `tests/economy.test.ts` should keep the Metro cheaper
   than cabs and the penalty fare a real deterrent.

## Assets needed

Rows are in `docs/ASSETS_NEEDED.*` (Area "Metro"):
- station entrance: stairs down with railings and a roundel on a post;
- ticket hall: ticket machine, gate line (paddle barriers that open), staff booth;
- platform: tiled wall panels, platform edge with the yellow line, benches, a dot-matrix departure board,
  tunnel mouths;
- a train: the outside of a carriage (doors that slide), and the inside (seats, poles, grab handles, the
  line map strip);
- a BTP officer and a revenue inspector look;
- sounds: barrier beep, gate, train arriving and leaving, doors, "mind the gap", carriage rumble.
