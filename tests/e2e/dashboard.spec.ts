import { test, expect } from 'playwright/test'
import { guardMutations, waitForHydration, STAFF_STATE, EN } from './helpers/fixtures'

// Real read-only data from the dev server; guardMutations blocks anything else.
test.beforeEach(async ({ page }) => {
  await guardMutations(page)
  await page.goto('/dashboard')
  await waitForHydration(page)
})

test('map canvas renders with real height (MapLibre container gotcha)', async ({ page }) => {
  const canvas = page.locator('.maplibregl-canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  const box = await canvas.boundingBox()
  expect(box!.height).toBeGreaterThan(100)
  expect(box!.width).toBeGreaterThan(100)
})

test('header: stats, heatmap toggle, report CTA', async ({ page }) => {
  await expect(page.getByText(EN.dashReports)).toBeVisible()

  const heatmap = page.getByRole('button', { name: EN.dashHeatmap })
  await expect(heatmap).toHaveAttribute('aria-pressed', 'false')
  await heatmap.click()
  await expect(heatmap).toHaveAttribute('aria-pressed', 'true')

  const cta = page.getByRole('link', { name: EN.dashReportCta })
  await expect(cta).toHaveAttribute('href', '/report')
  await expect(cta).not.toContainText('←')
})

test('filters start inactive (All time default) and the pill appears on toggle', async ({ page }) => {
  // Default = no filters → no "Showing X of Y" pill, and old reports stay visible.
  await expect(page.getByText(EN.dashReports)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Showing/)).toHaveCount(0)

  // Selecting a severity tier activates filtering.
  await page.getByRole('button', { name: new RegExp(EN.sevSevere, 'i') }).first().click()
  await expect(page.getByText(/Showing/)).toBeVisible({ timeout: 15_000 })

  // Clear restores the unfiltered view.
  await page.getByRole('button', { name: new RegExp(EN.dashClear) }).click()
  await expect(page.getByText(/Showing/)).toHaveCount(0)
})

test('time range chips filter and reset', async ({ page }) => {
  await expect(page.getByText(EN.dashReports)).toBeVisible({ timeout: 30_000 })
  const allChip = page.getByRole('button', { name: EN.filterAllTime })
  await expect(allChip).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '24h', exact: true }).click()
  await expect(page.getByText(/Showing/)).toBeVisible({ timeout: 15_000 })

  await allChip.click()
  await expect(page.getByText(/Showing/)).toHaveCount(0)
})

test('opens on the global all-crises overview, drills into a single crisis', async ({ page }) => {
  const select = page.locator('select').filter({ hasText: 'Myanmar' })
  await expect(select).toBeVisible()
  // Default = the global view; the selector offers "All active crises" + each crisis.
  await expect(select).toHaveValue('all')
  await expect(select.locator('option').first()).toHaveText(EN.dashAllCrises)
  expect(await select.locator('option').count()).toBeGreaterThanOrEqual(3) // All + several crises

  // Header shows the active-crisis count in global mode (not coverage %).
  await expect(page.getByText(EN.dashActiveCrisesLabel, { exact: true })).toBeVisible()

  // Drilling into a crisis switches the view to it.
  await select.selectOption({ label: 'SIMEX Mandalay — Central Myanmar Earthquake' })
  await expect(select).not.toHaveValue('all')
  await expect(page.getByText(EN.dashCoverage)).toBeVisible({ timeout: 15_000 })
})

test('activity feed opens the report detail modal with a sign-in path', async ({ page }) => {
  const feedItem = page.getByRole('button', { name: new RegExp(EN.feedViewOnMap) }).first()
  await expect(feedItem).toBeVisible({ timeout: 30_000 })
  await feedItem.click()
  await expect(page.getByRole('button', { name: EN.modalClose })).toBeVisible({ timeout: 15_000 })
  // Anon viewers see the moderation hint with a working sign-in link that returns here.
  await expect(page.getByText(EN.modalModerationNote)).toBeVisible()
  await expect(page.getByRole('link', { name: EN.modalSignIn })).toHaveAttribute('href', '/login?redirect=/dashboard')
})

test.describe('staff moderation', () => {
  test.use({ storageState: STAFF_STATE })

  test('verify and flag actions round-trip (mocked write)', async ({ page }) => {
    await guardMutations(page, [/supabase/, /\/auth\//])
    let lastAction: string | null = null
    await page.route('**/api/admin/reports/*/moderate', (route) => {
      lastAction = route.request().postDataJSON().action
      const id = route.request().url().match(/reports\/([^/]+)\/moderate/)![1]
      return route.fulfill({ json: { id, is_verified: lastAction === 'verify' } })
    })
    await page.goto('/dashboard')
    await waitForHydration(page)

    const feedItem = page.getByRole('button', { name: new RegExp(EN.feedViewOnMap) }).first()
    await expect(feedItem).toBeVisible({ timeout: 30_000 })
    await feedItem.click()

    const verify = page.getByRole('button', { name: new RegExp(EN.modalVerify) }).first()
    const flag = page.getByRole('button', { name: EN.modalFlag })
    await expect(verify).toBeVisible({ timeout: 15_000 })

    // Either state is valid at open; exercise the transition both ways.
    if (await verify.isEnabled()) {
      await verify.click()
      await expect.poll(() => lastAction).toBe('verify')
      await expect(flag).toBeEnabled()
    }
    await flag.click()
    await expect.poll(() => lastAction).toBe('unverify')
    await expect(verify).toBeEnabled()
  })
})

test('export buttons are present for all four formats', async ({ page }) => {
  for (const fmt of ['GeoJSON', 'CSV', 'GPKG', 'Shapefile']) {
    await expect(page.getByRole('button', { name: fmt, exact: true })).toBeVisible()
  }
})
