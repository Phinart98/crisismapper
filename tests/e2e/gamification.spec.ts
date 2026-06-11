import { test, expect } from 'playwright/test'
import { guardMutations, EN, PROFILE_FIXTURE, LEADERBOARD_FIXTURE } from './helpers/fixtures'

test.beforeEach(async ({ page }) => { await guardMutations(page) })

test.describe('/me profile', () => {
  test('empty state invites the first report', async ({ page }) => {
    await page.route('**/api/me', r => r.fulfill({ json: { found: false } }))
    await page.goto('/me')
    await expect(page.getByText(EN.meEmptyTitle)).toBeVisible()
    await expect(page.getByRole('link', { name: EN.meEmptyCta })).toHaveAttribute('href', '/report')
  })

  test('populated profile shows nickname, stats and badges', async ({ page }) => {
    await page.route('**/api/me', r => r.fulfill({ json: PROFILE_FIXTURE }))
    await page.goto('/me')
    await expect(page.getByText(PROFILE_FIXTURE.nickname)).toBeVisible()
    await expect(page.getByText(EN.meStatsTotal)).toBeVisible()
    await expect(page.getByText(String(PROFILE_FIXTURE.total)).first()).toBeVisible()
    await expect(page.getByText(EN.meBadges).first()).toBeVisible()
    await expect(page.getByText(EN.meRecent)).toBeVisible()
  })

  test('nav links: back to report, forward to leaderboard', async ({ page }) => {
    await page.route('**/api/me', r => r.fulfill({ json: { found: false } }))
    await page.goto('/me')
    await expect(page.getByRole('link', { name: new RegExp(EN.meBack) }).first()).toHaveAttribute('href', '/report')
    await expect(page.getByRole('link', { name: new RegExp(EN.meBoard) }).first()).toHaveAttribute('href', '/leaderboard')
  })
})

test.describe('/leaderboard', () => {
  test('podium + ranked rows render, current device is flagged', async ({ page }) => {
    await page.route('**/api/leaderboard', r => r.fulfill({ json: LEADERBOARD_FIXTURE }))
    await page.goto('/leaderboard')
    await expect(page.getByText(EN.leaderboardHeading)).toBeVisible()
    await expect(page.getByText('swift_falcon').first()).toBeVisible()
    await expect(page.getByText('calm_otter').first()).toBeVisible()
    await expect(page.getByText(EN.leaderboardYou).first()).toBeVisible()
    await expect(page.getByText(EN.leaderboardPrivacyStrong)).toBeVisible()
  })

  test('tab switch re-queries with scope=all', async ({ page }) => {
    const scopes: string[] = []
    await page.route('**/api/leaderboard', (r) => {
      scopes.push(r.request().postDataJSON().scope)
      return r.fulfill({ json: LEADERBOARD_FIXTURE })
    })
    await page.goto('/leaderboard')
    // Wait for fetched rows (not SSR text) — proves hydration finished before clicking.
    await expect(page.getByText('calm_otter').first()).toBeVisible()
    await page.getByRole('button', { name: EN.leaderboardTabAll }).click()
    await expect.poll(() => scopes).toContain('all')
  })

  test('empty leaderboard shows the empty message', async ({ page }) => {
    await page.route('**/api/leaderboard', r => r.fulfill({ json: [] }))
    await page.goto('/leaderboard')
    await expect(page.getByText(EN.leaderboardEmpty)).toBeVisible()
  })
})
