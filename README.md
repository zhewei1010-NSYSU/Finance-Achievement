# My Savings｜個人儲蓄目標儀表板

白底、留白多、以小豬撲滿與圓形進度環為中心的繁體中文儲蓄目標網站。使用 React、TypeScript、Vite、Tailwind CSS、Lucide 開源圖示與 Zod；不含投資分析、風險評分、財務健檢、收支記帳、帳戶管理或備份介面。

沒有後端、登入、銀行 API、雲端資料庫或分析追蹤。資料只存在目前瀏覽器。

## 使用方式

1. 首頁直接查看目前儲蓄目標的小豬圓環與大百分比。多個目標可以用上方選單切換。
2. **存一筆**：輸入這次新存入的金額，系統將它加到累積金額；不會操作實際存款。
3. **調整目標**：修改名稱、目前已存、目標金額與日期；也可按右上角的 ⋯ 編輯。
4. **我的目標 → 新增目標**：建立更多目標，每個目標金額獨立計算，同一筆存款請勿重複填入。
5. 首次達成 100% 會顯示適量彩帶、完成日期與金額。重新開啟不會強制重播，可在 **完成紀錄** 重看。

預設目標為 2026/12/31 前存到 NT$40,000，目前 NT$10,000，完成 25%；這是可修改的起始示例。

### 圓環與百分比

- 中央為簡潔線條的小豬撲滿 icon，下方大字顯示百分比。
- 0–30% 為淡綠、超過 30% 至 80% 為綠色、超過 80% 為較飽和的成功綠色。
- 金額更新後，百分比與圓弧在 800 毫秒內平滑變化。首次載入直接顯示實際進度，不從零開始假造增長。
- 超過 80% 時顯示「快達標了！離目標只差一點點！」；100% 顯示「恭喜！儲蓄目標達成！」。
- 圓環下方列出目前已存、目標金額、尚差金額、達成百分比及目標日期。
- 完成度＝已存 ÷ 目標，最高顯示 100%；百分比顯示採向下取整，避免未達標時提前顯示 100%。已存可超過目標，尚差最低為零。
- 作業系統或瀏覽器啟用「減少動態效果」時，數字與圓弧直接更新，彩帶停止。
- 完成後調低金額仍保留原完成紀錄；刪除目標會移除該目標的紀錄。

## 舊版資料如何保留

儲存格式升級為 `my-finance-quests.v2`。第一次開啟新版時，會從 `my-finance-dashboard.v1` 帶入儲蓄目標、餘額與原有完成紀錄（舊規劃欄位保留於格式內供相容，不顯示分析介面）；**舊版 key 原文不會被刪除或覆寫**。舊版的非目標帳戶與交易仍留在舊版資料裡，新版不提供管理入口，也不顯示分析介面。

如果舊版多個目標曾共用同一帳戶，為避免重複計算，帶入新版時會依各目標金額比例分配原本餘額；分配後總額與原帳戶餘額一致，完成紀錄仍保留原金額與日期。

新版不再提供 JSON 匯入、匯出或備份頁面。請留意：

- 資料只存在相同瀏覽器、設定檔與網址來源，沒有跨裝置同步，也未加密。
- 清除網站資料、結束無痕模式、更換瀏覽器或網址可能使進度遺失。新開另一台裝置不會自動讀到你的進度。
- 請一次只在一個分頁編輯，尚未提供多分頁衝突保護。
- 資料損毀時會停止寫入以保護原始內容，不靜默清空；請勿直接清除瀏覽器資料。
- 儲存空間不足時，這次操作不會套用，會顯示錯誤；先前進度保留。
- 網站公開不會公開你瀏覽器裡的財務資料，但任何能使用同一瀏覽器的人都可能讀到資料，請使用可信任的個人裝置。

## Windows 新手安裝與開啟

### 1. 安裝 Node.js

