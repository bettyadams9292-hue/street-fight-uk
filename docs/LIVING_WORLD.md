# Hard Graft: Living World Overhaul

Leeko's brief (28 Nov 2026) turns the game from one long road into a connected British town. He chose:

- **The world's shape:** keep the main road and add side streets. The long street stays as the town's main road, walked without a stop and streamed as before. Side streets leave it at junctions and come back onto it somewhere else.
- **Delivery:** one PR per stage (A to F), each tested and merged before the next starts.

This file is the audit, the plan and the checklist. Each line is marked **done**, **partial**, **not started**, **blocked** or **device** (needs a real phone or iPad to confirm).

## Audit: what the town is made of (28 Nov 2026)

| | Count | Where |
|---|---|---|
| Areas in all | 75 | `progress/Progress.ts` `AREA_IDS` |
| Main road, hand-built districts | 20 (20 district names) | `world/strip.ts` `STRIP`, `world/levels.ts`, `world/districts.ts` |
| Main road, generated towns east of Hale House | 24 (6 towns × 4) | `world/towns.ts` |
| Side streets | 2 (new in Stage A) | `world/sideStreets.ts` |
| Metro stations | 7 | `world/metroLevels.ts`, `travel/` |
| Interiors you walk into | 22 (shops, gyms, pub, casino, police, home, basement, properties, Ashcombe Park) | `world/interiors.ts`, `realty/`, `property/` |
| Hidden stashes | 23 | `pickups` of kind `secret` |
| Optional fights | 32 | `encounters` with `optional` |
| Things to search | 117 | `containers` |
| Jobs | 5 contacts, boards, chains, street jobs | `src/jobs/` |
| Day and night | none: the club's "night" is a 600 s play-time count; there's no clock | `fightclub/club.ts` |
| Opening hours | none (shops shut only after a robbery) | `Progress.isShopOpen` |
| NPC routines | passers-by, stair-goers and regulars; no schedules | `world/civilians.ts`, `World` |

Systems that are already there and are reused, not rebuilt:

- **The world graph** is the levels' exits. The map's router (`map/worldMap.ts` `route`, `nextExit`, `unlocked`, `lockReason`) searches it, Run there follows it, and the locks are on the exits (`requires`, `lockedText`).
- **Saves** use stable ids for every place (`save.area`, `save.visited`).
- **Streaming** of the main road is `GameRenderer.streamNeighbours`, with the background scheduler (`performance/scheduler.ts`).
- **The map** is a drawn street plan (`map/worldMap.ts`: `CITY`, warp, features).

## Stage A: world foundations (this PR)

| Item | Status | Notes |
|---|---|---|
| Audit and checklist | done | This file |
| Graph-based streets | done | The exit graph is the street graph. Side streets are areas joined to it by **junctions** (`ExitDef.junction`). Their ends are edges out to the junction on the street they join. |
| Street definitions | partial | Each side street is a `LevelDef` plus its two ends (`SIDE_STREETS`: street, x, lock). Class (`lane`, `towpath`), district and blurb are there. Population, traffic and lighting profiles, event spots and opening hours come with Stages B and C. |
| Junctions | done | A gap in the frontage (`city/street.ts`, like the subway stairwells), drawn as the lane's mouth by `LevelView.laneMouth`: setts, gable walls, the far wall with a door and a lit window, a lamp, and the street's name on a white plate. USE says "Turn into Mill Lane". You come out at the junction facing along the street. |
| Two-way traversal | done | Every street-to-street link has a way back (`tests/streetGraph.test.ts`). |
| No way round the story | done | A side street's end onto a locked street needs the same flag as that street's main-road seam. The test checks every stage of the story: the same places are open with or without side streets. |
| Loops, not dead ends | done | Each side street joins two streets the main road also joins. |
| First side streets | done | **Mill Lane** (back lane: Hollins Estate x 60 ↔ Back Alleys x 52, alleys end after the Gaffer). **The Canal Towpath** (Canal Side Works x 30 ↔ Canal Docks x 43, docks end after the Ratcatcher). Each has searchable bins, crates or a skip, a hidden stash, an optional fight and its own regulars. |
| Map | done | Side streets are drawn as roads behind the main road, from junction to junction, crossing nothing (`tests/stage9.test.ts`). The route finder and Run there use them: Hollins to the alleys goes by Mill Lane. |
| Discovery | done | Walking a side street the first time puts it on your map (`save.visited`). The notification says "New street: …". |
| Tutorial | done | Hint `junction` (Exploration) the first time you walk past a junction. |
| Streaming | partial | Side streets load like any area you walk into (the door fade). The main road's seamless streaming is unchanged. Preparing a junction's street in the background is Stage B (`prepareAround` already loads the models behind every door). |
| Save compatibility | done | New ids only. Old saves are untouched. A save on a side street loads there (test). |
| Shot pages | done | `&calm=1` takes a picture with the area's fights done, so any spot can be framed. |

## Stages still to come

**B: the connected town.** More side streets, so each district has two to four (estate footpaths, a service road behind the High Street, an arcade through the City Centre, the retail park's car park road). Prepare a junction's street in the background as you approach. Cab and drive stops on side streets. Map filters for routes and shortcuts.

**C: the living world.** A clock (morning, afternoon, evening, night) that drives lighting, opening hours (shutters, lit signs, hours on the map card), who's about, and police patterns. NPC schedules computed cheaply for unloaded streets. Recurring characters who remember you. A data-driven event system (street fights, shifts, markets, sales, broken-down vans) with cooldowns and no repeats on the same spot.

**D: activities and lifestyle.** Working shifts (warehouse, deliveries, door work) built on the jobs system. Pool, darts and fruit machines in the pubs. Business ownership on the property system, with running costs. Upstairs flats, rooftops and basements reached by stairs.

**E: discovery and progression.** Hidden places found through rumours, phone messages and exploring. District reputation feeding prices, greetings and access. Economy model updates for every new earner.

**F: production polish.** Art and audio passes, a performance pass over the bigger town (draw calls, memory over long sessions), and checks on a real iPhone and iPad (device).

## Targets from the brief, and where they stand

| Target | Now | Notes |
|---|---|---|
| 8–12 districts | 20 hand-built + 6 towns | Already over: districts get deeper in B, not more numerous |
| 40–60 streets | 46 outdoor (20 + 24 + 2) | The generated towns' streets are thinner than the hand-built ones |
| 100–150 interiors | 22 kinds (properties are generated per listing) | D |
| 30–50 event types | 0 | C |
| 25–40 activities | about 12 (gyms, club, casino games, jobs, dealing, grow, mugging…) | D |
| 5–8 lifestyles | fighter, criminal, property; partly business | D |
| 20–30 hidden places | 23 stashes, no hidden places yet | E |
