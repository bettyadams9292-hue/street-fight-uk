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

## Stage 4: fight length and difficulty curve ✅ done
**Problem:**
- Fights take 65–160 seconds; 20–45 seconds feels best for a brawler.
- Win rates jump around: industrial yard sits at 25–42% straight after areas at 80% or more.
- Health only regenerates back to 50% between fights, so damage carries over from one fight into the next.

**Fix:** tune enemy health and damage per area so the curve rises smoothly. Add something to heal with between fights, such as food or a rest spot.
**What changed:**
- Enemies in main fights take more damage: about 30% less effective health for ordinary enemies, 17% less for bosses.
- Every main fight has its own strength dial (`src/world/fightTuning.ts`). `tools/tune_fights.ts` sets the dials by playing each fight with the bots and searching for the strength that puts the win rate on the curve. The curve starts at 95% and eases down to 75% by the last area, with each boss 12 points below its area. Re-run the tool after any change to combat or enemies.
- Second wind: winning a main fight brings you back up to at least half health.
- Resting out of a fight now regenerates you up to 70% of your health, up from 50%.

**Result:**
- Win rates sit 5 points off the curve on average, down from 16. The worst miss is 15 points, down from 58.
- Normal fights average 71 s, down from 88 s; the longest is 120 s, down from 153 s.
- Bosses average 79 s, down from 89 s.
- Main fights are two waves, so they are still longer than a single brawl. Raise `ENEMY_DAMAGE_TAKEN` and re-run the tuner to shorten them further.

## Stage 5: running ✅ done
**Problem:** Walk speed is 2.6 m/s, and about 40% of every fight is spent walking. Crossing the long street is slow.
**Fix:** add a sprint, mainly for getting about outside fights, plus a short dash in fights.
**What changed:**
- There's a sprint at 2.1× walking pace. To start it:
  - keyboard: double-tap a direction and hold it;
  - D-pad: double-tap;
  - analogue stick: push it right to the edge for a moment. A touch stick needs a fuller, longer push, so walking doesn't turn into sprinting by accident.
- Sprinting is free when getting about. In a fight it costs stamina, and an empty tank stops it.
- The fighter turns to face the way they're running, drops the fight stance and uses the captured run cycle.
- Enemies sprint in from a distance.
- The short dash in fights already existed: dodge plus forward.

## Stage 6: sound ✅ done
**Problem:** Hit sounds are generated on the fly, and the code marks them as temporary.
**Fix:** use recorded impacts, whooshes, grunts, crowd noise and street ambience.
**What changed:**
- 39 recorded sounds from Kenney's public-domain (CC0) packs (`public/audio/`, credits in `public/audio/CREDITS.md`): punches at two weights, body hits and falls, concrete footsteps, clothing rustle on swings, glass and metal smashes, coins and doors.
- They're converted to MP3 so they play on iPhones and iPads, with leading silence trimmed and levels evened out.
- Each play picks a different take from last time and nudges the pitch and level. Heavy hits layer a body thud and a little synthesised low end.
- Everything falls back to the synthesised sound if a file hasn't loaded.

**Still synthesised:** whooshes, the parry tell and street ambience. There are no grunts or crowd noise yet, because there's no good public-domain set of voices. Better none than bad ones.

## Stage 7: animations that match ✅ done (for now)
**Problem:** Jabs, crosses and front kicks are motion capture. Hooks, uppercuts, knees, elbows and roundhouses are hand-made and look stiffer.
**Fix:** find more mocap for those moves, or rework the hand-made ones to the same standard.
**What was checked:** every fight take in the Rokoko pack was scanned for hooks, uppercuts, elbows and knees, by elbow angle, hand path and knee height. The candidates were drawn on pose sheets. They turned out to be jabs, flailing or gorilla chest-beats, so none were good enough to use.
**What changed:**
- Hand-made strikes now move as a kinetic chain (`lerpPoseChain`): the hips turn first, the trunk and shoulders follow, and the elbow or knee whips out last, all arriving on the impact frame.
- The roundhouse now chambers the knee before the leg snaps out.
- `tools/move_sheet.ts` draws any move by id in a real exchange, for checking animation work.

**Next:** proper captures of hooks, uppercuts, knees, elbows and round kicks would close the gap for good. Drop them in as FBX files and cut them with `tools/rokoko/convert.py`.

