import { useState } from 'react'
import { z } from 'zod'
import { today, uid, money } from '../lib/finance'
import { balances, lifeSchema, recordSchema, savingGoalSchema } from '../lib/ledger'
import type { Book, BookAccount, RecordItem, SavingGoal } from '../lib/ledger'
import { Field, MoneyInput } from './UI'
const errorText = (e: unknown) =>
  e instanceof z.ZodError
    ? e.issues.map((i) => i.message).join('；')
    : e instanceof Error
      ? e.message
      : '請確認輸入內容'
function Actions({ close, label }: { close: () => void; label: string }) {
  return (
    <div className="form-actions">
      <button className="button secondary" type="button" onClick={close}>
        取消
      </button>
      <button className="button primary" type="submit">
        {label}
      </button>
    </div>
  )
}
export function RecordForm({
  book,
  record,
  deposit = false,
  goalId,
  onSave,
  close,
  initialType = 'expense',
}: {
  book: Book
  record?: RecordItem
  deposit?: boolean
  goalId?: string
  onSave: (r: RecordItem) => void
  close: () => void
  initialType?: RecordItem['type']
}) {
  const [type, setType] = useState<RecordItem['type']>(
      record?.type ??
        (deposit
          ? book.accounts.some(
              (a) =>
                a.kind === 'asset' &&
                a.id !==
                  book.goals.find(
                    (g) => g.id === (goalId ?? book.goals.find((g) => !g.archived)?.id),
                  )?.accountId,
            )
            ? 'transfer'
            : 'income'
          : initialType),
    ),
    [selectedGoal, setGoal] = useState(
      record?.goalId ?? goalId ?? book.goals.find((g) => !g.archived)?.id ?? '',
    ),
    [error, setError] = useState('')
  const goal = book.goals.find((g) => g.id === selectedGoal),
    b = balances(book),
    assets = book.accounts.filter((a) => a.kind === 'asset')
  const [destination, setDestination] = useState(
    record?.toAccountId ?? goal?.accountId ?? assets[1]?.id ?? '',
  )
  const destinationId = deposit ? goal?.accountId : destination
  const sourceDefault =
    record?.accountId ?? assets.find((a) => a.id !== destinationId)?.id ?? assets[0]?.id
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          const external = deposit && v.source === 'external',
            recordType = external ? 'income' : deposit ? 'transfer' : type
          const arrivingAccount =
            recordType === 'transfer' ? destinationId : String(v.accountId ?? '')
          const matchingGoals =
            !deposit && recordType !== 'expense'
              ? book.goals.filter((g) => !g.archived && g.accountId === arrivingAccount)
              : []
          const next = recordSchema.parse({
            id: record?.id ?? uid(),
            type: recordType,
            date: v.date,
            amount: Number(v.amount),
            accountId: external ? goal?.accountId : deposit ? v.source : v.accountId,
            ...(recordType === 'transfer' ? { toAccountId: destinationId } : {}),
            ...(recordType !== 'transfer'
              ? {
                  categoryId: external
                    ? (v.categoryId ?? book.categories.find((c) => c.type === 'income')?.id)
                    : v.categoryId,
                }
              : {}),
            ...(deposit
              ? { goalId: selectedGoal }
              : matchingGoals.length === 1
                ? { goalId: matchingGoals[0].id }
                : {}),
            note: String(v.note ?? ''),
          })
          onSave(next)
          close()
        } catch (e) {
          setError(errorText(e))
        }
      }}
    >
      {!deposit && (
        <div className="segmented">
          {(['income', 'expense', 'transfer'] as const).map((t) => (
            <button
              type="button"
              key={t}
              className={type === t ? 'active' : ''}
              onClick={() => {
                setType(t)
                setError('')
              }}
            >
              {{ income: '收入', expense: '支出', transfer: '帳戶轉帳' }[t]}
            </button>
          ))}
        </div>
      )}
      {deposit && (
        <>
          <Field label="所屬儲蓄目標">
            <select value={selectedGoal} onChange={(e) => setGoal(e.target.value)} required>
              {book.goals
                .filter((g) => !g.archived || g.id === record?.goalId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="存入帳戶">
            <input
              value={book.accounts.find((a) => a.id === goal?.accountId)?.name ?? ''}
              readOnly
            />
          </Field>
        </>
      )}
      <div className="form-grid">
        <Field label="日期">
          <input
            name="date"
            type="date"
            defaultValue={record?.date ?? today()}
            max={today()}
            required
          />
        </Field>
        <Field label="金額（NT$）">
          <MoneyInput name="amount" defaultValue={record?.amount ?? 0} min={1} />
        </Field>
      </div>
      {deposit ? (
        <Field label="資金來源" hint="帳戶間轉帳不會增加總資產或收入；只有外部新收入會列入收入。">
          <select
            name="source"
            defaultValue={
              record?.type === 'income' || !assets.some((a) => a.id !== goal?.accountId)
                ? 'external'
                : sourceDefault
            }
            onChange={(e) => setType(e.target.value === 'external' ? 'income' : 'transfer')}
            required
          >
            {assets
              .filter((a) => a.id !== goal?.accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  從 {a.name} 轉入（餘額 {money(b.get(a.id) ?? 0)}）
                </option>
              ))}
            <option value="external">外部新收入（會計入收入）</option>
          </select>
        </Field>
      ) : (
        <Field label={type === 'transfer' ? '轉出帳戶' : '交易帳戶'}>
          <select
            name="accountId"
            key={type}
            defaultValue={
              record?.accountId ??
              book.accounts.find((a) => type !== 'income' || a.kind === 'asset')?.id
            }
            required
          >
            {book.accounts
              .filter((a) => type !== 'income' || a.kind === 'asset')
              .map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}（{money(b.get(a.id) ?? 0)}）
                </option>
              ))}
          </select>
        </Field>
      )}
      {!deposit && type === 'transfer' && (
        <Field label="存入帳戶">
          <select value={destination} onChange={(e) => setDestination(e.target.value)} required>
            {book.accounts.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {((deposit && type === 'income') || (!deposit && type !== 'transfer')) && (
        <Field label="收支類別">
          <select
            name="categoryId"
            defaultValue={
              record?.categoryId ??
              book.categories.find((c) => c.type === (deposit ? 'income' : type))?.id
            }
            required
          >
            {book.categories
              .filter((c) => c.type === (deposit ? 'income' : type))
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="備註">
        <input
          name="note"
          maxLength={160}
          defaultValue={record?.note}
          placeholder="例如：每月固定儲蓄"
        />
      </Field>
      {deposit && (
        <p className="info">
          此紀錄會同步出現在收支紀錄，只計算一次。先確認資金來源帳戶餘額足夠；原有餘額可在帳戶總覽對帳。
        </p>
      )}
      {!deposit && (
        <p className="info">
          刷卡請選支出及信用卡帳戶；繳卡費請用轉帳。存入帳戶若只有一個對應目標，會自動關聯存錢明細；同帳戶有多個目標時，請使用「新增存款」明確選擇。
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Actions close={close} label={record ? '儲存修改' : deposit ? '新增存款' : '新增紀錄'} />
    </form>
  )
}
export function AccountForm({
  book,
  account,
  onSave,
  close,
}: {
  book: Book
  account?: BookAccount
  onSave: (a: { id: string; name: string; kind: 'asset' | 'liability'; balance: number }) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          onSave({
            id: account?.id ?? uid(),
            name: String(v.name).trim(),
            kind: v.kind as 'asset' | 'liability',
            balance: Number(v.balance),
          })
          close()
        } catch (e) {
          setError(errorText(e))
        }
      }}
    >
      <Field label="帳戶名稱">
        <input name="name" maxLength={80} required defaultValue={account?.name} />
      </Field>
      <div className="form-grid">
        <Field label="帳戶類型">
          <select name="kind" defaultValue={account?.kind ?? 'asset'}>
            <option value="asset">資產</option>
            <option value="liability">負債／信用卡</option>
          </select>
        </Field>
        <Field label="目前餘額（NT$）">
          <MoneyInput name="balance" defaultValue={account ? balances(book).get(account.id) : 0} />
        </Field>
      </div>
      <p className="info">
        直接調整餘額用於期初設定或對帳，不會產生收入；負債請填未償還金額。已有關聯紀錄時不能更換帳戶類型。
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Actions close={close} label="儲存帳戶" />
    </form>
  )
}
export function SavingForm({
  book,
  goal,
  onSave,
  close,
}: {
  book: Book
  goal?: SavingGoal
  onSave: (g: SavingGoal) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          onSave(
            savingGoalSchema.parse({
              id: goal?.id ?? uid(),
              name: v.name,
              target: Number(v.target),
              deadline: v.deadline,
              accountId: v.accountId,
              ...(goal?.completedAt
                ? { completedAt: goal.completedAt, completedAmount: goal.completedAmount }
                : {}),
              ...(goal?.archived !== undefined ? { archived: goal.archived } : {}),
            }),
          )
          close()
        } catch (e) {
          setError(errorText(e))
        }
      }}
    >
      <Field label="目標名稱">
        <input name="name" maxLength={80} defaultValue={goal?.name} required />
      </Field>
      <div className="form-grid">
        <Field label="目標金額（NT$）">
          <MoneyInput name="target" min={1} defaultValue={goal?.target ?? 40000} />
        </Field>
        <Field label="目標日期">
          <input
            name="deadline"
            type="date"
            defaultValue={goal?.deadline ?? '2026-12-31'}
            required
          />
        </Field>
      </div>
      <Field label="指定帳戶">
        <select
          name="accountId"
          defaultValue={goal?.accountId ?? book.accounts.find((a) => a.kind === 'asset')?.id}
          required
        >
          {book.accounts
            .filter((a) => a.kind === 'asset')
            .map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </Field>
      <p className="info">
        儲蓄進度讀取指定帳戶的實際餘額。同帳戶的多個目標共用餘額，不會重複加到總資產。
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Actions close={close} label="儲存目標" />
    </form>
  )
}
export function LifeForm({
  book,
  life = book.life,
  goalName,
  onSave,
  close,
}: {
  book: Book
  life?: Book['life']
  goalName?: string
  onSave: (life: Book['life'], name?: string) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          if (goalName !== undefined && !String(v.name).trim())
            throw new Error('請填寫人生目標名稱')
          onSave(
            lifeSchema.parse({
              targetAge: Number(v.targetAge),
              targetIncome: Number(v.targetIncome),
              deadline: v.deadline || null,
            }),
            goalName !== undefined ? String(v.name).trim() : undefined,
          )
          close()
        } catch (e) {
          setError(errorText(e))
        }
      }}
    >
      {goalName !== undefined && (
        <Field label="人生目標名稱">
          <input name="name" maxLength={80} defaultValue={goalName} required />
        </Field>
      )}
      <div className="form-grid">
        <Field label="目標年齡">
          <input
            name="targetAge"
            type="number"
            min="1"
            max="100"
            step="1"
            defaultValue={life.targetAge}
            required
          />
        </Field>
        <Field label="目標年收入（NT$）">
          <MoneyInput name="targetIncome" defaultValue={life.targetIncome} min={1} />
        </Field>
      </div>
      <Field label="截止日期（選填）">
        <input name="deadline" type="date" defaultValue={life.deadline ?? ''} />
      </Field>
      <p className="info">
        目前年收入由所選年度的實際收入紀錄自動加總。要更新目前年收入，請新增或修改該年度收入紀錄；轉帳與存款總額不會混入。
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Actions close={close} label="儲存人生目標" />
    </form>
  )
}
