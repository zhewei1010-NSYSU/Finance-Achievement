# 小豬理財 PWA／Supabase 設定與驗收

## 已實作與資料遷移決策

原 React UI、帳務計算、儲蓄小豬、存款與投資基金保留。新增 App 圖示、standalone manifest、Apple Touch Icon、安全區、離線靜態介面及手動更新提示。離線快取只包含程式資源，不快取 Supabase API 或登入回應。

原 `my-finance-book.v3`、v1、v2 永不因登入而刪除或覆寫。登入後以使用者 UUID 建立獨立本機副本，雲端使用一人一份 JSONB 帳簿，保留所有原 ID、分類、交易、目標、封存與完成紀錄，避免逐表拆分改變原帳務語意。此版本適合個人帳簿，單份上限 5 MB；未提供多人共編或自動衝突合併。

**首次遷移必須由本人確認**：在原本有資料的瀏覽器及網址開啟 → 登入 → 下載原本機備份並檢查 JSON → 勾選同意 → 確認匯入。也可明確選擇全新零餘額帳簿。若帳號已有雲端資料，直接載入雲端，絕不自動用此裝置資料覆蓋。第一次遷移請只在一台裝置執行，其他裝置之後登入相同帳號。

備份含財務資料，請私下保存，不要提交 Git。備份是完整 Book JSON，並非加密檔；目前沒有一鍵還原／自動合併備份，請保留原瀏覽器資料，衝突時可依備份在 UI 逐筆核對、補登。若兩份既有帳簿都要合併，先停下遷移另行規劃，勿依序匯入覆蓋。

## 目前專案的公開連線設定

已依專案擁有者提供的資料，在 `src/lib/supabaseConfig.ts` 設定 Project URL 與 publishable key。這些是瀏覽器公開設定，不會繞過 RLS。此專案不必另填 GitHub Actions Variables 才能連線；若要切換專案，可同時設定下方兩個環境變數覆寫預設值。尚未完成真實連線／雙裝置驗收前，不代表雲端服務已驗證。

## 1. 手動設定 Supabase

1. 建立 Supabase 專案，保存資料庫密碼於自己的密碼管理器。
2. 開啟 SQL Editor，執行 `supabase/migrations/202610260001_finance_books.sql` **一次**。或以 Supabase CLI 的 migration 流程套用。此 migration 預期新資料表，重複執行會報已存在；不要刪表重跑。
3. 在 Database 確認 `finance_books` 已啟用 RLS，authenticated 只有自己的 SELECT 權限，不能直接 INSERT/UPDATE/DELETE。寫入只能經 `save_finance_book` RPC；函式以 `auth.uid()` 判定本人，無法指定別人的 UUID。
4. 在 Realtime／Publications 確認 `supabase_realtime` 含 `finance_books`（SQL 已加入）。不要關閉 RLS。
5. Authentication → Providers 啟用 Email/Password；建議啟用 Confirm email，正式使用設定自己的 SMTP 並檢查寄信頻率限制。此版本使用信箱＋密碼，不要求 OAuth provider。
6. Authentication → URL Configuration：Site URL 設為 `https://zhewei1010-nsysu.github.io/Finance-Achievement/`（若 Pages 顯示不同網址，以實際網址為準）。Redirect URLs 加入該完整網址；開發時另外加 `http://127.0.0.1:5173/`。不要允許任意網站萬用 redirect。
7. 在專案 Connect／API 設定取得 Project URL 與 **publishable key**（或舊版 anon public key）。絕不可使用 secret key、service_role 或資料庫密碼；Vite 的 `VITE_*` 值會公開出現在 JS。

本機把 `.env.example` 複製成 `.env.local`，填入：

```dotenv
VITE_SUPABASE_URL=https://你的專案.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的公開publishable-key
```

重啟開發伺服器；正式站必須重新建置。沒有設定時明確顯示本機模式，不會假裝已同步。網路政策若有限制，需允許該專案 hostname 的 HTTPS 與 WSS（Realtime）。

## 2. 開發與驗證

```bash
npm ci
npm test
npm run build
npm run dev -- --port 5173 --strictPort
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Node 24；開發根路徑 `/`，正式 build 預設 `/Finance-Achievement/`。PWA service worker 僅在正式 build 啟用，避免開發快取干擾。

正式離線檢查：`npm run preview -- --port 4174 --strictPort --base=/Finance-Achievement/`。瀏覽器先在線上完整開啟 `/Finance-Achievement/` 並等待 service worker 控制頁面，重新載入一次，再切離線重新載入。應仍顯示小豬介面與離線提示。未曾載入的裝置無法憑空離線安裝。

## 3. GitHub Pages 發布

1. GitHub Repository → Settings → Secrets and variables → Actions → **Variables** 建立 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`，填上上述公開設定。不要放 service_role。
2. Settings → Pages → Source 選 GitHub Actions。
3. 將本次程式變更提交並推送到 main，再 Actions → Deploy GitHub Pages → Run workflow。
4. 流程使用 Node 24、`npm ci`、單元測試、`--base=/Finance-Achievement/` 建置、上傳 dist 並部署。推送不會自動部署。
5. 從成功的 deployment 查看正式網址。檢查 `manifest.webmanifest`、`sw.js`、三個 PNG 皆回傳 200。manifest start_url/scope 應解析至 `/Finance-Achievement/`，不能落到帳號根目錄。

