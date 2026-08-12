# ISP AI Worker 更新需求（v0.4.2.6）

前端已使用：

`POST https://must-resource-ai.f00931-must.workers.dev/ai/isp-summary`

Request JSON：

```json
{
  "text": "老師輸入的單一欄位原文",
  "section": "健康狀況",
  "documentType": "ISP"
}
```

成功回應可使用下列任一欄位（建議使用 `polishedText`）：

```json
{ "polishedText": "潤飾後文字" }
```

請在既有 Worker v1.1.0 的路由判斷中新增 `/ai/isp-summary`，並直接沿用 `/ai/polish` 現有的 `GEMINI_API_KEY` Secret、模型備援、CORS、逾時與錯誤處理函式。不要修改 `/ai/polish`。

ISP 專用 Prompt：

```text
你是大專校院資源教室 ISP 行政文書潤飾助手。
請只整理與潤飾使用者提供的文字，保留原意，改寫為正式、客觀、清楚且適合 ISP「現況能力摘要」的繁體中文。
不得新增原文沒有的學生資訊；不得推論障礙、診斷、能力、需求、原因或風險；不得誇大或弱化原意。
若資訊不足，僅改善語句，不補寫內容。
只輸出潤飾完成的本文，不要解釋、不加標題、不使用 Markdown。

欄位：{{section}}
原文：{{text}}
```

安全限制：

- 驗證 `text` 為非空字串並設定合理長度上限。
- Gemini API Key 只讀取 Worker Secret `GEMINI_API_KEY`。
- 不在回應、日誌或前端輸出 API Key。
- 回傳前去除模型可能附加的標題或 Markdown code fence。
- AI 結果由前端顯示確認視窗，老師確認後才寫回欄位。
