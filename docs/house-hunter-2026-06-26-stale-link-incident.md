# 房子獵人 2026-06-26 失效 591 連結事件紀錄

## 問題

使用者回報前端點開 591 連結後，591 顯示「物件不存在，可能已關閉或者被刪除」。

截圖中的失效連結：

- `https://rent.591.com.tw/21509610`

## 判斷

本機 `src/data/listings.js` 已是較新的資料：

- `updatedAt`: `2026-06-26 02:15`
- 總筆數：`1359`
- 新上架：`693`
- 最低價：`NT$3,200`
- `21509610`: 本機資料中已不存在

但 GitHub Pages live bundle 仍是舊資料，檢查結果：

- live asset 仍含 `21509610`
- live asset 仍含 `2026-06-25 02:50`
- live asset 不含 `2026-06-26 02:15`

結論：這次主要不是 scraper 沒移除該物件，而是新的 `src/data/listings.js` 尚未 commit / push / deploy，導致前端仍載入舊 bundle。

## 本次處理規則

1. 確認本機資料已移除失效連結。
2. 執行 `npm test`、`npm run build`、`npm audit --json`。
3. commit 並 push `src/data/listings.js`。
4. 等 GitHub Actions Pages deploy 成功。
5. 重新抓 live HTML 與 live JS asset，確認：
   - 不含 `21509610`
   - 含最新 `updatedAt`

## 下次更新前必讀

每次房子獵人操作前先讀：

- `docs/house-hunter-runbook.md`

每次更新後不能只看本機，也必須驗證 live 網站：

- `https://iu-sys.github.io/house-hunter-tw/`

若 live 網站時間仍落後，優先檢查：

- `src/data/listings.js` 是否已 commit
- 是否 push 到 `origin/main`
- `.github/workflows/deploy-pages.yml` 是否成功
- live HTML 指向的 `assets/*.js` 是否含最新 `updatedAt`

