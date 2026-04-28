import { test, expect } from '@playwright/test'

test.describe('Login smoke', () => {
  test('login page renders the e-mail field', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  })

  test('unauthenticated / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows OTP step after entering email', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')
    // After submitting we should see either the OTP input or a "check your email" message
    await expect(
      page.locator('input[name="token"], [data-testid="otp-step"], text=Doğrulama')
    ).toBeVisible({ timeout: 8_000 })
  })
})
