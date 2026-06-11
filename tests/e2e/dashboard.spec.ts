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

test('severity filter narrows the shown count', async ({ page }) => {
  await expect(page.getByText(/Showing/)).toBeVisible({ timeout: 30_000 })
  const before = await page.getByText(/Showing/).textContent()
  // Deselect one severity tier; the pill should change (or at least re-render).
  await page.getByRole('button', { name: new RegExp(EN.sevSevere, 'i') }).first().click()
  await expect(async () => {
    const after = await page.getByText(/Showing/).textContent()
    expect(after).not.toBe(before)
  }).toPass({ timeout: 15_000 })
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
