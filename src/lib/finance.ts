import { z } from 'zod'

export const STORAGE_KEY = 'my-finance-dashboard.v1'
export const money = (value: number) =>
  `${value < 0 ? '−' : ''}NT$${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.abs(value))}`
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const uid = () => crypto.randomUUID()
const amount = z.number().finite().int().min(0).max(1_000_000_000_000)
const signedAmount = z.number().finite().min(-1e15).max(1e15)
const text = z.string().trim().min(1).max(80)
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, '請輸入有效日期')
export const accountSchema = z
  .object({
    id: text,
    name: text,
    kind: z.enum(['asset', 'liability']),
    category: z.enum(['post', 'bank', 'investment', 'fund', 'credit', 'custom']),
    balance: amount,
  })
  .strict()
export const goalSchema = z
  .object({
    id: text,
    name: text,
    target: amount.positive(),
    deadline: dateSchema,
    accountId: text,
    createdAt: dateSchema,
    completedAt: dateSchema.optional(),
    completedAmount: amount.optional(),
  })
  .strict()
  .refine((g) => !!g.completedAt === (g.completedAmount !== undefined), '完成紀錄不完整')
export const transactionSchema = z
  .object({
    id: text,
    type: z.enum(['income', 'expense', 'transfer']),
    accountId: text,
    toAccountId: text.optional(),
    amount: amount.positive(),
    date: dateSchema,
    note: z.string().max(160),
  })
  .strict()
  .refine(
    (t) =>
      t.type === 'transfer'
        ? !!t.toAccountId && t.toAccountId !== t.accountId
        : t.toAccountId === undefined,
    '轉帳來源與目的帳戶不得相同',
  )
export const planSchema = z
  .object({
    salary: amount,
    living: amount,
    family: amount,
    savings: amount,
    investment: amount,
    currentAge: z.number().int().min(0).max(99),
    targetAge: z.number().int().min(1).max(100),
    targetAssets: amount.positive(),
    returnRate: z.number().finite().min(-20).max(20),
  })
  .strict()
  .refine((p) => p.targetAge > p.currentAge, '目標年齡須大於目前年齡')
export const dataSchema = z
  .object({
    version: z.literal(1),
    accounts: z.array(accountSchema).max(200),
    goals: z.array(goalSchema).max(200),
    transactions: z.array(transactionSchema).max(10000),
    plan: planSchema,
    snapshots: z
      .array(
        z
          .object({
            date: dateSchema,
            assets: signedAmount,
            liabilities: signedAmount,
            net: signedAmount,
          })
          .strict()
          .refine(
            (s) =>
              s.assets >= 0 &&
              s.liabilities >= 0 &&
              Math.abs(s.net - (s.assets - s.liabilities)) < 1,
            '資產快照不一致',
          ),
      )
      .max(10000),
    theme: z.enum(['light', 'dark']),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = new Set<string>()
    for (const item of [...data.accounts, ...data.goals, ...data.transactions]) {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', message: '資料包含重複識別碼' })
      ids.add(item.id)
    }
    const accounts = new Map(data.accounts.map((a) => [a.id, a]))
    data.accounts.forEach((a) => {
      if (a.category === 'credit' && a.kind !== 'liability')
        ctx.addIssue({ code: 'custom', message: '信用卡必須為負債帳戶' })
    })
    data.goals.forEach((g) => {
      if (accounts.get(g.accountId)?.kind !== 'asset')
        ctx.addIssue({ code: 'custom', message: '儲蓄目標必須連結有效資產帳戶' })
    })
    data.transactions.forEach((t) => {
      if (!accounts.has(t.accountId) || (t.toAccountId && !accounts.has(t.toAccountId)))
        ctx.addIssue({ code: 'custom', message: '交易包含不存在的帳戶' })
      if (t.type === 'income' && accounts.get(t.accountId)?.kind === 'liability')
        ctx.addIssue({ code: 'custom', message: '收入須存入資產帳戶' })
    })
    if (new Set(data.snapshots.map((s) => s.date)).size !== data.snapshots.length)
      ctx.addIssue({ code: 'custom', message: '每日快照日期重複' })
  })
export type FinanceData = z.infer<typeof dataSchema>
export type Account = z.infer<typeof accountSchema>
export type Goal = z.infer<typeof goalSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type Plan = z.infer<typeof planSchema>

