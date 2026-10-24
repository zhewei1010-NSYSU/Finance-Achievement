import { test, expect } from '@playwright/test'
const key = 'my-finance-quests.v2'
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-24T12:00:00') })
  await page.goto('/')
})
test('白底首頁只保留四個入口，呈現真實的關卡進度', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /把小小的存款/ })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(4)
  for (const name of ['收支紀錄', '帳戶管理', '資料與備份', '匯出', '匯入'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('img', { name: '完成 25%' })).toBeVisible()
  await expect(page.getByRole('button', { name: '找到節奏 25% 已解鎖' })).toBeVisible()
  await expect(page.getByRole('button', { name: '走到一半 50% 未解鎖' })).toBeVisible()
  await page.getByRole('button', { name: '走到一半 50% 未解鎖' }).click()
  await expect(page.getByRole('dialog')).toContainText('再存 NT$10,000')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('存一筆即可更新圓環、關卡、XP，重新整理仍保留', async ({ page }) => {
  await page.getByRole('button', { name: '存一筆，前進一步' }).click()
  await page.getByLabel('這次存入（NT$）').fill('10000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(page.getByRole('img', { name: '完成 50%' })).toBeVisible()
  await expect(page.getByRole('button', { name: '走到一半 50% 已解鎖' })).toBeVisible()
  await expect(page.locator('.xp-label')).toContainText('2 / 4 XP')
  await page.reload()
  await expect(page.getByRole('img', { name: '完成 50%' })).toBeVisible()
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).goals[0].saved, key)).toBe(
    20000,
  )
})
test('達成時慶祝一次，重新開啟不重播，成就可重看', async ({ page }) => {
  await page.getByRole('button', { name: '存一筆，前進一步' }).click()
  await page.getByLabel('這次存入（NT$）').fill('30000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(page.getByRole('heading', { name: '恭喜！儲蓄目標達成' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('NT$40,000')
  await expect(page.getByRole('dialog')).toContainText('2026-10-24')
  await page.getByRole('button', { name: '收藏這份成就' }).click()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.level-chip')).toContainText('Lv. 2')
  await page.getByRole('button', { name: '查看成就收藏' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /第一桶金/ })
    .click()
  await expect(page.getByRole('heading', { name: '恭喜！儲蓄目標達成' })).toBeVisible()
})
test('挑戰可以直接新增、編輯金額及刪除，不需要帳戶操作', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄挑戰', exact: true }).click()
  await page.getByRole('button', { name: '新增挑戰' }).click()
  await page.getByLabel('挑戰名稱').fill('小旅行')
  await page.getByLabel('目標金額（NT$）').fill('20000')
  await page.getByLabel('目前已存（NT$）').fill('2000')
  await page.getByLabel('挑戰截止日期').fill('2027-12-31')
  await page.getByRole('button', { name: '儲存挑戰' }).click()
  await expect(page.getByRole('heading', { name: '小旅行' })).toBeVisible()
  await page.getByRole('button', { name: '編輯小旅行' }).click()
  await page.getByLabel('挑戰名稱').fill('日本旅行')
  await page.getByLabel('目前已存（NT$）').fill('5000')
  await page.getByRole('button', { name: '儲存挑戰' }).click()
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '日本旅行' }) })
  await expect(card).toContainText('NT$5,000')
  await page.getByRole('button', { name: '刪除日本旅行' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '刪除挑戰', exact: true }).click()
  await expect(page.getByRole('heading', { name: '日本旅行' })).toHaveCount(0)
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).goals.length, key)).toBe(1)
})
test('舊版資料自動帶入，新版修改不覆寫舊版原始內容', async ({ page }) => {
  const legacy = {
    version: 1,
    accounts: [{ id: 'post', name: '郵局', kind: 'asset', category: 'post', balance: 18000 }],
    goals: [
      {
        id: 'legacy',
        name: '舊版夢想',
        target: 40000,
        accountId: 'post',
        deadline: '2026-12-31',
        createdAt: '2026-10-23',
      },
    ],
    transactions: [],
    plan: {
      salary: 40000,
      living: 15000,
      family: 5000,
      savings: 10000,
      investment: 5000,
      currentAge: 25,
      targetAge: 30,
      targetAssets: 1000000,
      returnRate: 3,
    },
    snapshots: [],
    theme: 'dark',
  }
  await page.evaluate(
    ({ key, legacy }) => {
      localStorage.removeItem(key)
      localStorage.setItem('my-finance-dashboard.v1', JSON.stringify(legacy))
    },
    { key, legacy },
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: '舊版夢想' })).toBeVisible()
  await expect(page.getByRole('img', { name: '完成 45%' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: '存一筆，前進一步' }).click()
  await page.getByLabel('這次存入（NT$）').fill('2000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('my-finance-dashboard.v1')!).accounts[0].balance,
    ),
  ).toBe(18000)
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).goals[0].saved, key)).toBe(
    20000,
  )
})
test('理財模擬仍可調整預算、儲存，健檢可讀取', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '理財規劃', exact: true }).click()
  for (const [label, value] of [
    ['實領月薪（NT$）', '40000'],
    ['每月生活費（NT$）', '15000'],
    ['每月孝親費（NT$）', '5000'],
    ['每月儲蓄金額（NT$）', '10000'],
    ['每月投資金額（NT$）', '5000'],
  ])
    await page.getByLabel(label).fill(value)
  await expect(page.locator('.plan-summary')).toContainText('NT$5,000')
  await page.getByRole('button', { name: '儲存理財規劃' }).click()
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: '理財規劃', exact: true }).click()
  await expect(page.getByLabel('實領月薪（NT$）')).toHaveValue('40000')
  await page.getByRole('navigation').getByRole('button', { name: '財務健檢', exact: true }).click()
  await expect(page.locator('.health-grid')).toContainText('25.0%')
  await expect(page.locator('.health-grid')).toContainText('120,000')
})
test('損毀資料不會覆寫，會阻止儲蓄編輯', async ({ page }) => {
  await page.evaluate((k) => localStorage.setItem(k, 'broken-original'), key)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('已停止寫入')
  await expect(page.getByRole('button', { name: '存一筆，前進一步' })).toBeDisabled()
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('broken-original')
})
test('儲存空間錯誤不假裝成功，也不丟失先前進度', async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: '存一筆，前進一步' }).click()
  await page.getByLabel('這次存入（NT$）').fill('1000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('變更未套用')
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).goals[0].saved, key)).toBe(
    10000,
  )
  await page.getByRole('dialog').getByRole('button', { name: '關閉視窗' }).click()
  await expect(page.getByRole('img', { name: '完成 25%' })).toBeVisible()
})
test('桌面與手機四個頁面無水平溢出，無瀏覽器錯誤', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'artifacts/quests-desktop.png', fullPage: true })
  for (const width of [390, 360, 768]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['闖關首頁', '儲蓄挑戰', '理財規劃', '財務健檢']) {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
      await expect(page.locator('h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation').getByRole('button', { name: '闖關首頁', exact: true }).click()
  await page.screenshot({ path: 'artifacts/quests-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})
