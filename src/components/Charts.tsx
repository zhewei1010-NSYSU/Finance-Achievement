import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { money, projection } from '../lib/finance'
import type { Plan } from '../lib/finance'
const compact = (n: number) => (Math.abs(n) >= 10000 ? `${(n / 10000).toFixed(0)}萬` : `${n}`)
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
}
export function ProjectionChart({ plan, initial }: { plan: Plan; initial: number }) {
  const base = projection(plan, initial)
  const down = projection(plan, initial, -2)
  const up = projection(plan, initial, Math.min(20, plan.returnRate + 3))
  const data = base.map((p, i) => ({ ...p, conservative: down[i].value, optimistic: up[i].value }))
  return (
    <div className="chart tall" role="img" aria-label="資產模擬情境折線圖，所有報酬均為假設">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 20, right: 20, left: 5, bottom: 10 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis
            dataKey="age"
            tickFormatter={(v) => `${v}歲`}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={60}
            tickFormatter={compact}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => `${v} 歲`}
            formatter={(v, n) => [money(Number(v)), n]}
          />
          <ReferenceLine y={plan.targetAssets} stroke="#b28a42" strokeDasharray="5 5" />
          <Line
            name="-2% 壓力情境"
            type="monotone"
            dataKey="conservative"
            stroke="#b9c2af"
            dot={false}
            strokeDasharray="5 5"
          />
          <Line
            name="自訂假設情境"
            type="monotone"
            dataKey="value"
            stroke="#89a368"
            strokeWidth={3}
            dot={false}
          />
          <Line
            name="較高報酬假設"
            type="monotone"
            dataKey="optimistic"
            stroke="#c9ad70"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
