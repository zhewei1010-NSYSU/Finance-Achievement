import { test, expect } from '@playwright/test'
const key = 'my-finance-dashboard.v1'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
})
test('首頁呈現預設資料、互動圖表、深色模式與所有頁面', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await expect(page.getByRole('heading', { name: '好好生活，慢慢變富。.' })).toBeVisible()
  await expect(page.getByRole('img', { name: '完成 25%' })).toBeVisible()
  await expect(page.getByText('NT$10,000', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '切換深色模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  for (const name of ['帳戶管理', '收支紀錄', '理財規劃', '財務健檢', '資料與備份', '儲蓄目標']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
    await expect(page.locator('h1')).toContainText(name)
  }
  expect(errors).toEqual([])
})
test('帳戶 CRUD、目標連動、達成只播放一次並保留完成紀錄', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '帳戶管理', exact: true }).click()
  await page.getByRole('button', { name: '新增帳戶', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('帳戶名稱').fill('測試旅遊基金')
  await dialog.getByLabel('目前餘額（NT$）').fill('2000')
  await dialog.getByRole('button', { name: '儲存帳戶' }).click()
  await expect(page.getByRole('heading', { name: '測試旅遊基金' })).toBeVisible()
  await page.getByRole('button', { name: '刪除測試旅遊基金' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  await expect(page.getByRole('heading', { name: '測試旅遊基金' })).toHaveCount(0)
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標' }).click()
  await page.getByRole('button', { name: '更新餘額' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('目前餘額（NT$）').fill('40000')
  await dialog.getByRole('button', { name: '儲存帳戶' }).click()
  await expect(page.getByRole('heading', { name: '恭喜！儲蓄目標達成' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('NT$40,000')
  await page.getByRole('button', { name: '收藏這份成就' }).click()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標' }).click()
  await page.getByRole('button', { name: '完成紀錄', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /第一桶金/ })
    .click()
  await expect(page.getByRole('heading', { name: '恭喜！儲蓄目標達成' })).toBeVisible()
})
test('實際刷卡與還卡費流程只計一次支出', async ({ page }) => {
  await page.getByRole('button', { name: '記一筆', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('金額（NT$）').fill('1000')
  await dialog.getByLabel('交易帳戶').selectOption('card')
  await dialog.getByLabel('備註').fill('測試刷卡')
  await dialog.getByRole('button', { name: '新增紀錄', exact: true }).click()
  await page.getByRole('button', { name: '記一筆', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '轉帳／還卡費' }).click()
  await dialog.getByLabel('金額（NT$）').fill('1000')
  await dialog.getByLabel('來源帳戶').selectOption('post')
  await dialog.getByLabel('目的帳戶').selectOption('card')
  await dialog.getByRole('button', { name: '新增紀錄', exact: true }).click()
  const d = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(d.accounts.find((a: { id: string }) => a.id === 'post').balance).toBe(9000)
  expect(d.accounts.find((a: { id: string }) => a.id === 'card').balance).toBe(0)
  expect(d.transactions.filter((t: { type: string }) => t.type === 'expense')).toHaveLength(1)
  await expect(page.locator('.monthly-line').filter({ hasText: '每月支出' })).toContainText(
    'NT$1,000',
  )
})
test('新增、編輯、刪除多個儲蓄目標', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標' }).click()
  await page.getByRole('button', { name: '新增目標' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('儲蓄目標名稱').fill('出國旅遊')
  await dialog.getByLabel('目標金額（NT$）').fill('80000')
  await dialog.getByLabel('截止日期').fill('2027-12-31')
  await dialog.getByRole('button', { name: '儲存目標' }).click()
  await expect(page.getByRole('heading', { name: '出國旅遊' })).toBeVisible()
  await page.getByRole('button', { name: '編輯出國旅遊' }).click()
  await page.getByLabel('儲蓄目標名稱').fill('日本旅遊')
  await page.getByRole('button', { name: '儲存目標' }).click()
  await expect(page.getByRole('heading', { name: '日本旅遊' })).toBeVisible()
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '日本旅遊' }) })
  await card.getByRole('button', { name: '刪除目標' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  await expect(page.getByRole('heading', { name: '日本旅遊' })).toHaveCount(0)
})
test('規劃即時試算、儲存、重整保留', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '理財規劃', exact: true }).click()
  await page.getByLabel('實領月薪（NT$）').fill('40000')
  await page.getByLabel('每月生活費（NT$）').fill('15000')
  await page.getByLabel('每月孝親費（NT$）').fill('5000')
  await page.getByLabel('每月儲蓄金額（NT$）').fill('10000')
  await page.getByLabel('每月投資金額（NT$）').fill('5000')
  await expect(page.locator('.plan-summary')).toContainText('NT$5,000')
  await expect(page.locator('.summary-pair')).toContainText('25.0%')
  await page.getByRole('button', { name: '儲存理財規劃' }).click()
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: '理財規劃', exact: true }).click()
  await expect(page.getByLabel('實領月薪（NT$）')).toHaveValue('40000')
})
test('JSON 匯出與匯入確認、取消、無效檔案保護', async ({ page }) => {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: '資料與備份', exact: true })
    .click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下載完整備份' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^finance-backup-.*\.json$/)
  const original = await page.evaluate((k) => localStorage.getItem(k), key)
  await page.getByLabel('匯入 JSON 備份').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  })
  await expect(page.getByRole('status')).toContainText('匯入失敗')
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(original)
  const next = JSON.parse(original!)
  next.accounts[0].balance = 12345
  await page.getByLabel('匯入 JSON 備份').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(next)),
  })
  await expect(page.getByRole('dialog')).toContainText('NT$12,345')
  await page.getByRole('button', { name: '取消，保留原資料' }).click()
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(original)
  await page.getByLabel('匯入 JSON 備份').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(next)),
  })
  await page.getByRole('button', { name: '備份並取代資料' }).click()
  expect(
    JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key))!).accounts[0].balance,
  ).toBe(12345)
})
test('損毀的本機資料不會在載入或操作時被覆蓋', async ({ page }) => {
  await page.evaluate((k) => localStorage.setItem(k, 'broken-original'), key)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('已暫停自動儲存')
  await page.getByRole('button', { name: '切換深色模式' }).click()
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('broken-original')
})
test('手機 390px、360px 與桌面版面沒有水平溢出', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true })
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('button', { name: '開啟選單' })).toBeVisible()
    for (const name of [
      '財務總覽',
      '儲蓄目標',
      '帳戶管理',
      '理財規劃',
      '財務健檢',
      '資料與備份',
      '收支紀錄',
    ]) {
      await page.getByRole('button', { name: '開啟選單' }).click()
      await page
        .getByRole('navigation')
        .getByRole('button', {
          name: name === '儲蓄目標' ? /儲蓄目標/ : name,
          exact: name !== '儲蓄目標',
        })
        .click()
      await expect(page.locator('h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
  }
  await page.getByRole('button', { name: '開啟選單' }).click()
  await page.getByRole('navigation').getByRole('button', { name: '財務總覽', exact: true }).click()
  await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -260, 0)')
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true })
})
