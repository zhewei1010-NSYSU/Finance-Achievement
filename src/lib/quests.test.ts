import { afterEach, describe, expect, it } from 'vitest'
import { initialData, STORAGE_KEY } from './finance'
import {
  adventure,
  checkup,
  loadQuests,
  migrateLegacy,
  QUEST_KEY,
  questDataSchema,
  reconcileQuests,
  stages,
  stats,
} from './quests'
afterEach(() => localStorage.clear())
describe('舊版儲蓄資料帶入', () => {
  it('保留原有目標、日期、已存金額與規劃', () => {
    const old = initialData(),
      next = migrateLegacy(old)
    expect(next.version).toBe(2)
    expect(next.goals[0]).toMatchObject({
      id: 'first-goal',
      saved: 10000,
      target: 40000,
      deadline: '2026-12-31',
    })
    expect(next.plan).toEqual(old.plan)
  })
  it('已達成的日期與金額不遺失', () => {
    const old = initialData()
    old.goals[0].completedAt = '2026-10-23'
    old.goals[0].completedAmount = 40000
    old.accounts[0].balance = 10000
    expect(migrateLegacy(old).goals[0]).toMatchObject({
      saved: 10000,
      completedAt: '2026-10-23',
      completedAmount: 40000,
    })
  })
  it('共用帳戶依目標比例分配且保持總額，避免重複計算', () => {
    const old = initialData()
    old.goals.push({ ...old.goals[0], id: 'second', target: 60000 })
    const next = migrateLegacy(old)
    expect(next.goals.map((g) => g.saved)).toEqual([4000, 6000])
    expect(adventure(next).totalSaved).toBe(10000)
  })
  it('讀取舊版不修改原資料，新版存在時優先使用', () => {
    const old = JSON.stringify(initialData())
    localStorage.setItem(STORAGE_KEY, old)
    const first = loadQuests()
    expect(first.migrated).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(old)
    const changed = { ...first.data, goals: [{ ...first.data.goals[0], saved: 15000 }] }
    localStorage.setItem(QUEST_KEY, JSON.stringify(changed))
    expect(loadQuests().data.goals[0].saved).toBe(15000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(old)
  })
  it('損毀新版不回退並覆寫成舊版或預設值', () => {
    localStorage.setItem(QUEST_KEY, 'broken')
    expect(loadQuests().error).toBeTruthy()
    expect(localStorage.getItem(QUEST_KEY)).toBe('broken')
  })
  it('損毀舊版被保留，不寫入新版', () => {
    localStorage.setItem(STORAGE_KEY, 'broken')
    expect(loadQuests().error).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('broken')
    expect(localStorage.getItem(QUEST_KEY)).toBeNull()
  })
})
describe('闖關進度與成就', () => {
  it('每 25% 解鎖一個里程碑，未到下一站不提前計算', () => {
    const d = migrateLegacy(initialData())
    for (const [saved, stage] of [
      [0, 0],
      [9999, 0],
      [10000, 1],
      [19999, 1],
      [20000, 2],
      [30000, 3],
      [40000, 4],
      [50000, 4],
    ]) {
      const q = { ...d.goals[0], saved }
      expect(stats(q, d.plan).stage).toBe(stage)
    }
    expect(stages.map((s) => s.percent)).toEqual([0, 25, 50, 75, 100])
  })
  it('每4XP升級且初始為1XP，等級按目前進度計算', () => {
    const d = migrateLegacy(initialData())
    expect(adventure(d)).toMatchObject({ xp: 1, level: 1, next: 3, progress: 25 })
    d.goals[0].saved = 40000
    expect(adventure(d)).toMatchObject({ xp: 4, level: 2, next: 4, progress: 0 })
  })
  it('達成只觸發一次，餘額下降保留成就與XP', () => {
    const d = migrateLegacy(initialData())
    d.goals[0].saved = 40000
    const first = reconcileQuests(d, '2026-10-24')
    expect(first.completed).toHaveLength(1)
    const again = reconcileQuests(first.data, '2026-10-25')
    expect(again.completed).toHaveLength(0)
    again.data.goals[0].saved = 5000
    expect(adventure(again.data)).toMatchObject({ xp: 4, finished: 1 })
    expect(again.data.goals[0].completedAmount).toBe(40000)
  })
  it('拒絕負數、重複ID與不完整成就', () => {
    const d = migrateLegacy(initialData())
    expect(questDataSchema.safeParse({ ...d, goals: [{ ...d.goals[0], saved: -1 }] }).success).toBe(
      false,
    )
    expect(questDataSchema.safeParse({ ...d, goals: [...d.goals, ...d.goals] }).success).toBe(false)
    expect(
      questDataSchema.safeParse({ ...d, goals: [{ ...d.goals[0], completedAt: '2026-10-24' }] })
        .success,
    ).toBe(false)
  })
  it('日期估算處理月末、未設定與逾期', () => {
    const d = migrateLegacy(initialData())
    expect(stats(d.goals[0], d.plan).estimate).toBeNull()
    expect(stats(d.goals[0], d.plan, '2027-01-01').monthly).toBeNull()
    d.plan.savings = 30000
    expect(stats(d.goals[0], d.plan, '2027-01-31').estimate).toBe('2027-02-28')
  })
  it('健檢加總多個目標所需月存，而不是逐一比較相同預算', () => {
    const d = migrateLegacy(initialData())
    d.goals = d.goals.map((g) => ({ ...g, deadline: '2099-12-31' }))
    d.goals.push({ ...d.goals[0], id: 'second', target: 60000 })
    const required = d.goals.reduce((s, g) => s + (stats(g, d.plan).monthly ?? 0), 0)
    d.plan.savings = required - 1
    expect(checkup(d)[2].status).toBe('再加把勁')
    d.plan.savings = required
    expect(checkup(d)[2].status).toBe('狀態不錯')
  })
})

describe('已完成挑戰的健檢', () => {
  it('歷史成就不因後來調低金額而被列為逾期挑戰', () => {
    const data = migrateLegacy(initialData())
    data.goals[0] = {
      ...data.goals[0],
      saved: 0,
      deadline: '2020-01-01',
      completedAt: '2020-01-01',
      completedAmount: 40000,
    }
    expect(checkup(data)[2].status).toBe('狀態不錯')
  })
})
