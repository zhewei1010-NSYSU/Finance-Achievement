import {
  Area,
  AreaChart,
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
import type { FinanceData, Plan } from '../lib/finance'
const compact = (n: number) => (Math.abs(n) >= 10000 ? `${(n / 10000).toFixed(0)}萬` : `${n}`)
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
}
export function TrendChart({ data, metric }: { data: FinanceData; metric: 'assets' | 'net' }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`資產趨勢，共 ${data.snapshots.length} 天的實際餘額快照`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data.snapshots} margin={{ top: 18, right: 14, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b9d83" stopOpacity={0.19} />
              <stop offset="100%" stopColor="#3b9d83" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            tickFormatter={(s) => s.slice(5).replace('-', '/')}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickMargin={12}
          />
          <YAxis
            width={56}
            tickFormatter={compact}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [money(Number(v)), metric === 'assets' ? '總資產' : '淨資產']}
          />
          <Area
            name={metric === 'assets' ? '總資產' : '淨資產'}
            type="monotone"
            dataKey={metric}
            stroke="#31977b"
            strokeWidth={3}
            fill="url(#balanceFill)"
            dot={{ r: 4, fill: '#31977b', strokeWidth: 3, stroke: 'var(--surface)' }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
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
            stroke="#a3afbd"
            dot={false}
            strokeDasharray="5 5"
          />
          <Line
            name="自訂假設情境"
            type="monotone"
            dataKey="value"
            stroke="#31977b"
            strokeWidth={3}
            dot={false}
          />
          <Line
            name="較高報酬假設"
            type="monotone"
            dataKey="optimistic"
            stroke="#c09b54"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
