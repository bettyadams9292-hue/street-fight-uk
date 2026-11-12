# Gameplay plan: why fights feel off, and the fixes in stages

This plan comes from an audit on 12 Nov 2026. Bot players fought every area. The audit counted what every fighter spends its time doing and compared a careful bot with a sloppy one. Run the numbers again with:

    npx tsx tests/balance.ts        # win rate, fight length and health left per area
    npx tsx tools/fight_audit.ts estate 1   # time breakdown, parries, blocks, attackers

Each stage lists the problem, the fix, and the measurement that shows whether it worked.

## Stage 1: enemy defence you can read ✅ done
**Problem:** In the City area, enemies parried about 30% of the player's attacks but blocked less than 1% of the time. A parry was a random roll with no warning. It stopped combos dead and left the player open to a counter.
**Fix:**
- Enemies block much more. You can see a block and get through it with throws, heavy hits, guard breaks and stamina drain.
- Enemies parry only slow, readable attacks: heavies, specials and any move with a startup of 8 frames or more.
- No enemy parries the next hit of a combo that is already landing.
- Before an enemy parries, its guard visibly comes up early. This is the tell, and a good player can wait it out or grab.
**Target:** enemies parry under 8% of player attacks, and enemies block at least ten times as often as they parry.
**Root cause found:** the AI only reacts a few frames before a hit lands, and any block pressed that late opened the parry window, so nearly every block an enemy meant to make came out as a perfect parry. Enemy blocks are now plain guards (`CommandFrame.guard`). Only a deliberate parry press can parry. The player's own rule hasn't changed: a block pressed just in time still parries.
**Result (City fight):** enemy parries fell from 29% to 1% of player attacks, and enemy blocks rose from 4% to 21%. Every parry now comes with a glint and a scrape at least 8 frames (about 0.13 s) before impact (`fighter:tell`).

## Stage 2: skill pays ✅ done
**Problem:** A sloppy, mashing bot won as often as a careful one, and sometimes more (pub door 92% vs 58%, precinct boss 67% vs 42%).
**Fix:**
- Waiting enemies punish whiffs and mashing: an attack that misses close by gets punished.
- Blocking and punishing pays: a blocked heavy leaves the attacker open long enough to get a full combo in.
- Enemies bait whiffs by stepping just out of range.
**Target:** the careful bot wins clearly more than the sloppy one in almost every area.
**What changed:**
- Enemies punish missed swings and blocked heavies. They step in if they need to. The chance depends on training and reaction speed, and is capped at 70%.
- Each hit after the third in a combo stuns a little less, down to 60% (`comboStun`), so nobody can be locked down forever. This works both ways.
- An enemy coming out of a beating covers up.
- Punishes use the fighter's own style, so a kickboxer punishes with a kick.

**Result:**
- Against untrained thugs in the opening areas, mashing still works. That's deliberate.
- Against trained enemies it doesn't. City: careful bot 7/12 wins, masher 2/12. Nightlife: careful 7/12, masher 1/12.
- The test bots' "careful" and "casual" profiles differ only a little, so their win-rate gap stays small (+4 points). Use `tools/fight_audit.ts ... masher` for the clear comparison.

## Stage 3: crowds that feel alive ✅ done
**Problem:** In the first fight, enemies stood still 56% of the time, and for about 80% of the fight nobody was attacking. Group fights felt like a queue.
**Fix:**
- Waiting enemies circle and flank, shuffle in and out of range, feint, and shout or gesture.
- Now and then a second enemy jumps in from behind while you're busy, but never so often that it's unfair.
**Target:** enemies idle under 25% of the time, and someone threatens the player for a much bigger share of the fight, without pushing the careful bot's win rate down.
**Root cause found:** the time spent idle wasn't the waiting enemies. It was the two allowed to attack, standing flat-footed in front of the player for 1.5–3 seconds between swings. Untrained thugs had no footwork at all.
**What changed:**
- Every engaged fighter has footwork. Trained ones bounce on small, quick steps; brawlers sway; grapplers stalk forward. They circle a little too.
- The gap between attacks is shorter.
- Waiting enemies hold a spot round the player. About a third work round to the far side, swinging wide instead of walking through you. They drift, shuffle and feint.
- Enemies shout taunts in speech bubbles, rationed so a crowd doesn't chatter. They also shout when you're knocked down.
- When you're laying into someone with your back or side to a waiting enemy, it can shout "Oi!" and jump in. This happens at most once every 4 seconds per target, with a beat between the shout and the swing (`AttackTokens.jumpIn`).

**Result:**
- Enemies idle: first fight 56% → 28%, alleys 38% → 16%, City 32% → 24%.
- Two enemies attack at once only 2–4% of the time, so it doesn't become a pile-on.
- Fights average 82 seconds instead of 95.

## Stage 4: fight length and difficulty curve
**Problem:**
- Fights take 65–160 seconds; 20–45 seconds feels best for a brawler.
- Win rates jump around: industrial yard sits at 25–42% straight after areas at 80% or more.
- Health only regenerates back to 50% between fights, so damage carries over from one fight into the next.

**Fix:** tune enemy health and damage per area so the curve rises smoothly. Add something to heal with between fights, such as food or a rest spot.

## Stage 5: running
**Problem:** Walk speed is 2.6 m/s, and about 40% of every fight is spent walking. Crossing the long street is slow.
**Fix:** add a sprint, mainly for getting about outside fights, plus a short dash in fights.

## Stage 6: sound
**Problem:** Hit sounds are generated on the fly, and the code marks them as temporary.
**Fix:** use recorded impacts, whooshes, grunts, crowd noise and street ambience.

## Stage 7: animations that match
**Problem:** Jabs, crosses and front kicks are motion capture. Hooks, uppercuts, knees, elbows and roundhouses are hand-made and look stiffer.
**Fix:** find more mocap for those moves, or rework the hand-made ones to the same standard.

## Log
- 12 Nov 2026: audit done; stages 1–3 started on branch `gameplay-feel`.
- 12 Nov 2026 (later): stages 1–3 done, with tests in `tests/gameplay.test.ts`. Across the whole game, the careful bot's average win rate went from 70% to 78% and the sloppy bot's from 64% to 75%. Enemies no longer get free parries, while players still can, so the game got a little easier overall. Stage 4 should retune the curve from these numbers.
