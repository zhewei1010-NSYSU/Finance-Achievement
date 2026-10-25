import { useState } from 'react'
import { z } from 'zod'
import { today, uid, money } from '../lib/finance'
import {
  accountClass,
  assetClasses,
  balances,
  destinationAccount,
  sourceAccount,
  lifeSchema,
  recordSchema,
  savingGoalSchema,
} from '../lib/ledger'
import type { AssetClass, Book, BookAccount, RecordItem, SavingGoal } from '../lib/ledger'
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
  initialType = 'income',
}: {
  book: Book
  record?: RecordItem
  deposit?: boolean
  goalId?: string
  onSave: (r: RecordItem, accounts?: BookAccount[]) => void
  close: () => void
  initialType?: RecordItem['type']
}) {
  const initialGoal =
    record?.goalId ??
    goalId ??
    (!record ? book.goals.find((g) => !g.archived)?.id : undefined) ??
    ''
  const originalDestination = record
    ? record.type === 'transfer'
      ? record.toAccountId
      : record.accountId
    : deposit
      ? book.goals.find((g) => g.id === initialGoal)?.accountId
      : undefined
  const originalAccount = book.accounts.find((a) => a.id === originalDestination)
  const [category, setCategory] = useState<AssetClass>(
    originalAccount ? accountClass(originalAccount) : 'savings',
  )
  const [selectedGoal, setGoal] = useState(deposit ? initialGoal : '')
  const [source, setSource] = useState<AssetClass | 'external'>(() => {
    if (record?.type === 'income' || (!deposit && initialType === 'income')) return 'external'
    const originalSource = book.accounts.find((a) => a.id === record?.accountId)
    if (originalSource) return accountClass(originalSource)
    const candidates = book.accounts.filter(
      (a) => a.kind === 'asset' && a.id !== originalDestination,
    )
    return candidates.length
      ? accountClass(
          candidates.sort(
            (a, b) => (balances(book).get(b.id) ?? 0) - (balances(book).get(a.id) ?? 0),
          )[0],
        )
      : deposit
        ? 'external'
        : 'savings'
  })
  const [drafts] = useState(() =>
    (Object.keys(assetClasses) as AssetClass[]).map((assetClass) => ({
      id: uid(),
      name: assetClasses[assetClass],
      kind: 'asset' as const,
      assetClass,
      opening: 0,
    })),
  )
  const [error, setError] = useState('')
  const goal = book.goals.find((g) => g.id === selectedGoal)
  const preferred = deposit ? (goal?.accountId ?? originalDestination) : originalDestination
  const destination =
    destinationAccount(book, category, preferred) ?? drafts.find((a) => a.assetClass === category)!
  const from =
    source === 'external'
      ? undefined
      : sourceAccount(
          book,
          source,
          destination.id,
          record?.type === 'transfer' ? record.accountId : undefined,
        )
  const recordType = deposit
    ? source === 'external'
      ? 'income'
      : 'transfer'
    : (record?.type ?? initialType)
  const b = balances(book)
  const options = Object.entries(assetClasses).map(([id, name]) => (
    <option key={id} value={id}>
      {name}
    </option>
  ))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          if (recordType === 'transfer' && !from)
            throw new Error(
              '此來源分類沒有可轉出的其他帳戶。請選擇另一個來源，或先到「我的資產」設定資產餘額。',
            )
          const matchingGoals = book.goals.filter(
            (g) => !g.archived && g.accountId === destination.id,
          )
          const linkedGoal = deposit
            ? goal
            : matchingGoals.length === 1
              ? matchingGoals[0]
              : undefined
          const next = recordSchema.parse({
            id: record?.id ?? uid(),
            type: recordType,
            date: v.date,
            amount: Number(v.amount),
            accountId: recordType === 'transfer' ? from?.id : destination.id,
            ...(recordType === 'transfer'
              ? { toAccountId: destination.id }
              : { categoryId: v.categoryId }),
            ...(linkedGoal ? { goalId: linkedGoal.id } : {}),
            ...(deposit || record?.isDeposit ? { isDeposit: true } : {}),
            note: String(v.note ?? ''),
          })
          onSave(next, book.accounts.some((a) => a.id === destination.id) ? [] : [destination])
          close()
        } catch (e) {
          setError(errorText(e))
        }
      }}
    >
      <Field
        label="存入帳戶"
        hint={`本筆實際存入：${destination.name}${book.accounts.some((a) => a.id === destination.id) ? '' : '（首次使用時建立零餘額帳戶）'}。不會移動或覆寫其他既有資產。`}
      >
        <select
          aria-label="存入帳戶"
          name="destinationClass"
          value={category}
          onChange={(e) => {
            const next = e.target.value as AssetClass
            setCategory(next)
            setError('')
            if (deposit) {
              const candidates = book.goals.filter(
                (g) =>
                  !g.archived &&
                  accountClass(book.accounts.find((a) => a.id === g.accountId)!) === next,
              )
              setGoal(candidates.length === 1 ? candidates[0].id : '')
            }
          }}
          required
        >
          {options}
        </select>
      </Field>
      {deposit && (
        <Field
          label="所屬儲蓄目標"
          hint="只有存入目標指定帳戶，才會連動該目標；未綁定的存款仍保留完整明細。"
        >
          <select
            value={selectedGoal}
            onChange={(e) => {
              setGoal(e.target.value)
              setError('')
            }}
          >
            <option value="">不綁定儲蓄目標</option>
            {book.goals
              .filter(
                (g) =>
                  (!g.archived || g.id === record?.goalId) &&
                  accountClass(book.accounts.find((a) => a.id === g.accountId)!) === category,
              )
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </Field>
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
      {(deposit || recordType === 'transfer') && (
        <Field
          label="資金來源"
          hint={
            source === 'external'
              ? '只有真正的新收入才選此項，已入帳的收入請用分類間轉帳。'
              : from
                ? `本筆由 ${from.name} 轉出，可用餘額 ${money(b.get(from.id) ?? 0)}；轉帳不增加收入或總資產。`
                : '此分類尚無可轉出的其他帳戶，請先設定資產或選擇其他來源。'
          }
        >
          <select
            aria-label="資金來源"
            name="sourceClass"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as AssetClass | 'external')
              setError('')
            }}
            required
          >
            {options}
            {deposit && <option value="external">外部新收入（會計入收入）</option>}
          </select>
        </Field>
      )}
      {recordType === 'income' && (
        <Field label="收入類別">
          <select
            name="categoryId"
            defaultValue={
              record?.categoryId ?? book.categories.find((c) => c.type === 'income')?.id
            }
            required
          >
            {book.categories
              .filter((c) => c.type === 'income')
              .map((c) => (
                <option key={c.id} value={c.id}>
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
      <p className="info">
        {recordType === 'transfer'
          ? '分類間資金移動只記錄一次，不計收入，也不增加總資產。'
          : '只記錄真正的新收入。已入帳的錢請使用轉帳，避免重複計算收入。'}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Actions
        close={close}
        label={
          record
            ? '儲存修改'
            : deposit
              ? '新增存款'
              : recordType === 'transfer'
                ? '確認轉帳'
                : '新增收入'
        }
      />
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
  onSave: (a: {
    id: string
    name: string
    kind: 'asset' | 'liability'
    balance: number
    assetClass?: AssetClass
  }) => void
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
            kind: account?.kind ?? 'asset',
            assetClass: v.assetClass as AssetClass,
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
        <Field label="資產分類">
          <select name="assetClass" defaultValue={account ? accountClass(account) : 'savings'}>
            {Object.entries(assetClasses).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="目前餘額（NT$）">
          <MoneyInput name="balance" defaultValue={account ? balances(book).get(account.id) : 0} />
        </Field>
      </div>
      <p className="info">
        直接調整餘額僅用於期初設定或對帳，不會產生收入。變更分類不會改變原有帳戶或紀錄。
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
