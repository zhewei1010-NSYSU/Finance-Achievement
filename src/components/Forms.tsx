import { useState } from 'react'
import { z } from 'zod'
import { today, uid } from '../lib/finance'
import { questSchema } from '../lib/quests'
import type { Quest } from '../lib/quests'
import { Field, MoneyInput } from './UI'

export function GoalForm({
  goal,
  onSave,
  close,
}: {
  goal?: Quest
  onSave: (goal: Quest) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          const next = questSchema.parse({
            id: goal?.id ?? uid(),
            name: v.name,
            target: Number(v.target),
            saved: Number(v.saved),
            deadline: v.deadline,
            createdAt: goal?.createdAt ?? today(),
            ...(goal?.completedAt
              ? { completedAt: goal.completedAt, completedAmount: goal.completedAmount }
              : {}),
          })
          onSave(next)
          close()
        } catch (e) {
          setError(
            e instanceof z.ZodError
              ? e.issues.map((i) => i.message).join('；')
              : e instanceof Error
                ? e.message
                : '請確認輸入內容',
          )
        }
      }}
    >
      <Field label="目標名稱">
        <input
          name="name"
          maxLength={80}
          defaultValue={goal?.name}
          placeholder="例如：我的第一桶金"
          required
        />
      </Field>
      <div className="form-grid">
        <Field label="目標金額（NT$）">
          <MoneyInput name="target" min={1} defaultValue={goal?.target ?? 40000} />
        </Field>
        <Field label="目前已存（NT$）">
          <MoneyInput name="saved" defaultValue={goal?.saved ?? 0} />
        </Field>
      </div>
      <Field label="目標截止日期">
        <input
          name="deadline"
          type="date"
          defaultValue={goal?.deadline ?? `${new Date().getFullYear()}-12-31`}
          required
        />
      </Field>
      <p className="info">
        每個目標分別記錄已存金額，同一筆存款請勿重複填入多個目標。金額只供追蹤進度，不會操作實際存款。
      </p>
      {goal?.completedAt && (
        <p className="info">已解鎖的成就會保留原完成日期與金額。想再目標一次，可以建立新的目標。</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={close}>
          取消
        </button>
        <button className="button primary" type="submit">
          儲存目標
        </button>
      </div>
    </form>
  )
}
