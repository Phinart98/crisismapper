import { test, expect } from 'playwright/test'
import { guardMutations, EN } from './helpers/fixtures'

test.beforeEach(async ({ page }) => { await guardMutations(page) })

test('no horizontal overflow on the civilian pages', async ({ page }) => {
  for (const path of ['/', '/report', '/leaderboard']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBe(false)
  }
})

test('dashboard header does not clip its controls', async ({ page }) => {
  // The header is overflow-hidden, so document-level overflow checks can't see
  // internal clipping — measure the header element itself.
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: EN.dashReportCta })).toBeVisible({ timeout: 30_000 })
  const clipped = await page.locator('header').first().evaluate(el => el.scrollWidth > el.clientWidth)
  expect(clipped).toBe(false)
})

test('primary interactive elements meet the 44px touch target (36px secondary chips)', async ({ page }) => {
  await page.goto('/')
  const targets = [
    page.getByRole('link', { name: EN.landingOpenReporter }),
    page.getByRole('link', { name: new RegExp(EN.landingStaffCta) }),
    page.getByRole('link', { name: EN.landingNavDashboard }),
  ]
  for (const t of targets) {
    const box = await t.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  // Locale switcher is a documented 36px secondary chip.
  const chip = await page.locator('.lang-trigger').first().boundingBox()
  expect(chip!.height).toBeGreaterThanOrEqual(36)
})

test('form inputs are ≥16px to avoid iOS zoom-on-focus', async ({ page }) => {
  await page.goto('/login')
  for (const sel of ['input[type=email]', 'input[type=password]']) {
    const size = await page.locator(sel).evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(16)
  }
  await page.goto('/report')
  const langSelect = await page.locator('.lang-select').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  expect(langSelect).toBeGreaterThanOrEqual(16)
})

test('keyboard focus is visible on tab navigation', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const hasVisibleFocus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    if (!el || el === document.body) return false
    const s = getComputedStyle(el)
    return s.outlineWidth !== '0px' || s.boxShadow !== 'none'
  })
  expect(hasVisibleFocus).toBe(true)
})

test('language dropdown is keyboard-operable with a visible focus ring on the trigger', async ({ page }) => {
  await page.goto('/')
  await page.locator('.lang-select').first().focus()
  const triggerOutline = await page.locator('.lang-trigger').first().evaluate(el => getComputedStyle(el).outlineWidth)
  expect(triggerOutline).not.toBe('0px')
})
