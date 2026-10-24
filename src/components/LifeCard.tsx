import { useEffect, useState } from 'react'
import { Flag, MoreHorizontal, Mountain, Plus, Trash2 } from 'lucide-react'
import { money } from '../lib/finance'
import type { Book } from '../lib/ledger'
export default function LifeCard({
  life,
  name = '30歲目標',
  annual,
  year,
  onYear,
  onEdit,
  onIncome,
  onDelete,
  id,
}: {
  life: Book['life']
  name?: string
  annual: number
  year: number
  onYear: (year: number) => void
  onEdit: () => void
  onIncome: () => void
  onDelete?: () => void
  id?: string
}) {
  const [draft, setDraft] = useState(String(year))
  useEffect(() => setDraft(String(year)), [year])
  const percent = Math.min(100, (annual / life.targetIncome) * 100)
  return (
    <section className="card life-card">
      <div className="section-heading">
        <span className="life-symbol">
          <Mountain size={25} />
          <Flag size={13} />
        </span>
        <button className="icon-button" aria-label={`編輯${name}`} onClick={onEdit}>
          <MoreHorizontal size={20} />
        </button>
      </div>
      <span className="eyebrow">給未來的自己</span>
      <h2>{name}</h2>
      <p className="life-description">
        {life.targetAge}歲前達成年收入
        <br />
        <b>{money(life.targetIncome)}</b>
      </p>
      <label className="year-select">
        收入年度
        <input
          aria-label={id ? `收入年度-${name}` : '收入年度'}
          type="number"
          min="1900"
          max="9999"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Number(e.target.value)
            if (Number.isInteger(n) && n >= 1900 && n <= 9999) onYear(n)
          }}
          onBlur={() => setDraft(String(year))}
        />
      </label>
      <div className="life-income">
        <span>目前實際年收入</span>
        <strong>{money(annual)}</strong>
      </div>
      <div className="life-progress">
        <span>已達成 {Math.floor(percent)}%</span>
        <span>目標 {money(life.targetIncome)}</span>
      </div>
      <div className="progress-track">
        <i style={{ width: `${percent}%` }} />
      </div>
      <p className="life-remaining">
        距離目標還差 <b>{money(Math.max(0, life.targetIncome - annual))}</b>
      </p>
      {life.deadline && (
        <p className="small muted">截止日期：{life.deadline.replaceAll('-', '/')}</p>
      )}
      <button className="button secondary" onClick={onIncome}>
        <Plus size={15} />
        紀錄一筆收入
      </button>
      <small className="life-note">依所選年度的收入紀錄加總，轉帳不計入年收入。</small>
      {onDelete && (
        <button className="text-button danger life-delete" onClick={onDelete}>
          <Trash2 size={13} />
          刪除人生目標
        </button>
      )}
    </section>
  )
}
