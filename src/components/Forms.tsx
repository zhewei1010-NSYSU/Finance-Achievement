import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import {
  accountSchema,
  goalSchema,
  transactionSchema,
  categoryNames,
  today,
  uid,
} from '../lib/finance'
import type { Account, Goal, FinanceData, Transaction } from '../lib/finance'
import { Field, MoneyInput } from './UI'
const values = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  return Object.fromEntries(new FormData(event.currentTarget))
}
const message = (e: unknown) =>
  e instanceof z.ZodError
    ? e.issues.map((i) => i.message).join('；')
    : e instanceof Error
      ? e.message
      : '請確認輸入內容'
export function AccountForm({
  account,
  onSave,
  close,
}: {
  account?: Account
  onSave: (a: Account) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  const [category, setCategory] = useState(account?.category ?? 'bank')
  return (
    <form
      onSubmit={(e) => {
        const v = values(e)
        try {
          onSave(
            accountSchema.parse({
              id: account?.id ?? uid(),
              ...v,
              kind: category === 'credit' ? 'liability' : v.kind,
              balance: Number(v.balance),
            }),
          )
          close()
        } catch (e) {
          setError(message(e))
        }
      }}
    >
      <div className="form-grid">
        <Field label="帳戶名稱">
          <input
            name="name"
            maxLength={80}
            defaultValue={account?.name}
            placeholder="例如：旅行基金帳戶"
            required
          />
        </Field>
        <Field label="帳戶類別">
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Account['category'])}
          >
            {Object.entries(categoryNames).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="資產／負債">
          <select
            name="kind"
            defaultValue={account?.kind ?? 'asset'}
            disabled={category === 'credit'}
          >
            <option value="asset">資產</option>
            <option value="liability">負債</option>
          </select>
        </Field>
        <Field
          label="目前餘額（NT$）"
          hint="負債請填尚未償還的正數金額。直接調整餘額不會產生收支紀錄。"
        >
          <MoneyInput name="balance" defaultValue={account?.balance} />
        </Field>
      </div>
      {category === 'credit' && (
        <p className="info">信用卡自動歸類為負債；刷卡登記支出，還款使用轉帳。</p>
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
          儲存帳戶
        </button>
      </div>
    </form>
  )
}
export function GoalForm({
  goal,
  data,
  onSave,
  close,
}: {
  goal?: Goal
  data: FinanceData
  onSave: (g: Goal) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        const v = values(e)
        try {
          const next = goalSchema.parse({
            id: goal?.id ?? uid(),
            ...v,
            target: Number(v.target),
            createdAt: goal?.createdAt ?? today(),
            ...(goal?.completedAt
              ? { completedAt: goal.completedAt, completedAmount: goal.completedAmount }
              : {}),
          })
          onSave(next)
          close()
        } catch (e) {
          setError(message(e))
        }
      }}
    >
      <div className="form-grid">
        <Field label="儲蓄目標名稱">
          <input
            name="name"
            maxLength={80}
            defaultValue={goal?.name}
            placeholder="例如：給自己的旅行基金"
            required
          />
        </Field>
        <Field label="目標金額（NT$）">
          <MoneyInput name="target" min={1} defaultValue={goal?.target ?? 40000} />
        </Field>
        <Field label="截止日期">
          <input
            name="deadline"
            type="date"
            defaultValue={goal?.deadline ?? '2026-12-31'}
            required
          />
        </Field>
        <Field label="連動資產帳戶">
          <select
            name="accountId"
            defaultValue={goal?.accountId ?? data.accounts.find((a) => a.kind === 'asset')?.id}
            required
          >
            {data.accounts
              .filter((a) => a.kind === 'asset')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <p className="info">
        進度使用指定帳戶的全部餘額，不額外加計為資產。同一帳戶的多個目標會共用餘額，並非獨立分配的資金。預計日期假設每月全部儲蓄投入此目標。
      </p>
      {goal?.completedAt && (
        <p className="info">已完成紀錄會保留原達成日期與金額；若要建立新的挑戰，請新增目標。</p>
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
        <button className="button primary">儲存目標</button>
      </div>
    </form>
  )
}
export function TransactionForm({
  data,
  onSave,
  close,
}: {
  data: FinanceData
  onSave: (t: Transaction) => void
  close: () => void
}) {
  const [type, setType] = useState<Transaction['type']>('expense')
  const [error, setError] = useState('')
  const accounts = data.accounts.filter((a) => type !== 'income' || a.kind === 'asset')
  return (
    <form
      onSubmit={(e) => {
        const v = values(e)
        try {
          const next = transactionSchema.parse({ ...v, id: uid(), amount: Number(v.amount) })
          onSave(next)
          close()
        } catch (e) {
          setError(message(e))
        }
      }}
    >
      <div className="segmented form-segments">
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <button
            type="button"
            key={t}
            className={t === type ? 'active' : ''}
            onClick={() => {
              setType(t)
              setError('')
            }}
          >
            {{ expense: '支出', income: '收入', transfer: '轉帳／還卡費' }[t]}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />
      <div className="form-grid">
        <Field label="金額（NT$）">
          <MoneyInput name="amount" min={1} />
        </Field>
        <Field label="交易日期">
          <input name="date" type="date" max={today()} defaultValue={today()} required />
        </Field>
        <Field label={type === 'transfer' ? '來源帳戶' : '交易帳戶'}>
          <select key={type} name="accountId" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {type === 'transfer' && (
          <Field label="目的帳戶">
            <select name="toAccountId" required>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="備註">
          <input name="note" maxLength={160} placeholder="例如：午餐、薪水或信用卡還款" />
        </Field>
      </div>
      <p className="info">
        交易會立即調整帳戶餘額。刷卡列入支出並增加負債；繳卡費請選「轉帳」，從資產帳戶轉入信用卡，避免重複計算支出。
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={close}>
          取消
        </button>
        <button className="button primary" disabled={accounts.length === 0}>
          新增紀錄
        </button>
      </div>
    </form>
  )
}
