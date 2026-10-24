import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialData, STORAGE_KEY } from './finance'
import { migrateLegacy, QUEST_KEY } from './quests'
import {
  accountTotals,
  annualIncome,
  balances,
  BOOK_KEY,
  depositRows,
  emptyBook,
  loadBook,
  migrateBook,
  periodStats,
  progress,
  reconcileBook,
  removeAccount,
  removeGoal,
  replaceRecord,
  saveAccount,
  saveGoal,
  validBook,
} from './ledger'
import type { Book, RecordItem } from './ledger'
const record = (change: Partial<RecordItem> = {}): RecordItem => ({
  id: 'r1',
  type: 'transfer',
  date: '2026-10-24',
  amount: 2000,
  accountId: 'bank',
  toAccountId: 'post',
  goalId: 'post-goal',
  note: '固定儲蓄',
  ...change,
})
const funded = () =>
  saveAccount(emptyBook(), { id: 'bank', name: '銀行', kind: 'asset', balance: 20000 })
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})
describe('實際帳務與存款', () => {
  it('新用戶金額全部為零，不生成虛構存款或收入', () => {
    const d = emptyBook()
    expect(accountTotals(d).assets).toBe(0)
    expect(d.records).toEqual([])
    expect(progress(d, d.goals[0]).percent).toBe(0)
    expect(annualIncome(d, 2026)).toBe(0)
  })
  it('轉入郵局只移動帳戶餘額，不增加總資產或收入', () => {
    const d = replaceRecord(funded(), null, record())
    expect(accountTotals(d).assets).toBe(20000)
    expect(balances(d).get('post')).toBe(2000)
    expect(balances(d).get('bank')).toBe(18000)
    expect(periodStats(d, '2026-10')).toEqual({ income: 0, expense: 0, surplus: 0 })
    expect(annualIncome(d, 2026)).toBe(0)
    expect(progress(d, d.goals[0]).percent).toBe(5)
  })
  it('外部收入作為一筆存款與收入，年收入只計一次', () => {
    const d = replaceRecord(
      emptyBook(),
      null,
      record({ type: 'income', accountId: 'post', toAccountId: undefined, categoryId: 'salary' }),
    )
    expect(d.records).toHaveLength(1)
    expect(periodStats(d, '2026-10').income).toBe(2000)
    expect(annualIncome(d, 2026)).toBe(2000)
    expect(depositRows(d)).toHaveLength(1)
    expect(accountTotals(d).assets).toBe(2000)
  })
  it('編輯存款金額重新計算帳戶、累積存款及百分比', () => {
    let d = replaceRecord(funded(), null, record())
    d = replaceRecord(d, 'r1', record({ amount: 5000 }))
    expect(balances(d).get('bank')).toBe(15000)
    expect(balances(d).get('post')).toBe(5000)
    expect(progress(d, d.goals[0]).percent).toBe(12.5)
    expect(depositRows(d)[0].after).toBe(5000)
    expect(accountTotals(d).assets).toBe(20000)
  })
  it('刪除存款回復轉出與存入餘額', () => {
    const d = replaceRecord(replaceRecord(funded(), null, record()), 'r1')
    expect(balances(d).get('post')).toBe(0)
    expect(balances(d).get('bank')).toBe(20000)
    expect(d.records).toHaveLength(0)
  })
  it('日期排序及各筆存款後累積額按所有收支計算', () => {
    let d = replaceRecord(funded(), null, record({ id: 'late', date: '2026-10-24', amount: 3000 }))
    d = replaceRecord(d, null, record({ id: 'early', date: '2026-10-20', amount: 2000 }))
    d = replaceRecord(d, null, {
      id: 'spend',
      date: '2026-10-21',
      type: 'expense',
      amount: 500,
      accountId: 'post',
      categoryId: 'food',
      note: '',
    })
    expect(depositRows(d).map((x) => [x.record.id, x.after])).toEqual([
      ['early', 2000],
      ['late', 4500],
    ])
  })
  it('修改日期可重新排序，不生成額外交易', () => {
    let d = replaceRecord(funded(), null, record())
    d = replaceRecord(d, null, record({ id: 'r2', date: '2026-10-25', amount: 1000 }))
    d = replaceRecord(d, 'r2', record({ id: 'r2', date: '2026-10-20', amount: 1000 }))
    expect(depositRows(d).map((x) => [x.record.id, x.after])).toEqual([
      ['r2', 1000],
      ['r1', 3000],
    ])
    expect(d.records).toHaveLength(2)
  })
  it('餘額不足、負數、未來日期與同帳戶轉帳被拒絕', () => {
    expect(() => replaceRecord(emptyBook(), null, record())).toThrow()
    expect(() => replaceRecord(funded(), null, record({ amount: -1 }))).toThrow()
    expect(() => replaceRecord(funded(), null, record({ date: '2026-10-26' }))).toThrow()
    expect(() => replaceRecord(funded(), null, record({ toAccountId: 'bank' }))).toThrow()
  })
  it('刪除已被花用的外部存款會拒絕，不讓餘額變成負數', () => {
    let d = replaceRecord(
      emptyBook(),
      null,
      record({ type: 'income', accountId: 'post', toAccountId: undefined, categoryId: 'salary' }),
    )
    d = replaceRecord(d, null, {
      id: 'expense',
      type: 'expense',
      amount: 1000,
      date: '2026-10-25',
      accountId: 'post',
      categoryId: 'living',
      note: '',
    })
    expect(() => replaceRecord(d, 'r1')).toThrow()
    expect(balances(d).get('post')).toBe(1000)
  })
  it('信用卡刷卡與還款不會重複列支', () => {
    let d = replaceRecord(funded(), null, {
      id: 'card-spend',
      type: 'expense',
      amount: 1000,
      date: '2026-10-24',
      accountId: 'card',
      categoryId: 'food',
      note: '',
    })
    expect(balances(d).get('card')).toBe(1000)
    d = replaceRecord(d, null, {
      id: 'repay',
      type: 'transfer',
      amount: 1000,
      date: '2026-10-25',
      accountId: 'bank',
      toAccountId: 'card',
      note: '',
    })
    expect(balances(d).get('card')).toBe(0)
    expect(accountTotals(d)).toEqual({ assets: 19000, debt: 0, net: 19000 })
    expect(periodStats(d, '2026-10').expense).toBe(1000)
  })
})
describe('年度目標與連結驗證', () => {
  it('年度收入依年份及收入紀錄計算，與資產及存款轉帳獨立', () => {
    let d = funded()
    d = replaceRecord(d, null, {
      id: 'last',
      type: 'income',
      amount: 60000,
      date: '2025-12-31',
      accountId: 'bank',
      categoryId: 'salary',
      note: '',
    })
    d = replaceRecord(d, null, {
      id: 'this',
      type: 'income',
      amount: 40000,
      date: '2026-01-01',
      accountId: 'bank',
      categoryId: 'salary',
      note: '',
    })
    d = replaceRecord(d, null, record())
    expect(annualIncome(d, 2026)).toBe(40000)
    expect(annualIncome(d, 2025)).toBe(60000)
    expect(accountTotals(d).assets).toBe(120000)
    expect(d.life.targetIncome).toBe(1000000)
  })
  it('更改人生目標不影響郵局目標及存款', () => {
    const d = funded()
    const next = validBook({
      ...d,
      life: { targetAge: 35, targetIncome: 1200000, deadline: '2031-12-31' },
    })
    expect(next.goals).toEqual(d.goals)
    expect(balances(next)).toEqual(balances(d))
  })
  it('存入帳戶必須符合目標，收支類別不能錯用', () => {
    expect(() => replaceRecord(funded(), null, record({ toAccountId: 'cash' }))).toThrow()
    expect(() =>
      replaceRecord(funded(), null, {
        id: 'wrong',
        type: 'income',
        date: '2026-10-25',
        amount: 1000,
        accountId: 'bank',
        categoryId: 'food',
        note: '',
      }),
    ).toThrow()
  })
  it('有存款紀錄的目標不能直接改連結帳戶', () => {
    const d = replaceRecord(funded(), null, record())
    expect(() => saveGoal(d, { ...d.goals[0], accountId: 'bank' })).toThrow()
  })
  it('刪除目標保留存款及帳戶餘額，只移除關聯', () => {
    const d = replaceRecord(funded(), null, record())
    const next = removeGoal(d, d.goals[0].id)
    expect(next.records[0].goalId).toBeUndefined()
    expect(next.records[0].amount).toBe(2000)
    expect(balances(next)).toEqual(balances(d))
  })
  it('關聯帳戶不能被刪除；對帳不計入收入', () => {
    const d = funded()
    expect(() => removeAccount(d, 'post')).toThrow()
    expect(periodStats(d, '2026').income).toBe(0)
    expect(removeAccount(d, 'cash').accounts.some((a) => a.id === 'cash')).toBe(false)
  })
  it('完成紀錄只觸發一次，修改或刪除後仍保留原完成金額', () => {
    const d = replaceRecord(
      saveAccount(emptyBook(), { id: 'bank', name: '銀行', kind: 'asset', balance: 60000 }),
      null,
      record({ amount: 40000 }),
    )
    const first = reconcileBook(d)
    expect(first.completed).toHaveLength(1)
    expect(reconcileBook(first.book).completed).toHaveLength(0)
    const deleted = replaceRecord(first.book, 'r1')
    expect(deleted.goals[0].completedAmount).toBe(40000)
    expect(progress(deleted, deleted.goals[0]).percent).toBe(0)
  })
})
describe('資料保留與舊帳務', () => {
  it('v1帳戶與實際交易保留，既有交易不再次影響餘額', () => {
    const old = initialData()
    old.transactions = [
      {
        id: 'old-income',
        type: 'income',
        date: '2026-10-24',
        amount: 5000,
        accountId: 'post',
        note: '舊薪資',
      },
    ]
    old.accounts[0].balance = 10000
    const d = migrateBook(null, old)
    expect(balances(d).get('post')).toBe(10000)
    expect(annualIncome(d, 2026)).toBe(5000)
    expect(d.records[0].settled).toBe(true)
  })
  it('舊版已結算紀錄也能編輯與刪除，正確套用差額', () => {
    const old = initialData()
    old.accounts[0].balance = 10000
    old.transactions = [
      { id: 'old', type: 'income', date: '2026-10-24', amount: 5000, accountId: 'post', note: '' },
    ]
    let d = migrateBook(null, old)
    d = replaceRecord(d, 'old', {
      id: 'old',
      type: 'income',
      date: '2026-10-24',
      amount: 4000,
      accountId: 'post',
      categoryId: 'other-income',
      note: '',
    })
    expect(balances(d).get('post')).toBe(9000)
    expect(annualIncome(d, 2026)).toBe(4000)
    d = replaceRecord(d, 'old')
    expect(balances(d).get('post')).toBe(5000)
  })
  it('v2最新儲蓄覆蓋對應帳戶餘額，其他v1帳戶與紀錄不遺失', () => {
    const old = initialData()
    old.accounts.find((a) => a.id === 'bank')!.balance = 20000
    const v2 = migrateLegacy(old)
    v2.goals[0].saved = 15000
    const d = migrateBook(v2, old)
    expect(balances(d).get('post')).toBe(15000)
    expect(balances(d).get('bank')).toBe(20000)
    expect(d.goals[0].id).toBe('first-goal')
  })
  it('v2獨立目標轉為各自帳戶，不捏造歷史存款明細', () => {
    const v2 = migrateLegacy(initialData())
    v2.goals.push({ ...v2.goals[0], id: 'trip', name: '旅行', saved: 3000 })
    const d = migrateBook(v2, null)
    expect(accountTotals(d).assets).toBe(13000)
    expect(d.goals).toHaveLength(2)
    expect(d.records).toEqual([])
  })
  it('讀取與轉換不覆寫舊key，v3損毀不回退覆寫', () => {
    const v1 = JSON.stringify(initialData()),
      v2 = JSON.stringify(migrateLegacy(initialData()))
    localStorage.setItem(STORAGE_KEY, v1)
    localStorage.setItem(QUEST_KEY, v2)
    expect(loadBook().migrated).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(v1)
    expect(localStorage.getItem(QUEST_KEY)).toBe(v2)
    localStorage.setItem(BOOK_KEY, 'broken')
    expect(loadBook().error).toBeTruthy()
    expect(localStorage.getItem(BOOK_KEY)).toBe('broken')
  })
  it('拒絕孤立紀錄、重複識別碼與無效日期', () => {
    const d: Book = funded()
    expect(() => validBook({ ...d, accounts: [...d.accounts, d.accounts[0]] })).toThrow()
    expect(() => replaceRecord(d, null, record({ accountId: 'missing' }))).toThrow()
    expect(() => replaceRecord(d, null, record({ date: '2026-02-30' }))).toThrow()
  })
})
