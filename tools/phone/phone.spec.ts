/**
 * The in-game phone works the same on an iPhone, an iPad and a desktop browser (tools/phone/playwright.config.ts).
 *
 * For each device: start a real new game, pull the phone up with that device's input, open every app, use its
 * controls, come back, and put the phone away; then check play carries on. Every press is aimed at the middle of
 * the control and first checks that the control is what's actually there (no invisible layer over it, no transform
 * moving the picture away from the hit area). Screenshots of the home screen and the hosted apps are attached to
 * the report.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Input = 'touch' | 'mouse';
interface Device {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  input: Input;
}

const DEVICES: Device[] = [
  { name: 'iPhone portrait', width: 390, height: 700, touch: true, input: 'touch' },
  { name: 'iPhone landscape', width: 844, height: 390, touch: true, input: 'touch' },
  { name: 'iPad portrait', width: 820, height: 1180, touch: true, input: 'touch' },
  { name: 'iPad landscape', width: 1180, height: 820, touch: true, input: 'touch' },
  { name: 'iPad trackpad', width: 1180, height: 820, touch: true, input: 'mouse' },
  { name: 'desktop 1920', width: 1920, height: 1080, touch: false, input: 'mouse' },
  { name: 'desktop 2560', width: 2560, height: 1440, touch: false, input: 'mouse' },
  { name: 'desktop 1280', width: 1280, height: 720, touch: false, input: 'mouse' },
];

interface Sfuk {
  state: string;
  phone: { isOpen: boolean };
  world?: { player: { pos: { x: number; z: number } } };
}
const game = (p: Page) => p.evaluate(() => {
  const g = (window as unknown as { sfuk: Sfuk }).sfuk;
  return { state: g.state, open: g.phone.isOpen, x: g.world?.player.pos.x ?? NaN };
});

/** A real new game, through the menu and the creator. */
async function newGame(page: Page): Promise<void> {
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window as unknown as { sfuk?: unknown }).sfuk, undefined, { timeout: 90_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('button, [data-nav]')].some((e) => /New game/.test(e.textContent ?? '')), undefined, { timeout: 90_000 });
  await page.evaluate(() => ([...document.querySelectorAll('button, [data-nav]')].find((e) => /New game/.test(e.textContent ?? '')) as HTMLElement).click());
  for (let i = 0; i < 80; i++) {
    if ((await game(page)).state === 'playing') break;
    await page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>('button, [data-nav]')].filter((e) => e.offsetParent);
      const t = (e: HTMLElement) => (e.getAttribute('aria-label') || e.textContent || '').trim();
      const raise = els.filter((e) => /^Raise /.test(t(e)) && !(e as HTMLButtonElement).disabled);
      if (raise.length && /Spend your last/.test(document.body.innerText) && !/All points spent/.test(document.body.innerText)) return raise[0].click();
      (els.find((e) => /^Create fighter/.test(t(e))) ?? els.reverse().find((e) => /^Next/.test(t(e))))?.click();
    });
    await page.waitForTimeout(400);
  }
  await expect.poll(async () => (await game(page)).state, { timeout: 90_000 }).toBe('playing');
  await page.waitForSelector('.phone-btn', { state: 'visible', timeout: 60_000 });
}

/** Press a control the way the device would, after checking it's the thing under the pointer. */
async function press(page: Page, input: Input, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  const at = await el.evaluate((e) => {
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, ok: !!hit && (hit === e || e.contains(hit)), hit: hit ? `${hit.tagName}.${hit.className}` : 'nothing' };
  });
  expect(at.ok, `${selector} is covered by ${at.hit}`).toBe(true);
  if (input === 'touch') await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** The phone is up and has stopped moving (its slide-up is a transform). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const d = document.querySelector('.phone.up .ph-device');
    return !!d && getComputedStyle(d).transform === 'none';
  }, undefined, { timeout: 20_000 });
}

const app = (page: Page) => page.locator('.ph-screen').getAttribute('data-app');

async function openPhone(page: Page, input: Input): Promise<void> {
  await press(page, input, '.phone-btn');
  await settled(page);
  await expect.poll(() => app(page)).toBe('home');
}

async function backHome(page: Page, input: Input): Promise<void> {
  await press(page, input, '.ph-screen .ph-back:visible, .ph-screen .pm-back:visible');
  await expect.poll(() => app(page)).toBe('home');
}

