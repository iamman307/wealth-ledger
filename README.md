# Wealth Ledger

Wealth Ledger 是一個本機優先（local-first）的投資總帳 PWA，介面概念參考 Wealthfolio，但針對個人股票、幣安與資金對帳流程重新設計。

## 主要功能

- 長期股票、波段股票、幣安資產分帳呈現
- 股票已實現／未實現、幣安總損益與融資後淨成果
- 連續持倉歸零才計一筆完整交易
- 勝率、Payoff、Expectancy、Profit Factor、最大回撤與連勝／連敗
- 證券交割戶、待交割款與幣安轉帳對帳
- 相容 Stock Ledger 完整 JSON，支援合併匯入與匯出備份
- 可安裝到 Android／iPhone 主畫面，離線開啟
- 可選擇填入個人 Finnhub API 金鑰，自動補抓美股持倉現價；報價未成功時保留舊價與時間
- 同一組 Finnhub 金鑰可更新 Binance BTCUSDT 現價；只重估 BTC 持倉，不改動幣安總資產快照或入金
- 對帳頁可記錄新增股票投入，一次同步長期／波段配置本金與證券戶銀行快照，且不列為損益
- 台幣交割美股可先用試算匯率記錄，待銀行交割後以實際台幣金額或批次匯率完成核銷

## 隱私

公開儲存庫只包含程式碼。交易、持倉數量、貸款與資產資料存於瀏覽器 `localStorage`，不會自動上傳到 GitHub。換裝置或清除瀏覽器資料前請匯出 JSON 備份。

自動行情為選用功能。個人 API 金鑰僅存於當前裝置的瀏覽器，不在匯出備份或 GitHub；啟用後，持倉股票代號會直接送至 Finnhub 查詢報價。美股報價仍需有效的 USD/TWD 參考匯率才能計算台幣資產；銀行與幣安快照不由股票行情服務更新。台股及行情服務未支援的代號仍可手動更新。

## GitHub Pages

推送到 `main` 後，GitHub Actions 會自動部署 GitHub Pages。首次建立儲存庫時，請在 **Settings → Pages → Source** 選擇 **GitHub Actions**。

## 本機預覽

```bash
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080`。
