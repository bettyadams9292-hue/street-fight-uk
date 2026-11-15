# Texture catalogue

The owner's texture library (`StreetFightUK-assets/texturesforgame`): 130 material sets, all from ambientCG (CC0), 1K source.
Each set is stored in `public/textures/lib/` at 512 px as three files: `_c` (colour), `_n` (normal, OpenGL) and `_orm` (ambient occlusion, roughness and metalness packed into red, green and blue).
The game loads a set only when something uses it. Where each one is used is in `docs/assets/TEXTURE_ASSIGNMENTS.md`.

Maps: C colour, N normal, R roughness, M metalness, AO ambient occlusion, D displacement (in the source only; not shipped), O opacity, E emission.

## brick (5)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Bricks005 | weathered red-brown brick, pale mortar | terraced house and estate walls | 1024×1024 | C D N R | 1.4 m |
| Bricks007 | mixed red, purple and grey brick, heavy white mortar | old warehouse and yard walls | 1024×1024 | AO C D N R | 1.4 m |
| Bricks070 | clean new orange-red brick | new-build houses, shop units, retail park | 1024×1024 | AO C D N R | 1.2 m |
| Bricks097 | old dark red brick, crumbling white mortar | back alleys, pubs, factory walls | 1024×512 | AO C D N R | 1.4 m |
| PaintedBricks001 | brick painted glossy blue, chipped | pub and shop frontages, gym walls (tinted) | 1024×1024 | AO C D N R | 1.4 m |

## stone (4)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Bricks040 | dark slate-grey rough stone blocks | old boundary walls, railway arches, the underground | 1024×1024 | AO C D N R | 1.6 m |
| Bricks041 | tan sandstone blocks with moss | mansion walls, churchyard and park walls | 1024×1024 | AO C D N R | 1.6 m |
| Rock058 | dark veined slate | worktops, hearths, fire surrounds | 1024×1024 | AO C D N R | 2.0 m |
| Rocks022 | pebble aggregate | pebbledash house walls, gravel drives, planters | 1024×1024 | AO C D N R | 1.2 m |

## concrete (2)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Concrete034 | pale smooth cast concrete with trowel marks | pavement slabs, garage floors, car parks, ceilings | 1024×512 | C D N R | 2.5 m |
| Concrete042A | dark stained, polished concrete | factory and lock-up floors, underpasses | 1024×1024 | AO C D M N R | 2.5 m |

## asphalt (6)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Road012A | dark asphalt, fine cracks | main roads | 1024×1024 | AO C D N R | 4.0 m |
| Road012B | dark asphalt, faint tyre lines | main roads | 1024×1024 | AO C D N R | 4.0 m |
| Road012C | dark asphalt, worn centre | side streets | 1024×1024 | AO C D N R | 4.0 m |
| Road014B | asphalt with patched strip | estate roads | 1024×1024 | AO C D N R | 4.0 m |
| Road014C | asphalt with rusty leaf-litter stains | back streets, industrial estate | 1024×1024 | AO C D N R | 4.0 m |
| Road015A | coarse dark asphalt | car parks, yards | 1024×1024 | AO C D N R | 4.0 m |

## paving (6)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| PavingStones036 | grey block paving with moss | side streets, driveways | 1024×1024 | AO C D N R | 1.6 m |
| PavingStones083 | dark wet herringbone setts | alleys, the old market, pub yards | 1024×1024 | AO C D N R | 1.6 m |
| PavingStones092 | red and grey block paving | estate pavements, precinct | 1024×1024 | AO C D N R | 1.6 m |
| PavingStones102 | grey and white chevron paving | the shopping centre, plazas | 1024×1024 | AO C D N R | 1.6 m |
| PavingStones109 | grey small-block paving | high-street pavements | 1024×1024 | AO C D N R | 1.6 m |
| PavingStones123 | red-brown herringbone brick | driveways, mansion paths, market square | 1024×1024 | AO C D N R | 1.6 m |

## grass (3)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Grass004 | dry olive lawn | verges, waste ground | 1024×1024 | AO C D N R | 2.0 m |
| Grass006 | bright mown lawn | gardens, the park, mansion lawns | 1024×1024 | AO C D N R | 2.0 m |
| Grass007 | patchy green lawn | estate greens, football pitch | 1024×1024 | AO C D N R | 2.0 m |

## ground (3)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Ground020 | wet grit with leaves and moss | alley floors, yards, canal towpath | 1024×1024 | AO C D N R | 2.5 m |
| Ground037 | mossy patchy grass and earth | waste ground, verges | 1024×1024 | AO C D N R | 2.5 m |
| Ground108 | rubble and dry dirt | building sites, the Pit, lock-up yards | 1024×1024 | AO C D N R | 2.5 m |

