# The phone on iPhone, iPad and desktop

The phone (CaliLabsOS, `src/ui/phone/Phone.ts`) is one implementation for every screen. This page records the
cross-device audit of November 2026, what was wrong, what changed, how it is tested, and a checklist for real devices.

## What was wrong

The iPhone held upright was the only screen on which the phone was fully right. On iPads and desktop browsers:

1. **Me, Crew and Settings came out in the big-screen layout, squeezed into the phone.** Those three apps show the
   game's own screens inside the phone (`UIManager.setHost`). Their layout comes from `@media` rules, and a media
   query asks about the real screen, not the phone. On an upright iPhone the real screen is a narrow portrait one,
   so the right rules applied. On an iPad or a desktop the wide-screen rules applied: Me and Crew in two clipped
   columns (stats cut off at the phone's edge), and Settings' volume sliders with no track, so they couldn't be
   dragged. `embedCss.ts` already copied the `orientation: portrait` rules into a container query, but
   - it copied only those, not the `max-width` rules an iPhone also uses (`max-width: 700px` gives Me its single
     column), and
   - its copies sat in a `<style>` that the browser could rank *before* the game's own sheet, so the real screen's
     rule (an iPad's `max-width: 1080px`, two columns) still won.
2. **A keyboard couldn't work the phone.** Enter is a game key, so the browser never "clicked" a focused phone
   button, and the arrows did nothing on the phone's own screens. Mouse users were fine, keyboard-only and pad
   players could open the phone but not an app.
3. **Escape in a GraftWiki article left the wiki** instead of going back to its contents as the on-screen Back does.

Checked and fine already: every control uses `click` or pointer events (no touch-only handlers, no user-agent or
iPhone checks); the shade and device take pointer events only while the phone is up; the game is paused under it
(`state = 'paused'`), so nothing in the phone moves the player; the canvas has no pointer listeners; the map's pan and
pinch use pointer events with capture, so mouse, touch and pen all work; the wheel scrolls app lists (nothing calls
`preventDefault` on it outside the map).

## What changed

- `src/ui/phone/embedCss.ts`: every size-based media rule is judged against an upright phone (`PHONE`, 390 × 700),
  never against the real screen.
  - Each rule's original is kept out of the phone's narrow app view (`:where(:not(.ph-narrow *))`: same elements
    everywhere else, no added specificity).
  - Each rule an upright phone uses gets a `@container phone (max-width: 560px)` copy inserted straight after it in
    the same sheet, so the cascade inside the phone is exactly an upright iPhone's.
  - Rules about the device (reduced motion, hover, pointer) are left alone.
  - `markNarrow` sets `.ph-narrow` on the app view (ResizeObserver, same 560 px as the container query), so a phone
    held sideways keeps its own landscape layout as before.
- `Phone.nav` (from `Game.onMenuAction`): arrows, WASD, the D-pad and the stick move between the phone's buttons by
  where they are on screen; Enter or A presses the picked one (`.ph-pick` ring). Mouse, touch and pen press directly.
- `Phone.back`: in a GraftWiki article, Back (Escape, B) goes to the contents first.
- `theme.css`: hover on the app icons and buttons for a mouse or trackpad only (`@media (hover: hover)`, so touch
  screens are unchanged); the Me portrait inside the phone stops at the iPhone's size (it is `36vh` of the real screen).

Nothing about the phone's look, sizes, icons, wallpaper, animations or sounds changed on an iPhone.

## The apps

| App | Source | Opens | What was checked | Issue found | Result |
| --- | --- | --- | --- | --- | --- |
| Messages | `Phone.messages` | own screen | opens, lists Mo, needs and messages, Back | none | passes |
| Maps | `mapApp.ts` | own screen | filter chip, a place's card, close card, Directions sets the route, pan/zoom by pointer, Back | none | passes |
| Cabs | `Phone.cabs` | own screen | rows and fares; a fare puts the phone away and travels | none | passes (travel not pressed in the test) |
| Your bank (Califax or Lloyd’s THC) | `Phone.bank` | own screen | balances card, Pay in (only at home with cash) | none | passes |
| CaliStore | `Phone.store` | own screen | the two bank apps, Get / Switch / Open (money/banking.ts) | none | new |
| Jobs | `Phone.jobs` | own screen | objective, Mo's hint, the route's Map button opens Maps | none | passes |
| Heat | `Phone.heat` | own screen | districts' bars, "How heat works" opens GraftWiki's article | none | passes |
| Crew | `profileUI.ts` (hosted) | game screen | one column, nothing past the phone's sides | big-screen layout | **fixed** |
| Me | `profileUI.ts` (hosted) | game screen | one column, portrait, stats | big-screen layout | **fixed** |
| Home | `Phone.house` | own screen | Edit home in your house | none | passes |
| GraftWiki | `wikiApp.ts` | own screen | article and back to contents; search field takes typing | Escape skipped the contents | **fixed** |
| Settings | `settingsScreen` (hosted) | game screen | slider dragged (mouse) or tapped (touch), wheel scrolls | sliders lost their track | **fixed** |

The bag (Pockets & bag) is a HUD button, not a phone app, since #62.

## Tests

- `tests/phoneEmbed.test.ts` (in `npm test`): media queries judged against an upright phone, every query in the
  game's CSS gets an answer, kept-out selectors keep pseudo-elements last.
- `tools/phone/phone.spec.ts` (`npm run build && npm run phone`, and the "Phone on iPhone, iPad and desktop" CI job):
  a real new game, then every app with the device's own input at eight sizes: iPhone 390 × 700 and 844 × 390
  (touch), iPad 820 × 1180 and 1180 × 820 (touch), iPad 1180 × 820 with a trackpad (mouse on a touch screen),
  desktop 1920 × 1080, 2560 × 1440 and 1280 × 720 (mouse and keys). Each press first checks the control is what's
  under the pointer. Also: the phone fits the screen, nothing in it moves the player, keys pick and open apps,
  one Escape closes one layer, rapid open and close, the screen turning with the phone up, play resumes after.
  Screenshots of the home screen, Me, Crew and Settings are attached to the report.

These run in Chromium with the screen size and touch emulated. They check layout, hit areas and input handling at
each size; they are not Safari, and not a real iPhone or iPad.

## By hand on real devices

Not yet checked on physical devices. On each of: an iPhone in Safari (upright and sideways), an iPad in Safari
(both ways round, with a finger, and with a trackpad or mouse if there is one; also with Stage Manager or Split View
if used), and a desktop browser (Chrome, Safari, Firefox):

1. Start or continue a game; out of a fight, open the phone with its button (and P on a keyboard).
2. The whole phone is on screen, nothing cut off top or bottom (iPad Safari's toolbars too).
3. Open each app from its icon; each opens on the first press.
4. Maps: drag to pan, pinch (or wheel) to zoom, tap a pin, tap a place in the list, Directions, close the card.
5. Me and Crew: one column, the fighter's portrait above the stats, nothing cut off at the sides.
6. Settings: drag a volume slider; it moves and the sound changes. Scroll to the bottom of the list.
7. GraftWiki: open an article, scroll it, Back goes to the contents, Back again to the home screen.
8. Keyboard: arrows move the white ring between apps, Enter opens one, Escape goes back one step at a time.
9. Tap or click beside the phone: it slides away and the fighter moves again straight away.
10. Open and close the phone several times quickly: it always ends up open or closed, never stuck.
11. iPad: turn it round with the phone up; the phone stays on screen and its apps still work.