/** Tap or click the dimmed game beside the phone (which puts it away). */
async function pressShade(page: Page, input: Input): Promise<void> {
  const vw = page.viewportSize()!;
  const at = await page.evaluate(({ w, h }) => {
    const d = document.querySelector('.ph-device')!.getBoundingClientRect();
    const spots = [[8, h / 2], [w - 8, 8], [8, 8], [w / 2, 8]];
    for (const [x, y] of spots) {
      if (x >= d.left && x <= d.right && y >= d.top && y <= d.bottom) continue;
      if (document.elementFromPoint(x, y)?.classList.contains('ph-shade')) return { x, y };
    }
    return null;
  }, { w: vw.width, h: vw.height });
  expect(at, 'some of the shade is showing beside the phone').not.toBeNull();
  if (input === 'touch') await page.touchscreen.tap(at!.x, at!.y);
  else await page.mouse.click(at!.x, at!.y);
}

async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  const box = await page.locator('.ph-device').boundingBox();
  const body = await page.screenshot(box ? { clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 } } : {});
  await info.attach(name, { body, contentType: 'image/png' });
}

/** The hosted screen is laid out as on an upright phone: one column, nothing wider than the phone. */
async function fitsPhone(page: Page, what: string): Promise<void> {
  const r = await page.evaluate(() => {
    const box = document.querySelector('.ph-embed') as HTMLElement;
    const b = box.getBoundingClientRect();
    const narrow = box.classList.contains('ph-narrow');
    const grid = box.querySelector('.pf-grid');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length : 1;
    // Anything laid out past the phone's sides (the tutorial-hints line runs long on an iPhone too: it scrolls).
    const out = [...box.querySelectorAll<HTMLElement>('.panel, .pf-col, .setting-row, .pf-portrait, input[type=range]')].filter((e) => {
      const q = e.getBoundingClientRect();
      return q.width > 0 && (q.left < b.left - 1 || q.right > b.right + 1);
    }).map((e) => e.className);
    return { wide: box.clientWidth > 560, narrow, cols, out };
  });
  // A phone held sideways turns the phone landscape: its apps keep their wide layout there, as they always have.
  expect(r.narrow, `${what}: app view marked narrow exactly when it is`).toBe(!r.wide);
  if (!r.wide) expect(r.cols, `${what}: one column`).toBe(1);
  expect(r.out, `${what}: nothing wider than the phone`).toEqual([]);
}

