import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Compass,
  Flag,
  Heart,
  HeartPulse,
  Leaf,
  LockKeyhole,
  Map,
  MoreHorizontal,
  Mountain,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Trash2,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { money, today } from './lib/finance'
import {
  adventure,
  checkup,
  loadQuests,
  QUEST_KEY,
  questDataSchema,
  reconcileQuests,
  stages,
  stats,
} from './lib/quests'
import type { Quest, QuestData } from './lib/quests'
import { GoalForm } from './components/Forms'
import { Empty, Field, Modal, MoneyInput, Ring, SectionHeading } from './components/UI'
import Planning from './components/Planning'

type Page = 'home' | 'goals' | 'planning' | 'health'
type Dialog =
  | { type: 'goal'; goal?: Quest }
  | { type: 'deposit'; goal: Quest }
  | { type: 'delete'; goal: Quest }
  | { type: 'stage'; goal: Quest; index: number }
  | { type: 'history' }
  | { type: 'help' }
  | null
const pages = [
  { id: 'home', label: '闖關首頁', icon: Compass },
  { id: 'goals', label: '儲蓄挑戰', icon: Flag },
  { id: 'planning', label: '理財規劃', icon: Settings2 },
  { id: 'health', label: '財務健檢', icon: HeartPulse },
] as const
const StageIcons = [Sprout, Leaf, Mountain, Flag, Trophy]
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
        setNotice('原有挑戰已帶入；曾共用金額的目標已按比例分配，原始資料仍保留。')
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
  const progress = adventure(data),
    primary =
      data.goals.find((g) => g.id === selected) ??
      data.goals.find((g) => !g.completedAt) ??
      data.goals[0]
  const current = primary ? stats(primary, data.plan) : null
  const nextStage = current ? Math.min(4, current.stage + 1) : 0
  const completed = data.goals.filter((g) => g.completedAt)
  const renderQuest = (goal: Quest, index: number, featured = false) => {
    const s = stats(goal, data.plan)
    return (
      <article className={`quest-card ${featured ? 'featured' : ''}`} key={goal.id}>
        <div className="quest-top">
          <span className="quest-category">
            <span className="quest-number">{String(index + 1).padStart(2, '0')}</span>
            {goal.completedAt ? '已解鎖的成就' : '進行中的挑戰'}
          </span>
          <button
            className="icon-button"
            aria-label={`編輯${goal.name}`}
            onClick={() => setDialog({ type: 'goal', goal })}
          >
            <MoreHorizontal size={21} />
          </button>
        </div>
        <div className="quest-body">
          <div className="quest-copy">
            <span className="eyebrow">{featured ? 'YOUR MAIN QUEST' : 'SAVINGS CHALLENGE'}</span>
            <h2>{goal.name}</h2>
            <p className="quest-date">
              <Flag size={13} />
              {goal.deadline.replaceAll('-', '.')} 前完成
            </p>
            <div className="quest-amount">
              <strong>{money(goal.saved)}</strong>
              <span>／ {money(goal.target)}</span>
            </div>
            <p className="quest-encouragement">
              {s.remaining > 0 ? (
                <>
                  距離夢想，還差 <b>{money(s.remaining)}</b>
                </>
              ) : (
                <>
                  做到了！這份努力，值得被記住 <Sparkles size={14} />
                </>
              )}
            </p>
          </div>
          <Ring value={s.percent} large={featured} />
        </div>
        <div className="quest-actions">
          <div>
            <span>建議每月儲蓄</span>
            <strong>
              {s.monthly === null ? '調整一下期限' : money(s.monthly)}
              <small>{s.monthly !== null ? ' / 月' : ''}</small>
            </strong>
          </div>
          <button
            className="button primary"
            onClick={() => setDialog({ type: 'deposit', goal })}
            disabled={!!loaded.error}
          >
            <Plus size={17} />
            存一筆，前進一步
          </button>
        </div>
        {!featured && (
          <div className="quest-tools">
            <span>
              {s.estimate
                ? `預計達標 ${s.estimate.replaceAll('-', '.')}`
                : '設定每月儲蓄後可估算日期'}
            </span>
            {goal.completedAt && (
              <button className="text-button" onClick={() => setCelebrations([goal])}>
                <Trophy size={14} />
                查看成就
              </button>
            )}
            <button
              className="icon-button danger"
              aria-label={`刪除${goal.name}`}
              onClick={() => setDialog({ type: 'delete', goal })}
            >
              <Trash2 size={15} />
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
              <Flag size={22} strokeWidth={2.4} />
            </span>
            <span>
              my finance<span className="brand-dot">.</span>
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
          <div className="header-profile">
            <button
              className="icon-button help-button"
              aria-label="使用說明"
              onClick={() => setDialog({ type: 'help' })}
            >
              <CircleHelp size={19} />
            </button>
            <span className="level-chip">
              <Star size={14} fill="currentColor" /> Lv. {progress.level}
            </span>
            <span className="avatar">我</span>
          </div>
        </div>
      </header>
      <main>
        <div className="welcome-bar">
          <span>
            <span className="status-dot" />
            自己的步調，就是最好的進度。
          </span>
          <span>{today().replaceAll('-', ' / ')}</span>
        </div>
        {storageError && (
          <div className="warning-banner" role="alert">
            <ShieldCheck size={20} />
            <span>{storageError}</span>
          </div>
        )}
        {page === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="little-line" /> A LITTLE PROGRESS, EVERY DAY
                </span>
                <h1>
                  把小小的存款，
                  <br />
                  存成
                  <span className="hero-highlight">
                    大大的成就
                    <svg viewBox="0 0 300 12" aria-hidden="true">
                      <path d="M3 8 Q140 -1 295 7" />
                    </svg>
                  </span>
                  <span className="hero-period">。</span>
                </h1>
                <p>
                  理財不用一口氣做到最好。
                  <br className="mobile-break" />
                  把每一次累積，變成下一關的底氣。
                </p>
              </div>
              <div className="hero-illustration" aria-hidden="true">
                <div className="art-orbit" />
                <span className="art-star one">✦</span>
                <span className="art-star two">✧</span>
                <span className="art-dot" />
                <div className="art-card back" />
                <div className="art-card front">
                  <span className="art-card-tag">
                    <span /> DREAM IN PROGRESS
                  </span>
                  <div className="art-mountain">
                    <Mountain size={78} strokeWidth={1.2} />
                    <Flag size={26} className="art-flag" />
                  </div>
                  <div className="art-mini-bar">
                    <i />
                  </div>
                  <span className="art-card-bottom">
                    ONE STEP CLOSER <ArrowUpRight size={15} />
                  </span>
                </div>
                <span className="floating-coin">
                  <Star size={26} fill="currentColor" />
                </span>
                <span className="floating-check">
                  <Check size={24} />
                </span>
                <span className="art-note">每一步，都算數。</span>
              </div>
            </section>
            <div className="adventure-grid">
              <section className="main-challenge">
                <SectionHeading
                  eyebrow="LET’S KEEP GOING"
                  title="今天，離夢想再近一點"
                  action={
                    data.goals.length > 1 ? (
                      <select
                        className="quest-select"
                        aria-label="選擇主要挑戰"
                        value={primary?.id}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {data.goals.map((g) => (
                          <option value={g.id} key={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button className="text-button" onClick={() => navigate('goals')}>
                        所有挑戰
                        <ArrowUpRight size={15} />
                      </button>
                    )
                  }
                />
                {primary ? (
                  renderQuest(primary, data.goals.indexOf(primary), true)
                ) : (
                  <div className="card new-quest-empty">
                    <Flag size={35} />
                    <h2>下一個夢想，從這裡出發</h2>
                    <p>設定一個小目標，開啟你的儲蓄冒險。</p>
                    <button className="button primary" onClick={() => setDialog({ type: 'goal' })}>
                      建立第一個挑戰
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </section>
              <aside className="player-card">
                <div className="player-heading">
                  <span className="eyebrow">YOUR ADVENTURE</span>
                  <Sparkles size={17} />
                </div>
                <div className="player-emblem">
                  <div>
                    <Sprout size={43} strokeWidth={1.6} />
                  </div>
                  <span>LV. {progress.level}</span>
                </div>
                <h2>
                  {progress.level === 1
                    ? '夢想萌芽者'
                    : progress.level < 4
                      ? '夢想探險家'
                      : '夢想實踐家'}
                </h2>
                <p>慢慢累積，也會閃閃發光。</p>
                <div className="xp-label">
                  <span>探索等級 {progress.level}</span>
                  <span>{progress.xp % 4} / 4 XP</span>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${progress.progress}%` }} />
                </div>
                <small>再走過 {progress.next} 個里程碑，解鎖下一級</small>
                <div className="player-stats">
                  <div>
                    <b>
                      {data.goals.filter((g) => !g.completedAt).length}
                      <small>個</small>
                    </b>
                    <span>進行中挑戰</span>
                  </div>
                  <div>
                    <b>
                      {progress.finished}
                      <small>個</small>
                    </b>
                    <span>已達成夢想</span>
                  </div>
                </div>
              </aside>
            </div>
            {primary && current && (
              <section className="map-section">
                <SectionHeading
                  eyebrow="YOUR SAVINGS JOURNEY"
                  title="每一站，都更接近想要的生活"
                  action={
                    <span className="map-tag">
                      <Map size={14} />
                      闖關地圖
                    </span>
                  }
                />
                <div className="journey-map">
                  <div className="journey-line" />
                  <div className="journey-stations">
                    {stages.map((stage, i) => {
                      const Icon = StageIcons[i],
                        done = current.percent >= stage.percent,
                        isCurrent = i === current.stage
                      return (
                        <button
                          key={stage.percent}
                          className={`station station-${i} ${done ? 'unlocked' : ''} ${isCurrent ? 'current' : ''}`}
                          onClick={() => setDialog({ type: 'stage', goal: primary, index: i })}
                          aria-label={`${stage.title} ${stage.percent}% ${done ? '已解鎖' : '未解鎖'}`}
                        >
                          <span className="station-bubble">
                            {Icon && <Icon size={i === 4 ? 29 : 25} strokeWidth={1.7} />}
                            <span className="station-marker">
                              {done ? <Check size={11} /> : <LockKeyhole size={10} />}
                            </span>
                          </span>
                          <strong>{stage.title}</strong>
                          <small>{stage.percent === 0 ? 'START' : `${stage.percent}%`}</small>
                          {isCurrent && <span className="you-are-here">你在這裡</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="next-step">
                  <span className="next-step-icon">
                    <Zap size={18} />
                  </span>
                  <p>
                    {current.percent >= 100 ? (
                      <>
                        全關卡達成！<b>為自己開啟下一個夢想吧。</b>
                      </>
                    ) : (
                      <>
                        下一站：{stages[nextStage].title}
                        <b>
                          再存{' '}
                          {money(
                            Math.max(
                              0,
                              Math.ceil(
                                (primary.target * stages[nextStage].percent) / 100 - primary.saved,
                              ),
                            ),
                          )}
                          ，解鎖新里程碑。
                        </b>
                      </>
                    )}
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      setDialog({
                        type: current.percent >= 100 ? 'goal' : 'deposit',
                        ...(current.percent >= 100 ? {} : { goal: primary }),
                      } as Dialog)
                    }
                  >
                    {current.percent >= 100 ? '新的挑戰' : '繼續前進'}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}
            <div className="bottom-grid">
              <section className="achievement-preview">
                <div className="achievement-icon">
                  <Trophy size={26} />
                </div>
                <div>
                  <span className="eyebrow">LITTLE WINS, BIG FEELINGS</span>
                  <h3>把努力，收藏成一枚成就</h3>
                  <p>
                    {completed.length
                      ? `你已經完成 ${completed.length} 個挑戰，每一次達成都值得紀念。`
                      : '第一枚成就正在等你。到達終點的那一刻，一定很棒。'}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="查看成就收藏"
                  onClick={() => setDialog({ type: 'history' })}
                >
                  <ArrowUpRight size={21} />
                </button>
              </section>
              <button className="planning-shortcut" onClick={() => navigate('planning')}>
                <span className="mini-icon">
                  <Settings2 size={23} />
                </span>
                <div>
                  <h3>給下一關，一個小計畫</h3>
                  <p>調整每月儲蓄，走出舒服的步調。</p>
                </div>
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="gentle-note">
              <Heart size={13} />
              不跟別人比，今天比昨天前進一點就好。
            </div>
          </>
        )}
        {page === 'goals' && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">MAKE ROOM FOR YOUR DREAMS</span>
                <h1>
                  我的儲蓄挑戰<span className="green-period">.</span>
                </h1>
                <p>每一個小目標，都值得認真期待。</p>
              </div>
              <button
                className="button primary"
                onClick={() => setDialog({ type: 'goal' })}
                disabled={!!loaded.error}
              >
                <Plus size={17} />
                新增挑戰
              </button>
            </div>
            <div className="goals-summary">
              <span>
                <Flag size={16} /> {data.goals.length} 個夢想正在路上
              </span>
              <button className="text-button" onClick={() => setDialog({ type: 'history' })}>
                <Trophy size={16} />
                成就收藏・{completed.length}
              </button>
            </div>
            <div className="goals-grid">{data.goals.map((g, i) => renderQuest(g, i))}</div>
            {!data.goals.length && <Empty>還沒有挑戰。從一個小小的夢想開始吧。</Empty>}
            <p className="footnote">
              每個挑戰的已存金額各自計算，請勿重複分配同一筆存款。預計日期假設每月儲蓄全部投入該挑戰；多個挑戰請自行安排每月分配。
            </p>
          </>
        )}
        {page === 'planning' && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">A PLAN FOR YOUR NEXT LEVEL</span>
                <h1>
                  下一關，準備好了嗎<span className="green-period">？</span>
                </h1>
                <p>不用急著到終點，先找到能持續的步調。</p>
              </div>
              <span className="page-symbol">
                <Settings2 size={29} />
              </span>
            </div>
            <Planning data={data} save={commit} />
          </>
        )}
        {page === 'health' && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">TAKE CARE OF YOUR JOURNEY</span>
                <h1>
                  走得穩，也是一種進步<span className="green-period">.</span>
                </h1>
                <p>用一點點時間，照顧你的理財節奏。</p>
              </div>
              <span className="page-symbol">
                <HeartPulse size={30} />
              </span>
            </div>
            <div className="health-banner">
              <span className="health-heart">
                <HeartPulse size={35} />
              </span>
              <div>
                <h2>這不是考試，是給自己的溫柔提醒。</h2>
                <p>依目前儲蓄挑戰與已儲存預算提供建議。</p>
              </div>
              <button className="text-button" onClick={() => navigate('planning')}>
                調整計畫
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="health-grid">
              {checkup(data).map((item, i) => (
                <section className="card health-item" key={item.title}>
                  <div>
                    <span className="health-number">0{i + 1}</span>
                    <span className={`badge ${item.status === '狀態不錯' ? 'good' : ''}`}>
                      {item.status}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.detail}</p>
                </section>
              ))}
            </div>
            <p className="footnote">
              這些是一般規劃參考，未包含你的完整資產、負債或銀行資料，不構成個別投資建議。所有報酬率均為假設，不保證報酬。
            </p>
          </>
        )}
        <footer>
          <span>
            <Flag size={14} /> my finance<span className="footer-dot">·</span>
            把日子，存成喜歡的樣子。
          </span>
          <span>
            <span className="status-dot" />
            資料只存在這個瀏覽器
          </span>
        </footer>
      </main>
      {dialog && (
        <Modal
          title={
            dialog.type === 'goal'
              ? dialog.goal
                ? '調整我的挑戰'
                : '開啟新的挑戰'
              : dialog.type === 'deposit'
                ? '今天，也往前一步'
                : dialog.type === 'delete'
                  ? '確定放下這個挑戰？'
                  : dialog.type === 'history'
                    ? '我的成就收藏'
                    : dialog.type === 'help'
                      ? '關於這趟儲蓄冒險'
                      : stages[dialog.index].title
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
                setNotice('挑戰已儲存，一起慢慢前進。')
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
                」與它的完成紀錄將被移除，不會操作你的實際存款。其他挑戰不受影響。
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
                      setNotice('挑戰已移除，隨時可以重新出發。')
                    } catch (e) {
                      setNotice(e instanceof Error ? e.message : '無法儲存')
                    }
                  }}
                >
                  刪除挑戰
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
                  <p>挑戰達成 100% 後，完成日期與金額會收藏在這裡。</p>
                </div>
              )}
            </div>
          ) : dialog.type === 'help' ? (
            <div className="help-content">
              <p>設定夢想、填入目前已存金額，再用「存一筆」記下新的累積。</p>
              <p>
                每個挑戰走過 25%、50%、75%、100% 時解鎖里程碑。每個里程碑提供 1 XP，每 4 XP
                升一級；進行中的進度下降時，等級會隨目前進度調整，已完成成就則保留。
              </p>
              <p>
                資料自動保存在這個瀏覽器，沒有後端或跨裝置同步。清除網站資料、更換瀏覽器或網址可能使進度無法讀取。
              </p>
              <p>理財規劃是預算與假設，不會替你移動存款或更新挑戰金額。</p>
            </div>
          ) : dialog.type === 'stage' ? (
            <StageDetail goal={dialog.goal} index={dialog.index} />
          ) : null}
        </Modal>
      )}
      {celebrations.length > 0 && !dialog && (
        <Modal title="新的成就，解鎖了！" close={closeCelebration}>
          <div className="celebration">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 32 }, (_, i) => (
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
            <h2>恭喜！儲蓄目標達成</h2>
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
        只是記錄這次的儲蓄，不會操作實際存款。若要直接修改累積總額，請使用挑戰右上角的編輯按鈕。
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
function StageDetail({ goal, index }: { goal: Quest; index: number }) {
  const stage = stages[index],
    Icon = StageIcons[index],
    needed = Math.max(0, Math.ceil((goal.target * stage.percent) / 100 - goal.saved)),
    unlocked = needed === 0
  return (
    <div className="stage-detail">
      <span className={`stage-detail-icon ${unlocked ? 'unlocked' : ''}`}>
        <Icon size={45} />
      </span>
      <span className="eyebrow">MILESTONE {String(index + 1).padStart(2, '0')}</span>
      <h3>{stage.subtitle}</h3>
      <p>{unlocked ? '這一站，你已經做到了。' : `再存 ${money(needed)} 就能走到這一站。`}</p>
      <span className="badge">
        {unlocked ? (
          <>
            <Check size={13} />
            已解鎖
          </>
        ) : (
          <>
            <LockKeyhole size={13} />
            完成 {stage.percent}% 解鎖
          </>
        )}
      </span>
    </div>
  )
}
