# 資訊管理導論－訂單與原料管理網站

本專案依照 `資訊管理導論-系統架構.md` 實作 MVP 網站，提供：

- 客戶會員註冊/登入與下單介面（單筆訂單可含多項商品與交貨日）
- 廠商後台商品管理、原料管理、商品原料比例（配方）調整
- 訂單確認流程（廠商確認後，客戶首頁可看到交貨提醒）
- 訂單過量提醒（待處理訂單過多時提示等待時間較長）
- 基本統計（暢銷商品、客戶下單頻率/週期）

## 技術棧

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite（`better-sqlite3`）
- Auth: JWT

## 專案結構

```text
.
├─ frontend/          # React 前端
├─ backend/           # Express API 與 SQLite 初始化腳本
└─ 資訊管理導論-系統架構.md
```

## 環境需求

- Node.js 18+（建議 Node.js 20）
- npm 9+

## 安裝步驟

### 1) 安裝後端套件

```bash
cd backend
npm install
```

### 2) 初始化資料庫與種子資料

```bash
cd backend
npm run init-db
```

會建立 `backend/data/app.db`，並預設建立測試帳號、商品與原料資料。

### 3) 安裝前端套件

```bash
cd frontend
npm install
```

## 啟動方式

### 啟動後端（預設 `http://localhost:4000`）

```bash
cd backend
npm run dev
```

若要正式模式：

```bash
cd backend
npm start
```

### 啟動前端（預設 `http://localhost:5173`）

```bash
cd frontend
npm run dev
```

## 測試帳號

- 廠商：`vendor@example.com` / `vendor123`
- 客戶：`customer@example.com` / `customer123`

## 主要 API（節錄）

- `POST /api/auth/register`：客戶註冊
- `POST /api/auth/login`：登入
- `GET /api/products`：取得商品（含配方比例）
- `POST /api/orders`：客戶建立訂單
- `PUT /api/orders/:id/confirm`：廠商確認接單
- `GET /api/reminders`：客戶交貨日提醒
- `GET /api/orders/pending-alert`：訂單過量警示
- `GET /api/stats`：統計數據（廠商）

## 可調整設定

後端可透過環境變數調整：

- `PORT`：API 連接埠（預設 `4000`）
- `JWT_SECRET`：JWT 簽章密鑰
- `PENDING_ALERT_THRESHOLD`：訂單過量門檻（預設 `5`）

前端可透過環境變數指定 API 位址：

- `VITE_API_BASE`（預設 `http://localhost:4000/api`）

## 驗證過的指令

已在本機執行：

- `backend/npm install`
- `backend/npm run init-db`
- `frontend/npm install`
- `frontend/npm run build`