若儲存庫更名，需同時修改 Vite base、workflow build base、Supabase redirect URLs 及此教學。前端公開程式碼不包含私人帳簿；個人資料儲存在 Supabase 與使用者瀏覽器。GitHub Pages 並不是私人後端。

## 4. iPhone 實機驗收（需要手動）

1. 在 iPhone Safari 開啟正式 HTTPS 網址，等首次載入完成。
2. 分享 → 加入主畫面 → 加入。由主畫面開啟，確認小豬圖示、獨立視窗、橫直向、瀏海與底部 Home 指示條不遮住操作。
3. Safari 與主畫面 App 可能使用不同儲存狀態。原資料先在 Safari 完成匯入，再在 App 登入同帳號；不可假設 localStorage 自動共用。
4. 測試手機新增收入／存款、編輯、刪除、基金轉帳及 Modal 捲動、鍵盤、按鈕觸控。
5. 飛航模式重新開啟已快取的 App；應看得到離線提示與本機資料。離線編輯應顯示尚未同步。重新連線後按重試同步，等待「已確認與雲端同步」。iOS 可能清除網站儲存，不保證永遠離線保存；重要待同步資料請下載備份。沒有背景同步保證，App 必須開著才能上傳。

## 5. 雙裝置與安全性驗收（需要真實專案）

- 電腦與手機登入同帳號 A，僅首次在原裝置匯入。電腦新增一筆收入，手機確認出現；手機編輯或刪除，電腦確認更新。Realtime 推送觸發重抓；另有 15 秒輪詢及回到前景／恢復連線補查。
- 飛航模式編輯後確認狀態不是已同步；恢復連線確認只增加一次。重複點擊／回應中斷時使用同一 mutation UUID 重試，版本 CAS 不允許舊版本再次寫入，不會重複記帳。
- 兩裝置從同一版本同時離線編輯，各自連線：先上傳者成功，另一台顯示衝突、暫停編輯並保留待同步資料。下載備份且檢查檔案後，可明確選擇改用雲端版本，再手動核對補登。禁止自動最後寫入覆蓋。
- 建立帳號 B，確認 B 看不到 A 的帳簿。用 B 的 authenticated JWT 查 A 的 user_id 應回空陣列；anon 不可讀；直接寫 table 應拒絕；RPC 只更新 B。請用公開 key＋一般使用者 JWT 測試，不能用會繞過 RLS 的 SQL Editor 管理員或 service_role 當作隔離證據。
- 登出、切換帳號、重新登入：雲端副本依 UUID 隔離，不寫回原本機帳簿。登出不刪本機副本，因此不要使用共用裝置。Auth token 由 Supabase SDK 維護；本機資料與 token 都不是加密保險箱。

## 本次驗證範圍

自動測試涵蓋既有帳務、同步副本、失敗重試與版本衝突；正式 PWA 可在 Chromium 驗證。沒有真實 Supabase 設定、GitHub 發布權限及 iPhone 實機時，不宣稱已部署或已完成真實雙裝置／iOS 驗收。發布前務必完成以上手動步驟。

## 手機登入與保持登入

登入入口在頁首「登入」按鈕，使用可捲動的彈出視窗；支援顯示密碼、密碼管理器填入，以及登入／註冊切換。個人裝置會保存 Supabase session，SDK 自動使用 refresh token 續期，重新開啟同一瀏覽器與同一網站時恢復登入。程式不另外保存明文密碼。

這不是永久有效的登入：手動登出、清除網站資料、無痕模式結束、瀏覽器清理儲存空間，或 Supabase 管理員撤銷 session／限制 session 時間，都可能要求再次登入。Safari 與加入主畫面的 App 不保證共用 session。若想長期登入，請勿清除網站資料；Supabase 若有設定 session time-box 或 inactivity timeout，需要專案管理員確認其設定，前端不能越過伺服器期限。

自動化測試使用模擬 Auth 回應，驗證手機入口、密碼顯示、重新載入、以保存的瀏覽器狀態重新開啟、自動更新過期憑證，以及明確登出後不恢復登入；不會建立真實帳號或修改現有財務資料。
