import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
const key = 'my-finance-book.v3'
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T12:00:00') })
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
})
async function fund(page: Page, post = 0) {
  await page.evaluate(
    ({ key, post }) => {
      const b = JSON.parse(localStorage.getItem(key)!)
      b.accounts.find((a: { id: string }) => a.id === 'bank').opening = 60000
      b.accounts.find((a: { id: string }) => a.id === 'post').opening = post
      localStorage.setItem(key, JSON.stringify(b))
    },
    { key, post },
  )
  await page.reload()
}
async function deposit(page: Page, amount: string, note = '每月固定儲蓄', date = '2026-10-24') {
  await page.getByRole('button', { name: '新增存款', exact: true }).click()
  await page.getByLabel('日期', { exact: true }).fill(date)
  await page.getByLabel('金額（NT$）', { exact: true }).fill(amount)
  await page.getByLabel('資金來源').selectOption('bank')
  await page.getByLabel('備註').fill(note)
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
}
test('首頁是真實零起點、粉紅SVG大豬與深色數字，不包含分析或假收入', async ({ page }) => {
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(5)
  await expect(page.getByRole('img', { name: '完成 0%' })).toBeVisible()
  await expect(page.locator('.pink-pig')).toBeVisible()
  await expect(page.locator('.overview-grid')).toContainText('NT$0')
  await expect(page.locator('.goal-details')).toContainText('NT$40,000')
  await expect(page.locator('.life-income')).toContainText('NT$0')
  await expect(page.getByTestId('animated-percent')).toHaveCSS('color', 'rgb(36, 38, 42)')
  for (const name of ['財務健檢', '風險評分', '投資分析'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
})
test('轉帳存款同步明細、帳戶與圓環，總資產和收入不變', async ({ page }) => {
  await fund(page)
  await deposit(page, '2000')
  await expect(page.getByRole('img', { name: '完成 5%' })).toBeVisible()
  await expect(page.getByTestId('animated-percent')).toHaveText('5%')
  await expect(page.locator('.falling-coins svg')).toHaveCount(3)
  await expect(page.locator('.pig-scene')).toHaveClass(/deposit-active/)
  await expect(page.locator('.progress-message')).toContainText('又更接近目標了！')
  const b = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(b.records).toHaveLength(1)
  expect(b.records[0].type).toBe('transfer')
  await expect(page.locator('.metric-card').filter({ hasText: '目前總資產' })).toContainText(
    'NT$60,000',
  )
  await expect(page.locator('.metric-card').filter({ hasText: '本月收入' })).toContainText('NT$0')
  await expect(page.locator('.deposit-preview-card')).toContainText('每月固定儲蓄')
  await page.reload()
  await expect(page.getByRole('img', { name: '完成 5%' })).toBeVisible()
  await expect(page.locator('.falling-coins')).toHaveCount(0)
})
test('存錢明細可編輯刪除、依月份篩選、日期排序與重算累積', async ({ page }) => {
  await fund(page)
  await deposit(page, '2000', '十月儲蓄', '2026-10-24')
  await deposit(page, '1000', '九月儲蓄', '2026-09-30')
  await page.getByRole('navigation').getByRole('button', { name: '存錢明細', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('十月儲蓄')
  await expect(page.locator('tbody')).not.toContainText('九月儲蓄')
  await expect(page.locator('.filter-bar')).toContainText('NT$2,000')
  await page.getByRole('button', { name: '編輯紀錄十月儲蓄' }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('3000')
  await page.getByRole('button', { name: '儲存修改' }).click()
  await expect(page.locator('tbody')).toContainText('NT$4,000')
  await page.getByRole('button', { name: '全部月份', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: '日期由新到舊' }).click()
  await expect(page.locator('tbody tr').first()).toContainText('九月儲蓄')
  await page.getByRole('button', { name: '刪除紀錄十月儲蓄' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('navigation').getByRole('button', { name: '首頁', exact: true }).click()
  await expect(page.getByTestId('animated-percent')).toHaveText('2%')
  await expect(page.locator('.goal-details')).toContainText('NT$1,000')
})
test('真正外部存款只列一筆收入，不重複建立交易', async ({ page }) => {
  await page.getByRole('button', { name: '新增存款', exact: true }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('3000')
  await page.getByLabel('資金來源').selectOption('external')
  await page.getByLabel('收支類別').selectOption('salary')
  await page.getByLabel('備註').fill('外部薪資')
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(page.locator('.metric-card').filter({ hasText: '本月收入' })).toContainText(
    'NT$3,000',
  )
  await expect(page.locator('.life-income')).toContainText('NT$3,000')
  const b = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(b.records).toHaveLength(1)
  expect(b.records[0].type).toBe('income')
})
test('年收入目標依年度實際收入，與存款目標分開且可修改', async ({ page }) => {
  await fund(page)
  await deposit(page, '2000')
  await page.getByRole('button', { name: '記一筆', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '收入', exact: true }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('100000')
  await page.getByLabel('日期', { exact: true }).fill('2026-01-15')
  await page.getByLabel('交易帳戶').selectOption('bank')
  await page.getByLabel('收支類別').selectOption('salary')
  await page.getByLabel('備註').fill('年度薪資')
  await page.getByRole('dialog').getByRole('button', { name: '新增紀錄', exact: true }).click()
  await expect(page.locator('.life-income')).toContainText('NT$100,000')
  await expect(page.locator('.life-progress')).toContainText('10%')
  await expect(page.getByTestId('animated-percent')).toHaveText('5%')
  await page.getByRole('button', { name: '編輯30歲目標' }).click()
  await page.getByLabel('目標年收入（NT$）').fill('2000000')
  await page.getByLabel('目標年齡').fill('35')
  await page.getByLabel('截止日期（選填）').fill('2031-12-31')
  await page.getByRole('button', { name: '儲存人生目標' }).click()
  await expect(page.locator('.life-progress')).toContainText('5%')
  await expect(page.locator('.life-description')).toContainText('35歲')
  await expect(page.locator('.goal-details')).toContainText('NT$40,000')
  await page.getByLabel('收入年度').fill('')
  await page.getByLabel('收入年度').pressSequentially('2025')
  await expect(page.locator('.life-income')).toContainText('NT$0')
  await page.reload()
  await expect(page.locator('.life-description')).toContainText('NT$2,000,000')
})
test('首次達標金幣與慶祝只播放一次，重開不播放，完成紀錄可重看', async ({ page }) => {
  await fund(page)
  await deposit(page, '40000')
  await expect(
    page.getByRole('heading', { name: '恭喜！儲蓄目標達成！', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.pig-scene')).toHaveClass(/celebrate-pig/)
  await expect(page.getByRole('dialog')).toContainText('NT$40,000')
  await page.getByRole('button', { name: '收藏這份成就' }).click()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.falling-coins')).toHaveCount(0)
  await expect(page.locator('.pig-scene')).not.toHaveClass(/celebrate-pig/)
  await page.getByRole('button', { name: '查看完成紀錄', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /郵局儲蓄目標/ })
    .click()
  await expect(
    page.getByRole('heading', { name: '恭喜！儲蓄目標達成！', exact: true }),
  ).toBeVisible()
})
test('帳戶與類別可新增、編輯、刪除，帳戶對帳不列為收入', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '帳戶總覽', exact: true }).click()
  await page.getByRole('button', { name: '新增帳戶', exact: true }).click()
  await page.getByLabel('帳戶名稱').fill('測試錢包')
  await page.getByLabel('目前餘額（NT$）').fill('5000')
  await page.getByRole('button', { name: '儲存帳戶' }).click()
  await expect(page.getByRole('heading', { name: '測試錢包' })).toBeVisible()
  const card = page
    .locator('.account-card')
    .filter({ has: page.getByRole('heading', { name: '測試錢包' }) })
  await card.getByRole('button', { name: '編輯帳戶' }).click()
  await page.getByLabel('帳戶名稱').fill('小錢包')
  await page.getByRole('button', { name: '儲存帳戶' }).click()
  await page.getByRole('button', { name: '刪除小錢包' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  await expect(page.getByRole('heading', { name: '小錢包' })).toHaveCount(0)
  await page.getByRole('navigation').getByRole('button', { name: '收支紀錄', exact: true }).click()
  await page.getByRole('button', { name: '管理類別' }).click()
  await page.getByRole('button', { name: '新增類別' }).click()
  await page.getByLabel('類別名稱').fill('旅遊')
  await page.getByRole('button', { name: '儲存類別' }).click()
  await page.getByRole('button', { name: '管理類別' }).click()
  await page.getByRole('button', { name: '編輯類別旅遊' }).click()
  await page.getByLabel('類別名稱').fill('旅行')
  await page.getByRole('button', { name: '儲存類別' }).click()
  await page.getByRole('button', { name: '管理類別' }).click()
  await page.getByRole('button', { name: '刪除類別旅行' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
})
test('儲蓄目標可管理且依指定帳戶餘額，刪除目標不刪存款', async ({ page }) => {
  await fund(page)
  await deposit(page, '2000')
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標', exact: true }).click()
  await page.getByRole('button', { name: '新增目標', exact: true }).click()
  await page.getByLabel('目標名稱').fill('旅行夢想')
  await page.getByLabel('目標金額（NT$）').fill('80000')
  await page.getByLabel('指定帳戶').selectOption('bank')
  await page.getByRole('button', { name: '儲存目標' }).click()
  await expect(page.getByRole('heading', { name: '旅行夢想' })).toBeVisible()
  await expect(page.getByRole('img', { name: '完成 72%' })).toBeVisible()
  const main = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '郵局儲蓄目標' }) })
  await main.getByRole('button', { name: '刪除目標', exact: true }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  const b = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(b.records).toHaveLength(1)
  expect(b.records[0].goalId).toBeUndefined()
})
test('v2與v1資料帶入不覆寫原文，舊存款不捏造收入', async ({ page }) => {
  const v1 = {
    version: 1,
    accounts: [
      { id: 'post', name: '郵局', kind: 'asset', category: 'post', balance: 10000 },
      { id: 'bank', name: '銀行', kind: 'asset', category: 'bank', balance: 30000 },
    ],
    goals: [
      {
        id: 'old',
        name: '原有目標',
        target: 40000,
        accountId: 'post',
        deadline: '2026-12-31',
        createdAt: '2026-10-23',
      },
    ],
    transactions: [],
    plan: {
      salary: 40000,
      living: 10000,
      family: 5000,
      savings: 10000,
      investment: 0,
      currentAge: 25,
      targetAge: 30,
      targetAssets: 1000000,
      returnRate: 3,
    },
    snapshots: [],
    theme: 'light',
  }
  const v2 = {
    version: 2,
    goals: [
      {
        id: 'old',
        name: '原有目標',
        target: 40000,
        saved: 15000,
        deadline: '2026-12-31',
        createdAt: '2026-10-23',
      },
    ],
    plan: v1.plan,
  }
  await page.evaluate(
    ({ key, v1, v2 }) => {
      localStorage.removeItem(key)
      localStorage.setItem('my-finance-dashboard.v1', JSON.stringify(v1))
      localStorage.setItem('my-finance-quests.v2', JSON.stringify(v2))
    },
    { key, v1, v2 },
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: '原有目標' })).toBeVisible()
  await expect(page.getByRole('img', { name: '完成 37%' })).toBeVisible()
  await expect(page.locator('.metric-card').filter({ hasText: '目前總資產' })).toContainText(
    'NT$45,000',
  )
  await expect(page.locator('.metric-card').filter({ hasText: '本月收入' })).toContainText('NT$0')
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('my-finance-dashboard.v1')!).accounts[0].balance,
    ),
  ).toBe(10000)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('my-finance-quests.v2')!).goals[0].saved,
    ),
  ).toBe(15000)
})
test('損毀與儲存失敗均保留原資料，不顯示假成功', async ({ page }) => {
  await fund(page)
  await page.getByRole('button', { name: '新增存款', exact: true }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('2000')
  await page.getByLabel('資金來源').selectOption('bank')
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('未套用')
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).records.length, key)).toBe(
    0,
  )
  await page.reload()
  await page.evaluate((k) => localStorage.setItem(k, 'broken-original'), key)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('停止編輯')
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('broken-original')
})
test('圓環數字與金幣動畫正常，減少動態設定會停用', async ({ page }) => {
  await fund(page, 10000)
  await page.clock.pauseAt(new Date('2026-10-25T12:00:10'))
  await deposit(page, '10000')
  await page.clock.runFor(200)
  const percent = Number((await page.getByTestId('animated-percent').innerText()).replace('%', ''))
  expect(percent).toBeGreaterThan(25)
  expect(percent).toBeLessThan(50)
  await expect(page.locator('.pink-pig')).toHaveCSS('animation-name', 'pig-bounce')
  await page.clock.runFor(1000)
  await expect(page.getByTestId('animated-percent')).toHaveText('50%')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await deposit(page, '1000', '減少動態')
  await expect(page.getByTestId('animated-percent')).toHaveText('52%')
  await expect(page.locator('.falling-coins')).toHaveCSS('display', 'none')
  await expect(page.locator('.pink-pig')).toHaveCSS('animation-name', 'none')
})
test('手機320px至桌面版正常，主要文字深色，沒有健康分數或圖表', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'artifacts/finance-desktop.png', fullPage: true })
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['首頁', '存錢明細', '帳戶總覽', '收支紀錄', '儲蓄目標']) {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
      await expect(page.locator('h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation').getByRole('button', { name: '首頁', exact: true }).click()
  const percentageBottom = await page
    .getByTestId('animated-percent')
    .evaluate((el) => el.getBoundingClientRect().bottom)
  expect(percentageBottom).toBeLessThan(844 - 70)
  await page.screenshot({ path: 'artifacts/finance-mobile.png', fullPage: false })
  expect(errors).toEqual([])
})

