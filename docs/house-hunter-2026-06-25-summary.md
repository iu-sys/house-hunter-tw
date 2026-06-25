# 房子獵人 2026-06-25 更新摘要

## 這次處理了什麼

這次主要處理三件事：

1. 更新雙北租屋資料到最新一批結果
2. 修正抓資料流程中的過濾與重用邏輯
3. 釐清「本地已更新，但前端看起來還停在 2026-06-14」的真正原因，並完成正確部署

## 資料更新結果

- `src/data/listings.js` 已更新
- `updatedAt`：`2026-06-25 02:50`
- 總筆數：`1381`
- 新上架：`684`
- 最低價：`NT$3,000`
- PTT 3 天內保留文章：`1`

### 各區筆數

- 中和區 214
- 板橋區 191
- 三重區 176
- 中山區 95
- 士林區 77
- 萬華區 68
- 內湖區 67
- 永和區 66
- 新店區 60
- 文山區 53
- 信義區 53
- 大安區 51
- 大同區 43
- 中正區 37
- 北投區 37
- 南港區 35
- 土城區 29
- 松山區 29

## 修過的問題

### 1. 抓取排除條件不夠完整

更新 `scripts/update-data.mjs`，補強以下排除條件：

- 女性限定
- 單人限定
- 雅房
- 車位 / 停車
- 倉庫
- 店面
- 已出租 / 已收訂

另外也補了明顯不是房源、而是行政用途或戶籍學區類貼文的排除邏輯。

### 2. 重用舊資料時會誤丟正常房源

在 `scripts/update-data-utils.mjs` 中，原本重用舊詳情資料時沒有保留 `isMaleAllowed`，導致後續流程把本來合法的房源誤判掉。

這次已修正：

- 重用舊詳情時會保留 `isMaleAllowed`
- 並補上對應測試

### 3. 測試檔編碼混亂

`scripts/update-data-utils.test.js` 有亂碼與可維護性問題，這次已重寫成乾淨可讀版本，避免之後修 scraper 時再被測試檔卡住。

## 為什麼你會看到前端還停在 2026-06-14

這次最關鍵的誤判點是：

- 本地 `src/data/listings.js` 其實已經是新的
- 本地 `npm run build` 產生的 `dist` 也已經是新的
- 但你看到的 GitHub Pages 網站仍是舊部署，所以畫面顯示 `2026-06-14 19:38`

也就是說，問題不是「前端沒更新」，而是：

**本地更新完成了，但線上站還沒重新部署到最新 commit。**

## 如何確認這件事

已確認：

- 本地 repo remote：`https://github.com/iu-sys/house-hunter-tw.git`
- 線上站：`https://iu-sys.github.io/house-hunter-tw/`
- 部署方式：GitHub Pages
- workflow：`.github/workflows/deploy-pages.yml`
- 觸發條件：`push` 到 `main`

## 這次補上的保護機制

為了避免以後再發生「資料檔更新了，但 build 出來的前端其實不是最新資料」這種問題，新增了：

- `scripts/verify-dist-updated.mjs`
- `scripts/verify-dist-updated.test.js`

並修改 `package.json`：

- `npm run build` 現在除了 `vite build` 之外
- 還會額外驗證 `dist/assets/*.js` 內是否真的包含最新 `updatedAt`

如果 build 產物沒有吃到最新資料，build 會直接失敗，不再默默產生舊版前端。

## 這次最後怎麼上線

原本一度誤以為是 Netlify，但最後確認真正的部署來源是 GitHub Pages。

因此最後採取的正確做法是：

1. 將本地修正與最新資料 commit 到 `main`
2. push 到 `origin/main`
3. 讓 GitHub Actions 自動執行 `Deploy GitHub Pages`

### 本次部署 commit

- Commit: `96fa117`
- Message: `fix: refresh rental data and verify built frontend timestamp`

## 目前 repo 內重要檔案

- 資料檔：[`src/data/listings.js`](/C:/Users/USER/Documents/房子獵人/src/data/listings.js)
- 抓取腳本：[`scripts/update-data.mjs`](/C:/Users/USER/Documents/房子獵人/scripts/update-data.mjs)
- 重用/回退工具：[`scripts/update-data-utils.mjs`](/C:/Users/USER/Documents/房子獵人/scripts/update-data-utils.mjs)
- build 驗證：[`scripts/verify-dist-updated.mjs`](/C:/Users/USER/Documents/房子獵人/scripts/verify-dist-updated.mjs)
- GitHub Pages workflow：[` .github/workflows/deploy-pages.yml`](/C:/Users/USER/Documents/房子獵人/.github/workflows/deploy-pages.yml)

## 驗證結果

這次已執行並通過：

- `npm test`
- `npm run build`
- `npm audit --json`

已額外確認：

- 本地 `dist` 含最新 `updatedAt`
- 線上站的部署來源是 GitHub Pages 而非 Netlify

## 下次更新時應注意

下次跑 `房子獵人每日更新` 時，除了更新資料本身，還要把「線上站是否已重新部署」視為同一件事的一部分。

最低標準應該是：

1. `src/data/listings.js` 更新
2. `npm test` 通過
3. `npm run build` 通過
4. build 驗證 `dist` 確實含最新 `updatedAt`
5. push 到 `main`
6. 確認 GitHub Pages workflow 成功

如果少了第 5 和第 6 步，使用者看到的網站仍可能是舊版。
