import { test, expect } from 'playwright/test'
import { guardMutations, waitForHydration, STAFF_STATE, DEMO_EMAIL } from './helpers/fixtures'

test.describe('anonymous access', () => {
  test('login page has a back-to-home link', async ({ page }) => {
    await guardMutations(page, [/supabase/])
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', '/')
  })

  test('/admin/* bounces anonymous visitors to /login', async ({ page }) => {
    await guardMutations(page, [/supabase/])
    for (const path of ['/admin/crises', '/admin/staff', '/admin/languages']) {
      await page.goto(path)
      await page.waitForURL('**/login**', { timeout: 15_000 })
    }
  })

  test('wrong password shows an error, not a session', async ({ page }) => {
    await guardMutations(page, [/supabase/, /auth/])
    await page.goto('/login')
    // Retried: interactions fired before Vue hydration are lost (inputs reset).
    await expect(async () => {
      await page.getByLabel('Email').fill(DEMO_EMAIL)
      await page.getByLabel('Password').fill('definitely-wrong')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByText('Incorrect email or password.')).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 40_000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('staff session', () => {
  test.use({ storageState: STAFF_STATE })

  test.beforeEach(async ({ page }) => {
    // Read-only inside admin: every admin mutation stays blocked; only Supabase auth
    // endpoints (session refresh) are allowed through.
    await guardMutations(page, [/supabase/, /\/auth\//])
  })

  test('admin console renders with nav + crises list', async ({ page }) => {
    await page.goto('/admin/crises')
    await expect(page.getByRole('link', { name: 'Crises', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Languages', exact: true })).toBeVisible()
    await expect(page.getByText('Myanmar Earthquake 2026').first()).toBeVisible({ timeout: 20_000 })
  })

  test('staff list renders the allowlist with login status', async ({ page }) => {
    await page.goto('/admin/staff')
    await expect(page.locator('main').getByText(DEMO_EMAIL).first()).toBeVisible({ timeout: 20_000 })
  })

  test('languages console renders the locale bootstrap tool', async ({ page }) => {
    await page.goto('/admin/languages')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('sign out ends the session', async ({ page }) => {
    await page.goto('/admin/crises')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('**/login**', { timeout: 15_000 })
    // The session is really gone: an admin page bounces again.
    await page.goto('/admin/crises')
    await page.waitForURL('**/login**', { timeout: 15_000 })
  })
})
