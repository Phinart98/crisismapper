import { mkdirSync } from 'node:fs'
import { test as setup, expect } from 'playwright/test'
import { DEMO_EMAIL, DEMO_PASSWORD, STAFF_STATE, waitForHydration } from './fixtures'

// Real sign-in with the public sandbox demo account; the resulting Supabase session
// cookies are persisted as storageState for the staff-gated specs.
setup('authenticate as staff', async ({ page }) => {
  setup.setTimeout(90_000)
  await page.goto('/login')
  await waitForHydration(page)
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await page.getByLabel('Password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/admin/crises', { timeout: 45_000 })
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  mkdirSync('tests/e2e/.auth', { recursive: true })
  await page.context().storageState({ path: STAFF_STATE })
})