## tile-floor (15)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Tiles050 | grey and pink granite slabs | shopping centre, bank and hotel floors | 1024×1024 | C D N R | 2.0 m |
| Tiles052 | black polished square tiles | casino, club and luxury bathroom floors | 1024×1024 | C D N R | 1.5 m |
| Tiles055 | white tiles with small black dots | kitchens, cafes, barbers | 1024×1024 | C D M N R | 1.2 m |
| Tiles057 | white tiles with black and red dots | takeaways, bathrooms | 1024×1024 | C D M N R | 1.2 m |
| Tiles068 | white tiles with teal dots | bathrooms, launderette | 1024×1024 | AO C D N R | 1.0 m |
| Tiles074 | black and tan marble chequerboard | mansion halls, casino, hotel | 1024×1024 | C D N R | 1.5 m |
| Tiles076 | black and cream maze mosaic | feature floors: restaurants, jeweller | 1024×1024 | C D N R | 1.0 m |
| Tiles077 | cream and black marble waves | feature floors: club, salon | 1024×1024 | C D N R | 1.5 m |
| Tiles082 | cream and black marble chevrons | feature floors: jeweller, hotel | 1024×1024 | C D N R | 1.5 m |
| Tiles117 | mossy olive stone flags | patios, conservatories, old pubs | 1024×1024 | AO C D N R | 2.0 m |
| Tiles131 | Victorian encaustic pattern (ochre, slate, red) | terraced-house hallways, pubs | 1024×1024 | AO C D N R | 1.0 m |
| Tiles138 | charcoal matt square tiles | gyms, modern kitchens, shops | 1024×1024 | AO C D N R | 1.5 m |
| Tiles140 | dark marbled stone tiles | bars, luxury flats | 1024×1024 | C D N R | 1.5 m |
| Tiles143 | cream travertine tiles | mansion kitchens and bathrooms | 1024×1024 | C D N R | 1.5 m |
| Tiles144 | terracotta-brown stone tiles | kitchens, conservatories, restaurants | 1024×1024 | C D N R | 1.5 m |

## tile-wall (9)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Tiles005 | pastel iridescent brick tiles | nightclub and salon walls | 1024×1024 | C D N R | 1.0 m |
| Tiles011 | white marble brick tiles | smart bathrooms, kitchen splashbacks | 1024×1024 | AO C D N R | 1.0 m |
| Tiles031 | green glass mosaic | bathrooms, swimming pool surrounds | 1024×1024 | C D N R | 0.8 m |
| Tiles032 | dark green glazed metro tiles | pubs, underground station, chip shop | 1024×1024 | C D N R | 1.0 m |
| Tiles037 | red glazed metro tiles | takeaways, barbers, gym showers | 1024×1024 | C D N R | 1.0 m |
| Tiles105 | plain white square tiles | bathrooms, kitchens, chip shop, changing rooms | 1024×1024 | AO C D N R | 1.5 m |
| Tiles132A | bright blue pool mosaic | swimming pools | 1024×1024 | AO C D N R | 1.0 m |
| Tiles133C | white mosaic, tiles missing | grimy toilets, squats, the underground | 1024×1024 | AO C D N R | 1.0 m |
| Tiles136C | white and grey mosaic, broken | derelict bathrooms, lock-ups | 1024×1024 | AO C D N R | 1.0 m |

## porcelain (2)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Porcelain001 | white glazed porcelain | toilets, sinks, baths, plates | 1024×1024 | C D N R | 1.0 m |
| Porcelain003 | black glazed porcelain | luxury bathrooms, ashtrays, vases | 1024×1024 | C D N R | 1.0 m |

## wood (13)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Bamboo001C | split bamboo slats, with gaps (has opacity) | blinds, screens, garden fencing | 1024×1024 | AO C D N O R | 1.0 m |
| Planks023A | dark stained rough planks | pub floors, docks, workbenches, fences | 1024×1024 | AO C D M N R | 1.5 m |
| Wood026 | rich red-brown polished wood | pub bars, mansion furniture, doors | 1024×1024 | C D N R | 1.2 m |
| Wood049 | grey-brown open-grain wood | modern furniture, shop shelving | 1024×1024 | C D N R | 1.2 m |
| Wood051 | dark charcoal-brown wood | modern units, TV stands, counters | 1024×1024 | C D N R | 1.2 m |
| Wood052 | orange pine | cheap furniture, bed frames, kitchen units | 1024×1024 | C D N R | 1.2 m |
| Wood066 | dark walnut | desks, wardrobes, panelling | 1024×1024 | C D N R | 1.2 m |
| Wood067 | very dark mahogany | antique furniture, bar tops | 1024×1024 | C D N R | 1.2 m |
| Wood071 | end-grain block patchwork | butcher-block worktops, chopping boards | 1024×1024 | C D N R | 1.0 m |
| Wood082B | honey oak strips | kitchen worktops, tables, shelving | 1024×1024 | C D N R | 1.2 m |
| Wood084A | dark brown stained strips | tables, benches, doors | 1024×1024 | C D N R | 1.2 m |
| Wood084B | grey-brown weathered strips | pallets, crates, scaffold boards, fences | 1024×1024 | C D N R | 1.2 m |
| Wood096 | pale knotty pine | flat-pack furniture, shelves, crates | 1024×1024 | C D N R | 1.2 m |

