# Fight balance

How hard each fight is meant to be, and how it measures today. `npx tsx tests/balance.ts` runs the report. A bot plays every main fight and boss many times, at the level, upgrades and style a player would roughly have by then (`CHECKPOINTS` in `tests/balance.ts`). "Decent" blocks and reads attacks; "casual" mostly swings. The bot never eats or uses medicine, so real players do better than these numbers.

## Targets

| Fight | Decent wins | Casual wins | Length |
| --- | --- | --- | --- |
| The first fight (estate lads, with the coach) | 95% or more | 95% or more | Under 40 s |
| Ordinary fights | 80% or more | 70% or more | Under 90 s (the last area, Hale House, up to 120 s) |
| Bosses | 65–100% | 55% or more | Under 100 s |

`RUNS=36 npx tsx tests/balance.ts` gives about ±8% on a win rate; use `RUNS=48 npx tsx tests/balance.ts <fight id>` to check one fight. `WHY=1` lists what did the damage.

## Today (19 Nov 2026, 36 runs each)

Every fight meets its target except these, which are a little under:
- Underground platform casual 72%, and the Hale House courtyard 72% decent and 67% casual. They're the last two areas, so they're meant to be hard.
- The Hale House gate takes about 118 s.

The Estate King is easy: both bots win every time in about 30 s. He's an early boss off the Hollins estate, so that's left as it is.

## Changes made to reach the targets

- The harness walks the bot in until each fight starts. Before, it could drift back out of the trigger, and that counted as a 240 s loss at full health. This made the Estate King look like a 25% loss rate, and other fights looked harder than they were.
- The first fight is one lad, then two (it was two, then two). The coach teaches the buttons during it.
- Silas Crane goes for fewer submissions (grab chance 0.3 → 0.15) and reacts a little slower. Submissions did most of the damage in his losses.
- Kasia Nowak: only the wrench phase brings help, and it's a hooded lad rather than an enforcer.
- Simone Achebe has 100 bonus health (was 115). Victor Hale has 140 (was 170). The Estate King has 120 (was 60) and is a little more aggressive.
- Car park level 3 and the Hale House gate each lost one enemy.

## Repeat fights (farming)

Optional fights come back on every visit and pay half their reward. `npx tsx tools/economy/farming.ts` works out what farming one is worth per hour, allowing 20 s to walk back in. Through the story and districts the best is about £3,700 an hour (car park roof), and most pay £1,000–£3,500. That's about what the mid-size grow room makes, and far below the full one (£18,000 an hour), so fighting pays its way in the middle of the game and the business takes over later. No fight can be farmed faster than that.
