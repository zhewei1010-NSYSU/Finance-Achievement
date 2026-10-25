import { z } from 'zod'
import { dataSchema as legacySchema, dateSchema, STORAGE_KEY, today, uid } from './finance'
import { QUEST_KEY, questDataSchema } from './quests'
export const BOOK_KEY = 'my-finance-book.v3'
const text = z.string().trim().min(1, '請填寫名稱').max(80, '名稱不可超過80字')
const amount = z
  .number()
  .finite()
  .int('金額須為整數')
  .min(0, '金額不可為負數')
  .max(1e12, '金額超過上限')
export const bookAccountSchema = z
  .object({
    id: text,
    name: text,
    kind: z.enum(['asset', 'liability']),
    assetClass: z.enum(['savings', 'investment', 'fund']).optional(),
    opening: z.number().finite().int().min(-1e15).max(1e15),
  })
  .strict()
export const categorySchema = z
  .object({ id: text, name: text, type: z.enum(['income', 'expense']) })
  .strict()
export const recordSchema = z
  .object({
    id: text,
    type: z.enum(['income', 'expense', 'transfer']),
    date: dateSchema,
    amount: amount.positive('金額必須大於零'),
    accountId: text,
    toAccountId: text.optional(),
    goalId: text.optional(),
    categoryId: text.optional(),
    note: z.string().max(160),
    settled: z.boolean().optional(),
  })
  .strict()
  .superRefine((r, c) => {
    if (r.type === 'transfer' && (!r.toAccountId || r.toAccountId === r.accountId))
      c.addIssue({ code: 'custom', message: '請選擇不同的轉出與存入帳戶' })
    if (r.type !== 'transfer' && r.toAccountId)
      c.addIssue({ code: 'custom', message: '只有轉帳可指定目的帳戶' })
    if (r.type === 'transfer' && r.categoryId)
      c.addIssue({ code: 'custom', message: '轉帳不列入收入或支出類別' })
    if (r.goalId && r.type === 'expense')
      c.addIssue({ code: 'custom', message: '支出不能作為存款' })
  })
