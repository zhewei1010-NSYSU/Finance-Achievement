import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  applyTransaction,
  dataSchema,
  dateSchema,
  goalStats,
  health,
  initialData,
  loadData,
  monthlyStats,
  parseBackup,
  projection,
  reconcile,
  STORAGE_KEY,
  totals,
} from './finance'
import type { Transaction } from './finance'
const tx = (change: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  type: 'expense',
  accountId: 'card',
  amount: 1000,
  date: '2026-10-10',
  note: '餐費',
  ...change,
})
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-23T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})
describe('帳務正確性', () => {
  it('預設郵局 10,000 元、目標 40,000 元，完成 25%', () => {
    const data = initialData()
    expect(totals(data.accounts)).toEqual({ assets: 10000, liabilities: 0, net: 10000 })
    expect(goalStats(data.goals[0], data, '2026-10-23')).toMatchObject({
      percent: 25,
      monthly: 10000,
      remaining: 30000,
      estimate: null,
    })
  })
  it('刷卡只計一次支出；繳款減少現金與負債，不重複列支', () => {
    const spent = applyTransaction(initialData(), tx())
    expect(totals(spent.accounts)).toEqual({ assets: 10000, liabilities: 1000, net: 9000 })
    const paid = applyTransaction(
      spent,
      tx({ id: 't2', type: 'transfer', accountId: 'post', toAccountId: 'card' }),
    )
    expect(totals(paid.accounts)).toEqual({ assets: 9000, liabilities: 0, net: 9000 })
    expect(monthlyStats(paid, '2026-10')).toMatchObject({
      income: 0,
      expense: 1000,
      savingsRate: null,
    })
  })
  it('資產間轉帳不改變總資產或收支', () => {
    const d = applyTransaction(
      initialData(),
      tx({ type: 'transfer', accountId: 'post', toAccountId: 'bank' }),
    )
    expect(totals(d.accounts).net).toBe(10000)
    expect(monthlyStats(d, '2026-10').expense).toBe(0)
    expect(d.accounts.find((a) => a.id === 'bank')?.balance).toBe(1000)
  })
  it('收入及現金支出會更新資產與儲蓄率', () => {
    let d = applyTransaction(
      initialData(),
      tx({ type: 'income', accountId: 'bank', amount: 40000 }),
    )
    d = applyTransaction(d, tx({ id: 't2', accountId: 'bank', amount: 10000 }))
    expect(monthlyStats(d, '2026-10')).toEqual({
      income: 40000,
      expense: 10000,
      savingsRate: 75,
      cashflow: 30000,
    })
    expect(totals(d.accounts).net).toBe(40000)
  })
  it('刪除交易可逆轉餘額', () => {
    const d = initialData()
    const spent = applyTransaction(d, tx())
    const reversed = applyTransaction(spent, tx(), true)
    expect(reversed.accounts).toEqual(d.accounts)
    expect(reversed.transactions).toEqual([])
  })
  it('阻止餘額不足、超額還卡費、負數及同帳戶轉帳', () => {
    const d = initialData()
    expect(() => applyTransaction(d, tx({ accountId: 'post', amount: 20000 }))).toThrow()
    expect(() =>
      applyTransaction(d, tx({ type: 'transfer', accountId: 'post', toAccountId: 'card' })),
    ).toThrow()
    expect(() => applyTransaction(d, tx({ amount: -1 }))).toThrow()
    expect(() =>
      applyTransaction(d, tx({ type: 'transfer', accountId: 'post', toAccountId: 'post' })),
    ).toThrow()
  })
  it('不允許未來交易及重複交易識別碼', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T12:00:00'))
    expect(() => applyTransaction(initialData(), tx({ date: '2026-10-24' }))).toThrow()
    const d = applyTransaction(initialData(), tx())
    expect(() => applyTransaction(d, tx())).toThrow('交易已存在')
  })
})
describe('儲蓄目標與紀錄', () => {
  it('達成時記錄一次；重整及餘額變化不會重複觸發', () => {
    const d = initialData()
    d.accounts[0].balance = 40000
    const first = reconcile(d, '2026-10-23')
    expect(first.completed).toHaveLength(1)
    expect(first.data.goals[0]).toMatchObject({ completedAt: '2026-10-23', completedAmount: 40000 })
    const second = reconcile(first.data, '2026-10-24')
    expect(second.completed).toHaveLength(0)
    second.data.accounts[0].balance = 5000
    const third = reconcile(second.data, '2026-10-25')
    expect(third.data.goals[0].completedAmount).toBe(40000)
    expect(goalStats(third.data.goals[0], third.data).percent).toBe(12.5)
  })
  it('辨別逾期並以月存預算估算日期', () => {
    const d = initialData()
    expect(goalStats(d.goals[0], d, '2027-01-01')).toMatchObject({ overdue: true, monthly: null })
    d.plan.savings = 10000
    expect(goalStats(d.goals[0], d, '2026-10-23').estimate).toBe('2027-01-23')
  })
  it('同日更新保留一筆、跨日保留實際快照', () => {
    const a = reconcile(initialData(), '2026-10-23')
    const b = reconcile(a.data, '2026-10-23')
    expect(b.data.snapshots.filter((s) => s.date === '2026-10-23')).toHaveLength(1)
    const c = reconcile(b.data, '2026-10-24')
    expect(c.data.snapshots.some((s) => s.date === '2026-10-24')).toBe(true)
  })
})
describe('備份與本機資料保護', () => {
  it('JSON 匯出再匯入不遺失資料', () => {
    const d = applyTransaction(initialData(), tx())
    expect(parseBackup(JSON.stringify(d))).toEqual(d)
  })
  it('拒絕格式錯誤、錯誤版本、未知欄位、缺欄位及超大備份', () => {
    const d = initialData()
    expect(() => parseBackup('{')).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...d, version: 2 }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...d, evil: true }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ version: 1 }))).toThrow()
    expect(() => parseBackup(' '.repeat(5000001))).toThrow()
  })
  it('拒絕重複 ID、無效連結、信用卡資產及不一致的快照', () => {
    const d = initialData()
    expect(dataSchema.safeParse({ ...d, accounts: [...d.accounts, d.accounts[0]] }).success).toBe(
      false,
    )
    expect(
      dataSchema.safeParse({ ...d, goals: [{ ...d.goals[0], accountId: 'missing' }] }).success,
    ).toBe(false)
    expect(
      dataSchema.safeParse({
        ...d,
        accounts: d.accounts.map((a) => (a.id === 'card' ? { ...a, kind: 'asset' } : a)),
      }).success,
    ).toBe(false)
    expect(
      dataSchema.safeParse({
        ...d,
        snapshots: [{ date: '2026-10-23', assets: 5, liabilities: 0, net: 10000 }],
      }).success,
    ).toBe(false)
  })
  it('驗證真實日曆日期', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(dateSchema.safeParse('2028-02-29').success).toBe(true)
  })
  it('資料損毀時保留原始 localStorage，回報鎖定錯誤', () => {
    localStorage.setItem(STORAGE_KEY, 'broken')
    const result = loadData()
    expect(result.error).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('broken')
  })
})
describe('理財模擬與健檢', () => {
  it('零報酬時正確累積月存與投資，不把預算加到現有資產', () => {
    const d = initialData()
    const p = {
      ...d.plan,
      currentAge: 29,
      targetAge: 30,
      savings: 1000,
      investment: 2000,
      returnRate: 0,
    }
    expect(projection(p, 10000).at(-1)?.value).toBe(46000)
    expect(totals(d.accounts).assets).toBe(10000)
  })
  it('報酬只作用於新增投資，既有資產保持不變', () => {
    const d = initialData()
    expect(projection({ ...d.plan, savings: 0, investment: 0 }, 10000).at(-1)?.value).toBe(10000)
    expect(
      projection({ ...d.plan, savings: 0, investment: 1000 }, 10000, 10).at(-1)!.value,
    ).toBeGreaterThan(
      projection({ ...d.plan, savings: 0, investment: 1000 }, 10000, 0).at(-1)!.value,
    )
  })
  it('未填預算時不誤判為健康；不計投資資產為緊急現金', () => {
    const d = initialData()
    expect(health(d).find((h) => h.title === '儲蓄習慣')?.status).toBe('待設定')
    d.plan.living = 10000
    d.accounts.find((a) => a.id === 'cathay')!.balance = 1000000
    expect(health(d)[0].status).toBe('需留意')
  })
})

describe('日期與極端估算', () => {
  it('月末估算不溢出到下下個月', () => {
    const d = initialData()
    d.plan.savings = 30000
    expect(goalStats(d.goals[0], d, '2027-01-31').estimate).toBe('2027-02-28')
  })
  it('巨大目標與極小月存不產生無效日期', () => {
    const d = initialData()
    d.plan.savings = 1
    expect(goalStats({ ...d.goals[0], target: 1e12 }, d).estimateTooLong).toBe(true)
    expect(goalStats({ ...d.goals[0], target: 1e12 }, d).estimate).toBeNull()
  })
})
