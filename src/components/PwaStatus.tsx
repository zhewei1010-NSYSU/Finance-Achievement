import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined
let updateWaiting = false
function startWorker() {
  if (applyUpdate) return
  applyUpdate = registerSW({
    onNeedRefresh() {
      updateWaiting = true
      window.dispatchEvent(new Event('pwa-update'))
    },
    onRegisterError() {
      console.warn('離線快取尚未就緒，請連線後重新開啟網站。')
    },
  })
}
export default function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [update, setUpdate] = useState(updateWaiting)
  const [showInstall, setShowInstall] = useState(false)
  useEffect(() => {
    startWorker()
    const network = () => setOnline(navigator.onLine)
    const changed = () => setUpdate(true)
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    window.addEventListener('pwa-update', changed)
    return () => {
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
      window.removeEventListener('pwa-update', changed)
    }
  }, [])
  return (
    <aside className="pwa-status" aria-label="App 安裝與連線狀態">
      {!online && (
        <p role="status">
          目前離線：可讀取已快取的介面。本機新增／修改尚未同步雲端；請勿清除網站資料。
        </p>
      )}
      <button aria-expanded={showInstall} onClick={() => setShowInstall((v) => !v)}>
        加入 iPhone 主畫面
      </button>
      {showInstall && (
        <p>
          在 iPhone Safari
          開啟本站，點「分享」→「加入主畫面」→「加入」。從主畫面圖示開啟即可使用獨立 App
          模式。首次請在線上完整開啟一次，以準備離線介面。Safari 與主畫面 App
          的儲存狀態可能不同，請登入同一帳號確認同步。
        </p>
      )}
      {update && (
        <div role="status">
          有新版本可用；請先儲存表單並確認同步狀態。
          <button
            onClick={() => {
              if (
                window.confirm(
                  '更新會重新載入頁面；未儲存的表單會遺失。本機已儲存的待同步資料會保留。確定更新？',
                )
              )
                void applyUpdate?.(true)
            }}
          >
            重新載入更新
          </button>
        </div>
      )}
    </aside>
  )
}