從 [Node.js 官方網站](https://nodejs.org/) 安裝 **Node.js 24 LTS**（包含 npm），完成後重開 PowerShell：

```powershell
node --version
npm.cmd --version
```

應顯示版本號。本版本以 Node 24 驗證，也支援 Node 22.12 以上。

### 2. 取得程式碼

可在 GitHub 按 **Code → Download ZIP**，解壓縮後進入包含 `package.json` 的資料夾。在檔案總管網址列輸入 `powershell`，按 Enter。

也可安裝 [Git for Windows](https://git-scm.com/downloads/win)，再執行：

```powershell
cd "$HOME\Documents"
git clone https://github.com/zhewei1010-NSYSU/Finance-Achievement.git
cd Finance-Achievement
```

### 3. 安裝依賴

```powershell
npm.cmd ci
```

第一次及更新依賴後需要安裝；保留 `package-lock.json`。安裝需要網路，日常使用不連接任何銀行或資料服務。

### 4. 啟動網站

```powershell
npm.cmd run dev -- --port 5173 --strictPort
```

在自己的電腦瀏覽器輸入 `http://127.0.0.1:5173`。終端機要保持開啟，停止時按 `Ctrl+C`。

- 下次使用只要切到專案資料夾再執行啟動命令。
- 請保持相同網址，`localhost` 和 `127.0.0.1` 的本機資料不共用。
- `--strictPort` 避免連接埠被占用時自動換網址；若提示占用，先關閉舊伺服器。
- `npm.cmd` 可避開 PowerShell 對 `npm.ps1` 的限制，不必關閉系統安全政策。
- 若出現 `ENOENT package.json`，請先用 `cd` 進入正確資料夾。
- 更新依賴前先停止開發伺服器。如出現 `Outdated Optimize Dep`，停止後用 `npm.cmd run dev -- --port 5173 --strictPort --force` 重啟。
- 本機伺服器只綁定 loopback，不開放外網或區網；手機版可用桌面開發者工具切換尺寸預覽。

## GitHub Pages

`.github/workflows/pages.yml` 提供手動部署，**推送不會自動發布**。它會使用鎖定依賴、執行測試、以 `/Finance-Achievement/` 路徑建置，僅上傳 `dist/`。官方 Actions 已固定 commit SHA，不需另存部署金鑰。

1. 到儲存庫 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
2. 到 **Actions → Deploy GitHub Pages → Run workflow**，分支選 `main`，再執行。
3. 等 `build` 與 `deploy` 都成功後，從該次執行的 `github-pages` environment 開啟實際網址。
4. 每次想更新線上版本，重新執行這個流程。停用請用 Settings → Pages 的 Unpublish site。

公開儲存庫可使用免費 Pages；私人儲存庫是否支援以 GitHub 方案為準。[官方說明](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)

Pages 網站沒有登入保護，前端 JavaScript 也會送到訪客瀏覽器；請勿把密碼、金鑰或真實財務檔案寫入程式碼。網站搬到另一個網址來源時，本機資料不會自動移轉。

同一個 Pages 網址更新新版後，舊版儲蓄目標會在**原瀏覽器**自動帶入，無需清除網站資料；若暫時看到舊版，先重新整理快取，不要清除 localStorage。

## 開發與驗證

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run format:check
npm.cmd audit
```

正式產物本機預覽：

```powershell
npm.cmd run preview -- --port 4173 --strictPort
```

預覽的連接埠不同，本機資料也不同。不要直接雙擊 `dist/index.html`。

瀏覽器測試：

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Linux 已有 Chromium 時也可用：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

測試使用獨立瀏覽器情境及示例資料，包含兩個頁面、中央小豬、完整目標資訊、存款更新、目標編輯、三段色階、動畫中間值與減少動態設定、完成慶祝與重開不重播、舊版資料帶入、資料損毀與儲存失敗保護，以及 320px、360px、390px、768px、桌面版面。截圖與 trace 在 `artifacts/`、`test-results/`，不提交 Git。

`src/lib/quests.test.ts` 驗證格式相容、資料驗證、日期及資料帶入（保留舊版計算測試）；`src/lib/finance.test.ts` 保留舊版格式與財務計算相容性測試。測試使用 Chromium／Linux，尚未包含 Windows 真機、Safari 或 Firefox。

## 專案結構

```text
src/
├── App.tsx                 # 儲蓄首頁、目標管理、完成紀錄及儲存流程
├── components/
│   ├── Forms.tsx           # 挑戰表單
│   └── UI.tsx              # 對話框、欄位、小豬圓環與數字動畫
├── lib/
│   ├── quests.ts           # 儲存格式、舊版轉換與相容工具
│   ├── quests.test.ts
│   ├── finance.ts          # 共用格式／計算及舊版相容
│   └── finance.test.ts
├── main.tsx
└── style.css               # 白底、柔和綠色、極簡儲蓄儀表板與響應式設計
```

請不要提交真實財務資料、密碼或 API 金鑰。`.gitignore` 排除依賴、建置、測試產物、`.env` 及舊版備份檔名，但任意改名的敏感檔案仍需自行避免加入 Git。
