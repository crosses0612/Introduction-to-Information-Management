# 資訊管理導論－訂單與原料管理網站

本專案依照 `資訊管理導論-系統架構.md` 實作 MVP 網站，提供：

- 客戶會員註冊/登入與下單介面（單筆訂單可含多項商品與交貨日）
- 廠商後台商品管理、原料管理、商品原料比例（配方）調整
- 訂單確認流程（廠商確認後，客戶首頁可看到交貨提醒）
- 訂單過量提醒（待處理訂單過多時提示等待時間較長）
- 基本統計（暢銷商品、客戶下單頻率/週期）
- 廠商確認接單時依配方扣減原料庫存，並記錄進出貨
- 原料低庫存提醒、進貨登錄、消耗統計
- 待處理訂單可由客戶或廠商取消
- 操作完成後以置中 Modal 提示，並防止重複送出
- 客戶/廠商可於「個人資料」管理使用者名稱（廠商為登入帳號）、電話；密碼於獨立區塊變更
- 下單支援交貨日期時間、來店自取/配送、備註；客戶頁顯示商家資訊
- 訂單狀態中文顯示；廠商訂單確認/紀錄分頁；可標記已完成

## 技術棧

- **Next.js 15**（App Router，全端 monolith）
- **React 18**
- **Neon**（PostgreSQL）
- **JWT** 驗證

## 專案結構

```text
.
├── app/
│   ├── layout.jsx          # 根 layout
│   ├── page.jsx            # 首頁（客戶/廠商 UI）
│   ├── globals.css
│   └── api/                # Route Handlers（REST API）
├── components/
│   ├── App.jsx             # 主應用元件
│   ├── FeedbackModal.jsx   # 操作回饋彈窗
│   ├── ProfileForm.jsx     # 個人資料表單
│   └── ChangePasswordForm.jsx  # 變更密碼表單
├── lib/
│   ├── db.js               # 資料庫連線
│   ├── auth.js             # JWT
│   ├── inventory.js        # 庫存與進出貨
│   ├── numbers.js          # 數值驗證
│   └── client/api.js       # 前端 API 客戶端
├── scripts/
│   └── init-db.js          # 種子資料
├── db/migrations/          # PostgreSQL schema
└── 資訊管理導論-系統架構.md
```

## 環境需求