## Stage 8: game feel ✅ done
**Problem:** the basics were there (hit freeze, sparks, camera shake, damage numbers, a combo counter), but the big moments didn't land, getting hit didn't feel like anything, enemies' big shots were hard to read in time, and "CLEAN HIT" filled the screen.
**What changed:**
- **Slow motion on the final blow.** The hit that wins a fight plays at about a fifth of normal speed for three-quarters of a second, while the camera pushes in on it. Losing gets a shorter, gentler version. Fights and animation slow down; the HUD keeps real time.
- **Camera punch-in** on counters, heavy clean hits and finishers. It snaps in and springs straight back out, and follows the screen-shake setting.
- **Feeling your hits taken.** The screen's edges flash red, harder for bigger hits. They pulse slowly when you're below a quarter of your health. Gamepads rumble, both when you're hit and lightly when you land hits.
- **Danger flash.** When an enemy loads up a big, slow attack at you (startup of 11 frames or more), a red flash appears on the fist or foot with a low swell, in time to block, dodge or step out. Quick shots get none; reading those is down to you.
- **Weightier light hits.** Every landed hit freezes at least 4 frames. Both fighters freeze together, so frame advantage doesn't change.
- **Quieter screen.** "CLEAN HIT" shows at most once every 3 seconds.
- Boxers roll up off the floor instead of doing a get-up kick, so they really never kick.

**Measuring skill properly:** the old "masher" test bot was capped by the AI's attack timer at about one attack a second. It now hammers an attack every few frames whenever an enemy is in reach, like a person mashing. Pooled over seven areas:
- **Careful:** 70% of fights won, 40% health left.
- **Masher:** 52% won, 30% health left. It's out of stamina 13% of the time.

`tests/gameplay.test.ts` holds this gap.

## Stage 9: low-poly furniture ✅ done
**Problem:** the walk-in shops, pubs and cafés and the furniture you buy for your place were built from boxes in code, while the street outside uses proper low-poly kits.
**Sources checked:** the full Kenney Furniture Kit (140 pieces), Kenney's mini-market, mini-arcade and survival packs, Quaternius's house interior pack and the Polyfork kits the city already uses. They were compared on rendered contact sheets (`tools/glbsheet.py`, which draws .glb files and the packed Polyfork kit flat-shaded, no browser needed).
- The mini packs are chunky and toy-like; they'd clash with the city.
- Quaternius's set is darker and more realistic; it would clash with the Kenney furniture already in the flat.
**What changed:**
- **Furniture you buy:** 32 of the 45 catalogue pieces are now Kenney Furniture Kit models (`src/render/props/homeFurniture.ts`), matching the flat's existing furniture. That covers sofas, armchairs, beds, wardrobes, drawers, bedsides, desks, dining sets, the whole kitchen, the washer, bathroom storage, rugs, lamps and plants. 16 more kit models were added (CC0).
  - Each is fitted inside its catalogue footprint, keeping its proportions.
  - Your colour shows on the fabric, or as a wood or paint finish: wood tones keep the grain, while whites and blacks become satin paint.
  - Worktops and wall cupboards are built from units side by side.
  - Wall pieces hang at their mounting height.
- **Shops, pubs and cafés:** counters, the till, shelving (stocked), glass counters (watches and rings inside), the bar front, pub tables, the jukebox and drinks fridges now use the Polyfork pieces the street's shop windows use, so inside matches outside. The pub's fruit machine now uses the casino's slot-machine cabinet.
- Every piece falls back to its built-in model until the kits load. `tests/furniture.test.ts` checks every model the game asks for exists.

**Left as they are:** wall art, mirrors, the neon sign, the laundry basket and the floor vase (no good kit model). Basement grow kit, roulette and blackjack tables, the casino cage, mannequins and clothes rails (no matching models).

## Stage 10: gym furniture ✅ done
**Source:** the LowPoly Gym Assets pack by Matrixxy (CC BY 4.0, supplied by you), split into separate models by `tools/models/split_gym_pack.py`: dumbbell rack, flat and incline benches, barbell, plate stacks, three dumbbells, punch bag and mat.
**Made to match** (same palette and style, `tools/models/gym.py`): treadmill, exercise bike, speed ball, squat rack holding the pack's barbell, and the glove rack.
**What changed:**
- Iron Temple's display kit (dumbbells, barbell, treadmill, bike, bag, mat, speed ball) uses the new models (`src/render/props/GymLibrary.ts`).
- The fighting gyms use them for the heavy bags, glove rack and bench.
- New dressing: plate stacks, loose dumbbells and an incline bench. Small pieces don't block the way.
- Credits in `public/models/gym/CREDITS.md`; `tests/furniture.test.ts` checks every model and placement.

## Log
- 12 Nov 2026: audit done; stages 1–3 started on branch `gameplay-feel`.
- 12 Nov 2026 (later): stages 1–3 done, with tests in `tests/gameplay.test.ts`. Across the whole game, the careful bot's average win rate went from 70% to 78% and the sloppy bot's from 64% to 75%. Enemies no longer get free parries, while players still can, so the game got a little easier overall. Stage 4 should retune the curve from these numbers.
- 12 Nov 2026 (night): stages 4–7 done on branch `gameplay-stages-4-7`. Final balance: careful bot 82%, sloppy 75%, all fights within 15 points of the curve.
- 13 Nov 2026: stage 8 (game feel) done on branch `game-feel`.
- 13 Nov 2026: stage 9 (low-poly furniture) done on branch `low-poly-furniture`.
- 13 Nov 2026: stage 10 (gym furniture) done; shop furniture next.
