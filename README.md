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

## 隱私

公開儲存庫只包含程式碼。交易、持倉、貸款與資產資料存於瀏覽器 `localStorage`，不會自動上傳到 GitHub 或任何伺服器。換裝置或清除瀏覽器資料前請匯出 JSON 備份。

## GitHub Pages

推送到 `main` 後，GitHub Actions 會自動部署 GitHub Pages。首次建立儲存庫時，請在 **Settings → Pages → Source** 選擇 **GitHub Actions**。

## 本機預覽

```bash
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080`。
