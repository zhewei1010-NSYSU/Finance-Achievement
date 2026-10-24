import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Heart,
  LayoutDashboard,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { money } from './lib/finance'
import { loadQuests, QUEST_KEY, questDataSchema, reconcileQuests, stats } from './lib/quests'
import type { Quest, QuestData } from './lib/quests'
import { GoalForm } from './components/Forms'
import { Empty, Field, Modal, MoneyInput, Ring } from './components/UI'
type Page = 'home' | 'goals'
type Dialog =
  | { type: 'goal'; goal?: Quest }
  | { type: 'deposit'; goal: Quest }
  | { type: 'delete'; goal: Quest }
  | { type: 'history' }
  | { type: 'help' }
  | null
const pages = [
  { id: 'home', label: '儲蓄首頁', icon: LayoutDashboard },
  { id: 'goals', label: '我的目標', icon: Target },
] as const
export default function App() {
  const [loaded] = useState(loadQuests),
    [data, setData] = useState(loaded.data)
  const [page, setPage] = useState<Page>('home'),
    [selected, setSelected] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null),
    [celebrations, setCelebrations] = useState<Quest[]>([])
  const [notice, setNotice] = useState(''),
    [storageError, setStorageError] = useState(loaded.error ?? '')
  const closeDialog = useCallback(() => setDialog(null), []),
    closeCelebration = useCallback(() => setCelebrations((q) => q.slice(1)), [])
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    if (loaded.error) return
    try {
      localStorage.setItem(QUEST_KEY, JSON.stringify(loaded.data))
      if (loaded.migrated)
        setNotice('原有目標已帶入；曾共用金額的目標已按比例分配，原始資料仍保留。')
    } catch {
      setStorageError('瀏覽器無法儲存，請檢查可用空間與網站儲存權限。')
    }
  }, [loaded])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])
  function commit(next: QuestData) {
    if (loaded.error) throw new Error('原始資料尚未修復，已暫停編輯以保護內容。')
    const result = reconcileQuests(questDataSchema.parse(next))
    try {
      localStorage.setItem(QUEST_KEY, JSON.stringify(result.data))
    } catch {
      setStorageError('儲存失敗，這次變更未套用。請檢查瀏覽器空間與網站儲存權限後重試。')
      throw new Error('無法儲存，這次變更未套用。')
    }
    setStorageError('')
    setData(result.data)
    setCelebrations((q) => [...q, ...result.completed])
  }
  const navigate = (next: Page) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const primary =
    data.goals.find((g) => g.id === selected) ??
    data.goals.find((g) => !g.completedAt) ??
    data.goals[0]
  const completed = data.goals.filter((g) => g.completedAt)
  function renderGoal(goal: Quest, featured = false) {
    const s = stats(goal, data.plan)
    return (
      <article className={`savings-card ${featured ? 'featured' : ''}`} key={goal.id}>
        <div className="goal-card-header">
          <span className="goal-badge">
            <span />
            {s.percent >= 100 ? '目標已達成' : '慢慢存，慢慢靠近'}
          </span>
          <button
            className="icon-button"
            aria-label={`編輯${goal.name}`}
            onClick={() => setDialog({ type: 'goal', goal })}
          >
            <MoreHorizontal size={22} />
          </button>
        </div>
        <div className="goal-intro">
          <span className="eyebrow">
            {featured ? 'MY SAVINGS GOAL' : 'ONE GOAL, ONE LITTLE STEP'}
          </span>
          <h2>{goal.name}</h2>
          <p>每一筆小小的累積，都在讓夢想更近一點。</p>
        </div>
        <div className="progress-focus">
          <Ring key={goal.id} value={s.percent} large={featured} />
          <p className={`progress-message ${s.percent > 80 ? 'near' : ''}`} aria-live="polite">
            {s.percent >= 100 ? (
              <>
                <CheckCheck size={18} />
                恭喜！儲蓄目標達成！
              </>
            ) : s.percent > 80 ? (
              <>
                <Sparkles size={17} />
                快達標了！離目標只差一點點！
              </>
            ) : s.percent === 0 ? (
              '從第一筆開始，為夢想存一點。'
            ) : (
              '存錢有在前進，每一步都算數。'
            )}
          </p>
        </div>
        <dl className="goal-details">
          <div>
            <dt>目前已存</dt>
            <dd className="saved-amount">{money(goal.saved)}</dd>
          </div>
          <div>
            <dt>目標金額</dt>
            <dd>{money(goal.target)}</dd>
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
            <CalendarDays size={16} />
            目標日期
          </span>
          <time dateTime={goal.deadline}>{goal.deadline.replaceAll('-', '/')}</time>
        </div>
        <div className="goal-bottom">
          <button
            className="button primary"
            disabled={!!loaded.error}
            onClick={() => setDialog({ type: 'deposit', goal })}
          >
            <Plus size={18} />
            存一筆
          </button>
          <button className="button secondary" onClick={() => setDialog({ type: 'goal', goal })}>
            調整目標
            <ArrowUpRight size={16} />
          </button>
        </div>
        {!featured && (
          <div className="quest-tools">
            {goal.completedAt && (
              <button className="text-button" onClick={() => setCelebrations([goal])}>
                <Trophy size={14} />
                查看完成紀錄
              </button>
            )}
            <button
              className="icon-button danger"
              aria-label={`刪除${goal.name}`}
              onClick={() => setDialog({ type: 'delete', goal })}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </article>
    )
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault()
              navigate('home')
            }}
          >
            <span className="brand-mark">
              <PiggyBank size={26} strokeWidth={1.7} />
            </span>
            <span>
              my savings<span className="brand-dot">.</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="主選單">
            {pages.map((p) => (
              <button
                key={p.id}
                aria-label={p.label}
                aria-current={page === p.id ? 'page' : undefined}
                className={page === p.id ? 'active' : ''}
                onClick={() => navigate(p.id)}
              >
                <p.icon size={17} />
                <span>{p.label}</span>
              </button>
            ))}
          </nav>
          <button
            className="icon-button"
            aria-label="使用說明"
            onClick={() => setDialog({ type: 'help' })}
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </header>
      <main>
        {storageError && (
          <div className="warning-banner" role="alert">
            <ShieldCheck size={20} />
            <span>{storageError}</span>
          </div>
        )}
        <div className="page-heading">
          <div>
            <span className="eyebrow">A LITTLE SAVING, A LITTLE CLOSER</span>
            <h1>
              {page === 'home' ? '把喜歡的未來，一點一點存下來。' : '每一個目標，都值得慢慢實現。'}
            </h1>
            <p>
              {page === 'home'
                ? '不用急著到終點，先看見自己正在前進。'
                : '為心中的期待，留一個專屬的儲蓄空間。'}
            </p>
          </div>
          {page === 'goals' && (
            <button
              className="button primary"
              onClick={() => setDialog({ type: 'goal' })}
              disabled={!!loaded.error}
            >
              <Plus size={17} />
              新增目標
            </button>
          )}
        </div>
        {page === 'home' ? (
          <>
            <div className="home-layout">
              <div className="main-goal">
                <div className="goal-section-header">
                  <h2>我的儲蓄目標</h2>
                  {data.goals.length > 1 && (
                    <select
                      className="quest-select"
                      aria-label="選擇主要目標"
                      value={primary?.id}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {data.goals.map((g) => (
                        <option key={g.id} value={g.id}>
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
                  renderGoal(primary, true)
                ) : (
                  <div className="card empty-goal">
                    <PiggyBank size={64} strokeWidth={1.2} />
                    <h2>為下一個期待，存一點。</h2>
                    <p>新增第一個目標，開始看見自己的累積。</p>
                    <button
                      className="button primary"
                      disabled={!!loaded.error}
                      onClick={() => setDialog({ type: 'goal' })}
                    >
                      <Plus size={17} />
                      新增目標
                    </button>
                  </div>
                )}
              </div>
              <aside className="savings-aside">
                <section className="quiet-note">
                  <span className="aside-icon">
                    <Heart size={23} strokeWidth={1.5} />
                  </span>
                  <span className="eyebrow">AT YOUR OWN PACE</span>
                  <h2>
                    小小的前進，
                    <br />
                    也值得為自己開心。
                  </h2>
                  <p>
                    目標可以很大，
                    <br />
                    今天只要存下一點點就好。
                  </p>
                  <span className="note-line" />
                </section>
                <button
                  className="completion-card"
                  aria-label="查看完成紀錄"
                  onClick={() => setDialog({ type: 'history' })}
                >
                  <span className="history-medal">
                    <Trophy size={25} strokeWidth={1.6} />
                  </span>
                  <div>
                    <span className="eyebrow">LITTLE MOMENTS, BIG WINS</span>
                    <h3>值得記住的每一次達成</h3>
                    <p>
                      {completed.length
                        ? `已完成 ${completed.length} 個儲蓄目標`
                        : '第一份完成紀錄，正在等你。'}
                    </p>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
                <p className="local-note">
                  <ShieldCheck size={14} />
                  進度自動保存在這個瀏覽器。
                </p>
              </aside>
            </div>
          </>
        ) : (
          <>
            <div className="goals-summary">
              <span>{data.goals.length} 個儲蓄目標</span>
              <button className="text-button" onClick={() => setDialog({ type: 'history' })}>
                <Trophy size={16} />
                完成紀錄・{completed.length}
              </button>
            </div>
            <div className="goals-grid">{data.goals.map((g) => renderGoal(g))}</div>
            {!data.goals.length && <Empty>從一個小目標開始，為未來留一點期待。</Empty>}
            <p className="footnote">每個目標分別記錄已存金額，同一筆存款請勿重複填入。</p>
          </>
        )}
        <footer>
          <span>
            <PiggyBank size={16} /> my savings<span>·</span>把日子，存成喜歡的樣子。
          </span>
          <span>不跟別人比，用自己的步調前進。</span>
        </footer>
      </main>
      {dialog && (
        <Modal
          title={
            dialog.type === 'goal'
              ? dialog.goal
                ? '調整我的目標'
                : '開啟新的目標'
              : dialog.type === 'deposit'
                ? '今天，也往前一步'
                : dialog.type === 'delete'
                  ? '確定放下這個目標？'
                  : dialog.type === 'history'
                    ? '我的成就收藏'
                    : dialog.type === 'help'
                      ? '關於我的儲蓄目標'
                      : '使用說明'
          }
          close={closeDialog}
        >
          {dialog.type === 'goal' ? (
            <GoalForm
              goal={dialog.goal}
              close={closeDialog}
              onSave={(goal) => {
                commit({
                  ...data,
                  goals: data.goals.some((g) => g.id === goal.id)
                    ? data.goals.map((g) => (g.id === goal.id ? goal : g))
                    : [...data.goals, goal],
                })
                setNotice('目標已儲存，一起慢慢前進。')
              }}
            />
          ) : dialog.type === 'deposit' ? (
            <DepositForm
              goal={dialog.goal}
              close={closeDialog}
              onSave={(saved) => {
                commit({
                  ...data,
                  goals: data.goals.map((g) => (g.id === dialog.goal.id ? { ...g, saved } : g)),
                })
                setNotice('存下的不只是錢，還有未來的選擇。')
              }}
            />
          ) : dialog.type === 'delete' ? (
            <>
              <p className="confirm-body">
                「{dialog.goal.name}
                」與它的完成紀錄將被移除，不會操作你的實際存款。其他目標不受影響。
              </p>
              <div className="form-actions">
                <button className="button secondary" onClick={closeDialog}>
                  繼續保留
                </button>
                <button
                  className="button danger-button"
                  onClick={() => {
                    try {
                      commit({ ...data, goals: data.goals.filter((g) => g.id !== dialog.goal.id) })
                      closeDialog()
                      setNotice('目標已移除，隨時可以重新出發。')
                    } catch (e) {
                      setNotice(e instanceof Error ? e.message : '無法儲存')
                    }
                  }}
                >
                  刪除目標
                </button>
              </div>
            </>
          ) : dialog.type === 'history' ? (
            <div className="history-list">
              {completed.length ? (
                completed.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      closeDialog()
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
                    <ChevronRight size={18} />
                  </button>
                ))
              ) : (
                <div className="history-empty">
                  <span className="history-medal">
                    <Trophy size={36} />
                  </span>
                  <h3>第一枚成就，留給努力的你。</h3>
                  <p>目標達成 100% 後，完成日期與金額會收藏在這裡。</p>
                </div>
              )}
            </div>
          ) : dialog.type === 'help' ? (
            <div className="help-content">
              <p>設定夢想、填入目前已存金額，再用「存一筆」記下新的累積。</p>
              <p>
                圓環顯示已存金額占目標的比例。超過 80% 時會提醒你快達標，首次達成 100%
                時會記下完成日期與金額，並顯示簡單慶祝。
              </p>
              <p>
                資料自動保存在這個瀏覽器，沒有後端或跨裝置同步。清除網站資料、更換瀏覽器或網址可能使進度無法讀取。
              </p>
            </div>
          ) : null}
        </Modal>
      )}
      {celebrations.length > 0 && !dialog && (
        <Modal title="一個目標，完成了！" close={closeCelebration}>
          <div className="celebration">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 8) * 0.12}s`,
                    background: ['#a4bd8a', '#dfb96c', '#cadbb6', '#eed39b'][i % 4],
                  }}
                />
              ))}
            </div>
            <span className="trophy-orb">
              <Trophy size={55} />
              <Sparkles className="trophy-spark" size={25} />
            </span>
            <span className="eyebrow">DREAM ACHIEVED</span>
            <h2>恭喜！儲蓄目標達成！</h2>
            <p>{celebrations[0].name}</p>
            <strong>{money(celebrations[0].completedAmount ?? 0)}</strong>
            <span className="completed-date">
              <CheckCheck size={16} />
              完成日期 {celebrations[0].completedAt}
            </span>
            <p className="small muted">每一筆小小的累積，終於成為一件大大的事。</p>
            <button className="button primary" onClick={closeCelebration}>
              收藏這份成就
              <Heart size={16} />
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
function DepositForm({
  goal,
  onSave,
  close,
}: {
  goal: Quest
  onSave: (saved: number) => void
  close: () => void
}) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const amount = Number(new FormData(e.currentTarget).get('amount'))
        if (!Number.isInteger(amount) || amount <= 0 || goal.saved + amount > 1e12) {
          setError('請輸入正整數，累積金額不可超過一兆元。')
          return
        }
        try {
          onSave(goal.saved + amount)
          close()
        } catch (e) {
          setError(e instanceof Error ? e.message : '無法儲存')
        }
      }}
    >
      <div className="deposit-preview">
        <span>{goal.name}</span>
        <strong>{money(goal.saved)}</strong>
        <small>目前已存金額</small>
      </div>
      <Field label="這次存入（NT$）">
        <MoneyInput name="amount" min={1} />
      </Field>
      <p className="info">
        只是記錄這次的儲蓄，不會操作實際存款。若要直接修改累積總額，請使用目標右上角的編輯按鈕。
      </p>
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
          儲存這一步
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}