export const savingGoalSchema = z
  .object({
    id: text,
    name: text,
    target: amount.positive(),
    deadline: dateSchema,
    accountId: text,
    completedAt: dateSchema.optional(),
    completedAmount: amount.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((g) => !!g.completedAt === (g.completedAmount !== undefined), '完成紀錄不完整')
export const lifeSchema = z
  .object({
    targetAge: z.number().int().min(1).max(100),
    targetIncome: amount.positive(),
    deadline: dateSchema.nullable(),
  })
  .strict()
export const lifeGoalSchema = lifeSchema.extend({ id: text, name: text }).strict()
export const bookSchema = z
  .object({
    version: z.literal(3),
    accounts: z.array(bookAccountSchema).max(200),
    categories: z.array(categorySchema).max(200),
    records: z.array(recordSchema).max(10000),
    goals: z.array(savingGoalSchema).max(200),
    life: lifeSchema,
    lifeGoals: z.array(lifeGoalSchema).max(20).optional(),
  })
  .strict()
  .superRefine((d, c) => {
    for (const group of [d.accounts, d.categories, d.records, d.goals, d.lifeGoals ?? []])
      if (new Set(group.map((x) => x.id)).size !== group.length)
        c.addIssue({ code: 'custom', message: '資料識別碼重複' })
    const accounts = new Map(d.accounts.map((a) => [a.id, a])),
      goals = new Map(d.goals.map((g) => [g.id, g])),
      categories = new Map(d.categories.map((x) => [x.id, x]))
    for (const g of d.goals)
      if (accounts.get(g.accountId)?.kind !== 'asset')
        c.addIssue({ code: 'custom', message: '儲蓄目標須連結資產帳戶' })
    for (const r of d.records) {
      if (!accounts.has(r.accountId) || (r.toAccountId && !accounts.has(r.toAccountId)))
        c.addIssue({ code: 'custom', message: '紀錄的帳戶不存在' })
      if (r.type === 'income' && accounts.get(r.accountId)?.kind !== 'asset')
        c.addIssue({ code: 'custom', message: '收入須存入資產帳戶' })
      if (r.type !== 'transfer' && categories.get(r.categoryId ?? '')?.type !== r.type)
        c.addIssue({ code: 'custom', message: '請選擇正確的收支類別' })
      if (r.goalId) {
        const g = goals.get(r.goalId),
          destination = r.type === 'transfer' ? r.toAccountId : r.accountId
        if (!g || g.accountId !== destination)
          c.addIssue({ code: 'custom', message: '存入帳戶必須符合所屬儲蓄目標' })
      }
    }
  })
export type Book = z.infer<typeof bookSchema>
export type BookAccount = z.infer<typeof bookAccountSchema>
export type RecordItem = z.infer<typeof recordSchema>
export type SavingGoal = z.infer<typeof savingGoalSchema>
export type LifeGoal = z.infer<typeof lifeGoalSchema>
export type Category = z.infer<typeof categorySchema>
export const defaultCategories: Category[] = [
  { id: 'salary', name: '薪資', type: 'income' },
  { id: 'bonus', name: '獎金', type: 'income' },
  { id: 'other-income', name: '其他收入', type: 'income' },
  { id: 'food', name: '飲食', type: 'expense' },
  { id: 'living', name: '生活費', type: 'expense' },
  { id: 'transport', name: '交通', type: 'expense' },
  { id: 'other-expense', name: '其他支出', type: 'expense' },
]
export function emptyBook(): Book {
  return {
    version: 3,
    accounts: [
      { id: 'post', name: '郵局', kind: 'asset', opening: 0 },
      { id: 'bank', name: '銀行', kind: 'asset', opening: 0 },
      { id: 'cash', name: '現金', kind: 'asset', opening: 0 },
      { id: 'card', name: '信用卡', kind: 'liability', opening: 0 },
    ],
    categories: defaultCategories.map((c) => ({ ...c })),
    records: [],
    goals: [
      {
        id: 'post-goal',
        name: '年底郵局儲蓄',
        target: 40000,
        deadline: '2026-12-31',
        accountId: 'post',
      },
    ],
    life: { targetAge: 30, targetIncome: 1000000, deadline: null },
  }
}
export function effects(book: Book, record: RecordItem) {
  const result = new Map<string, number>()
  const change = (id: string, inflow: number) => {
    const a = book.accounts.find((a) => a.id === id)
    if (!a) throw new Error('找不到帳戶')
    result.set(id, (result.get(id) ?? 0) + inflow * (a.kind === 'asset' ? 1 : -1))
  }
  if (record.type === 'income') change(record.accountId, record.amount)
  if (record.type === 'expense') change(record.accountId, -record.amount)
  if (record.type === 'transfer') {
    change(record.accountId, -record.amount)
    change(record.toAccountId!, record.amount)
  }
  return result
}
export function balances(book: Book) {
  const result = new Map(book.accounts.map((a) => [a.id, a.opening]))
  for (const r of book.records)
    if (!r.settled)
      for (const [id, delta] of effects(book, r)) result.set(id, result.get(id)! + delta)
  return result
}
export function validBook(raw: unknown): Book {
  const book = bookSchema.parse(raw)
  if ([...balances(book).values()].some((v) => v < 0 || v > 1e12))
    throw new Error('帳戶餘額不足、還款超過負債，或金額超出上限。請先確認帳戶餘額。')
  return book
}
export function accountTotals(book: Book) {
  const b = balances(book)
  const assets = book.accounts
      .filter((a) => a.kind === 'asset')
      .reduce((s, a) => s + b.get(a.id)!, 0),
    debt = book.accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + b.get(a.id)!, 0)
  return { assets, debt, net: assets - debt }
}
export function periodStats(book: Book, prefix: string) {
  const records = book.records.filter((r) => r.date.startsWith(prefix)),
    income = records.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0),
    expense = records.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  return { income, expense, surplus: income - expense }
}
export function progress(book: Book, g: SavingGoal) {
  const saved = balances(book).get(g.accountId) ?? 0
  return {
    saved,
    remaining: Math.max(0, g.target - saved),
    percent: Math.min(100, (saved / g.target) * 100),
  }
}
export function reconcileBook(book: Book, now = today()) {
  const completed: SavingGoal[] = []
  const b = balances(book)
  const goals = book.goals.map((g) => {
    const saved = b.get(g.accountId) ?? 0
    if (!g.archived && !g.completedAt && saved >= g.target) {
      const done = { ...g, completedAt: now, completedAmount: saved }
      completed.push(done)
      return done
    }
    return g
  })
  return { book: validBook({ ...book, goals }), completed }
}
export function replaceRecord(book: Book, id: string | null, next?: RecordItem) {
  let accounts = book.accounts.map((a) => ({ ...a }))
  const old = id ? book.records.find((r) => r.id === id) : undefined
  if (id && !old) throw new Error('找不到紀錄')
  if (next) {
    recordSchema.parse(next)
    if (next.date > today()) throw new Error('日期不可晚於今天')
    if (next.settled) throw new Error('新紀錄不能標示為舊版已結算')
    if (next.id !== id && book.records.some((r) => r.id === next.id)) throw new Error('紀錄重複')
  }
  if (old?.settled) {
    const delta = effects(book, old)
    accounts = accounts.map((a) => ({ ...a, opening: a.opening - (delta.get(a.id) ?? 0) }))
  }
  const records = book.records.filter((r) => r.id !== id)
  if (next) {
    const index = id ? book.records.findIndex((r) => r.id === id) : -1
    if (index >= 0) records.splice(index, 0, next)
    else records.push(next)
  }
  return validBook({ ...book, accounts, records })
}
export function saveAccount(
  book: Book,
  account: {
    id: string
    name: string
    kind: 'asset' | 'liability'
    balance: number
    assetClass?: AssetClass
  },
) {
  const old = book.accounts.find((a) => a.id === account.id)
  if (
    old &&
    old.kind !== account.kind &&
    (book.records.some((r) => r.accountId === old.id || r.toAccountId === old.id) ||
      book.goals.some((g) => g.accountId === old.id))
  )
    throw new Error('此帳戶已連結紀錄或目標，不能更換資產／負債類型')
  if (!Number.isInteger(account.balance) || account.balance < 0 || account.balance > 1e12)
    throw new Error('請輸入有效餘額')
  const delta = old ? balances(book).get(old.id)! - old.opening : 0
  const next = {
    id: account.id,
    name: account.name,
    kind: account.kind,
    opening: account.balance - delta,
    ...(account.assetClass || old?.assetClass
      ? { assetClass: account.assetClass ?? old?.assetClass }
      : {}),
  }
  return validBook({
    ...book,
    accounts: old
      ? book.accounts.map((a) => (a.id === next.id ? next : a))
      : [...book.accounts, next],
  })
}
export function removeAccount(book: Book, id: string) {
  if (
    book.goals.some((g) => g.accountId === id) ||
    book.records.some((r) => r.accountId === id || r.toAccountId === id)
  )
    throw new Error('請先解除相關目標與紀錄，再刪除帳戶')
  return validBook({ ...book, accounts: book.accounts.filter((a) => a.id !== id) })
}
export function saveGoal(book: Book, goal: SavingGoal) {
  const old = book.goals.find((g) => g.id === goal.id)
  if (old && old.accountId !== goal.accountId && book.records.some((r) => r.goalId === goal.id))
    throw new Error('此目標已有存款明細，請先處理紀錄後再更換指定帳戶')
  return validBook({
    ...book,
    goals: old ? book.goals.map((g) => (g.id === goal.id ? goal : g)) : [...book.goals, goal],
  })
}
export function removeGoal(book: Book, id: string) {
  return validBook({
    ...book,
    goals: book.goals.filter((g) => g.id !== id),
    records: book.records.map((r) => {
      if (r.goalId !== id) return r
      const next = { ...r }
      delete next.goalId
      return next
    }),
  })
}
export function depositRows(book: Book) {
  const accountBalances = balances(book),
    running = new Map(book.accounts.map((a) => [a.id, a.opening]))
  const sorted = book.records
    .map((r, index) => ({ ...r, index }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
  const rows: { record: RecordItem; after: number }[] = []
  for (const r of sorted) {
    if (!r.settled)
      for (const [id, delta] of effects(book, r)) running.set(id, running.get(id)! + delta)
    if (r.goalId) {
      const id = r.type === 'transfer' ? r.toAccountId! : r.accountId
      rows.push({
        record: book.records[r.index],
        after: running.get(id) ?? accountBalances.get(id) ?? 0,
      })
    }
  }
  return rows
}
export function migrateBook(v2raw: unknown | null, v1raw: unknown | null): Book {
  const v1 = v1raw === null ? null : legacySchema.parse(v1raw),
    v2 = v2raw === null ? null : questDataSchema.parse(v2raw)
  if (!v1 && !v2) return emptyBook()
  let book = emptyBook()
  book.accounts = v1
    ? v1.accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, opening: a.balance }))
    : []
  book.goals = []
  book.records = v1
    ? v1.transactions.map((r) => ({
        ...r,
        categoryId:
          r.type === 'transfer'
            ? undefined
            : r.type === 'income'
              ? 'other-income'
              : 'other-expense',
        settled: true,
      }))
    : []
  if (v2) {
    const used = new Map<string, number>()
    book.goals = v2.goals.map((g) => {
      const old = v1?.goals.find((o) => o.id === g.id)
      let accountId = old?.accountId
      if (!accountId) {
        accountId = g.id === 'first-goal' ? 'post' : `saving-${g.id}`
        if (!book.accounts.some((a) => a.id === accountId))
          book.accounts.push({
            id: accountId,
            name: g.id === 'first-goal' ? '郵局' : `${g.name}儲蓄`,
            kind: 'asset',
            opening: 0,
          })
      }
      used.set(accountId, (used.get(accountId) ?? 0) + g.saved)
      return {
        id: g.id,
        name: g.name,
        target: g.target,
        deadline: g.deadline,
        accountId,
        ...(g.completedAt
          ? { completedAt: g.completedAt, completedAmount: g.completedAmount }
          : {}),
      }
    })
    book.accounts = book.accounts.map((a) =>
      used.has(a.id) ? { ...a, opening: used.get(a.id)! } : a,
    )
  } else if (v1)
    book.goals = v1.goals.map((g) => ({
      id: g.id,
      name: g.name,
      target: g.target,
      deadline: g.deadline,
      accountId: g.accountId,
      ...(g.completedAt ? { completedAt: g.completedAt, completedAmount: g.completedAmount } : {}),
    }))
  for (const a of emptyBook().accounts)
    if (!book.accounts.some((x) => x.id === a.id)) book.accounts.push(a)
  return validBook(book)
}
export function loadBook(): { book: Book; error?: string; migrated?: boolean } {
  try {
    const raw = localStorage.getItem(BOOK_KEY)
    if (raw !== null) return { book: validBook(JSON.parse(raw)) }
    const v2 = localStorage.getItem(QUEST_KEY),
      v1 = localStorage.getItem(STORAGE_KEY)
    return {
      book: migrateBook(v2 === null ? null : JSON.parse(v2), v1 === null ? null : JSON.parse(v1)),
      migrated: v1 !== null || v2 !== null,
    }
  } catch {
    return {
      book: emptyBook(),
      error: '無法讀取原始資料，已停止編輯與儲存。請勿清除瀏覽器資料，以免無法修復。',
    }
  }
}
export function annualIncome(book: Book, year: number) {
  return periodStats(book, String(year)).income
}
export const newRecord = (type: RecordItem['type']): RecordItem => ({
  id: uid(),
  type,
  date: today(),
  amount: 0,
  accountId: '',
  note: '',
})

