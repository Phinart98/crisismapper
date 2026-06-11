import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page } from 'playwright/test'

export const LOCALES = ['en', 'es', 'fr', 'ar', 'ru', 'zh', 'sw'] as const

export function readLocale(code: string): Record<string, string> {
  return JSON.parse(readFileSync(join(import.meta.dirname, '../../../i18n/locales', `${code}.json`), 'utf8'))
}

export const EN = readLocale('en')

// Seeded demo crisis (supabase/migrations/20260507000000_seed_demo_crisis.sql).
export const DEMO_CRISIS_ID = '018f3c2a-0001-7000-8000-000000000001'
// Inside the demo bbox [95.8, 21.5, 96.5, 22.2] so GPS crisis-resolution succeeds.
export const MANDALAY = { latitude: 21.97, longitude: 96.08 }

export const STAFF_STATE = 'tests/e2e/.auth/staff.json'
export const DEMO_EMAIL = 'demo@crisismapper.app'
export const DEMO_PASSWORD = 'CrisisMapper#Demo2026'

// Prod-data safety net: the dev server talks to the real Supabase project, so every UI
// spec installs this guard. Any non-GET /api call that wasn't explicitly mocked (more
// specific routes registered later win via fallback) is rejected with a sentinel status.
export async function guardMutations(page: Page, allow: RegExp[] = []) {
  // Dev-only chrome: the Nuxt DevTools floating toggle intercepts taps near the
  // bottom edge on mobile viewports (e.g. the sticky submit footer).
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
      document.head.appendChild(style)
    })
  })
  await page.route('**/api/**', (route) => {
    const req = route.request()
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method())
    if (mutating && !allow.some(re => re.test(req.url()))) {
      return route.fulfill({ status: 599, body: 'BLOCKED: unmocked mutation in e2e' })
    }
    return route.fallback()
  })
}

// Must satisfy isAiUsable(): a 'degraded' provider would be treated as no-AI.
export const AI_FIXTURE = {
  severity: 'severe',
  confidence: 0.91,
  damage_percentage: 60,
  reasoning: 'Partial structural collapse of the front facade with exposed rebar.',
  damage_indicators: ['collapsed wall', 'exposed rebar'],
  infrastructure_visible: true,
  photo_quality: 'good',
  recommendation: 'Prioritize structural assessment before reoccupation.',
  _meta: { provider: 'groq', model: 'e2e-mock', duration_ms: 5, fallback_used: false },
}

export const PROFILE_FIXTURE = {
  found: true,
  nickname: 'anon_swift_falcon',
  trust_tier: 'contributing',
  badges: ['first_responder', 'pioneer'],
  total: 12,
  verified: 4,
  zones: 3,
  impact_km2: 0.03,
  crisis_name: 'Myanmar Earthquake 2026',
  recent: [
    { id: '00000000-0000-7000-8000-00000000000a', severity: 'severe', damage_classification: 'complete', infrastructure_type: 'building', submitted_at: new Date().toISOString(), is_verified: true },
    { id: '00000000-0000-7000-8000-00000000000b', severity: 'moderate', damage_classification: 'partial', infrastructure_type: 'road', submitted_at: new Date().toISOString(), is_verified: false },
  ],
}

export const LEADERBOARD_FIXTURE = [
  { rank: 1, nickname: 'anon_swift_falcon', badges: 4, reports: 31, trust_tier: 'trusted', area: 'Myanmar Earthquake 2026', multi_crisis: false, isMe: true },
  { rank: 2, nickname: 'anon_calm_otter', badges: 2, reports: 18, trust_tier: 'contributing', area: 'Myanmar Earthquake 2026', multi_crisis: false, isMe: false },
  { rank: 3, nickname: 'anon_bold_ibis', badges: 1, reports: 9, trust_tier: 'contributing', area: 'Myanmar Earthquake 2026', multi_crisis: false, isMe: false },
  { rank: 4, nickname: 'anon_keen_lynx', badges: 0, reports: 4, trust_tier: 'unverified', area: 'Myanmar Earthquake 2026', multi_crisis: false, isMe: false },
]

// Switch locale through the overlay-select dropdown and wait for <html lang>.
// Retried: a select fired before Vue hydration changes the native control but
// never reaches the @change listener, so re-fire until the locale actually flips.
export async function setLocale(page: Page, code: string, htmlLang = code) {
  await expect(async () => {
    await page.locator('.lang-select').first().selectOption(code)
    await page.waitForFunction(l => document.documentElement.lang === l, htmlLang, { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
}

// Dexie pending_reports row count, read via raw IndexedDB.
export async function countPending(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('crisismapper')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      if (!db.objectStoreNames.contains('pending_reports')) { db.close(); resolve(0); return }
      const tx = db.transaction('pending_reports', 'readonly')
      const req = tx.objectStore('pending_reports').count()
      req.onsuccess = () => { db.close(); resolve(req.result) }
      req.onerror = () => { db.close(); reject(req.error) }
    }
  }))
}

// The photo pipeline lazily downloads the mediapipe face-detection WASM (~6MB CDN
// fetch) — slow and flaky under parallel workers. Face detection is explicitly
// non-fatal in usePhotoPipeline, so failing those requests fast keeps the wizard
// deterministic and quick.
export async function blockFaceDetectionCdn(page: Page) {
  await page.route('https://cdn.jsdelivr.net/**', r => r.abort())
  await page.route('https://storage.googleapis.com/**', r => r.abort())
}

// Interactions fired before Vue hydration vanish (no listeners attached yet, and
// hydration resets DOM state). Vue marks the root container once mounted.
export async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => !!(document.querySelector('#__nuxt') as any)?.__vue_app__,
    undefined,
    { timeout: 60_000 },
  )
}

// Drive the wizard through photo -> AI -> GPS -> infra. Callers mock routes first.
export async function fillWizardToStep5(page: Page) {
  await waitForHydration(page)
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/sample.jpg')
  // Compression worker + dev-server compiles still need patience on a cold run.
  await page.getByRole('button', { name: EN.aiConfirm }).click({ timeout: 60_000 })
  await page.getByRole('button', { name: EN.gpsBtn }).click()
  await page.getByText(EN.gpsLocated).waitFor()
  await page.getByRole('button', { name: EN.infraBuilding, exact: true }).click()
  await page.getByText(EN.step5label).waitFor()
}