## wood-floor (10)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| WoodFloor014 | dark herringbone parquet | mansion and pub floors | 1024×1024 | AO C D N R | 1.5 m |
| WoodFloor040 | golden oak boards | living rooms, shops | 1024×1024 | AO C D N R | 1.5 m |
| WoodFloor041 | dark rough reclaimed boards | pubs, lofts, the gym | 1024×1024 | AO C D N R | 1.5 m |
| WoodFloor043 | worn brown boards with knots | old flats, back rooms | 1024×512 | AO C D M N R | 1.5 m |
| WoodFloor048 | near-black narrow strip floor | clubs, modern flats | 1024×1024 | C D N R | 1.5 m |
| WoodFloor051 | light natural strip floor | flats, offices, gym studio | 1024×1024 | AO C D N R | 1.5 m |
| WoodFloor053 | pale chevron parquet | smart flats, the jeweller, estate agent | 1024×1024 | AO C D N R | 1.5 m |
| WoodFloor054 | pale basket-weave parquet | halls, community centre, school gym | 1024×1024 | AO C D N R | 1.5 m |
| WoodFloor064 | warm brown smooth boards | bedrooms, living rooms | 1024×1024 | C D N R | 1.5 m |
| WoodFloor070 | dark basket-weave parquet | pubs, studies, mansion rooms | 1024×1024 | C D N R | 1.5 m |

## wood-paint (2)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| PaintedWood007A | navy painted boards, worn | doors, sheds, shop fronts (tinted) | 1024×1024 | AO C D N R | 1.2 m |
| WoodSiding009 | cream painted clapboard | sheds, garage doors, shop fascias (tinted) | 1024×512 | AO C D M N R | 1.5 m |

## fabric (14)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Fabric001 | fine white cotton | bedding, net curtains, white T-shirts | 724×1024 | C D N R | 0.6 m |
| Fabric015 | open blue and white woven strap (has opacity) | deck chairs, bags | 1024×1024 | C D N O R | 0.3 m |
| Fabric022 | dark navy denim | jeans, denim jackets | 1024×1024 | C D N R | 0.5 m |
| Fabric023 | mid-navy denim | jeans, workwear | 1024×1024 | C D N R | 0.5 m |
| Fabric026 | red ribbed knit | jumpers, beanies, red upholstery | 1024×1024 | C D N R | 0.5 m |
| Fabric028 | olive-grey crushed velvet | sofas, armchairs, heavy curtains | 1024×1024 | C D N R | 0.8 m |
| Fabric029 | very dark brown velour | sofas, cinema seats, car seats | 1024×1024 | C D N R | 0.8 m |
| Fabric049 | charcoal windowpane-check suiting | suits, coats, smart trousers | 1024×1024 | AO C D N R | 0.4 m |
| Fabric064 | lilac cotton twill | shirts, polos, bedding | 1024×1024 | AO C D N R | 0.4 m |
| Fabric080 | red, white and green tartan | blankets, scarves, pub seating | 1024×512 | C D N R | 0.5 m |
| Fabric081A | plain mid-blue cotton | T-shirts, tracksuits, curtains | 1024×1024 | AO C D N R | 0.4 m |
| Fabric082A | plain light grey jersey | hoodies, joggers, tracksuits | 1024×1024 | AO C D N R | 0.4 m |
| Fabric082B | blue and white floral print | curtains, cushions, bedding | 1024×1024 | AO C D N R | 0.6 m |
| Fabric083 | grey dogtooth check | coats, flat caps, upholstery | 1024×1024 | C D N R | 0.4 m |

## carpet (2)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Fabric024 | green checked short-pile carpet | pub and snooker-hall carpet, casino floor | 1024×1024 | C D N R | 1.0 m |
| Fabric025 | ochre ribbed carpet squares | office and shop carpet tiles | 1024×1024 | C D N R | 1.0 m |

