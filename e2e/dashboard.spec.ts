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
      b.accounts.find((a: { id: string }) => a.id === 'bank').assetClass = 'investment'
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
  await page.getByLabel('資金來源').selectOption('investment')
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
  await expect(page.locator('.falling-coins svg')).toHaveCount(1)
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
  await page.getByLabel('收入類別').selectOption('salary')
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
  await page.getByRole('button', { name: '新增收入', exact: true }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('100000')
  await page.getByLabel('日期', { exact: true }).fill('2026-01-15')
  await page.getByLabel('存入帳戶', { exact: true }).selectOption('investment')
  await page.getByLabel('收入類別').selectOption('salary')
  await page.getByLabel('備註').fill('年度薪資')
  await page.getByRole('dialog').getByRole('button', { name: '新增收入', exact: true }).click()
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
    .getByRole('button', { name: /年底郵局儲蓄/ })
    .click()
  await expect(
    page.getByRole('heading', { name: '恭喜！儲蓄目標達成！', exact: true }),
  ).toBeVisible()
})
test('我的資產只有三分類，帳戶對帳及重新分類不會列為收入', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: '我的資產', exact: true }).click()
  await expect(page.locator('.account-card h2')).toHaveText(['儲蓄', '投資', '基金'])
  await page.getByRole('button', { name: '管理資產', exact: true }).click()
  await page.getByRole('button', { name: '新增帳戶', exact: true }).click()
  await page.getByLabel('帳戶名稱').fill('測試投資')
  await page.getByLabel('資產分類').selectOption('investment')
  await page.getByLabel('目前餘額（NT$）').fill('5000')
  await page.getByRole('button', { name: '儲存帳戶' }).click()
  await expect(page.locator('.account-card').filter({ hasText: '投資' })).toContainText('NT$5,000')
  await page.getByRole('button', { name: '管理資產', exact: true }).click()
  await page.getByRole('button', { name: /測試投資/ }).click()
  await page.getByLabel('資產分類').selectOption('fund')
  await page.getByRole('button', { name: '儲存帳戶' }).click()
  await expect(page.locator('.account-card').filter({ hasText: '基金' })).toContainText('NT$5,000')
  await page.getByRole('navigation').getByRole('button', { name: '首頁', exact: true }).click()
  await expect(page.locator('.metric-card').filter({ hasText: '本月收入' })).toContainText('NT$0')
  await page.getByRole('navigation').getByRole('button', { name: '收入紀錄', exact: true }).click()
  await page.getByRole('button', { name: '管理類別' }).click()
  await expect(page.getByRole('dialog')).not.toContainText('支出')
  await page.getByRole('button', { name: '新增類別' }).click()
  await page.getByLabel('類別名稱').fill('接案')
  await page.getByRole('button', { name: '儲存類別' }).click()
  await page.getByRole('button', { name: '管理類別' }).click()
  await page.getByRole('button', { name: '編輯類別接案' }).click()
  await page.getByLabel('類別名稱').fill('兼職')
  await page.getByRole('button', { name: '儲存類別' }).click()
  await page.getByRole('button', { name: '管理類別' }).click()
  await page.getByRole('button', { name: '刪除類別兼職' }).click()
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
    .filter({ has: page.getByRole('heading', { name: '年底郵局儲蓄' }) })
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
  await page.getByLabel('資金來源').selectOption('investment')
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
    for (const name of ['首頁', '存錢明細', '我的資產', '收入紀錄', '儲蓄目標']) {
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
  await page.getByLabel('資金來源').selectOption('investment')
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
  await page.getByLabel('資金來源').selectOption('investment')
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('其他分頁')
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).records.length, key)).toBe(
    1,
  )
  await sibling.close()
  await page.reload()
  await expect(page.getByRole('img', { name: '完成 5%' })).toBeVisible()
})

