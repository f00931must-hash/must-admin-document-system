# 新生 ISP AI 切換／還原紀錄

日期：2026-09-06

## 目前正式使用架構

新生 ISP 前端：GitHub Pages

AI 路徑：

`GitHub Pages → Cloud Run（asia-east1 台灣）→ Gemini API`

Cloud Run 服務：

`https://must-isp-ai-697793258377.asia-east1.run.app`

ISP API：

`https://must-isp-ai-697793258377.asia-east1.run.app/ai/isp-summary`

目前 Cloud Run 後端採多模型備援，並包含輸出完整性檢查。

## 舊架構（還原時使用）

原本新生 ISP AI 走 Cloudflare Worker：

`https://must-resource-ai.f00931-must.workers.dev/ai/isp-summary`

服務紀錄的 `/ai/polish` 目前仍維持原本 Cloudflare Worker，不應因 ISP 還原而修改。

## 前端切換方式

目前 `must-admin-document-system/app.js` 是一層 router，會把原本送往 Cloudflare Worker `/ai/isp-summary` 的請求改導到 Cloud Run，然後載入：

- `app-core.js`：原本正式版主要程式
- `isp-autosave-hotfix.js`：ISP 自動儲存模組

若未來要「不用 Google / 不走 Cloud Run」，最安全的還原方式：

1. 保留 `app-core.js` 與 `isp-autosave-hotfix.js`。
2. 把 `app.js` 的 Cloud Run 轉址拿掉，恢復直接使用原本 Cloudflare Worker：
   `https://must-resource-ai.f00931-must.workers.dev/ai/isp-summary`
3. 不修改 Firebase Firestore 結構或既有 `adminDocuments` 資料。
4. 不修改服務紀錄系統的 `/ai/polish`。
5. 還原後先以單一測試欄位確認 AI 潤飾，再正式讓老師使用。

## 重要資料安全原則

此次切換過程：

- 沒有搬移 Firebase 資料
- 沒有批次修改既有 ISP 紀錄
- 沒有刪除老師已儲存資料
- 沒有改服務紀錄正式資料

未來還原時也必須維持以上原則。

## 目前已知狀況

Gemini 曾發生：

- 地區限制錯誤
- 429 使用量／額度限制
- 503 high demand
- 回應逾時
- 偶發輸出句子不完整

因此 Cloud Run 後端後續加入多模型備援與輸出完整性檢查。

若未來改回 Cloudflare Worker，需確認當時 Worker 使用的模型與 API 仍可用，再切回正式流量。