## leather (11)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Leather008 | black crocodile-embossed leather | boots, belts, bags | 1024×1024 | AO C D N R | 0.5 m |
| Leather009 | black leather with stamped pattern | gloves, car seats | 1024×1024 | C D N R | 0.5 m |
| Leather011 | oxblood stamped leather | pub banquettes, club seating | 1024×1024 | C D N R | 0.5 m |
| Leather012 | cream leather | luxury car seats, mansion sofas | 1024×1024 | C D N R | 0.6 m |
| Leather025 | white leather | trainers, gym pads, white sofas | 1024×1024 | C D N R | 0.6 m |
| Leather033B | distressed brown hide | old armchairs, punch bags, jackets | 1024×1024 | C D N R | 0.8 m |
| Leather034C | dark brown diamond-quilted leather | chesterfield sofas, bar fronts, car seats | 1024×1024 | AO C D N R | 0.6 m |
| Leather034D | black diamond-quilted leather | puffer-style jackets, booth seating | 1024×1024 | AO C D N R | 0.6 m |
| Leather036B | red diamond-quilted leather | casino and club seating, sports car seats | 1024×1024 | AO C D N R | 0.6 m |
| Leather037 | plain brown leather | shoes, boots, jackets, sofas | 1024×1024 | C D N R | 0.6 m |
| Leather038 | tan-orange leather | boxing gloves, bags, bar stools | 1024×1024 | C D N R | 0.6 m |

## plastic (1)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Fabric004 | black carbon-fibre weave | car trim, bike bodywork, gym kit | 1024×1024 | C D M N R | 0.25 m |

## metal (11)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Metal034 | polished yellow gold | jewellery, taps and trim in mansions | 1024×1024 | C D M N R | 1.0 m |
| Metal035 | polished copper | pipes, pans, pub fittings | 1024×1024 | C D M N R | 1.0 m |
| Metal038 | dark gunmetal, lightly scratched | tools, weights, engine parts, railings | 1024×1024 | C D M N R | 1.0 m |
| Metal041A | clean pale steel | appliances, sinks, door furniture | 1024×1024 | C D M N R | 1.0 m |
| Metal042A | pale brass | door handles, lamp fittings | 1024×1024 | C D M N R | 1.0 m |
| Metal048B | brushed pale brass | bar rails, hand rails | 1024×1024 | C D M N R | 1.0 m |
| Metal048C | worn brushed brass | old fittings, trophies | 1024×1024 | C D M N R | 1.0 m |
| Metal052A | light brushed aluminium | kitchen appliances, shelving, chrome trim | 1024×1024 | C D M N R | 1.0 m |
| Metal057C | pale rose-gold | jewellery | 1024×1024 | C D M N R | 1.0 m |
| Metal061A | pale satin steel | fridges, lift doors, lockers | 1024×1024 | C D M N R | 1.0 m |
| Metal063 | dull blue-grey steel plate | factory plant, shutters, workbenches | 1024×1024 | C D M N R | 1.0 m |

## metal-paint (1)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Metal050C | white painted or powder-coated metal | radiators, white goods, tool cabinets (tinted) | 1024×1024 | C D M N R | 1.0 m |

## metal-rust (6)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Metal022 | galvanised steel, half rusted | skips, old shutters, scrap | 1024×1024 | C D M N R | 1.0 m |
| Metal041B | pale steel with rust streaks | bins, lamp posts, fences | 1024×1024 | C D M N R | 1.0 m |
| Metal055B | white painted metal with rust spots | garage doors, old vans, sign backs | 1024×1024 | C D M N R | 1.0 m |
| Metal056B | scratched pale metal, rust patch | lock-up doors, containers | 1024×1024 | C D M N R | 1.0 m |
| Metal056C | heavily rusted sheet | scrapyard, the docks, old shutters | 1024×1024 | C D M N R | 1.0 m |
| Metal062C | galvanised steel, weathered and blotched | corrugated roofs, fences, street furniture | 1024×1024 | C D M N R | 1.0 m |

## facade (1)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Facade014 | office block at night, lit windows (has emission) | distant tower blocks and office backdrops | 1024×1024 | C D E N R | 12.0 m |

## foliage (3)

| Set | Looks like | Suits | Source size | Maps | One repeat |
|---|---|---|---|---|---|
| Foliage006 | grass blade cut-outs (has opacity) | grass tufts: needs leaf-card models | 1024×1024 | C D N O R | 1.0 m |
| Foliage008 | long leaf cut-outs (has opacity) | plants: needs leaf-card models | 1024×1024 | C D N O R S | 1.0 m |
| Leaf001 | two leaves, cut out (has opacity) | plants: needs leaf-card models | 1024×1024 | AO C D N O R | 0.2 m |
