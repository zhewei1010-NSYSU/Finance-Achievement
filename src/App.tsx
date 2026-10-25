import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Landmark,
  LayoutDashboard,
  List,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Trash2,
  Trophy,
  Wallet,
  X,
} from 'lucide-react'
import { money, today, uid } from './lib/finance'
import {
  accountTotals,
  assetGroups,
  assetClasses,
  accountClass,
  archiveGoal,
  matchesRecordDate,
  annualIncome,
  balances,
  BOOK_KEY,
  categorySchema,
  depositRows,
  loadBook,
  periodStats,
  progress,
  reconcileBook,
  removeGoal,
  removeAccount,
  replaceRecord,
  saveAccount,
  saveGoal,
} from './lib/ledger'
import type { Book, BookAccount, Category, RecordItem, SavingGoal, LifeGoal } from './lib/ledger'
import { AccountForm, LifeForm, RecordForm, SavingForm } from './components/BookForms'
import { Countdown, Empty, Field, Modal, Ring } from './components/UI'
import LifeCard from './components/LifeCard'

type Page = 'home' | 'deposits' | 'accounts' | 'records' | 'goals'
type Dialog =
  | {
      type: 'record'
      record?: RecordItem
      deposit?: boolean
      goalId?: string
      initialType?: RecordItem['type']
    }
  | { type: 'assets' }
  | { type: 'account'; account?: BookAccount }
  | { type: 'goal'; goal?: SavingGoal }
  | { type: 'life'; goal?: LifeGoal; create?: boolean }
  | { type: 'history' }
  | { type: 'help' }
  | { type: 'categories' }
  | { type: 'category'; category?: Category }
  | { type: 'confirm'; title: string; message: string; run: () => void }
  | null
