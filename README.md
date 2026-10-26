# 一起學習｜成語與英文時態

「一起學習」是一個以繁體中文介面的靜態學習網站，提供四字成語與英文時態兩種主題，適合日常閱讀、複習和自我練習。網站以原生 HTML、CSS 和 JavaScript 製作，無需安裝套件或建置即可使用。

## 學習功能

### 四字成語

- 每日成語卡片：閱讀成語、注音、釋義、例句與資料來源，也可換一則繼續閱讀。
- 成語配對：從索引抽出十則成語與釋義進行連連看，提交後查看結果。
- 完整成語索引：搜尋成語名稱，並可連至教育部《成語典》查看詳細釋義。
- 個人收藏與閱讀歷史：保存想複習的成語、瀏覽過的紀錄，並可搜尋或清除。
- 收藏、歷史與部分查詢資料保存在瀏覽器的 `localStorage`。

### 英文時態

- 時態總覽與教學：整理現在、過去、未來與四種動作狀態，並提供 12 種基本時態的句型、用法及例句。
- 學習要點：幫助辨認時間線索並組成正確句型。
- 互動練習：以選擇或填答方式練習時態，查看作答回饋、分數與錯題複習。
- 分級短文練習：依程度選擇短文，填入適當時態後核對答案與中文翻譯。

### 學習首頁

首頁提供兩種版型：Style 1 卡片入口，以及以自製無文字虛擬地圖為底圖、標示現有學習入口並保留七個未來單元的 Style 2 群島地圖。首頁也會顯示網站累計造訪人次；達到特定里程碑時會顯示提示與動畫。造訪人次由外部計數服務提供，需連上網路。

### 吉他和弦播放

- 吉他和弦頁與和弦進行各格都可按「播放」，使用 Web Audio 合成和弦聲音。
- iPhone／iPad 需直接點按播放以啟動音訊；支援 Audio Session API 的瀏覽器會使用媒體播放模式。切換 App 或鎖定螢幕後，回到頁面再按播放即可嘗試恢復。
- 若沒有聲音，請調高媒體音量，確認藍牙或耳機等輸出裝置；較舊的 iOS／iPadOS 請關閉靜音模式。啟動失敗或逾時會顯示錯誤，並允許重新點按。
- 音訊回歸測試可執行 `node --test tests/guitar-audio.test.cjs`；測試以模擬音訊狀態驗證流程，實際聲音與靜音模式仍需在裝置上確認。

## 開始使用

可直接部署為靜態網站。若要在本機預覽，請在專案根目錄啟動簡易 HTTP 伺服器：

```bash
python -m http.server 8000
```

接著開啟 <http://localhost:8000>。成語資料與主要學習功能隨網站檔案提供；首頁造訪計數及連往教育部《成語典》的詳細釋義需要網路連線。

## 專案檔案

- [`index.html`](./index.html)：學習首頁。
- [`learning-island.svg`](./learning-island.svg)：首頁 Style 2 使用的自製虛擬群島地圖。
- [`4words_index.html`](./4words_index.html)：每日成語、配對、索引、收藏與歷史。
- [`English_tenses.html`](./English_tenses.html)：英文時態教學、練習與分級短文。
- [`idioms-index.js`](./idioms-index.js)：成語索引資料。
- [`idioms-meanings.js`](./idioms-meanings.js) 與 [`idioms-examples.js`](./idioms-examples.js)：成語釋義與例句資料。
- `idioms-meanings.partial.json`、`idioms-examples.partial.json`：釋義與例句的部分資料檔。
- `download-idiom-meanings.mjs`、`download-idiom-examples.mjs`：取得成語釋義與例句資料的工具。

## 部署

將專案檔案發布到 GitHub Pages 的網站根目錄即可；首頁入口為 `index.html`。`_config.yml` 已設定 GitHub Pages Jekyll 主題為 Merlot。現有 HTML 頁面沿用各自的版面；若要套用 Jekyll 主題版型，頁面需使用主題提供的 layout。此專案不需要額外的建置或套件安裝步驟。