test('一般轉帳自動連結唯一儲蓄目標，共用一筆存款與收入紀錄', async ({ page }) => {
  await fund(page)
  await page.getByRole('navigation').getByRole('button', { name: '我的資產', exact: true }).click()
  await page.getByRole('button', { name: '資產間轉帳', exact: true }).click()
  await page.getByLabel('資金來源').selectOption('investment')
  await page.getByLabel('存入帳戶').selectOption('savings')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('5000')
  await page.getByLabel('備註').fill('一般轉帳儲蓄')
  await page.getByRole('dialog').getByRole('button', { name: '確認轉帳', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: '首頁', exact: true }).click()
  await expect(page.locator('.deposit-preview-card')).toContainText('一般轉帳儲蓄')
  await expect(page.getByRole('img', { name: '完成 12%' })).toBeVisible()
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(data.records).toHaveLength(1)
  expect(data.records[0].goalId).toBe('post-goal')
  await expect(page.locator('.metric-card').filter({ hasText: '本月收入' })).toContainText('NT$0')
})

test('導覽順序、單枚金幣、80%提示與來源帳戶符合整合需求', async ({ page }) => {
  await expect(page.getByRole('navigation').getByRole('button')).toHaveText([
    '首頁',
    '收入紀錄',
    '存錢明細',
    '儲蓄目標',
    '我的資產',
  ])
  await fund(page, 30000)
  await deposit(page, '2000', '接近目標')
  await expect(page.getByTestId('animated-percent')).toHaveText('80%')
  await expect(page.locator('.progress-message')).toHaveText('快達標了！')
  await page.getByRole('navigation').getByRole('button', { name: '存錢明細', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: '來源帳戶', exact: true })).toBeVisible()
  await expect(page.locator('tbody .deposit-source')).toHaveText('銀行')
})

