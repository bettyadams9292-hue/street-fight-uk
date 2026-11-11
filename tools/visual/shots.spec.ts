import { expect, test } from '@playwright/test';
import { SHOT_NAMES } from '../../src/debug/shotList';
import { LOOKS } from '../../src/render/look/looks';

interface ShotState {
  ready: boolean;
  scene: string;
  error?: string;
}

/** Every scene plain (the game as shipped), plus each candidate look on the scenes that show it best. */
const LOOK_SCENES = ['spar', 'estate', 'home'] as const;
const cases: { title: string; url: string; file: string }[] = [
  ...SHOT_NAMES.map((n) => ({ title: `scene: ${n}`, url: `/?shot=${n}`, file: `${n}.png` })),
  ...LOOKS.flatMap((l) => LOOK_SCENES.map((n) => ({ title: `look ${l.id}: ${n}`, url: `/?shot=${n}&look=${l.id}`, file: `look-${l.id}-${n}.png` }))),
];

for (const { title, url, file } of cases) {
  test(title, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => (window as unknown as { __shot?: ShotState }).__shot?.ready === true, undefined, { timeout: 90_000 });
    const state = await page.evaluate(() => (window as unknown as { __shot: ShotState }).__shot);
    expect(state.error, `the scene failed to build: ${state.error}`).toBeUndefined();
    expect(errors, `the page threw: ${errors.join(' | ')}`).toEqual([]);
    await expect(page).toHaveScreenshot(file);
  });
}

test('a normal page is not a shot page', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60_000 });
  const shot = await page.evaluate(() => (window as unknown as { __shot?: unknown }).__shot);
  expect(shot).toBeUndefined();
});
