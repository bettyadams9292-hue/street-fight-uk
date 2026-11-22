/**
 * The in-game phone on every kind of screen: an iPhone either way round, an iPad either way round (touch, and a
 * trackpad), and desktop browsers at three sizes with a mouse and keys. Each run starts a real new game and works
 * through every phone app with that device's own input (phone.spec.ts).
 *
 *   npm run build && npm run phone
 *
 * Emulated in Chromium: this checks layout, hit areas and input handling at each size, not Safari itself
 * (docs/PHONE.md has the by-hand checklist for real devices).
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const base = process.env.PHONE_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: '.',
  outputDir: './out',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A new game through the creator, then every app, in software WebGL.
  timeout: 900_000,
  reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: base,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    channel: process.env.PW_CHANNEL || undefined,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--mute-audio'] },
  },
  webServer: process.env.PHONE_BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
        cwd: root,
        url: base,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