for (const d of DEVICES) {
  test.describe(d.name, () => {
    test.use({ viewport: { width: d.width, height: d.height }, hasTouch: d.touch, isMobile: false });

    test(`every phone app works by ${d.input}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await newGame(page);

      // ---- open: the phone fits the screen and its home screen is pressable ----
      await openPhone(page, d.input);
      const dev = (await page.locator('.ph-device').boundingBox())!;
      expect(dev.x).toBeGreaterThanOrEqual(-1);
      expect(dev.y).toBeGreaterThanOrEqual(-1);
      expect(dev.x + dev.width).toBeLessThanOrEqual(d.width + 1);
      expect(dev.y + dev.height).toBeLessThanOrEqual(d.height + 1);
      expect(await page.locator('.ph-app').count()).toBeGreaterThanOrEqual(11);
      await shot(page, info, 'home screen');
      const before = await game(page);
      expect(before.state).toBe('paused');

      // ---- Messages ----
      await press(page, d.input, '.app-messages');
      await expect.poll(() => app(page)).toBe('messages');
      await expect(page.locator('.ph-body')).toBeVisible();
      await backHome(page, d.input);

      // ---- Maps: a filter chip, a place, its card ----
      await press(page, d.input, '.app-map');
      await expect.poll(() => app(page)).toBe('map');
      await press(page, d.input, '.pm-chip:not(.on)');
      await expect(page.locator('.pm-chip.on')).toHaveCount(1);
      await press(page, d.input, '.pm-chip:first-child');
      await press(page, d.input, '.pm-row');
      await expect(page.locator('.pm-place')).toBeVisible();
      await press(page, d.input, '.pm-x');
      await expect(page.locator('.pm-place')).toHaveCount(0);
      // Directions to the next place along: sets the route (Jobs shows it below).
      await press(page, d.input, '.pm-row:not(.locked) >> nth=1');
      await expect(page.locator('.pm-place')).toBeVisible();
      await press(page, d.input, '.pm-act.primary');
      await expect(page.locator('.pm-act.primary.on')).toHaveCount(1);
      await backHome(page, d.input);

      // ---- Cabs, CaliBank: their rows and buttons are there ----
      await press(page, d.input, '.app-cabs');
      await expect.poll(() => app(page)).toBe('cabs');
      expect(await page.locator('.ph-body .ph-row').count()).toBeGreaterThan(0);
      await backHome(page, d.input);
      await press(page, d.input, '.app-bank');
      await expect.poll(() => app(page)).toBe('bank');
      await expect(page.locator('.ph-card').first()).toBeVisible();
      await backHome(page, d.input);

      // ---- Jobs: the route set in Maps, and its Map button opens Maps ----
      await press(page, d.input, '.app-jobs');
      await expect.poll(() => app(page)).toBe('jobs');
      await press(page, d.input, '.ph-body .ph-btn');
      await expect.poll(() => app(page)).toBe('map');
      await backHome(page, d.input);

      // ---- Heat: "How heat works" opens the article; Back goes to the contents, then home ----
      await press(page, d.input, '.app-heat');
      await expect.poll(() => app(page)).toBe('heat');
      await press(page, d.input, '.ph-link');
      await expect.poll(() => app(page)).toBe('wiki');
      await press(page, d.input, '.ph-screen .ph-back');
      await expect(page.locator('.wk-link').first()).toBeVisible();
      await backHome(page, d.input);

      // ---- GraftWiki: an article and back ----
      await press(page, d.input, '.app-wiki');
      await expect.poll(() => app(page)).toBe('wiki');
      const contents = await page.locator('.ph-body').innerText();
      await press(page, d.input, '.wk-link');
      await expect.poll(() => page.locator('.ph-body').innerText(), { message: 'the article opened' }).not.toBe(contents);
      await press(page, d.input, '.ph-screen .ph-back');
      await expect.poll(() => page.locator('.ph-body').innerText()).toBe(contents);
      await backHome(page, d.input);

      // ---- Home (at home: Edit home is offered) ----
      await press(page, d.input, '.app-house');
      await expect.poll(() => app(page)).toBe('house');
      await expect(page.locator('.ph-body .ph-btn.wide')).toBeVisible();
      await backHome(page, d.input);

      // ---- Crew and Me: the game's own screens, laid out as on an upright phone ----
      for (const [id, name] of [['crew', 'Crew'], ['me', 'Me']] as const) {
        await press(page, d.input, `.app-${id}`);
        await expect.poll(() => app(page)).toBe('embed');
        await expect(page.locator('.ph-embed .profile-screen')).toBeVisible();
        await page.waitForTimeout(600);
        await fitsPhone(page, name);
        await shot(page, info, name);
        await backHome(page, d.input);
      }

      // ---- Settings: drag a slider, scroll the list ----
      await press(page, d.input, '.app-settings');
      await expect.poll(() => app(page)).toBe('embed');
      const slider = page.locator('.ph-embed input[type=range]').first();
      await expect(slider).toBeVisible();
      await fitsPhone(page, 'Settings');
      await shot(page, info, 'Settings');
      const [lo, hi] = await slider.evaluate((e) => [Number((e as HTMLInputElement).min || 0), Number((e as HTMLInputElement).max || 100)]);
      const frac = async () => (Number(await slider.inputValue()) - lo) / (hi - lo);
      const v0 = await frac();
      const s = (await slider.boundingBox())!;
      expect(s.width, 'the slider has a track to drag').toBeGreaterThan(60);
      const target = v0 > 0.5 ? 0.15 : 0.85;
      if (d.input === 'mouse') {
        await page.mouse.move(s.x + s.width * v0, s.y + s.height / 2);
        await page.mouse.down();
        await page.mouse.move(s.x + s.width * target, s.y + s.height / 2, { steps: 6 });
        await page.mouse.up();
      } else {
        await page.touchscreen.tap(s.x + s.width * target, s.y + s.height / 2);
      }
      await expect.poll(async () => Math.abs((await frac()) - v0), { message: 'the slider moved' }).toBeGreaterThan(0.25);
      if (d.input === 'mouse') {
        const scroller = await page.evaluate(() => {
          const c = [...document.querySelectorAll<HTMLElement>('.ph-embed *')].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY));
          if (!c) return null;
          c.dataset.testScroll = '1';
          const r = c.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (scroller) {
          await page.mouse.move(scroller.x, scroller.y);
          await page.mouse.wheel(0, 400);
          await expect.poll(() => page.locator('[data-test-scroll]').evaluate((e) => e.scrollTop), { message: 'the wheel scrolls the app' }).toBeGreaterThan(0);
        }
      }
      await backHome(page, d.input);

      // ---- Nothing in the phone moved the player ----
      const during = await game(page);
      expect(during.x).toBeCloseTo(before.x, 3);
      expect(during.state).toBe('paused');

      // ---- Keys (keyboard players): arrows pick an app, Enter opens it, Escape steps back one layer at a time ----
      if (d.input === 'mouse') {
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.ph-pick')).toHaveCount(1);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await expect.poll(() => app(page)).not.toBe('home');
        await page.keyboard.press('Escape');
        await expect.poll(() => app(page)).toBe('home');
        expect((await game(page)).open, 'one Escape closed one layer').toBe(true);
      }

      // ---- Put away: Back on the home screen closes the phone, play resumes ----
      if (d.input === 'mouse') await page.keyboard.press('Escape');
      else await pressShade(page, d.input);
      await expect(page.locator('.phone')).toHaveClass(/off/);
      await expect.poll(async () => (await game(page)).state).toBe('playing');

      // ---- Up and down quickly, then still working ----
      for (let i = 0; i < 4; i++) {
        await press(page, d.input, '.phone-btn');
        await page.waitForTimeout(120);
        // Put away mid-slide (the shade covers the game, and its button, until it's back in the pocket).
        await pressShade(page, d.input);
        await expect(page.locator('.phone')).toHaveClass(/off/);
      }
      if (d.input === 'mouse') {
        // The phone key mashed: an even number of presses leaves it away, and the game in a sane state.
        for (let i = 0; i < 6; i++) await page.keyboard.press('KeyP', { delay: 40 });
        await page.waitForTimeout(800);
        const g = await game(page);
        expect(g.open === (await page.locator('.phone.up').count()) > 0, 'open flag matches what shows').toBe(true);
        if (g.open) await page.keyboard.press('Escape');
        await expect(page.locator('.phone')).toHaveClass(/off/);
      }
      await expect.poll(async () => (await game(page)).open, { timeout: 5000 }).toBe(false);
      await expect.poll(async () => (await game(page)).state).toBe('playing');
      await openPhone(page, d.input);
      for (let i = 0; i < 3; i++) {
        await press(page, d.input, '.app-messages');
        await expect.poll(() => app(page)).toBe('messages');
        await backHome(page, d.input);
      }

      // ---- The screen changes size with the phone up (a window resized, an iPad turned) ----
      await page.setViewportSize({ width: d.height, height: d.width });
      await page.waitForTimeout(800);
      const turned = (await page.locator('.ph-device').boundingBox())!;
      expect(turned.y + turned.height).toBeLessThanOrEqual(d.width + 1);
      expect(turned.x + turned.width).toBeLessThanOrEqual(d.height + 1);
      await press(page, d.input, '.app-me');
      await expect.poll(() => app(page)).toBe('embed');
      await page.waitForTimeout(500);
      await fitsPhone(page, 'Me, turned');
      await backHome(page, d.input);
      await page.setViewportSize({ width: d.width, height: d.height });
      await page.waitForTimeout(500);

      // ---- Away, and play carries on: walking moves the player ----
      await pressShade(page, d.input);
      await expect.poll(async () => (await game(page)).state).toBe('playing');
      let moved = 0;
      for (const key of ['KeyD', 'KeyA']) {
        const x0 = (await game(page)).x;
        await page.keyboard.down(key);
        await page.waitForTimeout(1200);
        await page.keyboard.up(key);
        moved = Math.max(moved, Math.abs((await game(page)).x - x0));
      }
      expect(moved, 'the player walks again once the phone is away').toBeGreaterThan(0.05);

      expect(errors, errors.join(' | ')).toEqual([]);
    });
  });
}