export function archiveGoal(book: Book, id: string, archived = true) {
  if (!book.goals.some((g) => g.id === id)) throw new Error('找不到目標')
  return validBook({
    ...book,
    goals: book.goals.map((g) => (g.id === id ? { ...g, archived } : g)),
  })
}
export function matchesRecordDate(
  record: RecordItem,
  filter: { month?: string; from?: string; to?: string },
) {
  if (filter.from && filter.to && filter.from > filter.to) return false
  return (
    (!filter.month || record.date.startsWith(filter.month)) &&
    (!filter.from || record.date >= filter.from) &&
    (!filter.to || record.date <= filter.to)
  )
}

export const assetClasses = { savings: '儲蓄', investment: '投資', fund: '基金' } as const
export type AssetClass = keyof typeof assetClasses
export function accountClass(account: BookAccount): AssetClass {
  return (
    account.assetClass ??
    (/基金/.test(account.name)
      ? 'fund'
      : /投資|證券|股票/.test(account.name)
        ? 'investment'
        : 'savings')
  )
}
export function assetGroups(book: Book) {
  const current = balances(book)
  return (Object.keys(assetClasses) as AssetClass[]).map((id) => ({
    id,
    name: assetClasses[id],
    amount: book.accounts
      .filter((a) => a.kind === 'asset' && accountClass(a) === id)
      .reduce((sum, a) => sum + current.get(a.id)!, 0),
  }))
}
export function daysUntil(deadline: string, now = today()) {
  return Math.round(
    (Date.parse(deadline + 'T00:00:00Z') - Date.parse(now + 'T00:00:00Z')) / 86400000,
  )
}
