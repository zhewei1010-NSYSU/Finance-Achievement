import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  HeartPulse,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import {
  accountSchema,
  applyTransaction,
  categoryNames,
  dataSchema,
  goalStats,
  health,
  initialData,
  loadData,
  money,
  monthlyStats,
  parseBackup,
  reconcile,
  STORAGE_KEY,
  today,
  totals,
} from './lib/finance'
import type { Account, FinanceData, Goal, Transaction } from './lib/finance'
import { AccountForm, GoalForm, TransactionForm } from './components/Forms'
import { AccountIcon, ActionLink, Empty, Modal, Ring, SectionHeading } from './components/UI'
import { TrendChart } from './components/Charts'
import Planning from './components/Planning'

type Page = 'dashboard' | 'goals' | 'accounts' | 'transactions' | 'planning' | 'health' | 'backup'
type Editor =
  | { type: 'account'; account?: Account }
  | { type: 'goal'; goal?: Goal }
  | { type: 'transaction' }
  | { type: 'history' }
  | null
const pages = [
  { id: 'dashboard', label: '財務總覽', en: 'OVERVIEW', icon: LayoutDashboard },
  { id: 'goals', label: '儲蓄目標', en: 'SAVINGS GOALS', icon: Target },
  { id: 'accounts', label: '帳戶管理', en: 'ACCOUNTS', icon: Wallet },
  { id: 'transactions', label: '收支紀錄', en: 'TRANSACTIONS', icon: ArrowLeftRight },
  { id: 'planning', label: '理財規劃', en: 'FINANCIAL PLAN', icon: Settings2 },
  { id: 'health', label: '財務健檢', en: 'FINANCIAL HEALTH', icon: HeartPulse },
  { id: 'backup', label: '資料與備份', en: 'DATA & BACKUP', icon: ShieldCheck },
] as const
function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const [loaded] = useState(loadData)
  const [data, setData] = useState(loaded.data)
  const [locked, setLocked] = useState(!!loaded.error)
  const [storageError, setStorageError] = useState(loaded.error ?? '')
  const [page, setPage] = useState<Page>('dashboard')
  const [mobile, setMobile] = useState(false)
  const [editor, setEditor] = useState<Editor>(null)
  const [celebrations, setCelebrations] = useState<Goal[]>([])
  const [confirm, setConfirm] = useState<{
    title: string
    body: ReactNode
    run: () => void
  } | null>(null)
  const [pendingImport, setPendingImport] = useState<FinanceData | null>(null)
  const [notice, setNotice] = useState('')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [metric, setMetric] = useState<'assets' | 'net'>('net')
  const fileRef = useRef<HTMLInputElement>(null)
  const closeEditor = useCallback(() => setEditor(null), [])
  const closeConfirm = useCallback(() => setConfirm(null), [])
  const closeImport = useCallback(() => setPendingImport(null), [])
  const closeCelebration = useCallback(() => setCelebrations((c) => c.slice(1)), [])
  useEffect(() => {
    document.documentElement.dataset.theme = data.theme
  }, [data.theme])
  useEffect(() => {
    if (loaded.error) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded.data))
    } catch {
      setStorageError('瀏覽器無法儲存資料，請匯出備份並檢查儲存權限。')
    }
  }, [loaded])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])
  const commit = (next: FinanceData, celebrate = true, unlock = false) => {
    const valid = dataSchema.parse(next)
    const result = reconcile(valid)
    if (!locked || unlock) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data))
        setStorageError('')
        if (unlock) setLocked(false)
      } catch {
        setStorageError(
          '瀏覽器無法儲存（空間不足或儲存權限受限）。目前變更只在記憶體中，請立即匯出備份。',
        )
      }
    }
    setData(result.data)
    if (celebrate && result.completed.length) setCelebrations((c) => [...c, ...result.completed])
    return result.data
  }
  const navigate = (p: Page) => {
    setPage(p)
    setMobile(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const t = totals(data.accounts),
    stats = monthlyStats(data, month),
    activePage = pages.find((p) => p.id === page)!,
    primaryGoal = data.goals.find((g) => !g.completedAt) ?? data.goals[0]
  const exportData = () => {
    download(JSON.stringify(data, null, 2), `finance-backup-${today()}.json`)
    setNotice('備份已下載，請妥善保管個人財務資料。')
  }
  const safeAction = (action: () => void) => {
    try {
      action()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '操作失敗，請檢查資料')
    }
  }
  const removeAccount = (account: Account) => {
    if (
      data.goals.some((g) => g.accountId === account.id) ||
      data.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id)
    ) {
      setNotice('此帳戶仍連結目標或交易；請先調整目標及移除相關交易，再刪除帳戶。')
      return
    }
    setConfirm({
      title: `刪除「${account.name}」？`,
      body: '此操作會移除此帳戶及其餘額，並影響淨資產。建議先匯出備份。',
      run: () => {
        commit({ ...data, accounts: data.accounts.filter((a) => a.id !== account.id) })
        setNotice('帳戶已刪除')
      },
    })
  }
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      if (file.size > 5_000_000) throw new Error('檔案超過 5 MB，請選擇較小的備份。')
      setPendingImport(parseBackup(await file.text()))
    } catch {
      setNotice(
        '匯入失敗：需使用有效的 v1 JSON 備份，含完整欄位、有效日期及帳戶連結，且不超過 5 MB。原資料未變更。',
      )
    }
  }
  const goalCard = (goal: Goal, hero = false) => {
    const s = goalStats(goal, data),
      account = data.accounts.find((a) => a.id === goal.accountId)
    return (
      <article className={`goal-card ${hero ? 'hero-goal' : 'card'}`} key={goal.id}>
        <div className="goal-card-top">
          <span className="pill">
            <Target size={14} />
            {s.percent >= 100 ? '目標已達成' : '正在實現的願望'}
          </span>
          <button
            className="icon-button"
            aria-label={`編輯${goal.name}`}
            onClick={() => setEditor({ type: 'goal', goal })}
          >
            <MoreHorizontal size={22} />
          </button>
        </div>
        <div className="goal-core">
          <div className="goal-copy">
            <p className="goal-account">
              {account?.name} <span>・</span> {goal.deadline.replaceAll('-', '/')} 前
            </p>
            <h3>{goal.name}</h3>
            <p className="goal-amount">
              {money(s.current)}
              <span> / {money(goal.target)}</span>
            </p>
            <p className="goal-remaining">
              {s.remaining === 0 ? (
                '每一筆積累，都值得為自己喝采。'
              ) : (
                <>
                  再存 <b>{money(s.remaining)}</b>，就離夢想更近一步。
                </>
              )}
            </p>
          </div>
          <Ring value={s.percent} large={hero} />
        </div>
        <div className="goal-divider" />
        <div className="goal-bottom">
          <div>
            <span>每月需要儲蓄</span>
            <strong>
              {s.monthly === null ? '已逾期，請調整' : money(s.monthly)}
              {s.monthly !== null && s.remaining > 0 && <small> / 月</small>}
            </strong>
          </div>
          <div>
            <span>預計達標日期</span>
            <strong>
              {s.estimate
                ? s.estimate.replaceAll('-', '/')
                : s.estimateTooLong
                  ? '超過 100 年'
                  : '設定月存後估算'}
            </strong>
          </div>
          <button
            className={`button ${hero ? 'light' : 'secondary'}`}
            onClick={() => account && setEditor({ type: 'account', account })}
          >
            更新餘額
            <ArrowUpRight size={16} />
          </button>
        </div>
        {!hero && (
          <div className="goal-tools">
            {goal.completedAt && (
              <button className="text-button" onClick={() => setCelebrations([goal])}>
                <Trophy size={15} />
                查看完成紀錄
              </button>
            )}
            <button
              className="text-button danger"
              onClick={() =>
                setConfirm({
                  title: '刪除這個儲蓄目標？',
                  body: '帳戶餘額不會變動，這個目標的完成紀錄會一併刪除。',
                  run: () => commit({ ...data, goals: data.goals.filter((g) => g.id !== goal.id) }),
                })
              }
            >
              <Trash2 size={14} />
              刪除目標
            </button>
          </div>
        )}
      </article>
    )
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            navigate('dashboard')
          }}
        >
          <span className="brand-mark">
            M<span>↗</span>
          </span>
          <span>
            My Finance<small>把日子，存成喜歡的樣子。</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="關閉選單"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <p className="nav-caption">我的財務空間</p>
        <nav aria-label="主選單">
          {pages.map((p) => (
            <button
              key={p.id}
              aria-label={p.label}
              className={`nav-item ${page === p.id ? 'selected' : ''}`}
              aria-current={page === p.id ? 'page' : undefined}
              onClick={() => navigate(p.id)}
            >
              <p.icon size={19} />
              <span>{p.label}</span>
              {p.id === 'goals' && <small>{data.goals.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">
              <LockKeyhole size={18} />
            </span>
            <strong>只屬於你的財務空間</strong>
            <p>
              資料保存在此瀏覽器
              <br />
              安心規劃，定期備份。
            </p>
            <button className="text-button" onClick={() => navigate('backup')}>
              管理備份
              <ArrowRight size={14} />
            </button>
          </div>
          <button
            className="theme-button"
            onClick={() =>
              safeAction(() =>
                commit({ ...data, theme: data.theme === 'light' ? 'dark' : 'light' }, false),
              )
            }
          >
            {data.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{data.theme === 'light' ? '切換深色模式' : '切換淺色模式'}</span>
            <span className="theme-switch">
              <i />
            </span>
          </button>
          <div className="profile">
            <span className="avatar">我</span>
            <div>
              <b>我的理財生活</b>
              <small>PERSONAL WORKSPACE</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      {mobile && <div className="nav-scrim" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="開啟選單"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>我的財務空間</span>
            <ChevronRight size={14} />
            <b>{activePage.label}</b>
          </div>
          <div className="top-actions">
            <span className={`local-status ${storageError || locked ? 'error' : ''}`}>
              <i />
              {storageError || locked ? '儲存需處理' : '本機資料模式'}
            </span>
            <button
              className="icon-button"
              aria-label="備份與資料說明"
              onClick={() => navigate('backup')}
            >
              <CircleHelp size={20} />
            </button>
            <span className="avatar small-avatar">我</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">MY FINANCE / {activePage.en}</p>
              <h1>
                {page === 'dashboard' ? '好好生活，慢慢變富。' : activePage.label}
                <span className="heading-dot">.</span>
              </h1>
              <p className="page-subtitle">
                {page === 'dashboard'
                  ? '每一份小小的累積，都是為未來的自己留一份底氣。'
                  : {
                      goals: '為心中的期待，安排一個實現的日期。',
                      accounts: '掌握每個帳戶，讓每一筆資產都有位置。',
                      transactions: '記下日常的流動，看清收支的方向。',
                      planning: '把想過的生活，變成可以實踐的計畫。',
                      health: '定期照顧你的財務，讓生活多一份安心。',
                      backup: '資料由你保管，安全感從一份備份開始。',
                    }[page]}
              </p>
            </div>
            <div className="heading-actions">
              {page === 'dashboard' ? (
                <>
                  <span className="date-label">{today().replaceAll('-', ' / ')}</span>
                  <button
                    className="button primary"
                    onClick={() => setEditor({ type: 'transaction' })}
                  >
                    <Plus size={17} />
                    記一筆
                  </button>
                </>
              ) : page === 'goals' ? (
                <>
                  <button
                    className="button secondary"
                    onClick={() => setEditor({ type: 'history' })}
                  >
                    <Trophy size={16} />
                    完成紀錄
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setEditor({ type: 'goal' })}
                    disabled={!data.accounts.some((a) => a.kind === 'asset')}
                  >
                    <Plus size={17} />
                    新增目標
                  </button>
                </>
              ) : page === 'accounts' ? (
                <button className="button primary" onClick={() => setEditor({ type: 'account' })}>
                  <Plus size={17} />
                  新增帳戶
                </button>
              ) : page === 'transactions' ? (
                <button
                  className="button primary"
                  onClick={() => setEditor({ type: 'transaction' })}
                >
                  <Plus size={17} />
                  新增紀錄
                </button>
              ) : null}
            </div>
          </div>
          {storageError && (
            <div className="warning-banner" role="alert">
              <ShieldCheck size={20} />
              <span>{storageError}</span>
              <button className="text-button" onClick={() => navigate('backup')}>
                前往備份
              </button>
            </div>
          )}
          {page === 'dashboard' && (
            <>
              <div className="overview-grid">
                <Metric
                  label="總資產"
                  value={money(t.assets)}
                  icon={<Wallet size={19} />}
                  foot="所有資產帳戶的目前餘額"
                />
                <Metric
                  label="總負債"
                  value={money(t.liabilities)}
                  icon={<CreditCard size={19} />}
                  foot="信用卡與其他待償還金額"
                />
                <Metric
                  label="淨資產"
                  value={money(t.net)}
                  icon={<TrendingIcon />}
                  foot="屬於你的財務底氣"
                  highlighted
                />
              </div>
              <div className="dashboard-middle">
                <section>
                  <SectionHeading
                    eyebrow="ONE STEP CLOSER"
                    title="離夢想，再近一點"
                    action={<ActionLink onClick={() => navigate('goals')}>所有目標</ActionLink>}
                  />
                  {primaryGoal ? (
                    goalCard(primaryGoal, true)
                  ) : (
                    <div className="card">
                      <Empty>還沒有儲蓄目標，為下一個夢想開始吧。</Empty>
                      <button
                        className="button primary"
                        onClick={() => setEditor({ type: 'goal' })}
                        disabled={!data.accounts.some((a) => a.kind === 'asset')}
                      >
                        新增目標
                      </button>
                    </div>
                  )}
                  <p className="caption">
                    <Sparkles size={13} />
                    月存額按含本月的剩餘月份估算；預計日期依理財規劃的月存金額假設。
                  </p>
                </section>
                <section className="card monthly-card">
                  <SectionHeading
                    title="本月收支"
                    action={
                      <input
                        className="month-input"
                        aria-label="收支月份"
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value || today().slice(0, 7))}
                      />
                    }
                  />
                  <div className="monthly-line">
                    <span className="mini-icon income">
                      <ArrowDownLeft size={18} />
                    </span>
                    <span>每月收入</span>
                    <strong>{money(stats.income)}</strong>
                  </div>
                  <div className="monthly-line">
                    <span className="mini-icon expense">
                      <ArrowUpRight size={18} />
                    </span>
                    <span>每月支出</span>
                    <strong>{money(stats.expense)}</strong>
                  </div>
                  <div className="monthly-saving">
                    <span>
                      每月儲蓄率<small>（收入－支出）÷ 收入</small>
                    </span>
                    <strong>
                      {stats.savingsRate === null ? '—' : `${stats.savingsRate.toFixed(1)}%`}
                    </strong>
                  </div>
                  <div className="rate-track">
                    <i
                      style={{ width: `${Math.min(100, Math.max(0, stats.savingsRate ?? 0))}%` }}
                    />
                  </div>
                  <p className="small muted">
                    {stats.income === 0
                      ? '本月尚無收入紀錄，新增記帳後開始計算。'
                      : `本月收支結餘 ${money(stats.cashflow)}，繼續保持掌握。`}
                  </p>
                  <button className="text-button" onClick={() => navigate('transactions')}>
                    查看收支紀錄
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <div className="dashboard-bottom">
                <section className="card trend-card">
                  <SectionHeading
                    title="累積，看得見"
                    action={
                      <div className="segmented">
                        <button
                          className={metric === 'net' ? 'active' : ''}
                          onClick={() => setMetric('net')}
                        >
                          淨資產
                        </button>
                        <button
                          className={metric === 'assets' ? 'active' : ''}
                          onClick={() => setMetric('assets')}
                        >
                          總資產
                        </button>
                      </div>
                    }
                  />
                  <div className="trend-head">
                    <strong>{money(t[metric])}</strong>
                    <span>
                      <i className="dot" />
                      實際餘額快照
                    </span>
                  </div>
                  <TrendChart data={data} metric={metric} />
                  <p className="caption">
                    每天保留一筆操作時的餘額，從今天開始累積。
                    {data.snapshots.length < 2 ? '目前只有一筆快照，尚無跨日趨勢。' : ''}
                  </p>
                </section>
                <section className="card account-overview">
                  <SectionHeading
                    title="我的帳戶"
                    action={<ActionLink onClick={() => navigate('accounts')}>管理</ActionLink>}
                  />
                  {data.accounts.length ? (
                    data.accounts.slice(0, 5).map((a) => (
                      <button
                        className="account-row"
                        key={a.id}
                        onClick={() => setEditor({ type: 'account', account: a })}
                      >
                        <AccountIcon account={a} />
                        <span>
                          <b>{a.name}</b>
                          <small>
                            {categoryNames[a.category]}・{a.kind === 'asset' ? '資產' : '負債'}
                          </small>
                        </span>
                        <strong>
                          {a.kind === 'liability' && a.balance > 0 ? '−' : ''}
                          {money(a.balance)}
                        </strong>
                      </button>
                    ))
                  ) : (
                    <Empty>新增你的第一個帳戶。</Empty>
                  )}
                </section>
              </div>
              <div className="quote">
                <span>“</span>理財不是限制生活，而是讓未來的選擇更多。<span>”</span>
              </div>
            </>
          )}
          {page === 'goals' && (
            <>
              <div className="goal-intro">
                <span className="mini-icon gold-icon">
                  <Target size={24} />
                </span>
                <div>
                  <h3>每個目標，都有自己的步調</h3>
                  <p>帳戶餘額會自動同步進度。達成後的紀錄，會好好為你保存。</p>
                </div>
                <strong>
                  {data.goals.filter((g) => g.completedAt).length}
                  <small> / {data.goals.length} 個已達成</small>
                </strong>
              </div>
              <div className="goals-grid">{data.goals.map((g) => goalCard(g))}</div>
              {!data.goals.length && <Empty>還沒有儲蓄目標，點選「新增目標」開始。</Empty>}
              <p className="info">
                同一帳戶可連結多個目標，但資金不會自動分配；每個進度都使用該帳戶全部餘額。已完成紀錄保留歷史，不會因餘額下降而刪除。
              </p>
            </>
          )}
          {page === 'accounts' && (
            <>
              <div className="overview-grid">
                <Metric
                  label="總資產"
                  value={money(t.assets)}
                  icon={<Wallet size={19} />}
                  foot="資產餘額加總"
                />
                <Metric
                  label="總負債"
                  value={money(t.liabilities)}
                  icon={<CreditCard size={19} />}
                  foot="待償還負債加總"
                />
                <Metric
                  label="淨資產"
                  value={money(t.net)}
                  icon={<TrendingIcon />}
                  foot="總資產減總負債"
                  highlighted
                />
              </div>
              <div className="accounts-grid">
                {data.accounts.map((a) => (
                  <article className="card account-tile" key={a.id}>
                    <div className="account-tile-heading">
                      <AccountIcon account={a} />
                      <span className={`badge ${a.kind === 'liability' ? 'neutral' : ''}`}>
                        {a.kind === 'asset' ? '資產' : '負債'}
                      </span>
                    </div>
                    <h3>{a.name}</h3>
                    <p className="muted small">{categoryNames[a.category]}</p>
                    <strong>{money(a.balance)}</strong>
                    <div className="account-tile-actions">
                      <button
                        className="text-button"
                        onClick={() => setEditor({ type: 'account', account: a })}
                      >
                        編輯帳戶
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`刪除${a.name}`}
                        onClick={() => removeAccount(a)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="info">
                直接編輯餘額用於對帳，不會計入收入或支出。若是新交易，請使用「收支紀錄」。投資帳戶請手動更新市值；本版本不連接銀行或報價服務。
              </p>
            </>
          )}
          {page === 'transactions' && (
            <>
              <div className="filter-bar">
                <label>
                  查看月份{' '}
                  <input
                    aria-label="交易月份"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value || today().slice(0, 7))}
                  />
                </label>
                <span>
                  收入 <b className="positive">{money(stats.income)}</b>
                </span>
                <span>
                  支出 <b>{money(stats.expense)}</b>
                </span>
                <span>
                  結餘 <b>{money(stats.cashflow)}</b>
                </span>
              </div>
              <section className="card table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>日期／備註</th>
                        <th>類型</th>
                        <th>帳戶</th>
                        <th className="align-right">金額</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.transactions]
                        .filter((tx) => tx.date.startsWith(month))
                        .reverse()
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((tx) => (
                          <tr key={tx.id}>
                            <td>
                              <b>{tx.note || '未填備註'}</b>
                              <small>{tx.date}</small>
                            </td>
                            <td>
                              <span className={`badge ${tx.type === 'income' ? '' : 'neutral'}`}>
                                {{ income: '收入', expense: '支出', transfer: '轉帳' }[tx.type]}
                              </span>
                            </td>
                            <td>
                              {data.accounts.find((a) => a.id === tx.accountId)?.name}
                              {tx.toAccountId && (
                                <>
                                  <ArrowRight size={13} className="inline-icon" />
                                  {data.accounts.find((a) => a.id === tx.toAccountId)?.name}
                                </>
                              )}
                            </td>
                            <td
                              className={`align-right number ${tx.type === 'income' ? 'positive' : ''}`}
                            >
                              {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
                              {money(tx.amount)}
                            </td>
                            <td>
                              <button
                                className="icon-button danger"
                                aria-label={`刪除交易${tx.note || tx.date}`}
                                onClick={() =>
                                  setConfirm({
                                    title: '刪除這筆交易？',
                                    body: '系統會反向調整相關帳戶餘額。若反向調整造成負數或超額還款，將拒絕刪除，請先檢查較新的交易及帳戶餘額。',
                                    run: () => {
                                      commit(applyTransaction(data, tx, true))
                                      setNotice('交易已刪除，餘額已還原')
                                    },
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!data.transactions.some((tx) => tx.date.startsWith(month)) && (
                  <Empty>這個月還沒有收支紀錄，從第一筆日常開始。</Empty>
                )}
              </section>
              <p className="info">
                還信用卡費請使用轉帳。支出只在刷卡當下計算一次；跨帳戶移動與還款不列入收支。日期代表記帳歸屬月份，餘額於新增時立即調整；歷史趨勢不會回溯重建。
              </p>
            </>
          )}
          {page === 'planning' && (
            <Planning
              key={page}
              data={data}
              save={(next) => {
                commit(next)
                setNotice('理財規劃已儲存')
              }}
            />
          )}
          {page === 'health' && (
            <>
              <section className="health-hero">
                <div className="health-art">
                  <HeartPulse size={45} />
                </div>
                <div>
                  <p className="eyebrow">A LITTLE CHECK-IN</p>
                  <h2>財務健康，是持續照顧自己的過程。</h2>
                  <p>以下依已登記餘額與已儲存預算分析，作為生活規劃參考。</p>
                </div>
                <button className="button secondary" onClick={() => navigate('planning')}>
                  調整理財規劃
                  <ArrowUpRight size={16} />
                </button>
              </section>
              <div className="health-grid">
                {health(data).map((item, i) => (
                  <section className="card health-item" key={item.title}>
                    <div>
                      <span className="health-number">0{i + 1}</span>
                      <span
                        className={`badge ${item.status === '穩健' ? '' : item.status === '待設定' ? 'neutral' : 'caution'}`}
                      >
                        {item.status === '穩健' && <Check size={12} />} {item.status}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </section>
                ))}
              </div>
              <p className="info">
                分析採一般參考門檻，未涵蓋利率、家庭責任與完整風險承受度，不構成個別投資建議。儲蓄率與現金流使用「理財規劃」的預算，實際收支請看首頁與收支紀錄。
              </p>
            </>
          )}
          {page === 'backup' && (
            <>
              <div className="backup-banner">
                <ShieldCheck size={34} />
                <div>
                  <h2>你的資料，掌握在你手中。</h2>
                  <p>
                    本網站沒有後端，也不會主動上傳財務資料。使用同一瀏覽器與同一網址，才能讀取原有資料。
                  </p>
                </div>
              </div>
              <div className="backup-grid">
                <section className="card">
                  <span className="backup-icon">
                    <Download size={26} />
                  </span>
                  <h2>匯出 JSON 備份</h2>
                  <p>包含帳戶、目標、交易、規劃、快照與完成紀錄。建議每週及重要變更後備份一次。</p>
                  <button className="button primary" onClick={exportData}>
                    <ArrowDownToLine size={17} />
                    下載完整備份
                  </button>
                  {locked && (
                    <button
                      className="button secondary recovery-button"
                      onClick={() => {
                        const raw = localStorage.getItem(STORAGE_KEY)
                        if (raw) download(raw, `finance-backup-unreadable-${today()}.json`)
                      }}
                    >
                      下載無法讀取的原始資料
                    </button>
                  )}
                </section>
                <section className="card">
                  <span className="backup-icon">
                    <Upload size={26} />
                  </span>
                  <h2>匯入既有資料</h2>
                  <p>
                    支援此網站匯出的 v1 JSON（5 MB
                    以下）。先驗證並顯示摘要，確認後才會取代資料；匯入前會下載一份目前資料備份。
                  </p>
                  <button className="button secondary" onClick={() => fileRef.current?.click()}>
                    <Upload size={17} />
                    選擇備份檔案
                  </button>
                  <input
                    className="sr-only"
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={importFile}
                    aria-label="匯入 JSON 備份"
                  />
                </section>
              </div>
              <section className="card privacy-notes">
                <h2>關於資料安全</h2>
                <ul>
                  <li>
                    資料保存在瀏覽器
                    localStorage，並未加密，也沒有登入鎖定。請在自己的可信任裝置使用。
                  </li>
                  <li>
                    清除瀏覽器網站資料、無痕模式結束，或更換網址／連接埠，可能使資料消失或無法讀取。
                  </li>
                  <li>
                    JSON 備份包含個人財務資料，請放在私人且安全的位置；不要放入 Git
                    Repository、聊天或公開雲端。
                  </li>
                  <li>
                    預設郵局 NT$10,000 與目標 NT$40,000
                    為起始示例，其他帳戶為零；請依自己的實際狀況調整。
                  </li>
                  <li>同時使用多個分頁可能產生覆蓋，請一次只在一個分頁編輯；不支援跨裝置同步。</li>
                </ul>
                <div className="divider" />
                <button
                  className="text-button danger"
                  onClick={() =>
                    setConfirm({
                      title: '重設為起始示例？',
                      body: '這會取代此瀏覽器的全部帳戶、交易、規劃與完成紀錄。系統會先下載一份現有資料；請確認備份已妥善保存。',
                      run: () => {
                        const raw = localStorage.getItem(STORAGE_KEY)
                        download(
                          locked && raw ? raw : JSON.stringify(data, null, 2),
                          `finance-backup-before-reset-${today()}.json`,
                        )
                        commit(initialData(), false, true)
                        setNotice('已重設為起始示例')
                      },
                    })
                  }
                >
                  <Trash2 size={16} />
                  重設所有資料
                </button>
              </section>
            </>
          )}
          <footer>
            <span>
              MY FINANCE <i />
              慢慢來，也是一種前進。
            </span>
            <span>
              <LockKeyhole size={12} />
              私人・本機儲存・由你掌握
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Bell size={17} />
          <span>{notice}</span>
          <button className="icon-button" aria-label="關閉通知" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {editor && (
        <Modal
          title={
            editor.type === 'account'
              ? editor.account
                ? '編輯帳戶'
                : '新增帳戶'
              : editor.type === 'goal'
                ? editor.goal
                  ? '編輯儲蓄目標'
                  : '新的儲蓄目標'
                : editor.type === 'transaction'
                  ? '記錄一筆日常'
                  : '值得紀念的每一步'
          }
          close={closeEditor}
        >
          {editor.type === 'account' ? (
            <AccountForm
              account={editor.account}
              close={closeEditor}
              onSave={(a) => {
                accountSchema.parse(a)
                commit({
                  ...data,
                  accounts: data.accounts.some((item) => item.id === a.id)
                    ? data.accounts.map((item) => (item.id === a.id ? a : item))
                    : [...data.accounts, a],
                })
                setNotice('帳戶已儲存')
              }}
            />
          ) : editor.type === 'goal' ? (
            <GoalForm
              goal={editor.goal}
              data={data}
              close={closeEditor}
              onSave={(g) => {
                commit({
                  ...data,
                  goals: data.goals.some((item) => item.id === g.id)
                    ? data.goals.map((item) => (item.id === g.id ? g : item))
                    : [...data.goals, g],
                })
                setNotice('儲蓄目標已儲存')
              }}
            />
          ) : editor.type === 'transaction' ? (
            <TransactionForm
              data={data}
              close={closeEditor}
              onSave={(tx: Transaction) => {
                commit(applyTransaction(data, tx))
                setNotice('交易已記錄，帳戶餘額已更新')
              }}
            />
          ) : (
            <div className="history-list">
              {data.goals
                .filter((g) => g.completedAt)
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setEditor(null)
                      setCelebrations([g])
                    }}
                  >
                    <span className="mini-icon gold-icon">
                      <Trophy size={20} />
                    </span>
                    <span>
                      <b>{g.name}</b>
                      <small>
                        {g.completedAt}・{money(g.completedAmount ?? 0)}
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              {!data.goals.some((g) => g.completedAt) && (
                <Empty>每一步都算數。達成第一個目標後，紀錄就會出現在這裡。</Empty>
              )}
            </div>
          )}
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} close={closeConfirm}>
          <div className="confirm-body">{confirm.body}</div>
          <div className="form-actions">
            <button className="button secondary" onClick={closeConfirm}>
              取消
            </button>
            <button
              className="button danger-button"
              onClick={() => {
                safeAction(confirm.run)
                setConfirm(null)
              }}
            >
              確認操作
            </button>
          </div>
        </Modal>
      )}
      {pendingImport && (
        <Modal title="確認匯入資料" close={closeImport}>
          <p className="info">
            檔案格式已通過驗證。這會取代所有目前資料，不會合併；確認後會先下載現有資料的備份。
          </p>
          <div className="import-summary">
            <span>
              帳戶<b>{pendingImport.accounts.length} 個</b>
            </span>
            <span>
              儲蓄目標<b>{pendingImport.goals.length} 個</b>
            </span>
            <span>
              交易紀錄<b>{pendingImport.transactions.length} 筆</b>
            </span>
            <span>
              淨資產<b>{money(totals(pendingImport.accounts).net)}</b>
            </span>
          </div>
          <div className="form-actions">
            <button className="button secondary" onClick={closeImport}>
              取消，保留原資料
            </button>
            <button
              className="button primary"
              onClick={() =>
                safeAction(() => {
                  const raw = localStorage.getItem(STORAGE_KEY)
                  download(
                    locked && raw ? raw : JSON.stringify(data, null, 2),
                    `finance-backup-before-import-${today()}.json`,
                  )
                  commit(pendingImport, false, true)
                  setPendingImport(null)
                  setNotice('匯入完成；既有達成紀錄不會自動播放慶祝動畫。')
                })
              }
            >
              備份並取代資料
            </button>
          </div>
        </Modal>
      )}
      {!!celebrations.length && !editor && !confirm && !pendingImport && (
        <Modal title="值得為自己喝采的一刻" close={closeCelebration}>
          <div className="celebration">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 32 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 8) * 0.12}s`,
                    background: ['#c8a052', '#31977b', '#a6c5d1', '#e5ca8b'][i % 4],
                    transform: `rotate(${i * 31}deg)`,
                  }}
                />
              ))}
            </div>
            <span className="trophy-orb">
              <Trophy size={54} />
            </span>
            <p className="eyebrow">YOU MADE IT</p>
            <h2>恭喜！儲蓄目標達成</h2>
            <p>{celebrations[0].name}</p>
            <strong>{money(celebrations[0].completedAmount ?? 0)}</strong>
            <span className="completed-date">
              <CheckCircle2 size={16} />
              完成日期 {celebrations[0].completedAt}
            </span>
            <p className="muted small">這份努力已保存。以後可在「完成紀錄」重新查看。</p>
            <button className="button primary" onClick={closeCelebration}>
              收藏這份成就
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
function TrendingIcon() {
  return <ArrowUpRight size={19} />
}
function Metric({
  label,
  value,
  icon,
  foot,
  highlighted = false,
}: {
  label: string
  value: string
  icon: ReactNode
  foot: string
  highlighted?: boolean
}) {
  return (
    <section className={`metric card ${highlighted ? 'highlighted' : ''}`}>
      <div>
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>
        {highlighted && <span className="tiny-dot" />}
        {foot}
      </p>
    </section>
  )
}
