import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Calculator, Info, Save } from 'lucide-react'
import { planSchema, money, totals, projection } from '../lib/finance'
import type { FinanceData } from '../lib/finance'
import { Field, MoneyInput, SectionHeading } from './UI'
import { ProjectionChart } from './Charts'
export default function Planning({
  data,
  save,
}: {
  data: FinanceData
  save: (data: FinanceData) => void
}) {
  const [draft, setDraft] = useState(data.plan)
  const [notice, setNotice] = useState('')
  const p = draft
  const available = p.salary - p.living - p.family - p.savings - p.investment
  const final = projection(p, totals(data.accounts).net).at(-1)!.value
  const change = (e: FormEvent<HTMLFormElement>) => {
    const v = Object.fromEntries(new FormData(e.currentTarget))
    const parsed = planSchema.safeParse(
      Object.fromEntries(Object.entries(v).map(([k, v]) => [k, Number(v)])),
    )
    if (parsed.success) {
      setDraft(parsed.data)
      setNotice('尚有未儲存的調整')
    } else setNotice(parsed.error.issues.map((i) => i.message).join('；'))
  }
  return (
    <>
      <SectionHeading eyebrow="BUILD YOUR FUTURE" title="讓未來，從每個月開始" />
      <div className="planning-grid">
        <section className="card">
          <SectionHeading title="每月收支規劃" action={<Calculator size={21} />} />
          <p className="muted small">這是預算與假設，不會改動帳戶餘額或記帳紀錄。</p>
          <form
            onChange={change}
            onSubmit={(e) => {
              e.preventDefault()
              const v = Object.fromEntries(new FormData(e.currentTarget))
              const parsed = planSchema.safeParse(
                Object.fromEntries(Object.entries(v).map(([k, v]) => [k, Number(v)])),
              )
              if (!parsed.success) {
                setNotice(parsed.error.issues.map((i) => i.message).join('；'))
                return
              }
              save({ ...data, plan: parsed.data })
              setNotice('規劃已儲存至本機')
            }}
          >
            <div className="form-grid">
              {(
                [
                  ['salary', '實領月薪'],
                  ['living', '每月生活費'],
                  ['family', '每月孝親費'],
                  ['savings', '每月儲蓄金額'],
                  ['investment', '每月投資金額'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={`${label}（NT$）`}>
                  <MoneyInput name={key} defaultValue={data.plan[key]} />
                </Field>
              ))}
            </div>
            <div className="divider" />
            <h3>資產目標模擬器</h3>
            <div className="form-grid">
              <Field label="目前年齡（預設為示意值）">
                <input
                  name="currentAge"
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  defaultValue={data.plan.currentAge}
                  required
                />
              </Field>
              <Field label="目標年齡">
                <input
                  name="targetAge"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  defaultValue={data.plan.targetAge}
                  required
                />
              </Field>
              <Field label="目標資產（NT$）">
                <MoneyInput name="targetAssets" min={1} defaultValue={data.plan.targetAssets} />
              </Field>
              <Field
                label={`假設年報酬率：${p.returnRate}%`}
                hint="只套用於新投入的投資金額，不保證報酬。"
              >
                <input
                  name="returnRate"
                  type="range"
                  min="-20"
                  max="20"
                  step=".5"
                  defaultValue={data.plan.returnRate}
                />
              </Field>
            </div>
            <p className="small muted" role="status">
              {notice || '調整欄位即可預覽，按儲存後才會保留。'}
            </p>
            <button className="button primary" type="submit">
              <Save size={17} />
              儲存理財規劃
            </button>
          </form>
        </section>
        <div className="stack">
          <div className="plan-summary">
            <span className="eyebrow">MONTHLY BALANCE</span>
            <p>每月可支配餘額</p>
            <strong className={available < 0 ? 'negative' : ''}>{money(available)}</strong>
            <span className="small">
              {available < 0
                ? '預算已超過收入，請調整分配。'
                : '扣除生活費、孝親費、儲蓄與投資後。'}
            </span>
            <div className="summary-pair">
              <div>
                <small>規劃儲蓄率</small>
                <b>{p.salary > 0 ? `${((p.savings / p.salary) * 100).toFixed(1)}%` : '—'}</b>
              </div>
              <div>
                <small>每月投入資產</small>
                <b>{money(p.savings + p.investment)}</b>
              </div>
            </div>
          </div>
          <section className="card">
            <SectionHeading title={`${p.targetAge} 歲的可能風景`} />
            <p className="projection-amount">
              {money(final)} <ArrowRight size={19} />
              <span>
                {final >= p.targetAssets ? '假設下達標' : `距目標 ${money(p.targetAssets - final)}`}
              </span>
            </p>
            <ProjectionChart plan={p} initial={totals(data.accounts).net} />
            <div className="chart-legend">
              <span>
                <i className="dot gray" />
                -2% 壓力情境
              </span>
              <span>
                <i className="dot" />
                自訂 {p.returnRate}%
              </span>
              <span>
                <i className="dot gold" />
                {Math.min(20, p.returnRate + 3)}% 假設
              </span>
            </div>
            <p className="info">
              <Info size={17} />
              所有投資報酬均為假設，不保證報酬。模型以目前淨資產為基礎，每月底投入儲蓄與投資，投資按月複利；不含稅費、通膨、既有資產報酬與負債利息。虛線為指定資產目標。
            </p>
          </section>
          <div className="card emergency">
            <span>六個月緊急預備金</span>
            <strong>{money((p.living + p.family) * 6)}</strong>
            <small>以生活費＋孝親費估算，不含投資與儲蓄。</small>
          </div>
        </div>
      </div>
    </>
  )
}
