import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import App from '../App'
import { CloudBookStore, cloudAPI, supabase } from '../lib/cloud'
import { emptyBook, loadBook } from '../lib/ledger'
import type { Book } from '../lib/ledger'
import { Modal } from './UI'
import { UserRound, Eye, EyeOff } from 'lucide-react'

export function downloadBook(book: Book, label: string) {
  const blob = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `finance-backup-${label}-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function SignedIn({ user }: { user: User }) {
  const [store] = useState(() => {
    try {
      return new CloudBookStore(user.id, cloudAPI(user.id))
    } catch {
      return null
    }
  })
  const [, render] = useState(0)
  const [version, setVersion] = useState(0)
  const [checked, setChecked] = useState(false)
  const [backedUp, setBackedUp] = useState(false)
  const [message, setMessage] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [busy, setBusy] = useState(false)
  const storage = useMemo(() => store?.storage, [store])
  useEffect(() => {
    if (!store) return
    let active = true
    store.onChange = () => {
      if (active) render((v) => v + 1)
    }
    store.onRemote = () => {
      if (active) setVersion((v) => v + 1)
    }
    void store.sync().then(() => {
      if (active) setInitialized(true)
    })
    const sync = () => {
      void store.sync()
    }
    const storageChanged = (event: StorageEvent) => {
      if (event.key === store.key) {
        store.blocked = true
        store.status = '另一分頁已更新帳簿；此頁暫停編輯，請重新整理。'
        store.onChange()
      }
    }
    const channel = supabase!
      .channel(`book:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance_books', filter: `user_id=eq.${user.id}` },
        sync,
      )
      .subscribe()
    const timer = setInterval(sync, 15000)
    window.addEventListener('online', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('storage', storageChanged)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('online', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('storage', storageChanged)
      void supabase!.removeChannel(channel)
      // Stop writes immediately on unmount; StrictMode is intentionally not wrapping this workspace.
      store.stop()
    }
  }, [store, user.id])
  async function action(run: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await run()
    } catch {
      setMessage('操作失敗，請保留本機資料，檢查連線或稍後重試。')
    } finally {
      setBusy(false)
    }
  }
  const legacy = loadBook()
  return (
    <>
      <section className="cloud-panel" aria-label="雲端帳簿">
        <b>雲端帳簿 · {user.email}</b>
        <p role="status" aria-live="polite">
          {store?.status ?? '本機雲端副本無法讀取，已停止編輯；請勿清除網站資料。'}
        </p>
        <p className="cloud-hint">
          僅「已確認與雲端同步」代表上傳已確認。離線變更只在此裝置；登出後仍保留此帳號的本機副本，請使用私人裝置。
        </p>
        {message && <p role="alert">{message}</p>}
        <div className="cloud-actions">
          <button disabled={busy || !store} onClick={() => void action(() => store!.sync())}>
            重試同步
          </button>
          {store?.draft && (
            <button
              onClick={() => {
                downloadBook(store.draft!.book, 'cloud-pending')
                setBackedUp(true)
              }}
            >
              下載本機帳簿備份
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => {
              if (
                store?.draft?.dirty &&
                !window.confirm(
                  '仍有尚未同步的資料。登出後此裝置仍保留副本，下次登入同帳號才能重試。確定登出？',
                )
              )
                return
              void action(async () => {
                const { error } = await supabase!.auth.signOut({ scope: 'local' })
                if (error) throw error
              })
            }}
          >
            登出
          </button>
        </div>
        {store?.conflict && (
          <div className="migration-box">
            <p>
              不會自動合併或覆蓋。先下載備份並確認檔案已保存；改用雲端版本會捨棄此裝置的待同步變更，可依備份逐筆重新登記。
            </p>
            <button
              disabled={!backedUp || busy}
              onClick={() => {
                if (window.confirm('已確認備份可讀取？改用雲端版本後，待同步變更不會自動合併。'))
                  void action(() => store.useCloud())
              }}
            >
              已備份，改用雲端版本
            </button>
          </div>
        )}
        {initialized && store && !store.draft && (
          <div className="migration-box">
            <h2>第一次使用雲端帳簿</h2>
            <p>
              先下載原本機帳簿。只有你確認後才會複製到目前登入帳號；原 localStorage
              與舊版資料都保留。若雲端已有資料，不會用本機內容覆蓋。
            </p>
            {legacy.error ? (
              <p role="alert">{legacy.error}</p>
            ) : (
              <>
                <button
                  onClick={() => {
                    downloadBook(legacy.book, 'local-before-migration')
                    setBackedUp(true)
                  }}
                >
                  下載原本機資料備份
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  我已確認備份，並同意將此裝置的帳簿複製到此帳號
                </label>
                <button
                  disabled={busy || !backedUp || !checked}
                  onClick={() => void action(() => store.create(legacy.book))}
                >
                  確認匯入原本機帳簿
                </button>
              </>
            )}
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm('建立全新零餘額雲端帳簿？此裝置原本機資料會保留。'))
                  void action(() => store.create(emptyBook()))
              }}
            >
              改用全新空帳簿
            </button>
          </div>
        )}
      </section>
      {store?.draft && storage ? (
        <App key={version} storage={storage} />
      ) : (
        <p className="cloud-panel">雲端帳簿準備完成後，會顯示原本的理財介面。</p>
      )}
    </>
  )
}

