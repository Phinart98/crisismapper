import { test, expect } from 'playwright/test'
import { guardMutations, waitForHydration, EN } from './helpers/fixtures'

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

test('crisis selector lists the active crises', async ({ page }) => {
  const select = page.locator('select').filter({ hasText: 'Myanmar' })
  await expect(select).toBeVisible()
  const options = await select.locator('option').count()
  expect(options).toBeGreaterThanOrEqual(1)
})

test('activity feed opens the report detail modal', async ({ page }) => {
  const feedItem = page.getByRole('button', { name: new RegExp(EN.feedViewOnMap) }).first()
  await expect(feedItem).toBeVisible({ timeout: 30_000 })
  await feedItem.click()
  await expect(page.getByRole('button', { name: EN.modalClose })).toBeVisible({ timeout: 15_000 })
  // Anon viewers see the moderation hint, not active moderation buttons.
  await expect(page.getByText(EN.modalModerationNote)).toBeVisible()
})

test('export buttons are present for all four formats', async ({ page }) => {
  for (const fmt of ['GeoJSON', 'CSV', 'GPKG', 'Shapefile']) {
    await expect(page.getByRole('button', { name: fmt, exact: true })).toBeVisible()
  }
})
