import { test, expect } from '@playwright/test'
const key = 'my-finance-quests.v2'
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-24T12:00:00') })
  await page.goto('/')
})
test('白底首頁呈現中央小豬、百分比與完整目標資訊', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /把喜歡的未來/ })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(2)
  for (const name of ['收支紀錄', '帳戶管理', '資料與備份', '匯出', '匯入'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('img', { name: '完成 25%' })).toBeVisible()
  await expect(page.locator('.ring-center .piggy-icon svg')).toBeVisible()
  await expect(page.locator('.goal-details')).toContainText('NT$10,000')
  await expect(page.locator('.goal-details')).toContainText('NT$40,000')
  await expect(page.locator('.goal-details')).toContainText('NT$30,000')
  await expect(page.locator('.target-date')).toContainText('2026/12/31')
  for (const name of ['財務健檢', '理財規劃', '投資分析'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.locator('.level-chip,.journey-map,.chart')).toHaveCount(0)
})
test('存一筆平滑更新圓環與百分比，重新整理仍保留', async ({ page }) => {
  await page.getByRole('button', { name: '存一筆', exact: true }).click()
  await page.getByLabel('這次存入（NT$）').fill('10000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(page.getByRole('img', { name: '完成 50%' })).toBeVisible()
  await expect(page.getByTestId('animated-percent')).toHaveText('50%')
  await expect(page.locator('.goal-ring')).toHaveClass(/steady/)
  await page.reload()
  await expect(page.getByRole('img', { name: '完成 50%' })).toBeVisible()
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).goals[0].saved, key)).toBe(
    20000,
  )
})
test('達成時慶祝一次，重新開啟不重播，成就可重看', async ({ page }) => {
  await page.getByRole('button', { name: '存一筆', exact: true }).click()
  await page.getByLabel('這次存入（NT$）').fill('30000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(
    page.getByRole('heading', { name: '恭喜！儲蓄目標達成！', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('NT$40,000')
  await expect(page.getByRole('dialog')).toContainText('2026-10-24')
  await page.getByRole('button', { name: '收藏這份成就' }).click()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.progress-message')).toHaveText('恭喜！儲蓄目標達成！')
  await page.getByRole('button', { name: '查看完成紀錄', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /第一桶金/ })
    .click()
  await expect(
    page.getByRole('heading', { name: '恭喜！儲蓄目標達成！', exact: true }),
  ).toBeVisible()
})
test('目標可以直接新增、編輯金額及刪除，不需要帳戶操作', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '我的目標', exact: true }).click()
  await page.getByRole('button', { name: '新增目標' }).click()
  await page.getByLabel('目標名稱').fill('小旅行')
  await page.getByLabel('目標金額（NT$）').fill('20000')
  await page.getByLabel('目前已存（NT$）').fill('2000')
  await page.getByLabel('目標截止日期').fill('2027-12-31')
  await page.getByRole('button', { name: '儲存目標' }).click()
  await expect(page.getByRole('heading', { name: '小旅行' })).toBeVisible()
  await page.getByRole('button', { name: '編輯小旅行' }).click()
  await page.getByLabel('目標名稱').fill('日本旅行')
  await page.getByLabel('目前已存（NT$）').fill('5000')
  await page.getByRole('button', { name: '儲存目標' }).click()
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '日本旅行' }) })
  await expect(card).toContainText('NT$5,000')
  await page.getByRole('button', { name: '刪除日本旅行' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '刪除目標', exact: true }).click()
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
  await page.getByRole('button', { name: '存一筆', exact: true }).click()
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
test('損毀資料不會覆寫，會阻止儲蓄編輯', async ({ page }) => {
  await page.evaluate((k) => localStorage.setItem(k, 'broken-original'), key)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('已停止寫入')
  await expect(page.getByRole('button', { name: '存一筆', exact: true })).toBeDisabled()
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('broken-original')
})
test('儲存空間錯誤不假裝成功，也不丟失先前進度', async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: '存一筆', exact: true }).click()
  await page.getByLabel('這次存入（NT$）').fill('1000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('變更未套用')
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).goals[0].saved, key)).toBe(
    10000,
  )
  await page.getByRole('dialog').getByRole('button', { name: '關閉視窗' }).click()
  await expect(page.getByRole('img', { name: '完成 25%' })).toBeVisible()
})
test('桌面與手機320px以上小豬與資訊清楚顯示，無水平溢出', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'artifacts/piggy-desktop.png', fullPage: true })
  for (const width of [320, 390, 360, 768]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['儲蓄首頁', '我的目標']) {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
      await expect(page.locator('h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄首頁', exact: true }).click()
  await page.screenshot({ path: 'artifacts/piggy-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})

test('進度色階及接近達標提示符合各區間，超額仍顯示100%', async ({ page }) => {
  for (const [saved, tone, percent] of [
    [0, 'gentle', 0],
    [12000, 'gentle', 30],
    [12400, 'steady', 31],
    [32000, 'steady', 80],
    [32400, 'success', 81],
    [45000, 'success', 100],
  ] as const) {
    await page.getByRole('button', { name: /編輯第一桶金/ }).click()
    await page.getByLabel('目前已存（NT$）').fill(String(saved))
    await page.getByRole('button', { name: '儲存目標', exact: true }).click()
    if (saved >= 40000) await page.getByRole('button', { name: '收藏這份成就' }).click()
    await expect(page.locator('.goal-ring')).toHaveClass(new RegExp(tone))
    await expect(page.getByTestId('animated-percent')).toHaveText(`${percent}%`)
    if (percent === 81) await expect(page.locator('.progress-message')).toContainText('快達標了！')
    if (percent === 80)
      await expect(page.locator('.progress-message')).not.toContainText('快達標了！')
    if (percent === 100) await expect(page.locator('.goal-details')).toContainText('NT$0')
  }
})
test('百分比及圓弧在更新時有中間值，動畫可被減少動態設定停用', async ({ page }) => {
  await page.clock.pauseAt(new Date('2026-10-24T12:00:10'))
  const initialOffset = await page.locator('.ring-value').getAttribute('stroke-dashoffset')
  await page.getByRole('button', { name: '存一筆', exact: true }).click()
  await page.getByLabel('這次存入（NT$）').fill('10000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await page.clock.runFor(200)
  const intermediate = Number(
    (await page.getByTestId('animated-percent').innerText()).replace('%', ''),
  )
  expect(intermediate).toBeGreaterThan(25)
  expect(intermediate).toBeLessThan(50)
  expect(await page.locator('.ring-value').getAttribute('stroke-dashoffset')).not.toBe(
    initialOffset,
  )
  await page.clock.runFor(900)
  await expect(page.getByTestId('animated-percent')).toHaveText('50%')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '存一筆', exact: true }).click()
  await page.getByLabel('這次存入（NT$）').fill('1000')
  await page.getByRole('button', { name: '儲存這一步' }).click()
  await expect(page.getByTestId('animated-percent')).toHaveText('52%')
})
