# MUST 行政文書製作系統 v0.1.0

這一版先建立「入口 + Google 登入 + 每位老師自己的 Firestore 草稿 + ISP 基礎編輯器」。

## 先做的 Firebase 設定
1. Firebase Console 建立全新專案（建議：MUST Administrative Document System）。
2. Authentication > Sign-in method > Google：啟用。
3. Firestore Database：建立資料庫。
4. Project settings > Your apps > Web：建立 Web App。
5. 將設定貼進 `firebase-config.js`。
6. Firestore Rules 貼上本專案的 `firestore.rules` 並 Publish。
7. Authentication > Settings > Authorized domains：之後加入 GitHub Pages 網域。

## GitHub 設定
1. 建立新的 Repository，例如 `must-admin-document-system`。
2. 上傳本 ZIP 解壓後的所有檔案。
3. Settings > Pages > Deploy from a branch > main / root。
4. 等 GitHub Pages 網址產生。
5. 把該網域加入 Firebase Authorized domains。

## 本版已完成
- 行政表單製作入口
- Google 登入/登出
- 每位老師只讀寫自己的 `adminDocuments`
- ISP 草稿建立、修改、列表
- 民國學年度/學期自動預設（8/1 第一學期、3/1 第二學期）
- 已附 `templates/ISP-template-v1.docx`

## 下一階段
- 對 ISP Word 母版建立精準欄位對應
- 完整 12 頁 ISP 網頁欄位
- 下載 Word
- ISP 現況能力摘要 AI 潤飾（沿用既有 Cloudflare Worker，新增 ISP 專用 route/prompt）
- 複製上一學期 ISP