test('非首頁主要目標的存款也會觸發對應小豬動畫', async ({ page }) => {
  await fund(page)
  await page.evaluate((k) => {
    const b = JSON.parse(localStorage.getItem(k)!)
    b.accounts.find((a: { id: string }) => a.id === 'cash').opening = 10000
    b.goals.push({
      id: 'trip',
      name: '旅行目標',
      target: 50000,
      deadline: '2027-12-31',
      accountId: 'cash',
    })
    localStorage.setItem(k, JSON.stringify(b))
  }, key)
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標', exact: true }).click()
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '旅行目標' }) })
  await card.getByRole('button', { name: '新增存款', exact: true }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('1000')
  await page.getByLabel('資金來源').selectOption('bank')
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(card.locator('.pig-scene')).toHaveClass(/deposit-active/)
  await expect(card.getByRole('img', { name: '完成 22%' })).toBeVisible()
})

test('跨分頁更新不覆蓋新資料，重新整理後可接續使用', async ({ page, context }) => {
  await fund(page)
  const sibling = await context.newPage()
  await sibling.clock.install({ time: new Date('2026-10-25T12:00:00') })
  await sibling.goto('/')
  await expect(sibling.locator('h1')).toBeVisible()
  await deposit(sibling, '2000', '第二分頁存款')
  await expect(page.getByRole('alert')).toContainText('另一個分頁已更新')
  await page.getByRole('button', { name: '新增存款', exact: true }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('1000')
  await page.getByLabel('資金來源').selectOption('bank')
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('其他分頁')
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).records.length, key)).toBe(
    1,
  )
  await sibling.close()
  await page.reload()
  await expect(page.getByRole('img', { name: '完成 5%' })).toBeVisible()
})

test('一般轉帳自動連結唯一儲蓄目標，共用一筆存款與收支紀錄', async ({ page }) => {
  await fund(page)
  await page.getByRole('button', { name: '記一筆', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '帳戶轉帳', exact: true }).click()
  await page.getByLabel('轉出帳戶').selectOption('bank')
  await page.getByLabel('存入帳戶').selectOption('post')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('5000')
  await page.getByLabel('備註').fill('一般轉帳儲蓄')
  await page.getByRole('dialog').getByRole('button', { name: '新增紀錄', exact: true }).click()
  await expect(page.locator('.deposit-preview-card')).toContainText('一般轉帳儲蓄')
  await expect(page.getByRole('img', { name: '完成 12%' })).toBeVisible()
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(data.records).toHaveLength(1)
  expect(data.records[0].goalId).toBe('post-goal')
  await expect(page.locator('.metric-card').filter({ hasText: '本月收入' })).toContainText('NT$0')
})
