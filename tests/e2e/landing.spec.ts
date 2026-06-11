import { test, expect } from 'playwright/test'
import { guardMutations, EN, LOCALES, readLocale } from './helpers/fixtures'

test.beforeEach(async ({ page }) => { await guardMutations(page) })

test('hero CTAs route to reporter and staff login', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: EN.landingOpenReporter })).toHaveAttribute('href', '/report')
  await expect(page.getByRole('link', { name: new RegExp(EN.landingStaffCta) })).toHaveAttribute('href', '/login')
})

test('nav links are visible on every viewport (incl. mobile)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: EN.landingNavDashboard })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: EN.leaderboardTitle })).toBeVisible()
})

test('locale dropdown lists all 7 locales by native name', async ({ page }) => {
  await page.goto('/')
  const options = page.locator('.lang-select').first().locator('option')
  await expect(options).toHaveCount(7)
  const names = await options.allTextContents()
  expect(names).toEqual(['English', 'Español', 'Français', 'العربية', 'Русский', '中文', 'Kiswahili'])
})

test('live stats overlay + ticker render from the map endpoints', async ({ page }) => {
  await page.route('**/api/map/stats**', r => r.fulfill({ json: { total: 4321, coverage_pct: 12, hourly: [], duplicate_count: 0 } }))
  await page.route('**/api/map/reports**', r => r.fulfill({
    json: { type: 'FeatureCollection', features: [{ properties: { severity: 'severe', infrastructure_type: 'hospital', submitted_at: new Date().toISOString() } }] },
  }))
  await page.goto('/')
  await expect(page.getByText('4,321').first()).toBeVisible()
  await expect(page.getByText(new RegExp(EN.landingTickerNew))).toBeVisible()
})

test('ticker falls back gracefully when stats fail', async ({ page }) => {
  await page.route('**/api/map/stats**', r => r.fulfill({ status: 500, body: 'boom' }))
  await page.route('**/api/map/reports**', r => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')
  await expect(page.getByText(EN.landingTickerFallback)).toBeVisible()
})

test('footer links: leaderboard, terms, data policy — and honest 7-language meta', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')
  await expect(footer.getByRole('link', { name: EN.leaderboardTitle })).toHaveAttribute('href', '/leaderboard')
  await expect(footer.getByRole('link', { name: EN.landingFooterTerms })).toHaveAttribute('href', '/terms')
  await expect(footer.getByRole('link', { name: EN.landingFooterPrivacy })).toHaveAttribute('href', '/privacy')
  await expect(footer.getByText(EN.landingMeta)).toBeVisible()
})

test('claims framing is demo-honest', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(EN.landingMetaLive)).toBeVisible()
  await expect(page.getByText(EN.landingMapTitle)).toBeVisible()
  // The unsubstantiated numbers are gone.
  await expect(page.locator('body')).not.toContainText('94%')
  await expect(page.locator('body')).not.toContainText('<100KB')
})

test('legal pages load with back-links', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/data-deletion']) {
    await page.goto(path)
    await expect(page.getByRole('link', { name: /Back to CrisisMapper/ })).toBeVisible()
  }
})

test('locale JSON files have identical key sets (CLAUDE.md parity rule)', () => {
  const ref = Object.keys(readLocale('en')).sort()
  for (const code of LOCALES) {
    expect(Object.keys(readLocale(code)).sort(), `locale ${code}`).toEqual(ref)
  }
})
