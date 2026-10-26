import { test, expect } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'
import { emptyBook } from '../src/lib/ledger'
const owner = '6dcd01b4-50e8-4654-b95d-9e975ed11447'
const user = {
  id: owner,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'mobile@example.com',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
async function mockCloud(context: BrowserContext) {
  let refreshes = 0
  await context.route('https://bxywdeuffodtfrgpidwk.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/token')) {
      if (url.searchParams.get('grant_type') === 'refresh_token') refreshes++
      const exp = Math.floor(Date.now() / 1000) + 3600
      const token =
        [
          { alg: 'HS256', typ: 'JWT' },
          { sub: owner, exp, role: 'authenticated' },
        ]
          .map((x) => Buffer.from(JSON.stringify(x)).toString('base64url'))
          .join('.') + '.mock'
      await route.fulfill({
        json: {
          access_token: token,
          refresh_token: 'mock-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: exp,
          user,
        },
      })
    } else if (url.pathname.endsWith('/user')) await route.fulfill({ json: user })
    else if (url.pathname.includes('/rest/v1/finance_books'))
      await route.fulfill({
        json: { book: emptyBook(), revision: 1, mutation_id: crypto.randomUUID() },
      })
    else await route.fulfill({ status: 204 })
  })
  await context.routeWebSocket(/supabase\.co/, (ws) => ws.close())
  return () => refreshes
}
test('mobile login is visible, supports password reveal and persists across a browser restart with token refresh', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await mockCloud(context)
  const page = await context.newPage()
  await page.goto('/')
  const login = page.getByRole('button', { name: '登入', exact: true })
  await expect(login).toBeInViewport()
  await login.click()
  const dialog = page.getByRole('dialog', { name: '歡迎回來' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('電子郵件', { exact: true }).fill('mobile@example.com')
  await dialog.getByLabel('密碼', { exact: true }).fill('test-password-123')
  await dialog.getByRole('button', { name: '顯示密碼', exact: true }).click()
  await expect(dialog.getByLabel('密碼', { exact: true })).toHaveAttribute('type', 'text')
  await dialog.getByRole('button', { name: '登入並同步帳簿' }).click()
  await expect(page.getByText('雲端帳簿 · mobile@example.com', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('雲端帳簿 · mobile@example.com', { exact: true })).toBeVisible()
  const state = await context.storageState()
  const binding = state.origins
    .flatMap((x) => x.localStorage)
    .find((x) => x.name.endsWith('-auth-token'))!
  expect(binding).toBeTruthy()
  const saved = JSON.parse(binding.value)
  saved.expires_at = 1
  binding.value = JSON.stringify(saved)
  await context.close()
  const restored = await browser.newContext({
    storageState: state,
    viewport: { width: 390, height: 844 },
  })
  const refreshes = await mockCloud(restored)
  const reopened = await restored.newPage()
  await reopened.goto('/')
  await expect(reopened.getByText('雲端帳簿 · mobile@example.com', { exact: true })).toBeVisible()
  expect(refreshes()).toBeGreaterThan(0)
  await expect(reopened.getByRole('button', { name: '登入並同步帳簿' })).toHaveCount(0)
  await reopened.getByRole('button', { name: '登出', exact: true }).click()
  await expect(reopened.getByRole('button', { name: '登入', exact: true })).toBeVisible()
  await reopened.reload()
  await expect(reopened.getByRole('button', { name: '登入', exact: true })).toBeVisible()
  await restored.close()
})
test('320px login dialog fits, switches to signup and closes with Escape', async ({
  page,
  context,
}) => {
  await mockCloud(context)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '建立帳號', exact: true }).click()
  await expect(page.getByLabel('密碼', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '登入', exact: true })).toBeFocused()
})
