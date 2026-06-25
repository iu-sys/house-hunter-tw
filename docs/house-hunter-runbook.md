# 房子獵人操作紀錄與必讀流程

> 下次任何人或自動化在操作房子獵人之前，請先讀這份文件。

這份文件記錄 2026-06-25 這次更新遇到的問題，以及之後更新資料、測試、部署時必須遵守的流程。

## 專案位置與線上站

- 本地專案：`C:\Users\USER\Documents\房子獵人`
- Git remote：`https://github.com/iu-sys/house-hunter-tw.git`
- 線上站：`https://iu-sys.github.io/house-hunter-tw/`
- 部署方式：GitHub Pages
- 部署 workflow：`.github/workflows/deploy-pages.yml`
- 觸發方式：push 到 `main`

## 2026-06-25 狀況摘要

這次原本已經在本地成功更新資料與 build，但線上站仍顯示舊資料：

- 舊線上顯示：`2026-06-14 19:38`
- 舊統計：`556 / 472 / NT$2,000`
- 本地新資料：`2026-06-25 02:50`
- 本地新統計：`1381 / 684 / NT$3,000`

根因不是前端讀錯資料，而是 GitHub Pages 部署沒有成功完成。

## 這次修正過的問題

### 抓取與過濾

`scripts/update-data.mjs` 已補強排除條件：

- 女性限定
- 單人限定
- 雅房
- 車位 / 停車
- 倉庫
- 店面
- 已出租 / 已收訂
- 明顯不是出租房源的戶籍或學區類貼文

### 重用舊詳情資料

`scripts/update-data-utils.mjs` 已修正重用舊 591 詳情資料時遺失 `isMaleAllowed` 的問題。

如果沒有保留這個欄位，後續流程會把可租給男性的舊資料誤判掉，造成 fresh scrape 筆數異常下降。

### build 產物驗證

新增：

- `scripts/verify-dist-updated.mjs`
- `scripts/verify-dist-updated.test.js`

`npm run build` 現在會在 `vite build` 後檢查 `dist/assets/*.js` 是否包含目前 `src/data/listings.js` 的 `updatedAt`。

如果 build 產物沒有吃到最新資料，build 會直接失敗。

## 這次部署失敗原因

第一次 push 的 commit：

- `96fa117`
- `fix: refresh rental data and verify built frontend timestamp`

GitHub Actions run：

- `Deploy GitHub Pages #24`
- 結果：failure
- 失敗步驟：`Install dependencies`

原因：

`package.json` 有變更，但 `package-lock.json` 沒有一起 commit。GitHub Actions 使用 `npm ci`，所以 lockfile 不同步時會直接失敗，後續 test、build、deploy 都不會跑。

第二次修正 commit：

- `82d1cb0`
- `fix: sync lockfile for pages deployment`

GitHub Actions run：

- `Deploy GitHub Pages #25`
- `build` job：success
- `deploy` job：success

## 下次每日更新流程

下次操作前先讀本文件，然後照順序執行：

1. 讀 `docs/house-hunter-runbook.md`
2. 讀自動化記憶：`$CODEX_HOME/automations/automation/memory.md`
3. 執行資料更新：`npm run update:data`
4. 檢查 `src/data/listings.js` 的 `updatedAt`、總數、新上架數、最低價
5. 執行 `npm test`
6. 執行 `npm run build`
7. 執行 `npm audit --json`
8. 確認 `git status --short`，不要漏掉 `package-lock.json`
9. commit 必要變更
10. push 到 `origin/main`
11. 查 GitHub Actions 最新 run 是否完成
12. 確認 GitHub Pages 線上站已顯示最新 `updatedAt`

## 必須確認的部署檢查

push 之後不要只看 git push 成功。必須確認 GitHub Pages workflow 成功。

可查：

```powershell
$ProgressPreference='SilentlyContinue'
Invoke-RestMethod -Uri 'https://api.github.com/repos/iu-sys/house-hunter-tw/actions/runs?per_page=3' |
  Select-Object -ExpandProperty workflow_runs |
  Select-Object id,run_number,head_sha,status,conclusion,html_url,created_at,updated_at
```

如果最新 run 是 `failure`，再查 jobs：

```powershell
$ProgressPreference='SilentlyContinue'
Invoke-RestMethod -Uri 'https://api.github.com/repos/iu-sys/house-hunter-tw/actions/runs/<RUN_ID>/jobs'
```

## 線上站仍顯示舊資料時

先判斷是哪一層出問題：

- `src/data/listings.js` 是否已更新
- `npm run build` 是否通過並驗證 `dist` 有最新 `updatedAt`
- GitHub Actions 最新 run 是否成功
- GitHub Pages deploy job 是否成功
- 使用 cache-bust URL 是否看到新版

cache-bust URL 格式：

```text
https://iu-sys.github.io/house-hunter-tw/?v=<commit-sha>
```

如果 workflow 成功但瀏覽器仍舊，通常是瀏覽器快取。使用無痕視窗或 cache-bust URL 驗證。

## 注意事項

- `dist/` 被 `.gitignore` 忽略，線上站不是靠 commit `dist` 更新。
- GitHub Pages 會在 CI 裡重新執行 `npm ci`、`npm test`、`npm run build`。
- `package.json` 有任何依賴或 script 變更時，要檢查 `package-lock.json` 是否也需要 commit。
- 不要只回報本地 build 成功，必須確認 GitHub Pages workflow 成功。
- 本專案仍有 Vite chunk size warning，目前不是阻塞部署的錯誤。

## 相關紀錄

- 詳細事件摘要：`docs/house-hunter-2026-06-25-summary.md`
- 更新計畫紀錄：`docs/superpowers/plans/2026-06-24-rental-listings-refresh.md`
