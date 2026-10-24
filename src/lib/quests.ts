import { z } from 'zod'
import { dataSchema, dateSchema, initialData, planSchema, STORAGE_KEY, today } from './finance'
import type { Plan } from './finance'

export const QUEST_KEY = 'my-finance-quests.v2'
const amount = z.number().int().min(0).max(1e12)
export const questSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    target: amount.positive(),
    saved: amount,
    deadline: dateSchema,
    createdAt: dateSchema,
    completedAt: dateSchema.optional(),
    completedAmount: amount.optional(),
  })
  .strict()
  .refine((q) => !!q.completedAt === (q.completedAmount !== undefined), '完成紀錄不完整')
export const questDataSchema = z
  .object({ version: z.literal(2), goals: z.array(questSchema).max(200), plan: planSchema })
  .strict()
  .refine((d) => new Set(d.goals.map((g) => g.id)).size === d.goals.length, '挑戰識別碼重複')
export type Quest = z.infer<typeof questSchema>
export type QuestData = z.infer<typeof questDataSchema>
export const stages = [
  { percent: 0, title: '踏出第一步', subtitle: '每個夢想，都從這裡開始' },
  { percent: 25, title: '找到節奏', subtitle: '小小的累積，開始有了形狀' },
  { percent: 50, title: '走到一半', subtitle: '回頭看，你已經走了這麼遠' },
  { percent: 75, title: '勝利在望', subtitle: '再堅持一下，終點就在前面' },
  { percent: 100, title: '夢想達成', subtitle: '這一刻，值得為自己喝采' },
]
export function stats(q: Quest, plan: Plan, now = today()) {
  const remaining = Math.max(0, q.target - q.saved),
    percent = Math.min(100, (q.saved / q.target) * 100)
  const [y, m, day] = now.split('-').map(Number),
    [ey, em] = q.deadline.split('-').map(Number)
  const months = Math.max(1, (ey - y) * 12 + em - m + 1),
    overdue = q.deadline < now && remaining > 0
  let estimate: string | null = null
  if (!remaining) estimate = q.completedAt ?? now
  else if (plan.savings > 0 && Math.ceil(remaining / plan.savings) <= 1200) {
    const month = m - 1 + Math.ceil(remaining / plan.savings),
      d = new Date(y, month, Math.min(day, new Date(y, month + 1, 0).getDate()))
    estimate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return {
    remaining,
    percent,
    monthly: overdue ? null : Math.ceil(remaining / months),
    overdue,
    estimate,
    stage: Math.min(4, Math.floor(percent / 25)),
  }
}
export function reconcileQuests(data: QuestData, now = today()) {
  const completed: Quest[] = []
  const goals = data.goals.map((g) => {
    if (!g.completedAt && g.saved >= g.target) {
      const done = { ...g, completedAt: now, completedAmount: g.saved }
      completed.push(done)
      return done
    }
    return g
  })
  return { data: questDataSchema.parse({ ...data, goals }), completed }
}
export function migrateLegacy(raw: unknown): QuestData {
  const legacy = dataSchema.parse(raw)
  // Shared balances are apportioned by target size, so a single deposit is never counted twice.
  const allocated = new Map<string, number>()
  const goals = legacy.goals.map((g, index) => {
    const balance = legacy.accounts.find((a) => a.id === g.accountId)!.balance
    const group = legacy.goals.filter((item) => item.accountId === g.accountId)
    const last = legacy.goals.map((item) => item.accountId).lastIndexOf(g.accountId) === index
    const saved = last
      ? balance - (allocated.get(g.accountId) ?? 0)
      : Math.floor((balance * g.target) / group.reduce((s, item) => s + item.target, 0))
    allocated.set(g.accountId, (allocated.get(g.accountId) ?? 0) + saved)
    return {
      id: g.id,
      name: g.name,
      target: g.target,
      saved,
      deadline: g.deadline,
      createdAt: g.createdAt,
      ...(g.completedAt ? { completedAt: g.completedAt, completedAmount: g.completedAmount } : {}),
    }
  })
  return questDataSchema.parse({ version: 2, goals, plan: legacy.plan })
}
export function loadQuests(): { data: QuestData; error?: string; migrated?: boolean } {
  try {
    const current = localStorage.getItem(QUEST_KEY)
    if (current !== null) return { data: questDataSchema.parse(JSON.parse(current)) }
    const legacy = localStorage.getItem(STORAGE_KEY)
    return {
      data: migrateLegacy(legacy === null ? initialData() : JSON.parse(legacy)),
      migrated: legacy !== null,
    }
  } catch {
    return {
      data: migrateLegacy(initialData()),
      error: '本機資料無法讀取，已停止寫入以保留原始內容。請先不要清除瀏覽器資料，待修復後再繼續。',
    }
  }
}
export function adventure(data: QuestData) {
  const xp = data.goals.reduce(
    (s, g) => s + (g.completedAt ? 4 : Math.floor(stats(g, data.plan).percent / 25)),
    0,
  )
  const level = Math.floor(xp / 4) + 1
  return {
    xp,
    level,
    next: 4 - (xp % 4),
    progress: ((xp % 4) / 4) * 100,
    finished: data.goals.filter((g) => g.completedAt).length,
    totalSaved: data.goals.reduce((s, g) => s + g.saved, 0),
  }
}
export function checkup(data: QuestData) {
  const p = data.plan,
    spending = p.living + p.family,
    rate = p.salary > 0 ? (p.savings / p.salary) * 100 : null
  const cash = p.salary - spending - p.savings - p.investment
  const needed = data.goals
    .filter((g) => !g.completedAt)
    .reduce((s, g) => s + (stats(g, p).monthly ?? 0), 0)
  const overdue = data.goals.some((g) => !g.completedAt && stats(g, p).overdue)
  return [
    {
      title: '儲蓄習慣',
      status: rate === null ? '待設定' : rate >= 20 ? '狀態不錯' : '再加把勁',
      detail:
        rate === null
          ? '先填寫月薪與每月儲蓄，幫自己找到舒服的節奏。'
          : `目前規劃儲蓄率 ${rate.toFixed(1)}%。可以 20% 為參考，再依自己的生活需求調整。`,
    },
    {
      title: '預算平衡',
      status: p.salary === 0 ? '待設定' : cash >= 0 ? '狀態不錯' : '再加把勁',
      detail:
        p.salary === 0
          ? '到理財規劃設定預算，看看每月能為夢想留下多少。'
          : `每月分配後剩餘 ${cash.toLocaleString('zh-TW')} 元。${cash < 0 ? '分配已超出收入，試著調整生活費、儲蓄或投資。' : '留一些彈性，日常生活也要好好照顧。'}`,
    },
    {
      title: '挑戰步調',
      status: !data.goals.length
        ? '待設定'
        : overdue || needed > p.savings
          ? '再加把勁'
          : '狀態不錯',
      detail: overdue
        ? '有挑戰超過原訂日期。調整期限也沒關係，重要的是繼續前進。'
        : `所有進行中挑戰合計每月需要約 ${needed.toLocaleString('zh-TW')} 元，請和每月儲蓄預算一起安排。`,
    },
    {
      title: '安全緩衝',
      status: spending === 0 ? '待設定' : '規劃提醒',
      detail:
        spending === 0
          ? '填寫生活費與孝親費後，就能估算預備金目標。'
          : `建議另留 ${(spending * 6).toLocaleString('zh-TW')} 元，作為六個月緊急預備金。這是建議金額，未判定你的實際預備金是否足夠。`,
    },
  ]
}