const pages = [
  { id: 'home', name: '首頁', icon: LayoutDashboard },
  { id: 'records', name: '收入紀錄', icon: List },
  { id: 'deposits', name: '存錢明細', icon: PiggyBank },
  { id: 'goals', name: '儲蓄目標', icon: Target },
  { id: 'accounts', name: '我的資產', icon: Wallet },
] as const
export default function App() {
  const [loaded] = useState(loadBook),
    [book, setBook] = useState(loaded.book),
    [page, setPage] = useState<Page>('home'),
    [selected, setSelected] = useState(''),
    [dialog, setDialog] = useState<Dialog>(null),
    [celebrations, setCelebrations] = useState<SavingGoal[]>([]),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(loaded.error ?? ''),
    [month, setMonth] = useState(today().slice(0, 7)),
    [dateFrom, setDateFrom] = useState(''),
    [dateTo, setDateTo] = useState(''),
    [showArchived, setShowArchived] = useState(false),
    [descending, setDescending] = useState(true),
    [year, setYear] = useState(Number(today().slice(0, 4))),
    [animation, setAnimation] = useState({ id: '', key: 0, happy: false })
  const savedRef = useRef<string | null>(null)
  const close = useCallback(() => setDialog(null), []),
    closeCelebration = useCallback(() => setCelebrations((q) => q.slice(1)), [])
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    if (loaded.error) return
    try {
      const raw = JSON.stringify(loaded.book)
      localStorage.setItem(BOOK_KEY, raw)
      savedRef.current = raw
      if (loaded.migrated)
        setNotice('原有帳戶、目標與紀錄已帶入。舊版原始資料仍保留，沒有新增虛構收入。')
    } catch {
      setError('無法儲存本機資料，請檢查瀏覽器空間與網站權限。')
    }
  }, [loaded])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === BOOK_KEY && e.newValue !== savedRef.current)
        setError('另一個分頁已更新資料，請重新整理後再編輯，避免覆蓋新資料。')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  useEffect(() => {
    if (!animation.key) return
    const eventKey = animation.key
    const timer = setTimeout(
      () =>
        setAnimation((event) =>
          event.key === eventKey ? { id: '', key: 0, happy: false } : event,
        ),
      2400,
    )
    return () => clearTimeout(timer)
  }, [animation.key])
  const primary =
      book.goals.find((g) => g.id === selected && !g.archived) ??
      book.goals.find((g) => !g.archived && !g.completedAt) ??
      book.goals.find((g) => !g.archived),
    b = balances(book),
    groups = assetGroups(book),
    total = accountTotals(book),
    monthly = periodStats(book, today().slice(0, 7)),
    annual = annualIncome(book, year),
    completed = book.goals.filter((g) => g.completedAt)
  function commit(next: Book, animate = false) {
    if (loaded.error) throw new Error('原始資料尚未修復，已暫停編輯。')
    const result = reconcileBook(next)
    try {
      if (localStorage.getItem(BOOK_KEY) !== savedRef.current)
        throw new Error('資料已由其他分頁更新，請先重新整理。')
      const raw = JSON.stringify(result.book)
      localStorage.setItem(BOOK_KEY, raw)
      savedRef.current = raw
    } catch (e) {
      const message =
        e instanceof Error && e.message.includes('其他分頁')
          ? e.message
          : '儲存失敗，這次變更未套用。請檢查儲存空間與權限。'
      setError(message)
      throw new Error(message)
    }
    if (animate) {
      const updatedBalances = balances(result.book)
      const candidates = primary
        ? [primary, ...result.book.goals.filter((g) => g.id !== primary.id)]
        : result.book.goals
      const increased = candidates.find(
        (g) => (updatedBalances.get(g.accountId) ?? 0) > (b.get(g.accountId) ?? 0),
      )
      if (increased)
        setAnimation((e) => ({
          id: increased.accountId,
          key: e.key + 1,
          happy: result.completed.some((g) => g.accountId === increased.accountId),
        }))
    }
    setError('')
    setBook(result.book)
    setCelebrations((q) => [...q, ...result.completed])
  }
  const navigate = (next: Page) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const confirm = (title: string, message: string, run: () => void) =>
    setDialog({ type: 'confirm', title, message, run })
  const sorted = (items: RecordItem[]) =>
    items
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (descending ? -1 : 1) * (a.r.date.localeCompare(b.r.date) || a.i - b.i))
      .map((x) => x.r)
  const openRecord = (r: RecordItem) =>
    setDialog({
      type: 'record',
      record: r,
      deposit: !!r.goalId || !!r.isDeposit,
      goalId: r.goalId,
      initialType: r.type,
    })
  const deleteRecord = (r: RecordItem) =>
    confirm(
      '刪除這筆紀錄？',
      '系統會重新計算帳戶餘額、累積存款與目標進度。若造成餘額不足或超額還款，會阻止刪除。',
      () => {
        commit(replaceRecord(book, r.id), true)
        setNotice('紀錄已刪除，帳戶與目標已同步更新。')
      },
    )
  const allDeposits = depositRows(book),
    filteredDeposits = allDeposits.filter((x) =>
      matchesRecordDate(x.record, { month, from: dateFrom, to: dateTo }),
    ),
    depositTotal = allDeposits.reduce((s, x) => s + x.record.amount, 0),
    monthDeposits = allDeposits
      .filter((x) => !month || x.record.date.startsWith(month))
      .reduce((s, x) => s + x.record.amount, 0)
  const recordList = (items: RecordItem[], deposits = false) => {
    const after = new Map(allDeposits.map((x) => [x.record.id, x.after]))
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>日期／備註</th>
              <th>{deposits ? '本次存入' : '類型／類別'}</th>
              {deposits && <th>來源帳戶</th>}
              <th>{deposits ? '存入帳戶／目標' : '帳戶'}</th>
              <th className="align-right">{deposits ? '存款後累積金額' : '金額'}</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>
                    {r.note || { income: '收入', expense: '支出', transfer: '帳戶轉帳' }[r.type]}
                  </b>
                  <small>{r.date.replaceAll('-', '/')}</small>
                </td>
                <td>
                  {deposits ? (
                    <b>{money(r.amount)}</b>
                  ) : (
                    <>
                      <span className={`record-tag ${r.type}`}>
                        {{ income: '收入', expense: '支出', transfer: '轉帳' }[r.type]}
                      </span>
                      <small>
                        {book.categories.find((c) => c.id === r.categoryId)?.name ?? '不列入收入'}
                      </small>
                    </>
                  )}
                </td>
                {deposits && (
                  <td className="deposit-source">
                    {r.type === 'income'
                      ? '外部收入'
                      : book.accounts.find((a) => a.id === r.accountId)?.name}
                  </td>
                )}
                <td>
                  <b>
                    {
                      book.accounts.find(
                        (a) =>
                          a.id ===
                          (deposits
                            ? r.type === 'transfer'
                              ? r.toAccountId
                              : r.accountId
                            : r.accountId),
                      )?.name
                    }
                  </b>
                  <small>
                    {deposits
                      ? (book.goals.find((g) => g.id === r.goalId)?.name ?? '未綁定目標')
                      : r.toAccountId
                        ? `→ ${book.accounts.find((a) => a.id === r.toAccountId)?.name}`
                        : r.settled
                          ? '舊版已結算紀錄'
                          : ''}
                  </small>
                </td>
                <td className="align-right number">
                  {money(deposits ? (after.get(r.id) ?? 0) : r.amount)}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`編輯紀錄${r.note || r.date}`}
                      onClick={() => openRecord(r)}
                    >
                      <Settings2 size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`刪除紀錄${r.note || r.date}`}
                      onClick={() => deleteRecord(r)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <Empty>目前沒有紀錄，從今天的第一筆開始。</Empty>}
      </div>
    )
  }
  const savingCard = (g: SavingGoal, large = false) => {
    const s = progress(book, g)
    return (
      <article className={`savings-card ${large ? 'featured' : ''}`} key={g.id}>
        <div className="goal-card-header">
          <span className="goal-badge">
            {g.archived ? '已封存 · ' : ''}
            {book.accounts.find((a) => a.id === g.accountId)?.name} ·{' '}
            {s.percent >= 100 ? '目標已達成' : '正在累積中'}
          </span>
          <button
            className="icon-button"
            aria-label={`編輯${g.name}`}
            onClick={() => setDialog({ type: 'goal', goal: g })}
          >
            <MoreHorizontal size={22} />
          </button>
        </div>
        <div className="goal-intro">
          <h2>{g.name}</h2>
          <p>每次存下一點，就離喜歡的未來更近一點。</p>
        </div>
        <div className="progress-focus">
          <Ring
            key={g.id}
            value={s.percent}
            large={large}
            animationKey={animation.id === g.accountId ? animation.key : 0}
            celebrating={animation.id === g.accountId && animation.happy}
          />
          <p className={`progress-message ${s.percent >= 100 ? 'success' : ''}`} aria-live="polite">
            {s.percent >= 100
              ? '恭喜！儲蓄目標達成！'
              : s.percent >= 80
                ? '快達標了！'
                : animation.id === g.accountId && animation.key
                  ? '又更接近目標了！'
                  : '為每一次認真存錢的自己，開心一下。'}
          </p>
        </div>
        <dl className="goal-details">
          <div>
            <dt>目前已存</dt>
            <dd>{money(s.saved)}</dd>
          </div>
          <div>
            <dt>目標金額</dt>
            <dd>{money(g.target)}</dd>
          </div>
          <div>
            <dt>尚差金額</dt>
            <dd>{money(s.remaining)}</dd>
          </div>
          <div>
            <dt>達成進度</dt>
            <dd>
              {Math.floor(s.percent)}
              <small>%</small>
            </dd>
          </div>
        </dl>
        <div className="target-date">
          <span>
            <CalendarDays size={15} />
            目標日期
          </span>
          <time>{g.deadline.replaceAll('-', '/')}</time>
        </div>
        <Countdown deadline={g.deadline} />
        <div className="goal-bottom">
          <button
            className="button primary"
            disabled={!!loaded.error || g.archived}
            onClick={() => setDialog({ type: 'record', deposit: true, goalId: g.id })}
          >
            <Plus size={17} />
            新增存款
          </button>
          <button className="button secondary" onClick={() => setDialog({ type: 'goal', goal: g })}>
            調整目標
            <ArrowUpRight size={16} />
          </button>
        </div>
        {!large && (
          <div className="quest-tools">
            <button
              className="text-button"
              aria-label={`${g.archived ? '還原' : '封存'}${g.name}`}
              onClick={() => {
                try {
                  commit(archiveGoal(book, g.id, !g.archived))
                  setNotice(g.archived ? '目標已還原。' : '目標已封存，原始紀錄與帳戶餘額保留。')
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : '無法儲存')
                }
              }}
            >
              {g.archived ? '還原目標' : '封存目標'}
            </button>
            {g.completedAt && (
              <button className="text-button" onClick={() => setCelebrations([g])}>
                查看完成紀錄
              </button>
            )}
            <button
              className="text-button danger"
              onClick={() =>
                confirm(
                  '刪除這個儲蓄目標？',
                  '存款與收入紀錄會保留，只解除目標關聯；帳戶餘額不會被刪除。',
                  () => commit(removeGoal(book, g.id)),
                )
              }
            >
              刪除目標
            </button>
          </div>
        )}
      </article>
    )
  }
  function dateFilters(label: string) {
    return (
      <div className="date-query">
        <label>
          起始日期
          <input
            aria-label={`${label}起始日期`}
            type="date"
            value={dateFrom}
            max={dateTo || today()}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label>
          結束日期
          <input
            aria-label={`${label}結束日期`}
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            max={today()}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <button
          className="text-button"
          onClick={() => {
            setDateFrom('')
            setDateTo('')
            setMonth('')
          }}
        >
          清除篩選
        </button>
        {dateFrom && dateTo && dateFrom > dateTo && (
          <p className="form-error" role="alert">
            結束日期不可早於起始日期。
          </p>
        )}
        {label === '存款' && (dateFrom || dateTo) && (
          <span className="date-query-total">
            查詢存款合計{' '}
            <b>{money(filteredDeposits.reduce((sum, row) => sum + row.record.amount, 0))}</b>
          </span>
        )}
      </div>
    )
  }
  function lifeSection(manage: boolean) {
    return (
      <section className="life-section">
        <div className="section-heading">
          <h2>長期人生目標</h2>
          {manage ? (
            <button
              className="button secondary"
              onClick={() => setDialog({ type: 'life', create: true })}
            >
              <Plus size={15} />
              新增人生目標
            </button>
          ) : (
            <button className="text-button" onClick={() => navigate('goals')}>
              管理人生目標
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
        <div className="life-goals-grid">
          <LifeCard
            life={book.life}
            annual={annual}
            year={year}
            onYear={setYear}
            onEdit={() => setDialog({ type: 'life' })}
            onIncome={() => setDialog({ type: 'record', initialType: 'income' })}
          />
          {manage &&
            book.lifeGoals?.map((g) => (
              <LifeCard
                key={g.id}
                id={g.id}
                name={g.name}
                life={g}
                annual={annual}
                year={year}
                onYear={setYear}
                onEdit={() => setDialog({ type: 'life', goal: g })}
                onIncome={() => setDialog({ type: 'record', initialType: 'income' })}
                onDelete={() =>
                  confirm(
                    '刪除這個人生目標？',
                    '只移除目標設定，年度收入紀錄與帳戶餘額會保留。',
                    () =>
                      commit({
                        ...book,
                        lifeGoals: book.lifeGoals?.filter((item) => item.id !== g.id),
                      }),
                  )
                }
              />
            ))}
        </div>
      </section>
    )
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault()
              navigate('home')
            }}
          >
            <span className="brand-mark">
              <PiggyBank size={26} strokeWidth={1.7} />
            </span>
            <span>
              我的理財手帳<span className="brand-dot">.</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="主選單">
            {pages.map((p) => (
              <button
                key={p.id}
                aria-label={p.name}
                aria-current={page === p.id ? 'page' : undefined}
                className={page === p.id ? 'active' : ''}
                onClick={() => navigate(p.id)}
              >
                <p.icon size={16} />
                <span>{p.name}</span>
              </button>
            ))}
          </nav>
          <button
            className="icon-button privacy-button"
            aria-label="資料與隱私說明"
            onClick={() => setDialog({ type: 'help' })}
          >
            <ShieldCheck size={20} />
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="warning-banner" role="alert">
            <ShieldCheck size={18} />
            <span>{error}</span>
          </div>
        )}
        <div className={`page-heading ${page === 'home' ? 'home-heading' : ''}`}>
          <div>
            <span className="eyebrow">
              {page === 'home' ? '好好生活，也好好存錢' : pages.find((p) => p.id === page)?.name}
            </span>
            <h1>
              {
                {
                  home: '把夢想，一點一點存下來。',
                  deposits: '每一筆累積，都有它的故事。',
                  accounts: '讓每筆錢，都有自己的位置。',
                  records: '記下每筆收入，看見自己的累積。',
                  goals: '為喜歡的未來，設定一個目標。',
                }[page]
              }
            </h1>
            <p>
              {page === 'home'
                ? '用自己的步調，慢慢靠近想要的生活。'
                : '所有金額依你的實際帳戶與紀錄計算，資料保存在此瀏覽器。'}
            </p>
          </div>
          <button
            className="button primary"
            disabled={!!loaded.error}
            onClick={() =>
              setDialog(
                page === 'accounts'
                  ? { type: 'assets' }
                  : page === 'goals'
                    ? { type: 'goal' }
                    : page === 'deposits'
                      ? { type: 'record', deposit: true, goalId: primary?.id }
                      : { type: 'record' },
              )
            }
          >
            <Plus size={17} />
            {page === 'accounts'
              ? '管理資產'
              : page === 'goals'
                ? '新增目標'
                : page === 'deposits'
                  ? '新增存款'
                  : '新增收入'}
          </button>
        </div>
        {page === 'home' && (
          <>
            <div className="overview-grid">
              {[
                ['目前總資產', total.assets, Wallet],
                ['本月收入', monthly.income, ArrowDownLeft],
                [
                  '本月存入',
                  allDeposits
                    .filter((x) => x.record.date.startsWith(today().slice(0, 7)))
                    .reduce((sum, x) => sum + x.record.amount, 0),
                  PiggyBank,
                ],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Wallet
                return (
                  <section className="metric-card" key={String(label)}>
                    <div>
                      <span>{String(label)}</span>
                      <I size={18} />
                    </div>
                    <strong>{money(Number(value))}</strong>
                    <small>
                      {label === '目前總資產'
                        ? '資產帳戶餘額合計'
                        : `${today().slice(0, 7).replace('-', ' 年 ')} 月實際紀錄`}
                    </small>
                  </section>
                )
              })}
            </div>
            <div className="dashboard-layout">
              <div className="saving-zone">
                <div className="section-heading">
                  <h2>我的儲蓄目標</h2>
                  {book.goals.filter((g) => !g.archived).length > 1 && (
                    <select
                      className="goal-select"
                      aria-label="選擇儲蓄目標"
                      value={primary?.id}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {book.goals
                        .filter((g) => !g.archived)
                        .map((g) => (
                          <option value={g.id} key={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  )}
                  <button className="text-button" onClick={() => navigate('goals')}>
                    所有目標
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {primary ? (
                  savingCard(primary, true)
                ) : (
                  <div className="card empty-goal">
                    <PiggyBank size={65} />
                    <h2>從第一個儲蓄目標開始。</h2>
                    <button className="button primary" onClick={() => setDialog({ type: 'goal' })}>
                      新增目標
                    </button>
                  </div>
                )}
                <section className="card deposit-preview-card">
                  <div className="section-heading">
                    <h2>存錢明細</h2>
                    <button className="text-button" onClick={() => navigate('deposits')}>
                      全部明細
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {recordList(
                    sorted(
                      allDeposits
                        .filter(
                          (x) => !primary || !x.record.goalId || x.record.goalId === primary.id,
                        )
                        .map((x) => x.record),
                    ).slice(0, 4),
                    true,
                  )}
                </section>
              </div>
              <aside className="dashboard-aside">
                <section className="card mini-accounts">
                  <div className="section-heading">
                    <h2>我的資產</h2>
                    <button className="text-button" onClick={() => navigate('accounts')}>
                      管理
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {groups.map((group) => (
                    <div className="account-row" key={group.id}>
                      <span className="account-symbol">
                        <Landmark size={17} />
                      </span>
                      <b>{group.name}</b>
                      <strong>{money(group.amount)}</strong>
                    </div>
                  ))}
                </section>
                <button
                  className="completion-card"
                  aria-label="查看完成紀錄"
                  onClick={() => setDialog({ type: 'history' })}
                >
                  <Trophy size={24} />
                  <span>
                    <b>值得記住的每一次達成</b>
                    <small>已完成 {completed.length} 個儲蓄目標</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              </aside>
            </div>
            {lifeSection(false)}
            <section className="card recent-card">
              <div className="section-heading">
                <h2>最近收入紀錄</h2>
                <button className="text-button" onClick={() => navigate('records')}>
                  全部紀錄
                  <ArrowUpRight size={15} />
                </button>
              </div>
              {recordList(sorted(book.records.filter((r) => r.type === 'income')).slice(0, 5))}
            </section>
          </>
        )}
        {page === 'deposits' && (
          <>
            <div className="filter-bar">
              <label>
                月份
                <input
                  aria-label="存款月份"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <button className="text-button" onClick={() => setMonth('')}>
                全部月份
              </button>
              <button className="button secondary" onClick={() => setDescending((v) => !v)}>
                日期{descending ? '由新到舊' : '由舊到新'}
              </button>
              <div>
                <span>{month ? '所選月份存款' : '全部存款'}</span>
                <b>{money(monthDeposits)}</b>
              </div>
              <div>
                <span>累積存款紀錄總額</span>
                <b>{money(depositTotal)}</b>
              </div>
            </div>
            {dateFilters('存款')}
            <section className="card table-card">
              {recordList(sorted(filteredDeposits.map((x) => x.record)), true)}
            </section>
            <p className="footnote">
              月份存款總額不受下方日期區間影響；日期查詢合計只計篩選結果。累積存款紀錄總額是已記錄存入金額的加總；每筆「存款後累積金額」依原有餘額、歷史紀錄與轉帳重算。未記錄的舊版存款保留為帳戶餘額，不會捏造明細。
            </p>
          </>
        )}
        {page === 'records' && (
          <>
            <div className="filter-bar">
              <label>
                月份
                <input
                  aria-label="收入月份"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <button className="text-button" onClick={() => setMonth('')}>
                全部月份
              </button>
              <button className="button secondary" onClick={() => setDescending((v) => !v)}>
                日期{descending ? '由新到舊' : '由舊到新'}
              </button>
              <button
                className="button secondary"
                onClick={() => setDialog({ type: 'categories' })}
              >
                <Tags size={16} />
                管理類別
              </button>
              <div>
                <span>{month ? '該月收入' : '全部收入'}</span>
                <b>{money(periodStats(book, month).income)}</b>
              </div>
            </div>
            {dateFilters('收入')}
            <section className="card table-card">
              {recordList(
                sorted(
                  book.records.filter(
                    (r) =>
                      r.type === 'income' &&
                      matchesRecordDate(r, { month, from: dateFrom, to: dateTo }),
                  ),
                ),
              )}
            </section>
            <p className="footnote">
              僅列出實際收入，外部收入存款共用同一筆紀錄。帳戶轉帳不計入收入。歷史支出保留於本機資料且維持原有餘額影響。
            </p>
          </>
        )}
        {page === 'accounts' && (
          <>
            <div className="account-total">
              <span>
                總資產 <b>{money(total.assets)}</b>
              </span>
            </div>
            <div className="accounts-grid">
              {groups.map((group) => (
                <section className="card account-card" key={group.id}>
                  <span className="account-symbol">
                    <Landmark size={22} />
                  </span>
                  <h2>{group.name}</h2>
                  <strong>{money(group.amount)}</strong>
                </section>
              ))}
            </div>
            <div className="asset-tools">
              <button
                className="button secondary"
                onClick={() => setDialog({ type: 'record', initialType: 'transfer' })}
              >
                資產間轉帳
              </button>
            </div>
            <p className="footnote">
              三個分類包含所有資產帳戶，每筆資產只計算一次。分類間轉帳不增加總資產或收入；原有負債及歷史紀錄保留，不列入此資產合計。
            </p>
          </>
        )}
        {page === 'goals' && (
          <>
            <div className="goals-summary">
              <span>
                {book.goals.filter((g) => !g.archived).length} 個進行中目標 ·{' '}
                {book.goals.filter((g) => g.archived).length} 個已封存
              </span>
              <button className="button secondary" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? '查看進行中目標' : '查看已封存目標'}
              </button>
            </div>
            <div className="goals-grid">
              {book.goals.filter((g) => !!g.archived === showArchived).map((g) => savingCard(g))}
            </div>
            {!book.goals.some((g) => !!g.archived === showArchived) && (
              <Empty>
                {showArchived ? '目前沒有已封存目標。' : '新增一個儲蓄目標，從今天開始累積。'}
              </Empty>
            )}
            {lifeSection(true)}
          </>
        )}
        <footer>
          <span>
            <PiggyBank size={16} />
            我的理財手帳 · 好好生活，慢慢存錢。
          </span>
          <button className="text-button" onClick={() => setDialog({ type: 'help' })}>
            <ShieldCheck size={13} />
            資料儲存在此瀏覽器
          </button>
        </footer>
      </main>
      {dialog && (
        <Modal
          title={
            dialog.type === 'record'
              ? dialog.record
                ? '編輯紀錄'
                : dialog.deposit
                  ? '新增存款'
                  : dialog.initialType === 'transfer'
                    ? '資產間轉帳'
                    : '新增收入'
              : dialog.type === 'assets'
                ? '管理資產帳戶'
                : dialog.type === 'account'
                  ? dialog.account
                    ? '編輯帳戶'
                    : '新增帳戶'
                  : dialog.type === 'goal'
                    ? dialog.goal
                      ? '編輯儲蓄目標'
                      : '新增儲蓄目標'
                    : dialog.type === 'life'
                      ? dialog.create
                        ? '新增人生目標'
                        : '設定人生目標'
                      : dialog.type === 'history'
                        ? '我的完成紀錄'
                        : dialog.type === 'help'
                          ? '資料與隱私說明'
                          : dialog.type === 'categories'
                            ? '收入類別'
                            : dialog.type === 'category'
                              ? dialog.category
                                ? '編輯類別'
                                : '新增類別'
                              : dialog.title
          }
          close={close}
          wide={dialog.type === 'record' || dialog.type === 'assets'}
        >
          {dialog.type === 'record' ? (
            <RecordForm
              book={book}
              record={dialog.record}
              deposit={dialog.deposit}
              goalId={dialog.goalId}
              initialType={dialog.initialType}
              close={close}
              onSave={(r, accounts = []) => {
                commit(
                  replaceRecord(
                    { ...book, accounts: [...book.accounts, ...accounts] },
                    dialog.record?.id ?? null,
                    r,
                  ),
                  true,
                )
                setNotice(
                  r.goalId
                    ? '又更接近目標了！帳戶與存款進度已同步更新。'
                    : r.isDeposit
                      ? '存款已儲存，資產與明細已同步更新。'
                      : '紀錄已儲存，帳戶餘額已更新。',
                )
              }}
            />
          ) : dialog.type === 'assets' ? (
            <div className="asset-manage">
              <p className="info">在三個分類中整理現有帳戶；重新分類不會改變資產或收入。</p>
              {book.accounts
                .filter((a) => a.kind === 'asset')
                .map((a) => (
                  <button
                    className="account-row"
                    key={a.id}
                    onClick={() => setDialog({ type: 'account', account: a })}
                  >
                    <span>
                      <b>{a.name}</b>
                      <small>{assetClasses[accountClass(a)]}</small>
                    </span>
                    <strong>{money(b.get(a.id) ?? 0)}</strong>
                    <Settings2 size={16} />
                  </button>
                ))}
              <button className="button secondary" onClick={() => setDialog({ type: 'account' })}>
                <Plus size={16} />
                新增帳戶
              </button>
              <h3 className="transfer-heading">資產移動紀錄</h3>
              {recordList(
                sorted(
                  book.records.filter(
                    (r) =>
                      r.type === 'transfer' &&
                      book.accounts.find((a) => a.id === r.accountId)?.kind === 'asset' &&
                      book.accounts.find((a) => a.id === r.toAccountId)?.kind === 'asset',
                  ),
                ),
              )}
            </div>
          ) : dialog.type === 'account' ? (
            <>
              <AccountForm
                book={book}
                account={dialog.account}
                close={close}
                onSave={(a) => {
                  commit(saveAccount(book, a))
                  setNotice('帳戶已儲存。')
                }}
              />
              {dialog.account && (
                <button
                  className="text-button danger"
                  onClick={() => {
                    const account = dialog.account!
                    confirm(
                      '刪除帳戶？',
                      '僅可刪除未關聯紀錄或儲蓄目標的帳戶。此操作會移除該帳戶餘額。',
                      () => commit(removeAccount(book, account.id)),
                    )
                  }}
                >
                  刪除帳戶
                </button>
              )}
            </>
          ) : dialog.type === 'goal' ? (
            <SavingForm
              book={book}
              goal={dialog.goal}
              close={close}
              onSave={(g) => {
                commit(saveGoal(book, g))
                setNotice('目標已儲存，進度依指定帳戶餘額計算。')
              }}
            />
          ) : dialog.type === 'life' ? (
            <LifeForm
              book={book}
              life={
                dialog.create
                  ? { targetAge: 30, targetIncome: 1000000, deadline: null }
                  : (dialog.goal ?? book.life)
              }
              goalName={dialog.create ? '' : dialog.goal?.name}
              close={close}
              onSave={(life, name) => {
                if (dialog.create)
                  commit({
                    ...book,
                    lifeGoals: [
                      ...(book.lifeGoals ?? []),
                      { ...life, id: uid(), name: name ?? '' },
                    ],
                  })
                else if (dialog.goal)
                  commit({
                    ...book,
                    lifeGoals: book.lifeGoals?.map((g) =>
                      g.id === dialog.goal?.id ? { ...g, ...life, name: name ?? g.name } : g,
                    ),
                  })
                else commit({ ...book, life })
              }}
            />
          ) : dialog.type === 'history' ? (
            <div className="history-list">
              {completed.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    close()
                    setCelebrations([g])
                  }}
                >
                  <span className="history-medal">
                    <Trophy size={22} />
                  </span>
                  <span>
                    <b>{g.name}</b>
                    <small>
                      {g.completedAt} · {money(g.completedAmount ?? 0)}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
              {!completed.length && <Empty>目標達成後，完成日期與金額會保留在這裡。</Empty>}
            </div>
          ) : dialog.type === 'help' ? (
            <div className="help-content">
              <p>
                目前沒有登入驗證、後端或雲端資料庫。GitHub Pages
                只提供公開網頁，無法提供私人資料庫或登入保護。
              </p>
              <p>
                你的資產、存款與歷史紀錄只保存在目前瀏覽器的本機儲存，沒有上傳
                GitHub。重新整理會保留；換瀏覽器、裝置、網址或清除網站資料後，不會自動同步或還原。
              </p>
              <p>
                本機資料未加密，任何能使用同一瀏覽器的人可能讀到資料。請在可信任的個人裝置使用。本版本沒有偽裝成安全登入的前端密碼鎖。
              </p>
              <p>
                舊版原始資料仍保留；轉換後使用新版帳簿。來源帳戶對帳餘額不是收入，轉帳不增加總資產。
              </p>
            </div>
          ) : dialog.type === 'categories' ? (
            <div className="categories-list">
              <button className="button primary" onClick={() => setDialog({ type: 'category' })}>
                <Plus size={16} />
                新增類別
              </button>
              {book.categories
                .filter((c) => c.type === 'income')
                .map((c) => (
                  <div key={c.id}>
                    <span>
                      {c.name}
                      <small>收入</small>
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`編輯類別${c.name}`}
                      onClick={() => setDialog({ type: 'category', category: c })}
                    >
                      <Settings2 size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`刪除類別${c.name}`}
                      onClick={() =>
                        confirm(
                          '刪除類別？',
                          '已被紀錄使用的類別無法刪除，請先調整相關紀錄。',
                          () => {
                            if (book.records.some((r) => r.categoryId === c.id))
                              throw new Error('此類別仍有紀錄，請先修改相關紀錄。')
                            commit({
                              ...book,
                              categories: book.categories.filter((x) => x.id !== c.id),
                            })
                          },
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
            </div>
          ) : dialog.type === 'category' ? (
            <CategoryForm
              category={dialog.category}
              close={close}
              onSave={(category) =>
                commit({
                  ...book,
                  categories: dialog.category
                    ? book.categories.map((c) => (c.id === category.id ? category : c))
                    : [...book.categories, category],
                })
              }
            />
          ) : dialog.type === 'confirm' ? (
            <>
              <p className="confirm-body">{dialog.message}</p>
              <div className="form-actions">
                <button className="button secondary" onClick={close}>
                  取消
                </button>
                <button
                  className="button danger-button"
                  onClick={() => {
                    try {
                      dialog.run()
                      close()
                    } catch (e) {
                      setNotice(e instanceof Error ? e.message : '操作失敗')
                    }
                  }}
                >
                  確認操作
                </button>
              </div>
            </>
          ) : null}
        </Modal>
      )}
      {!!celebrations.length && !dialog && (
        <Modal title="一個目標，完成了！" close={closeCelebration}>
          <div className="celebration">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 6) * 0.12}s`,
                    background: ['#9bbf9a', '#e3c777', '#f0bacb'][i % 3],
                  }}
                />
              ))}
            </div>
            <span className="trophy-orb">
              <Trophy size={52} />
              <Sparkles className="trophy-spark" size={23} />
            </span>
            <h2>恭喜！儲蓄目標達成！</h2>
            <p>{celebrations[0].name}</p>
            <strong>{money(celebrations[0].completedAmount ?? 0)}</strong>
            <span className="completed-date">
              <CheckCheck size={16} />
              完成日期 {celebrations[0].completedAt}
            </span>
            <p className="small muted">每一次認真累積，都值得為自己開心。</p>
            <button className="button primary" onClick={closeCelebration}>
              收藏這份成就
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button className="icon-button" aria-label="關閉通知" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
function CategoryForm({
  category,
  onSave,
  close,
}: {
  category?: Category
  onSave: (c: Category) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = Object.fromEntries(new FormData(e.currentTarget))
        try {
          onSave(categorySchema.parse({ id: category?.id ?? uid(), name: v.name, type: 'income' }))
          close()
        } catch (e) {
          setError(e instanceof Error ? e.message : '請檢查輸入')
        }
      }}
    >
      <Field label="類別名稱">
        <input name="name" maxLength={80} defaultValue={category?.name} required />
      </Field>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={close}>
          取消
        </button>
        <button className="button primary" type="submit">
          儲存類別
        </button>
      </div>
    </form>
  )
}