export function totals(accounts: Account[]) {
  const assets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.balance, 0)
  const liabilities = accounts
    .filter((a) => a.kind === 'liability')
    .reduce((s, a) => s + a.balance, 0)
  return { assets, liabilities, net: assets - liabilities }
}
export function initialData(): FinanceData {
  return {
    version: 1,
    accounts: [
      { id: 'post', name: '郵局儲蓄', category: 'post', kind: 'asset', balance: 10000 },
      { id: 'bank', name: '銀行日常帳戶', category: 'bank', kind: 'asset', balance: 0 },
      { id: 'cathay', name: '國泰投資帳戶', category: 'investment', kind: 'asset', balance: 0 },
      { id: 'fund', name: '高銀基金帳戶', category: 'fund', kind: 'asset', balance: 0 },
      { id: 'card', name: '信用卡', category: 'credit', kind: 'liability', balance: 0 },
    ],
    goals: [
      {
        id: 'first-goal',
        name: '第一桶金・郵局儲蓄',
        target: 40000,
        deadline: '2026-12-31',
        accountId: 'post',
        createdAt: today(),
      },
    ],
    transactions: [],
    plan: {
      salary: 0,
      living: 0,
      family: 0,
      savings: 0,
      investment: 0,
      currentAge: 25,
      targetAge: 30,
      targetAssets: 1000000,
      returnRate: 3,
    },
    snapshots: [{ date: today(), assets: 10000, liabilities: 0, net: 10000 }],
    theme: 'light',
  }
}

export function monthlyStats(data: FinanceData, month = today().slice(0, 7)) {
  const records = data.transactions.filter((t) => t.date.startsWith(month))
  const income = records.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = records.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return {
    income,
    expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
    cashflow: income - expense,
  }
}
export function goalStats(goal: Goal, data: FinanceData, now = today()) {
  const current = data.accounts.find((a) => a.id === goal.accountId)?.balance ?? 0
  const remaining = Math.max(goal.target - current, 0)
  const [y, m, day] = now.split('-').map(Number)
  const [ey, em] = goal.deadline.split('-').map(Number)
  const overdue = goal.deadline < now && remaining > 0
  const months = Math.max(1, (ey - y) * 12 + em - m + 1)
  const monthly = overdue ? null : Math.ceil(remaining / months)
  const contribution = data.plan.savings
  let estimate: string | null = null
  const estimateTooLong = contribution > 0 && Math.ceil(remaining / contribution) > 1200
  if (remaining === 0) estimate = goal.completedAt ?? now
  else if (contribution > 0 && !estimateTooLong) {
    const targetMonth = m - 1 + Math.ceil(remaining / contribution)
    const lastDay = new Date(y, targetMonth + 1, 0).getDate()
    const d = new Date(y, targetMonth, Math.min(day, lastDay))
    estimate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return {
    current,
    remaining,
    percent: Math.min(100, (current / goal.target) * 100),
    monthly,
    overdue,
    estimate,
    estimateTooLong,
  }
}
export function reconcile(
  data: FinanceData,
  now = today(),
): { data: FinanceData; completed: Goal[] } {
  const completed: Goal[] = []
  const goals = data.goals.map((g) => {
    const balance = data.accounts.find((a) => a.id === g.accountId)?.balance ?? 0
    if (!g.completedAt && balance >= g.target) {
      const done = { ...g, completedAt: now, completedAmount: balance }
      completed.push(done)
      return done
    }
    return g
  })
  const snapshot = { date: now, ...totals(data.accounts) }
  return {
    data: {
      ...data,
      goals,
      snapshots: [...data.snapshots.filter((s) => s.date !== now), snapshot]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-10000),
    },
    completed,
  }
}