test('存款與收支可查詢日期區間，不改動每月統計或紀錄', async ({ page }) => {
  await fund(page)
  await deposit(page, '2000', '月初存款', '2026-10-01')
  await deposit(page, '3000', '月底存款', '2026-10-24')
  await page.getByRole('navigation').getByRole('button', { name: '存錢明細', exact: true }).click()
  await page.getByLabel('存款起始日期').fill('2026-10-20')
  await page.getByLabel('存款結束日期').fill('2026-10-25')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('月底存款')
  await expect(page.locator('.date-query-total')).toContainText('NT$3,000')
  await expect(page.locator('.filter-bar')).toContainText('NT$5,000')
  await page.getByRole('navigation').getByRole('button', { name: '收入紀錄', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.getByRole('button', { name: '清除篩選', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
})

test('封存與還原保留明細及餘額，首頁不再顯示封存目標', async ({ page }) => {
  await fund(page)
  await deposit(page, '2000', '保留存款')
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標', exact: true }).click()
  await page.getByRole('button', { name: '封存年底郵局儲蓄', exact: true }).click()
  await expect(page.locator('.goals-grid article')).toHaveCount(0)
  await page.getByRole('button', { name: '查看已封存目標', exact: true }).click()
  await expect(page.getByRole('heading', { name: '年底郵局儲蓄', exact: true })).toBeVisible()
  await expect(
    page.locator('article').getByRole('button', { name: '新增存款', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '編輯年底郵局儲蓄', exact: true }).click()
  await page.getByLabel('目標名稱').fill('已封存的郵局目標')
  await page.getByRole('button', { name: '儲存目標', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: '首頁', exact: true }).click()
  await expect(page.locator('.saving-zone article')).toHaveCount(0)
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(data.records).toHaveLength(1)
  expect(data.goals[0].archived).toBe(true)
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標', exact: true }).click()
  await page.getByRole('button', { name: '還原已封存的郵局目標', exact: true }).click()
  await page.getByRole('button', { name: '查看進行中目標', exact: true }).click()
  await expect(page.getByRole('img', { name: '完成 5%' })).toBeVisible()
})

test('首頁下方及目標頁可管理獨立人生目標，不混入存款', async ({ page }) => {
  const savingsBottom = await page
    .locator('.dashboard-layout')
    .evaluate((el) => el.getBoundingClientRect().bottom)
  const lifeTop = await page
    .locator('.life-section')
    .evaluate((el) => el.getBoundingClientRect().top)
  expect(lifeTop).toBeGreaterThan(savingsBottom)
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標', exact: true }).click()
  await expect(page.getByRole('heading', { name: '長期人生目標', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '新增人生目標', exact: true }).click()
  await page.getByLabel('人生目標名稱').fill('35歲年收入目標')
  await page.getByLabel('目標年齡').fill('35')
  await page.getByLabel('目標年收入（NT$）').fill('1500000')
  await page.getByRole('button', { name: '儲存人生目標', exact: true }).click()
  await expect(page.getByRole('heading', { name: '35歲年收入目標', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '編輯35歲年收入目標', exact: true }).click()
  await page.getByLabel('目標年收入（NT$）').fill('1800000')
  await page.getByRole('button', { name: '儲存人生目標', exact: true }).click()
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: '儲蓄目標', exact: true }).click()
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(data.life.targetIncome).toBe(1000000)
  expect(data.lifeGoals[0].targetIncome).toBe(1800000)
  expect(data.goals[0].target).toBe(40000)
  expect(data.records).toHaveLength(0)
})

test('隱藏支出保留歷史原文，編輯收入類別不遺失支出分類及餘額', async ({ page }) => {
  await fund(page)
  const original = await page.evaluate((k) => {
    const b = JSON.parse(localStorage.getItem(k)!)
    b.records.push({
      id: 'historic-expense',
      type: 'expense',
      date: '2026-10-20',
      amount: 1200,
      accountId: 'bank',
      categoryId: 'food',
      note: '既有支出',
    })
    localStorage.setItem(k, JSON.stringify(b))
    return b
  }, key)
  await page.reload()
  await expect(page.locator('.overview-grid')).not.toContainText('支出')
  await expect(page.locator('.overview-grid')).not.toContainText('結餘')
  await expect(page.locator('.metric-card').filter({ hasText: '目前總資產' })).toContainText(
    'NT$58,800',
  )
  await page.getByRole('navigation').getByRole('button', { name: '收入紀錄', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.getByRole('button', { name: '管理類別' }).click()
  await expect(page.getByRole('dialog')).not.toContainText('支出')
  await page.getByRole('button', { name: '編輯類別薪資' }).click()
  await page.getByLabel('類別名稱').fill('工作薪資')
  await page.getByRole('button', { name: '儲存類別' }).click()
  const updated = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(updated.records).toEqual(original.records)
  expect(updated.accounts).toEqual(original.accounts)
  expect(updated.categories.filter((c: { type: string }) => c.type === 'expense')).toEqual(
    original.categories.filter((c: { type: string }) => c.type === 'expense'),
  )
  await page.reload()
  await expect(page.locator('.metric-card').filter({ hasText: '目前總資產' })).toContainText(
    'NT$58,800',
  )
})

test('大型收入視窗可新增編輯刪除查詢，只提供收入；減少動畫及倒數正常', async ({ page }) => {
  await expect(page.getByLabel('目標天數倒數')).toContainText('67 天')
  await page.getByRole('button', { name: '新增收入', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveClass(/wide/)
  await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'modal-pop-in')
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '支出', exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('日期', { exact: true }).fill('2026-10-21')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('5000')
  await page.getByLabel('存入帳戶', { exact: true }).selectOption('investment')
  await page.getByLabel('備註').fill('測試收入')
  await page.getByRole('dialog').getByRole('button', { name: '新增收入', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: '收入紀錄', exact: true }).click()
  await page.getByLabel('收入起始日期').fill('2026-10-22')
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.getByRole('button', { name: '清除篩選', exact: true }).click()
  await page.getByRole('button', { name: '編輯紀錄測試收入' }).click()
  await page.getByLabel('金額（NT$）', { exact: true }).fill('6000')
  await page.getByRole('button', { name: '儲存修改' }).click()
  await expect(page.locator('tbody')).toContainText('NT$6,000')
  await page.getByRole('button', { name: '刪除紀錄測試收入' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '新增收入', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: '關閉視窗' }).click()
  await page.getByRole('navigation').getByRole('button', { name: '首頁', exact: true }).click()
  await page.clock.fastForward(86400000)
  await expect(page.getByLabel('目標天數倒數')).toContainText('66 天')
})

test('收入與存款存入選單只有三類，首次基金存入原子建立帳戶且不污染郵局目標', async ({ page }) => {
  await fund(page)
  const original = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  await page.getByRole('button', { name: '新增收入', exact: true }).click()
  await expect(page.getByLabel('存入帳戶', { exact: true }).locator('option')).toHaveText([
    '儲蓄',
    '投資',
    '基金',
  ])
  await page.getByLabel('存入帳戶', { exact: true }).selectOption('fund')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('5000')
  await page.getByLabel('備註').fill('基金外部收入')
  await page.getByRole('dialog').getByRole('button', { name: '新增收入', exact: true }).click()
  await expect(page.locator('.metric-card').filter({ hasText: '目前總資產' })).toContainText(
    'NT$65,000',
  )
  await expect(page.locator('.life-income')).toContainText('NT$5,000')
  await expect(page.getByTestId('animated-percent')).toHaveText('0%')
  await page.getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(page.getByLabel('存入帳戶', { exact: true }).locator('option')).toHaveText([
    '儲蓄',
    '投資',
    '基金',
  ])
  await page.getByLabel('存入帳戶', { exact: true }).selectOption('fund')
  await expect(page.getByLabel('所屬儲蓄目標')).toHaveValue('')
  await page.getByLabel('資金來源').selectOption('investment')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('2000')
  await page.getByLabel('備註').fill('投資轉基金')
  await page.getByRole('dialog').getByRole('button', { name: '新增存款', exact: true }).click()
  await expect(page.locator('.deposit-preview-card')).toContainText('投資轉基金')
  await expect(page.locator('.metric-card').filter({ hasText: '目前總資產' })).toContainText(
    'NT$65,000',
  )
  await expect(page.locator('.life-income')).toContainText('NT$5,000')
  await expect(page.getByTestId('animated-percent')).toHaveText('0%')
  await page.getByRole('navigation').getByRole('button', { name: '存錢明細', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('未綁定目標')
  await expect(page.locator('tbody')).toContainText('NT$7,000')
  await page.getByRole('button', { name: '編輯紀錄投資轉基金' }).click()
  await expect(page.getByLabel('存入帳戶', { exact: true })).toHaveValue('fund')
  await expect(page.getByLabel('資金來源')).toHaveValue('investment')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('3000')
  await page.getByRole('button', { name: '儲存修改' }).click()
  await expect(page.locator('tbody')).toContainText('NT$8,000')
  await page.getByRole('button', { name: '刪除紀錄投資轉基金' }).click()
  await page.getByRole('button', { name: '確認操作' }).click()
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(
    saved.accounts.filter((a: { assetClass?: string }) => a.assetClass === 'fund'),
  ).toHaveLength(1)
  expect(
    saved.accounts.filter((a: { id: string }) =>
      original.accounts.some((old: { id: string }) => old.id === a.id),
    ),
  ).toEqual(original.accounts)
  await page.reload()
  await expect(page.getByTestId('animated-percent')).toHaveText('0%')
})

test('編輯同類舊收入保留原帳戶，取消及儲存失敗不留下新分類帳戶', async ({ page }) => {
  await page.evaluate((k) => {
    const b = JSON.parse(localStorage.getItem(k)!)
    b.records.push({
      id: 'old-bank-income',
      type: 'income',
      date: '2026-10-20',
      amount: 10000,
      accountId: 'bank',
      categoryId: 'salary',
      note: '舊銀行薪資',
    })
    localStorage.setItem(k, JSON.stringify(b))
  }, key)
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: '收入紀錄', exact: true }).click()
  await page.getByRole('button', { name: '編輯紀錄舊銀行薪資' }).click()
  await expect(page.getByLabel('存入帳戶', { exact: true })).toHaveValue('savings')
  await expect(page.getByRole('dialog')).toContainText('本筆實際存入：銀行')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('12000')
  await page.getByRole('button', { name: '儲存修改' }).click()
  const original = await page.evaluate((k) => localStorage.getItem(k), key)
  expect(JSON.parse(original!).records[0].accountId).toBe('bank')
  await page.getByRole('button', { name: '新增收入', exact: true }).click()
  await page.getByLabel('存入帳戶', { exact: true }).selectOption('fund')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(original)
  await page.getByRole('button', { name: '新增收入', exact: true }).click()
  await page.getByLabel('存入帳戶', { exact: true }).selectOption('fund')
  await page.getByLabel('金額（NT$）', { exact: true }).fill('1000')
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('dialog').getByRole('button', { name: '新增收入', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('未套用')
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(original)
})
