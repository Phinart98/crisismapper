import { test, expect } from 'playwright/test'
import { fillWizardToStep5, MANDALAY, EN } from './helpers/fixtures'

// OPERATOR-ONLY: one genuine end-to-end submission against the live Supabase project.
// Off by default — run with:  E2E_REAL_SUBMIT=1 npx playwright test real-submit --project=chromium
// Cleanup needs NUXT_DB_URL in the environment (same value the dev server uses).
const ENABLED = !!process.env.E2E_REAL_SUBMIT

test.skip(!ENABLED, 'real submission disabled (set E2E_REAL_SUBMIT=1)')

const TAG = `E2E-TEST-${Date.now()}`

test.use({ geolocation: MANDALAY, permissions: ['geolocation'] })

test.afterAll(async () => {
  if (!ENABLED || !process.env.NUXT_DB_URL) return
  const { default: postgres } = await import('postgres')
  const sql = postgres(process.env.NUXT_DB_URL, { prepare: false, max: 1 })
  await sql`DELETE FROM damage_reports WHERE description LIKE 'E2E-TEST-%'`
  await sql.end()
})

test('one real report lands in the database', async ({ page }) => {
  test.setTimeout(120_000)
  // Tag the genuine request via the schema-accepted description field (no UI for it),
  // so afterAll cleanup can find the row. The request still hits the real server.
  await page.route('**/api/reports', (route) => {
    const body = route.request().postDataJSON()
    return route.continue({ postData: JSON.stringify({ ...body, description: TAG }) })
  })
  await page.goto('/report')
  await fillWizardToStep5(page)
  await page.getByRole('button', { name: EN.submit }).click()
  await expect(page.getByText(EN.confirmLabel).first()).toBeVisible({ timeout: 60_000 })
})