export default function CloudWorkspace() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [signup, setSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const closeLogin = useCallback(() => {
    setShowLogin(false)
    setPassword('')
    setShowPassword(false)
  }, [])
  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setMessage('無法確認登入狀態，請重新登入。')
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  async function authenticate() {
    if (busy || !supabase) return
    setBusy(true)
    setMessage('')
    try {
      const result = signup
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: new URL(import.meta.env.BASE_URL, location.origin).href,
            },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      setPassword('')
      setMessage(signup ? '註冊已送出，請至信箱確認，再回到本站登入。' : '登入成功。')
      if (signup) setSignup(false)
    } catch {
      setMessage('登入／註冊失敗，請確認信箱、密碼、確認信與網路；也可能超過寄信頻率限制。')
    } finally {
      setBusy(false)
    }
  }
  if (loading)
    return (
      <p className="cloud-panel" role="status">
        正在確認登入狀態…
      </p>
    )
  if (user) return <SignedIn key={user.id} user={user} />
  return (
    <>
      <App
        accountAction={
          supabase ? (
            <button
              className="account-login"
              onClick={() => {
                setMessage('')
                setShowLogin(true)
              }}
            >
              <UserRound size={18} />
              <span>登入</span>
            </button>
          ) : undefined
        }
      />
      {showLogin && (
        <Modal title={signup ? '建立理財帳號' : '歡迎回來'} close={closeLogin}>
          <div className="auth-content">
            <p className="auth-intro">登入後，手機與電腦就能共用你的理財帳簿。</p>
            <div className="auth-tabs" role="group" aria-label="登入或註冊">
              <button
                type="button"
                aria-pressed={!signup}
                disabled={busy}
                onClick={() => {
                  setSignup(false)
                  setMessage('')
                }}
              >
                登入
              </button>
              <button
                type="button"
                aria-pressed={signup}
                disabled={busy}
                onClick={() => {
                  setSignup(true)
                  setMessage('')
                }}
              >
                建立帳號
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void authenticate()
              }}
              aria-busy={busy}
            >
              <label htmlFor="auth-email">電子郵件</label>
              <input
                id="auth-email"
                name="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                type="email"
                required
                disabled={busy}
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="auth-password">密碼</label>
              <div className="auth-password">
                <input
                  id="auth-password"
                  name="password"
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  type={showPassword ? 'text' : 'password'}
                  minLength={signup ? 8 : undefined}
                  required
                  disabled={busy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {signup && <p className="auth-hint">密碼至少 8 個字元；註冊後請到信箱點確認信。</p>}
              {message && (
                <p className="auth-message" role="status">
                  {message}
                </p>
              )}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? '處理中…' : signup ? '建立帳號' : '登入並同步帳簿'}
              </button>
            </form>
            <p className="auth-hint">
              此裝置會保持登入，下次開啟不必再輸入密碼。請使用自己的裝置，使用完也可手動登出。
            </p>
            <p className="auth-hint">尚未登入時，原本機帳簿仍保留；登入不會自動覆蓋或匯入資料。</p>
          </div>
        </Modal>
      )}
    </>
  )
}