export function applyTransaction(
  data: FinanceData,
  raw: Transaction,
  reverse = false,
): FinanceData {
  const tx = transactionSchema.parse(raw)
  const sign = reverse ? -1 : 1
  if (tx.date > today()) throw new Error('暫不支援未來日期的交易')
  if (!reverse && data.transactions.some((t) => t.id === tx.id)) throw new Error('交易已存在')
  const source = data.accounts.find((a) => a.id === tx.accountId)
  const dest = data.accounts.find((a) => a.id === tx.toAccountId)
  if (!source || (tx.type === 'transfer' && !dest)) throw new Error('找不到交易帳戶')
  if (tx.type === 'income' && source.kind === 'liability') throw new Error('收入請選擇資產帳戶')
  const delta = new Map<string, number>()
  const change = (a: Account, inflow: number) =>
    delta.set(a.id, (delta.get(a.id) ?? 0) + inflow * (a.kind === 'asset' ? 1 : -1) * sign)
  if (tx.type === 'income') change(source, tx.amount)
  if (tx.type === 'expense') change(source, -tx.amount)
  if (tx.type === 'transfer' && dest) {
    change(source, -tx.amount)
    change(dest, tx.amount)
  }
  const accounts = data.accounts.map((a) => ({ ...a, balance: a.balance + (delta.get(a.id) ?? 0) }))
  if (accounts.some((a) => a.balance < 0 || a.balance > 1e12))
    throw new Error('餘額不足、還款超過負債，或餘額超出上限；請檢查金額')
  return dataSchema.parse({
    ...data,
    accounts,
    transactions: reverse
      ? data.transactions.filter((t) => t.id !== tx.id)
      : [...data.transactions, tx],
  })
}
export function projection(plan: Plan, initial: number, rate = plan.returnRate) {
  const months = (plan.targetAge - plan.currentAge) * 12
  const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1
  let savings = 0,
    invested = 0
  const series = [{ age: plan.currentAge, value: initial }]
  for (let i = 1; i <= months; i++) {
    savings += plan.savings
    invested = invested * (1 + monthlyRate) + plan.investment
    if (i % 12 === 0)
      series.push({
        age: plan.currentAge + i / 12,
        value: Math.round(initial + savings + invested),
      })
  }
  return series
}
export function health(data: FinanceData) {
  const p = data.plan
  const { assets, liabilities } = totals(data.accounts)
  const liquid = data.accounts
    .filter((a) => a.kind === 'asset' && ['post', 'bank', 'custom'].includes(a.category))
    .reduce((s, a) => s + a.balance, 0)
  const spending = p.living + p.family
  const rate = p.salary > 0 ? (p.savings / p.salary) * 100 : null
  const available = p.salary - spending - p.savings - p.investment
  const behind = data.goals.filter((g) => {
    const s = goalStats(g, data)
    return s.remaining > 0 && (s.overdue || (s.monthly ?? 0) > p.savings)
  }).length
  return [
    {
      title: '緊急預備金',
      status: spending === 0 ? '待設定' : liquid >= spending * 6 ? '穩健' : '需留意',
      detail:
        spending === 0
          ? '先在理財規劃填寫生活費與孝親費。'
          : `可動用資金約支應 ${(liquid / spending).toFixed(1)} 個月，建議準備 ${money(spending * 6)}（六個月必要支出）。`,
    },
    {
      title: '儲蓄習慣',
      status: rate === null ? '待設定' : rate >= 20 ? '穩健' : '需留意',
      detail:
        rate === null
          ? '填寫實領月薪與儲蓄預算，建立可持續的習慣。'
          : `規劃儲蓄率 ${rate.toFixed(1)}%，可先以 20% 為參考，依生活需求調整。`,
    },
    {
      title: '負債情況',
      status: liabilities === 0 || (assets > 0 && liabilities / assets <= 0.3) ? '穩健' : '需留意',
      detail:
        liabilities === 0
          ? '目前沒有已登記負債，請持續確認帳戶餘額。'
          : `負債 ${money(liabilities)}，${assets > 0 ? `占資產 ${((liabilities / assets) * 100).toFixed(1)}%` : '目前沒有可抵償的資產'}；優先清償高利率債務。`,
    },
    {
      title: '每月現金流',
      status: p.salary === 0 ? '待設定' : available >= 0 ? '穩健' : '需留意',
      detail:
        p.salary === 0
          ? '填寫每月規劃後即可檢查收支平衡。'
          : `預算分配後餘額 ${money(available)}。${available < 0 ? '目前分配超出收入，請降低支出或調整儲蓄、投資金額。' : '保留一部分彈性，應對不定期支出。'}`,
    },
    {
      title: '儲蓄目標進度',
      status: behind > 0 ? '需留意' : data.goals.length ? '穩健' : '待設定',
      detail:
        data.goals.length === 0
          ? '新增一個目標，為下一步儲蓄找到方向。'
          : behind > 0
            ? `${behind} 個目標已逾期或所需月存高於規劃；多目標共用儲蓄預算時，請另行分配。`
            : '依目前每月儲蓄規劃，個別目標進度合理；多目標仍需分配預算。',
    },
  ]
}
export function parseBackup(raw: string): FinanceData {
  if (new TextEncoder().encode(raw).length > 5_000_000) throw new Error('備份檔不可超過 5 MB')
  return dataSchema.parse(JSON.parse(raw))
}
export function loadData(): { data: FinanceData; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return { data: raw ? parseBackup(raw) : initialData() }
  } catch {
    return {
      data: initialData(),
      error: '無法讀取本機資料。為保護原始內容，已暫停自動儲存；請先下載原始資料，或匯入有效備份。',
    }
  }
}
export const categoryNames: Record<Account['category'], string> = {
  post: '郵局',
  bank: '銀行',
  investment: '投資',
  fund: '基金',
  credit: '信用卡',
  custom: '自訂',
}
