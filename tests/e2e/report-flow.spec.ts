import { test, expect } from 'playwright/test'
import { guardMutations, blockFaceDetectionCdn, fillWizardToStep5, waitForHydration, AI_FIXTURE, MANDALAY, MID_PACIFIC, EN } from './helpers/fixtures'

const REPORT_ID = '00000000-0000-7000-8000-0000000000e2'

test.use({ geolocation: MANDALAY, permissions: ['geolocation'] })
test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await guardMutations(page)
  await blockFaceDetectionCdn(page)
  await page.route('**/api/ai/classify', r => r.fulfill({ json: AI_FIXTURE }))
  await page.route('**/api/reports', r => r.fulfill({ status: 201, json: { id: REPORT_ID } }))
  await page.route(`**/api/reports/${REPORT_ID}/photo`, r => r.fulfill({ json: { id: REPORT_ID, photo_url: 'mock' } }))
  // Confirm-screen extras (rank + profile) — deterministic mocks.
  await page.route('**/api/map/stats**', r => r.fulfill({ json: { total: 161, coverage_pct: 3, hourly: [], duplicate_count: 0 } }))
  await page.route('**/api/me', r => r.fulfill({ json: { found: false } }))
})

test('full 5-step wizard submits and shows the synced confirm screen', async ({ page }) => {
  await page.goto('/report')
  await fillWizardToStep5(page)

  // AI assessment surfaced the mocked stats; reasoning lives in the accordion.
  await expect(page.getByText(`${AI_FIXTURE.damage_percentage}%`).first()).toBeVisible()
  await page.getByRole('button', { name: EN.reasoningTitle }).click()
  await expect(page.getByText(AI_FIXTURE.reasoning)).toBeVisible()

  // Step 5 structured chips: one of each flavor.
  await page.getByRole('button', { name: EN.extraToggle }).click()
  await page.getByRole('button', { name: EN.elecNone }).click()
  await page.getByRole('button', { name: EN.needWater, exact: true }).click()
  await page.getByRole('button', { name: EN.needShelter, exact: true }).click()
  await page.getByRole('button', { name: EN.vulnChildren, exact: true }).click()
  await page.getByRole('button', { name: '50-200' }).click()

  const reportPost = page.waitForRequest(req => req.url().includes('/api/reports') && req.method() === 'POST' && !req.url().includes('photo'))
  await page.getByRole('button', { name: EN.submit }).click()
  const posted = (await reportPost).postDataJSON()

  // The payload is the structured Core Questions shape (regression: free text used to 400).
  expect(posted.electricity_status).toBe('non-functional')
  expect(posted.community_needs).toEqual(['water', 'shelter'])
  expect(posted.vulnerable_groups).toEqual(['children'])
  expect(posted.affected_population).toBe('50-200')
  expect(posted.severity).toBe('complete') // AI 'severe' → UI 'complete' (4→3 tier)
  expect(posted.location_method).toBe('gps')

  await expect(page.getByText(EN.confirmLabel).first()).toBeVisible()
  await expect(page.getByRole('button', { name: EN.confirmAnother })).toBeVisible()
  // Synced (not queued) and no photo error.
  await expect(page.getByText(EN.queuedTitle)).toHaveCount(0)
  await expect(page.getByText(EN.photoFailedNote)).toHaveCount(0)
})

test('degraded AI falls back to manual severity selection', async ({ page }) => {
  await page.route('**/api/ai/classify', r => r.fulfill({
    json: { ...AI_FIXTURE, severity: 'unknown', confidence: 0, _meta: { ...AI_FIXTURE._meta, provider: 'degraded' } },
  }))
  await page.goto('/report')
  await waitForHydration(page)
  await page.getByRole('button', { name: EN.gpsBtn }).click()
  await page.getByText(EN.gpsLocated).waitFor()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/sample.jpg')
  // The visible degraded indicator is the offline banner; manual severity chips remain.
  await expect(page.getByText(EN.aiOffline)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: EN.sevPartial, exact: true })).toBeVisible()
})

test('denied geolocation falls back to Plus Code entry', async ({ page, context }) => {
  await context.clearPermissions()
  await page.goto('/report')
  await waitForHydration(page)
  // Location is step 1 now — Plus Code lives in the same step as the GPS button.
  await page.getByRole('button', { name: EN.gpsBtn }).click()
  await expect(page.getByText(EN.gpsDenied)).toBeVisible({ timeout: 15_000 })
  await page.getByPlaceholder(EN.gpsPlaceholder).fill('7MRX+PG Mandalay')
  await page.getByPlaceholder(EN.gpsPlaceholder).press('Enter')
  await expect(page.getByText(EN.gpsLocated)).toBeVisible()
})

test('photo-upload failure after metadata success is surfaced, not silent', async ({ page }) => {
  await page.route(`**/api/reports/${REPORT_ID}/photo`, r => r.fulfill({ status: 500, body: 'storage down' }))
  await page.goto('/report')
  await fillWizardToStep5(page)
  await page.getByRole('button', { name: EN.submit }).click()
  await expect(page.getByText(EN.confirmLabel).first()).toBeVisible()
  await expect(page.getByText(EN.photoFailedNote)).toBeVisible()
})

test.describe('no-crisis path', () => {
  test.use({ geolocation: MID_PACIFIC })

  test('location outside every crisis zone blocks the flow with the notice', async ({ page }) => {
    await page.goto('/report')
    await waitForHydration(page)
    // Location is step 1; resolving outside every zone blocks BEFORE the photo step.
    await page.getByRole('button', { name: EN.gpsBtn }).click()
    await page.getByText(EN.gpsLocated).waitFor()

    await expect(page.getByText(EN.noCrisisTitle)).toBeVisible()
    await expect(page.getByRole('link', { name: EN.noCrisisDashboardCta })).toHaveAttribute('href', '/dashboard')
    // The flow is blocked: no photo capture, no infrastructure step, no submit.
    await expect(page.getByRole('button', { name: EN.capture })).toHaveCount(0)
    await expect(page.getByText(EN.step4title)).toHaveCount(0)
    await expect(page.getByRole('button', { name: EN.submit })).toHaveCount(0)
  })
})

test('invalid Plus Code shows a validation error', async ({ page, context }) => {
  await context.clearPermissions()
  await page.goto('/report')
  await waitForHydration(page)
  // The Plus Code field is in the first (location) step — reachable immediately.
  await page.getByPlaceholder(EN.gpsPlaceholder).fill('not-a-plus-code')
  await page.getByPlaceholder(EN.gpsPlaceholder).press('Enter')
  await expect(page.getByText(EN.gpsInvalid)).toBeVisible()
})
