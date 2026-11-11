import { expect, test } from '@playwright/test';
import { SHOT_NAMES } from '../../src/debug/shotList';

interface ShotState {
  ready: boolean;
  scene: string;
  error?: string;
}

for (const name of SHOT_NAMES) {
  test(`scene: ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/?shot=${name}`);
    await page.waitForFunction(() => (window as unknown as { __shot?: ShotState }).__shot?.ready === true, undefined, { timeout: 90_000 });
    const state = await page.evaluate(() => (window as unknown as { __shot: ShotState }).__shot);
    expect(state.error, `the scene failed to build: ${state.error}`).toBeUndefined();
    expect(errors, `the page threw: ${errors.join(' | ')}`).toEqual([]);
    await expect(page).toHaveScreenshot(`${name}.png`);
  });
}

test('a normal page is not a shot page', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60_000 });
  const shot = await page.evaluate(() => (window as unknown as { __shot?: unknown }).__shot);
  expect(shot).toBeUndefined();
});
