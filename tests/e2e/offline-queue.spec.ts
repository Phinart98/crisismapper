import { test, expect } from 'playwright/test'
import { guardMutations, blockFaceDetectionCdn, fillWizardToStep5, countPending, AI_FIXTURE, MANDALAY, EN } from './helpers/fixtures'

const REPORT_ID = '00000000-0000-7000-8000-0000000000f1'

test.use({ geolocation: MANDALAY, permissions: ['geolocation'] })
test.describe.configure({ timeout: 120_000 })

test('offline submit queues locally, then drains once back online', async ({ page, context }) => {
  await guardMutations(page)
  await blockFaceDetectionCdn(page)
  await page.route('**/api/ai/classify', r => r.fulfill({ json: AI_FIXTURE }))
  // Fail first: simulate the network being gone for the metadata POST.
  let online = false
  await page.route('**/api/reports', (r) => {
    if (!online) return r.abort('internetdisconnected')
    return r.fulfill({ status: 201, json: { id: REPORT_ID } })
  })
  await page.route(`**/api/reports/${REPORT_ID}/photo`, r => r.fulfill({ json: { id: REPORT_ID } }))
  await page.route('**/api/map/stats**', r => r.fulfill({ json: { total: 1, coverage_pct: 1, hourly: [], duplicate_count: 0 } }))
  await page.route('**/api/me', r => r.fulfill({ json: { found: false } }))

  await page.goto('/report')
  // Photo + AI steps need the network (mediapipe CDN); go "offline" after them.
  await fillWizardToStep5(page)
  await context.setOffline(true)

  await page.getByRole('button', { name: EN.submit }).click()

  // Queued confirm screen + Dexie row + pending badge.
  await expect(page.getByText(EN.queuedTitle)).toBeVisible({ timeout: 20_000 })
  expect(await countPending(page)).toBe(1)
  await expect(page.getByRole('button', { name: new RegExp(`${EN.pending}.*1`) })).toBeVisible()

  // Reconnect. The offline-sync plugin auto-flushes on the 'online' event, so the
  // queue may drain before (or instead of) a manual badge click — accept either path.
  // Once drained the badge unmounts entirely (hidden at zero pending).
  online = true
  await context.setOffline(false)
  await page.getByRole('button', { name: new RegExp(`${EN.pending}.*\\(1\\)`) }).click({ timeout: 3_000 }).catch(() => {})
  await expect(page.getByRole('button', { name: new RegExp(EN.pending) })).toBeHidden({ timeout: 30_000 })
  expect(await countPending(page)).toBe(0)
})

test('queued rows survive a reload (IndexedDB persistence)', async ({ page, context }) => {
  await guardMutations(page)
  await blockFaceDetectionCdn(page)
  await page.route('**/api/ai/classify', r => r.fulfill({ json: AI_FIXTURE }))
  await page.route('**/api/reports', r => r.abort('internetdisconnected'))

  await page.goto('/report')
  await fillWizardToStep5(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: EN.submit }).click()
  await expect(page.getByText(EN.queuedTitle)).toBeVisible({ timeout: 20_000 })

  await context.setOffline(false)
  await page.reload()
  expect(await countPending(page)).toBe(1)
  // The sync tray invites the user to upload the stranded report.
  await expect(page.getByText(EN.syncTitle).first()).toBeVisible()
})
