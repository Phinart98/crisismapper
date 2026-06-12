import { defineConfig, devices } from 'playwright/test'

// serviceWorkers:'block' kills the dev-SW stale-precache hydration trap; the offline
// queue drains via foreground fetch, so offline tests are unaffected.
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // Capped: the photo pipeline (compression worker + mediapipe) is heavy, and all
  // workers share one Nuxt dev server.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  // One local retry absorbs dev-server transients (HMR restarts, slow cold compiles).
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    {
      // Civilian-facing subset on a phone viewport; staff/API specs are desktop-only.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(landing|i18n|report-flow|offline-queue|a11y-responsive)\.spec\.ts/,
    },
  ],
})