- Node.js 18+（建議 Node.js 20）
- npm 9+
- [Neon](https://neon.tech) 帳號與專案

## Neon 專案設定

### 1) 建立 Neon 專案

1. 登入 [neon.tech](https://neon.tech) 並建立新專案。
2. 等待資料庫佈建完成。

### 2) 取得資料庫連線字串

於 Neon Console **Connection details**：

- 選擇 **Pooled connection**（建議 Node.js 後端使用）。
- 複製連線 URI，確認包含 `?sslmode=require`。

### 3) 套用資料表 schema

1. 開啟 Neon 專案 → **SQL Editor**。
2. 依序執行 migration 檔案：
   - [`db/migrations/20260520000000_initial_schema.sql`](db/migrations/20260520000000_initial_schema.sql)
   - [`db/migrations/20260521100000_inventory_and_cancel.sql`](db/migrations/20260521100000_inventory_and_cancel.sql)
   - [`db/migrations/20260523100000_user_phone_profile.sql`](db/migrations/20260523100000_user_phone_profile.sql)
   - [`db/migrations/20260524100000_orders_and_vendor_settings.sql`](db/migrations/20260524100000_orders_and_vendor_settings.sql)
   - [`db/migrations/20260525100000_rename_email_to_username.sql`](db/migrations/20260525100000_rename_email_to_username.sql)
   - [`20260526140000_user_tab_preferences.sql`](db/migrations/20260525100000_rename_email_to_username.sql)

### 4) 設定環境變數

```bash
cp .env.example .env.local
```

編輯 `.env.local`，填入 `DATABASE_URL` 與 `JWT_SECRET` 等值。

## 安裝步驟

### 1) 安裝依賴

在專案根目錄執行：

```bash
npm install
```

### 2) 寫入種子資料

確認 schema 已套用後：

```bash
npm run init-db
```

會建立測試帳號、商品與原料資料（若已存在則跳過）。

若需清空既有訂單並重置訂單編號（`orders`、`order_items`、`material_movements` 會被清空且流水號歸 1），可加上 `--reset`：

```bash
npm run init-db -- --reset
```

## 啟動方式

### 開發模式（預設 `http://localhost:3000`）

```bash
npm run dev
```

瀏覽器開啟 `http://localhost:3000` 即可使用。前端與 API 皆由同一個 Next.js 程序提供（API 路徑為 `/api/*`）。

### 正式模式

```bash
npm run build
npm start
```

## 測試帳號

以**使用者名稱**登入（字串可含 `@`，非 Email 格式限制）：

- 廠商：`vendor@example.com` / `vendor123`
- 客戶：`customer@example.com` / `customer123`

## 主要 API（節錄）

- `POST /api/auth/register`：客戶註冊（可選填電話）
- `POST /api/auth/login`：登入
- `GET /api/profile`：取得個人資料（已登入）
- `PUT /api/profile`：更新 username、電話、密碼（變更 username 或密碼需目前密碼）
- `GET /api/products`：取得商品（含配方比例）
- `GET /api/shop-info`：商家名稱/電話/地址（公開）
- `GET/PUT /api/vendor/settings`：廠商商家資訊與測試用時鐘偏移
- `POST /api/orders`：客戶建立訂單（`deliveryAt`、`deliveryMethod`、`deliveryAddress`、`note`）
- `GET /api/orders?scope=pending|history`：廠商待處理/歷史訂單（含品項與客戶電話）
- `PUT /api/orders/:id/confirm`：廠商確認接單（依配方扣庫，不足時拒絕）
- `PUT /api/orders/:id/complete`：廠商將已確認訂單標記為已完成
- `PUT /api/orders/:id/cancel`：取消待處理訂單（客戶/廠商）
- `GET /api/materials/movements`：進出貨紀錄（廠商）
- `GET /api/materials/consumption-stats`：原料消耗統計（廠商，近 30 天）
- `POST /api/materials/:id/inbound`：進貨登錄（廠商）
- `GET /api/reminders`：交貨日提醒（客戶/廠商，依角色回傳）
- `GET /api/orders/pending-alert`：訂單過量警示
- `GET /api/stats`：統計數據（廠商）

## 可調整設定

透過 `.env.local` 設定：

- `DATABASE_URL`：Neon PostgreSQL 連線字串（必填，建議 Pooled + `sslmode=require`）
- `JWT_SECRET`：JWT 簽章密鑰
- `PENDING_ALERT_THRESHOLD`：訂單過量門檻（預設 `5`）
- `MATERIAL_LOW_STOCK_THRESHOLD`：新原料預設低庫存門檻（預設 `10`）
- `NEXT_PUBLIC_API_BASE`：API 基底路徑（選填，預設 `/api`，同 origin 無需修改）

## 驗證清單

schema 與種子資料就緒後，可確認：

- `GET http://localhost:3000/api/health` 回傳 `{ "ok": true }`
- 廠商/客戶登入成功
- 商品列表含 recipe JSON
- 客戶下單、廠商確認扣庫、取消 pending 訂單、原料進貨/調整紀錄、低庫存提醒
- 任一送出操作出現 Modal 提示，處理中按鈕不可重複點擊
- 客戶/廠商於「個人資料」分頁可修改電話；「變更密碼」區塊常駐顯示目前密碼欄位；變更 username 後能以新名稱登入
- 下單含日期+時間、自取/配送與備註；無效年份被拒；超大數量顯示「輸入的整數過大」
- 客戶訂單紀錄分為已送出/已確認/已完成/已取消；廠商訂單確認頁每 15 秒自動更新
- 廠商可標記已完成；同名商品與空原料名稱會被擋下
