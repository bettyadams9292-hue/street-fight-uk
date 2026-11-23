# The economy

How money is meant to flow through Street Fight UK, and the targets the numbers are held to. Run `npx tsx tools/economy/model.ts` for the full report after changing any price or reward. `tests/economy.test.ts` fails if a change breaks a target.

## The shape of the game

| Stage | Where the money comes from | What it's for | Target |
| --- | --- | --- | --- |
| Story (estate to Hale House) | Fights, boss purses, boss loot | Training, your first styles, food and kit | £20k–£40k in total; covers training at least 1.2 times over |
| Towns 1–6 | Bigger fights and purses, stashes | The rest of your styles, a car, the grow business | £50k–£90k; the full business is affordable by the end |
| After the towns | The business, then rent | Property, cars, jewellery | First mansion in 20–40 hours; every property in 40–70 |

Today's model (19 Nov 2026) gives about £28k for the story and £66k for the towns. The first mansion comes about 28 hours after the towns, and every property about 51 hours after.

## Rules the numbers follow

- **Bosses pay mostly in cash.** Every purse is at least 90% of what its drops would sell for. The victory screen says what the loot is worth.
- **Jewellery lives in the jewellery box.** Watches, chains and rings found as loot or dropped by bosses are real pieces from Halden & Crane's range (`JEWEL_ITEMS` in `src/items/jewellery.ts`). They go straight in the box, can be worn, and sell back at 45%, the same as bought pieces. Their item value equals the piece's price. Stolen jewellery stays in your pockets as hot goods for the pawn shop. Threads sells no jewellery.
- **The grow business pays back within 8 hours** at every size. `UNIT_VALUE` is £14 a unit.
- **Rent pays back in 11–17 hours.** A letting month is ten minutes of play, so yields (`YIELD` in `src/realty/catalogue.ts`) are 1.0–1.5% a month: well above real yields, on purpose.
- **House prices settle rather than compound.** Each tier drifts up towards a long-run level, from +15% (budget) to +38% (exclusive), over a few hundred months. On top of that there's a wobble that pulls back to the trend, kept within 0.75–1.8 times the starting price. Unchecked compounding used to double mansion prices in 30 hours, so saving for one was a moving target.
- **Mansions cost £650k–£1.25m** and the penthouse £480k. That's what a gated house costs in a northern town, and it's reachable on the income above.
- **Medicine is the fighter's heal; food is for hunger.** Food heals about 0.6 health per point of hunger it fills, and you can't eat at hunger 95 or more. Plasters (£3, +35, treats bruising) and first aid (£10, 60%, treats your worst injury) work whenever, and heal more per pound than any food.
- **Being nicked costs, but it can't ruin you.** The fine is 15% of the cash on you plus 5% of the bank, at least £25. It's capped at £500 + £100 a level, and never more than you have.
- **The casino is a place to spend money, never to make it.** Every game pays back less than it takes (`tests/economy.test.ts` works out each one). Slots return about 81%, roulette 97%, the prize draw about 78%, and the motor competition 75% (`HOUSE_RETURN`): its odds are set by the prize's value, so the Phantom is 1 in about 4,900.
- **Jobs pay like a few fights, for the trip.** An ordinary job pays about £70–£150 at level 1 (sort someone out £70 + £9 a level, getting something back £80, a delivery £50; a debt pays 30% of what's owed plus £20; a deal buys at £90 + £15 a level and sells at 1.55–1.8 times that), times 1.3 per point of a town's threat, times your standing with the contact (1, 1.15, 1.3, 1.5). A contact's own chain jobs pay 2–3 times as much and give an item. One job at a time and a walk or cab each way keep it below farming fights.
- **Only your biggest bag counts.** Shops won't sell you a bag no bigger than one you already own.

## Where the numbers live

| What | File |
| --- | --- |
| Boss purses and drops | `src/ai/bosses.ts` (story), `src/world/towns.ts` (towns) |
| Encounter rewards, stashes | `src/world/levels.ts`, `src/world/districts.ts`, `src/world/towns.ts` |
| Grunt cash drops | `cashDrop` in `src/ai/archetypes.ts`; loot tables in `src/items/loot.ts` |
| Item values, food and medicine | `src/items/items.ts`; shop stock and pawn rates in `src/items/shops.ts`; bar menu in `src/ui/hub.ts` |
| Jewellery | `src/items/jewellery.ts`, `src/items/jewelleryBox.ts` |
| Training, styles, techniques | `src/progress/catalogue.ts`, `src/training/styleGyms.ts` |
| Business | `src/business/catalogue.ts`, `src/business/production.ts` |
| Property market and rent | `src/realty/catalogue.ts`, `src/realty/portfolio.ts` |
| Fines | `arrestFine` in `src/world/robbery.ts` |
| Bail, court fines, settling up at the front counter | `src/progress/record.ts` |
| Bungs, Kerrigan's paperwork and favours, what you owe crew who bail you out | `src/progress/cops.ts` |
| Casino | `src/property/casino.ts` |
| Clothes tiers and stats, outfit buffs, jewellery XP bonus | `src/items/gearBonus.ts` (`XP_BONUS_CAP` 30%) |
| Jobs: pay, heat, standing, boards and chains | `jobPay`, `jobHeat`, `TIERS` in `src/jobs/jobs.ts`; chains in `src/jobs/contacts.ts` |
