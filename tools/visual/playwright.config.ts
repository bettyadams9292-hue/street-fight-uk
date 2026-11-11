/**
 * Visual regression tests: every scene in src/debug/shotList.ts is drawn on a
 * fixed clock with fixed random numbers and compared with its stored picture
 * in tools/visual/baseline/.
 *
 *   npm run build && npm run visual            compare
 *   npm run build && npm run visual:update     accept the current pictures as the new baseline
 *
 * Pictures depend on the machine that draws them (software WebGL here), so the
 * baselines are made by CI, not on a developer's laptop.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  outputDir: './out',
  snapshotPathTemplate: '{testDir}/baseline/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
  expect: {
    // A few stray pixels of anti-aliasing are not a regression; a moved limb or a changed light is.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.15, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    // PW_CHANNEL=chrome uses an installed Chrome instead of Playwright's own download.
    channel: process.env.PW_CHANNEL || undefined,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--mute-audio'] },
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    cwd: root,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
