import { test, expect } from 'playwright/test'
import { guardMutations, setLocale, LOCALES, readLocale } from './helpers/fixtures'

// nuxt.config.ts locale `language` values drive <html lang>.
const HTML_LANG: Record<string, string> = { zh: 'zh-CN' }

test.beforeEach(async ({ page }) => { await guardMutations(page) })

for (const code of LOCALES) {
  test(`locale ${code}: html lang/dir + translated nav`, async ({ page }) => {
    const messages = readLocale(code)
    await page.goto('/')
    await setLocale(page, code, HTML_LANG[code] ?? code)
    await expect(page.locator('html')).toHaveAttribute('dir', messages.dir)
    await expect(page.getByRole('link', { name: messages.landingNavDashboard })).toBeVisible()
    await expect(page.getByRole('link', { name: messages.landingOpenReporter })).toBeVisible()
  })
}

test('arabic flips layout to RTL without horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await setLocale(page, 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('locale choice persists across reload (cookie)', async ({ page }) => {
  await page.goto('/')
  await setLocale(page, 'fr')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  const fr = readLocale('fr')
  await expect(page.getByRole('link', { name: fr.landingNavDashboard })).toBeVisible()
})

test('locale carries across page navigation', async ({ page }) => {
  await page.goto('/')
  await setLocale(page, 'es')
  const es = readLocale('es')
  await page.getByRole('link', { name: es.landingOpenReporter }).click()
  await page.waitForURL('**/report')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.getByText(es.step1label)).toBeVisible()
})
