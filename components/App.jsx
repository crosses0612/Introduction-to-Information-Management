import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { nonNegativeFromInput, nonNegativeStringFromInput } from "@/lib/numbers";
import { useActionFeedback } from "@/lib/client/useActionFeedback";
import FeedbackModal from "@/components/FeedbackModal";
import ProfileForm from "@/components/ProfileForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import OrderForm from "@/components/OrderForm";
import CustomerOrders from "@/components/CustomerOrders";
import RemindersList from "@/components/RemindersList";
import OrderCard from "@/components/OrderCard";
import VendorSettingsForm from "@/components/VendorSettingsForm";
import { formatDateTime } from "@/lib/format";

function formatRecipeLine(r) {
  const kg = r.usageKg ?? r.ratio;
  return `${r.materialName} ${kg} kg`;
}
const DEFAULT_UNITS = ["公斤 (kg)", "公克 (g)", "磅 (lb)", "公升 (L)", "加侖 (gal)", "桶", "包", "罐"];
const emptyProduct = { name: "", description: "", price: "", isActive: true }; // price 改為 ""
const emptyMaterial = { name: "", stock: "", unit: "公斤", lowStockThreshold: 10 }; // stock 改為 ""

export default function App() {
  const { modalOpen, modalMessage, modalType, isSubmitting, closeModal, runAction, notifyError } =
    useActionFeedback();

  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [orderFormResetToken, setOrderFormResetToken] = useState(0);
  const [stats, setStats] = useState({ topProducts: [], customerFrequency: [] });
  const [pendingAlert, setPendingAlert] = useState({ pendingCount: 0, threshold: 5, warning: false });

  const [authForm, setAuthForm] = useState({ name: "", username: "", password: "", phone: "" });
  const [productForm, setProductForm] = useState(emptyProduct);
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [recipeEditor, setRecipeEditor] = useState({ productId: "", materialId: "", ratio: "" });
  const [activeTab, setActiveTab] = useState("order");
  const [materialEdits, setMaterialEdits] = useState({});
  const [inboundForm, setInboundForm] = useState({ materialId: "", quantity: "", note: "" });
  const [movements, setMovements] = useState([]);
  const [consumptionStats, setConsumptionStats] = useState([]);
  const [vendorHistoryTab, setVendorHistoryTab] = useState("confirmed");
  // App 組件內部
  const [unitList, setUnitList] = useState(DEFAULT_UNITS);

  const [isCustomUnit, setIsCustomUnit] = useState(false); 
  const [customUnitInput, setCustomUnitInput] = useState("");

  const [editingMaterialId, setEditingMaterialId] = useState(null);

  const [editingCustomUnitId, setEditingCustomUnitId] = useState(null);
  const [editCustomUnitInput, setEditCustomUnitInput] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [productEditForm, setProductEditForm] = useState({ name: "", description: "", price: "", recipe: [] });
  const [vendorTabsOrder, setVendorTabsOrder] = useState(() => {
    const saved = localStorage.getItem("vendorTabsOrder");
    return saved ? JSON.parse(saved) : vendorTabs.map(t => t[0]);
  });
  const [custTabs, setCustTabs] = useState([
    ["order", "下單"],
    ["reminders", "交貨日提醒"],
    ["orders", "訂單紀錄"],
    ["profile", "個人資料"]
  ]);

  const [vendTabs, setVendTabs] = useState([
    ["products", "商品與配方"],
    ["materials", "原料管理"],
    ["orders", "訂單確認"],
    ["orderHistory", "訂單紀錄"],
    ["reminders", "交貨日提醒"],
    ["stats", "統計數據"],
    ["profile", "個人資料"]
  ]);

  const [draggedMainTabIdx, setDraggedMainTabIdx] = useState(null);

  const [materialSubTabs, setMaterialSubTabs] = useState([
    { key: "create", label: "新增原料" },
    { key: "list", label: "原料列表" },
    { key: "inbound", label: "進貨登錄" },
    { key: "stats", label: "原料消耗統計" },
    { key: "history", label: "進出貨紀錄" }
  ]);

  const [activeMaterialSubTab, setActiveMaterialSubTab] = useState("list");

  const [draggedTabIdx, setDraggedTabIdx] = useState(null);

  const isVendor = user?.role === "vendor";
  const isCustomer = user?.role === "customer";

  useEffect(() => {
    const handleAuthExpired = () => logout();
    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, []);

  async function refreshCoreData() {
    const data = await api.getProducts();
    setProducts(data);
    if (!user) return;

    const alertData = await api.getPendingAlert();
    setPendingAlert(alertData);

    if (isCustomer) {
      const [myOrders, myReminders] = await Promise.all([api.getMyOrders(), api.getReminders()]);
      setOrders(myOrders);
      setReminders(myReminders);
    }

    if (isVendor) {
      const [materialData, pending, history, statsData, vendorReminders] = await Promise.all([
        api.getMaterials(),
        api.getVendorOrders("pending"),
        api.getVendorOrders("history"),
        api.getStats(),
        api.getReminders()
      ]);
      setMaterials(materialData);
      setPendingOrders(pending);
      setHistoryOrders(history);
      setReminders(vendorReminders);
      setStats(statsData);
    }
  }

  useEffect(() => {
    if (!user) return;
    setActiveTab(user.role === "customer" ? "order" : "products");
  }, [user?.id, user?.role]);

  useEffect(() => {
    refreshCoreData().catch((err) => notifyError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const edits = {};
    for (const m of materials) {
      edits[m.id] = {
        name: m.name,
        stock: m.stock,
        unit: m.unit,
        low_stock_threshold: m.low_stock_threshold ?? 10
      };
    }
    setMaterialEdits(edits);
  }, [materials]);

  useEffect(() => {
    if (!isVendor || activeTab !== "materials") return;
    Promise.all([api.getMaterialMovements(), api.getMaterialConsumptionStats()])
      .then(([mov, cons]) => {
        setMovements(mov);
        setConsumptionStats(cons);
      })
      .catch((err) => notifyError(err.message));
  }, [isVendor, activeTab, materials, notifyError]);

  useEffect(() => {
    if (!isVendor || activeTab !== "orders") return;
    const id = setInterval(() => {
      refreshCoreData().catch((err) => notifyError(err.message));
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, activeTab]);

  const lowStockMaterials = useMemo(
    () => materials.filter((m) => m.is_low_stock),
    [materials]
  );

  function handleUserUpdate(updatedUser, token) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    await runAction(async () => {
      const data =
        authMode === "register"
          ? await api.register(authForm)
          : await api.login({ username: authForm.username, password: authForm.password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setAuthForm({ name: "", username: "", password: "", phone: "" });
    }, { successMessage: authMode === "register" ? "註冊成功" : "登入成功" });
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setOrders([]);
    setPendingOrders([]);
    setHistoryOrders([]);
    setReminders([]);
    setStats({ topProducts: [], customerFrequency: [] });
    setMaterials([]);
    setMovements([]);
    setConsumptionStats([]);
    setMaterialEdits({});
  }

  async function handleOrderSubmit(payload) {
    await runAction(async () => {
      if (!payload.deliveryAt || !payload.items?.length) {
        throw new Error("請選擇交貨日時間並至少選擇一項商品");
      }
      await api.createOrder(payload);
      setOrderFormResetToken((t) => t + 1);
      await refreshCoreData();
    }, { successMessage: "訂單送出成功，等待廠商確認" });
  }

  async function completeOrder(id) {
    await runAction(async () => {
      await api.completeOrder(id);
      await refreshCoreData();
    }, { successMessage: "訂單已標記為已完成" });
  }

  async function createProduct(e) {
    e.preventDefault();
    
    // 新增防呆：檢查價格是否為空字串或未填
    if (productForm.price === "" || productForm.price === undefined || productForm.price === null) {
      notifyError("新增失敗：請輸入商品價格！");
      return;
    }
    // 前端直接阻擋名稱重複
    const isDuplicate = products.some(p => p.name.trim() === productForm.name.trim());
    if (isDuplicate) {
      notifyError("新增失敗：商品名稱「" + productForm.name + "」已存在，請使用其他名稱！");
      return;
    }

    await runAction(async () => {
      await api.createProduct(productForm);
      setProductForm(emptyProduct);
      await refreshCoreData();
    }, { successMessage: "商品已成功上架！" });
  }

  async function createMaterial(e) {
    e.preventDefault();
    const isDuplicate = materials.some(m => m.name.trim() === materialForm.name.trim());
    if (isDuplicate) {
      notifyError("新增失敗：原料名稱「" + materialForm.name + "」已存在，請確認是否重疊！");
      return;
    }
    await runAction(async () => {
      await api.createMaterial({
        name: materialForm.name,
        stock: nonNegativeFromInput(materialForm.stock),
        unit: materialForm.unit,
        lowStockThreshold: nonNegativeFromInput(materialForm.lowStockThreshold, 10)
      });
      setMaterialForm(emptyMaterial);
      await refreshCoreData();
      if (isCustomUnit && customUnitInput.trim() && !unitList.includes(customUnitInput.trim())) {
        setUnitList([...unitList, customUnitInput.trim()]);
      }
      setIsCustomUnit(false);
      setCustomUnitInput("");
    }, { successMessage: "原料已新增" });
  }

async function handleUpdateProductAndRecipe(productId, e) {
  e.preventDefault();
  await runAction(async () => {
    // 呼叫後端 API 同時更新商品基本資料與配方（視你後端 API 調整，或分兩支 API 跑 Promise.all）
    await api.updateProduct(productId, {
      name: productEditForm.name,
      description: productEditForm.description,
      price: Number(productEditForm.price),
    });
    await api.updateRecipe(productId, productEditForm.recipe);
    setEditingProductId(null);
    await refreshCoreData();
  }, { successMessage: "商品與配方已同步更新" });
}

  async function confirmOrder(id) {
    await runAction(
      async () => {
        const result = await api.confirmOrder(id);
        await refreshCoreData();
        return result;
      },
      {
        successMessage: (result) => {
          let msg = "訂單已確認，客戶首頁將顯示交貨提醒";
          if (result.lowStockMaterials?.length) {
            msg += `（低庫存：${result.lowStockMaterials.map((m) => m.name).join("、")}）`;
          }
          return msg;
        }
      }
    );
  }

  async function cancelOrder(id) {
    if (!window.confirm("確定要取消這筆訂單嗎？此動作將無法復原！")) {
      return;
    }
    await runAction(async () => {
      await api.cancelOrder(id);
      await refreshCoreData();
    }, { successMessage: "訂單已成功取消" });
  }

  async function saveMaterial(id) {
    const edit = materialEdits[id];
    if (!edit) return;
    await runAction(async () => {
      await api.updateMaterial(id, {
        name: edit.name,
        stock: nonNegativeFromInput(edit.stock),
        unit: edit.unit,
        lowStockThreshold: nonNegativeFromInput(edit.low_stock_threshold, 10)
      });
      await refreshCoreData();
      if (editCustomUnitInput.trim() && !unitList.includes(editCustomUnitInput.trim())) {
        setUnitList([...unitList, editCustomUnitInput.trim()]);
      }
      setEditingCustomUnitId(null);
      setEditCustomUnitInput("");
    }, { successMessage: "原料已更新" });
  }

  async function submitInbound(e) {
    e.preventDefault();
    await runAction(async () => {
      if (!inboundForm.materialId || !inboundForm.quantity) {
        throw new Error("請選擇原料並填寫進貨數量");
      }
      const qty = nonNegativeFromInput(inboundForm.quantity);
      if (qty <= 0) throw new Error("進貨數量必須大於 0");
      await api.inboundMaterial(inboundForm.materialId, {
        quantity: qty,
        note: inboundForm.note
      });
      setInboundForm({ materialId: "", quantity: "", note: "" });
      await refreshCoreData();
    }, { successMessage: "進貨紀錄已新增" });
  }

  const movementTypeLabel = {
    inbound: "進貨",
    outbound: "出貨",
    adjustment: "調整"
  };

  async function removeProduct(id) {
    const isBoundToOrder = historyOrders.some(order => 
    order.items?.some(item => Number(item.productId ?? item.product_id) === Number(id))
    );

    // 2. 如果被訂單綁定了，直接阻斷，不讓後端報錯
    if (isBoundToOrder) {
      alert("無法刪除商品！\n\n因為此商品目前已存在於客戶的訂單紀錄中，因此無法刪除。\n若不繼續販售，建議點選「編輯商品與配方」\n將名稱加上 (已下架/停售) 即可。");
      return;
    }

    if (!window.confirm("確定要將此商品下架並刪除嗎？此動作將無法復原！")) {
      return;
    }

    await runAction(async () => {
      await api.deleteProduct(id);
      await refreshCoreData();
    }, { successMessage: "商品已下架刪除" });
  }

  async function removeMaterial(id) {
    if (!window.confirm("確定要刪除此原料嗎？此動作將無法復原！")) {
      return;
    }
    await runAction(async () => {
      await api.deleteMaterial(id);
      await refreshCoreData();
    }, { successMessage: "原料已刪除" });
  }

  const tabs = isCustomer ? custTabs : isVendor ? vendTabs : [];
  const setTabs = isCustomer ? setCustTabs : isVendor ? setVendTabs : () => {};

  return (
    <div className="page">
      <FeedbackModal
        open={modalOpen}
        message={modalMessage}
        type={modalType}
        onClose={closeModal}
      />
      <h1>訂單與原料管理系統</h1>

      {!user ? (
        <section className="card">
          <h2>{authMode === "login" ? "會員登入" : "會員註冊"}</h2>
          <form onSubmit={handleAuthSubmit} className="grid">
            {authMode === "register" && (
              <>
                <input
                  placeholder="姓名"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  disabled={isSubmitting}
                />
                <input 
                  type="tel" 
                  placeholder="電話（選填）" 
                  value={authForm.phone} 
                  onChange={(e) => {
                    // 允許數字、減號 -、星號 *，其餘字元直接過濾掉不給輸入
                    const filteredValue = e.target.value.replace(/[^0-9\-*]/g, "");
                    setAuthForm({ ...authForm, phone: filteredValue });
                  }} 
                  disabled={isSubmitting} 
                />
              </>
            )}
            <input
              placeholder="使用者名稱"
              value={authForm.username}
              onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              disabled={isSubmitting}
            />
            <input
              type="password"
              placeholder="密碼"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting}>
              {authMode === "login" ? "登入" : "註冊"}
            </button>
          </form>
          <button
            type="button"
            className="link"
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            disabled={isSubmitting}
          >
            {authMode === "login" ? "沒有帳號？前往註冊" : "已有帳號？前往登入"}
          </button>
          <p className="hint">測試帳號：vendor@example.com / vendor123、customer@example.com / customer123</p>
        </section>
      ) : (
        <>
          <section className="card headerRow">
            <p>
              目前身份：<strong>{user.name}</strong> ({user.role})
              {user.phone ? ` · 電話 ${user.phone}` : ""}
            </p>
            <button type="button" onClick={logout} disabled={isSubmitting}>
              登出
            </button>
          </section>

          {pendingAlert.warning && (
            <section className="alert">
              訂單量偏高（目前 {pendingAlert.pendingCount} 筆待處理），系統提醒客戶等待時間可能較長。
            </section>
          )}

          {isVendor && lowStockMaterials.length > 0 && (
            <section className="alert">
              原料庫存不足：{lowStockMaterials.map((m) => `${m.name}（${m.stock} ${m.unit}）`).join("、")}
            </section>
          )}

          {isVendor && stats.customerFrequency && stats.customerFrequency.filter(c => {
            return c.avg_cycle_days !== null && c.avg_cycle_days <= 3; 
          }).length > 0 && (
            <section className="alert" style={{ borderLeft: "5px solid var(--warning)", background: "#fff9f0" }}>
               <strong>客戶下單週期提醒：</strong>
              {stats.customerFrequency
                .filter(c => c.avg_cycle_days !== null && c.avg_cycle_days <= 3)
                .map((c) => `${c.name}（預計 ${c.avg_cycle_days} 天內再度下單）`)
                .join("、")} 
              ，請提早備妥原料與產能。
            </section>
          )}

          {(isCustomer || isVendor) && (
            <section className="tabs">
              {tabs.map(([key, label], idx) => {
                // 1. 在迴圈內部動態計算該標籤目前應有的紅點數量
                let badgeCount = 0;

                if (isVendor) {
                  if (key === "orders") {
                    // 商家「訂單確認」：計算 pending (待處理) 的單子數
                    badgeCount = pendingOrders.length;
                  } else if (key === "reminders") {
                    // 商家「交貨日提醒」：計算 historyOrders 裡面 confirmed (已確認) 的單子數
                    badgeCount = historyOrders.filter(o => o.status === "confirmed").length;
                  }
                }

                if (isCustomer) {
                  if (key === "reminders") {
                    // 客戶「交貨日提醒」：計算 orders 裡面 confirmed (已確認) 的單子數
                    badgeCount = orders.filter(o => o.status === "confirmed").length;
                  }
                }

                // 2. 渲染可拖曳按鈕
                return (
                  <button 
                    key={key} 
                    type="button" 
                    draggable // 啟用 HTML5 原生拖曳
                    className={activeTab === key ? "active" : ""} 
                    onClick={() => setActiveTab(key)} 
                    disabled={isSubmitting} 
                    style={{ 
                      cursor: "move", 
                      opacity: draggedMainTabIdx === idx ? 0.4 : 1, // 拖曳時淡出
                      transition: "opacity 0.2s ease"
                    }}
                    title="按住左右拖曳可調整選單順序"

                    // --- 主導覽列 HTML5 原生拖曳事件 ---
                    onDragStart={(e) => {
                      setDraggedMainTabIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault(); // 必須阻斷預設行為才能觸發重排序
                    }}
                    onDragEnter={(e) => {
                      if (draggedMainTabIdx === null || draggedMainTabIdx === idx) return;
                      
                      // 實時調換主選單二維陣列位置
                      const updatedTabs = [...tabs];
                      const draggedItem = updatedTabs[draggedMainTabIdx];
                      updatedTabs.splice(draggedMainTabIdx, 1); // 挖出拖曳項
                      updatedTabs.splice(idx, 0, draggedItem); // 塞入新格
                      
                      setDraggedMainTabIdx(idx); // 同步更新當前正在移動的索引
                      setTabs(updatedTabs); // 儲存排序結果
                    }}
                    onDragEnd={() => {
                      setDraggedMainTabIdx(null); // 拖曳放開，清空暫存
                    }}
                  >
                    {badgeCount > 0 ? (
                      <span className="tab-badge-container">
                        {label}
                        <span className="tab-badge">{badgeCount}</span>
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                );
              })}
            </section>
          )}

          {isCustomer && activeTab === "order" && (
            <OrderForm
              products={products}
              isSubmitting={isSubmitting}
              onSubmit={handleOrderSubmit}
              resetToken={orderFormResetToken}
              notifyError={notifyError}
            />
          )}

          {isCustomer && activeTab === "reminders" && (
            <RemindersList 
              // 捨棄結構不完整的 reminders，直接拿客戶自己最完整的 orders 清單
              // 過濾出狀態為 "confirmed"（廠商已確認、待交貨）的訂單作為提醒來源
              reminders={orders.filter(o => o.status === "confirmed")} 
              products={products}
            />
          )}

          {isCustomer && activeTab === "orders" && (
            <CustomerOrders orders={orders} isSubmitting={isSubmitting} onCancel={cancelOrder} />
          )}

          {isCustomer && activeTab === "profile" && (
            <section className="card">
              <ProfileForm
                isVendor={false}
                isSubmitting={isSubmitting}
                runAction={runAction}
                onUserUpdate={handleUserUpdate}
              />
              <hr />
              <ChangePasswordForm
                isSubmitting={isSubmitting}
                runAction={runAction}
                onUserUpdate={handleUserUpdate}
              />
            </section>
          )}

          {isVendor && activeTab === "products" && (
            <section className="card">
              <h2>商品管理與配方用量</h2>
              <form onSubmit={createProduct} className="grid">
                <input
                  placeholder="商品名稱"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  disabled={isSubmitting}
                />
                <input
                  placeholder="商品描述"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  disabled={isSubmitting}
                />
                <label>
                  價格 (NT$)
                  <input
                  type="number"
                  min="0"
                  max="99999"
                  step="1"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value === "" ? "" : nonNegativeFromInput(e.target.value) })}
                  disabled={isSubmitting}
                  required
                />
                </label>
                <button type="submit" disabled={isSubmitting}>
                  新增商品
                </button>
              </form>

              {products.map((p) => {
                const isEditing = editingProductId === p.id;
                return (
                  <div key={p.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: "15px" }}>
                    {!isEditing ? (
                      // 瀏覽模式
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{p.name}</strong> - <span style={{ color: "var(--primary)" }}>NT$ {p.price}</span>
                          <p style={{ margin: "5px 0", color: "var(--subtext)" }}>{p.description}</p>
                          <small>
                              當前配方： {p.recipe.map((r) => {
                                // 透過配方的 materialId 去動態尋找原料列表裡最新、最即時的單位
                                const currentMaterial = materials.find(m => Number(m.id) === Number(r.materialId));
                                const latestUnit = currentMaterial ? currentMaterial.unit : (r.materialUnit || 'kg');
                                return `${r.materialName} ${r.ratio} ${latestUnit}`;
                              }).join(" / ") || "尚未設定"}
                            </small>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button type="button" onClick={() => {
                            setEditingProductId(p.id);
                            setProductEditForm({ name: p.name, description: p.description, price: p.price, recipe: p.recipe || [] });
                          }}>編輯商品與配方</button>
                          {(() => {
                            const isDiscontinued = p.name.includes("[已下架停售]");
                            return (
                              <button
                                type="button"
                                onClick={async () => {
                                  let newName = p.name;
                                  if (isDiscontinued) {
                                    newName = p.name.replace(" [已下架停售]", "").replace("[已下架停售]", "");
                                    if (!window.confirm(`確定要將「${newName}」重新上架恢復販售嗎？`)) return;
                                  } else {
                                    newName = `${p.name} [已下架停售]`;
                                    if (!window.confirm(`確定要將「${p.name}」停售下架嗎？\n停售後客戶將無法再下單此商品。`)) return;
                                  }

                                  // 呼叫現有的 updateProduct 接口更新名稱
                                  await runAction(async () => {
                                    await api.updateProduct(p.id, {
                                      name: newName,
                                      description: p.description,
                                      price: Number(p.price)
                                    });
                                    await refreshCoreData();
                                  }, { successMessage: isDiscontinued ? "商品已恢復販售！" : "商品已成功停售！" });
                                }}
                              >
                                {isDiscontinued ? "恢復販售" : "停售商品"}
                              </button>
                            );
                          })()}
                          <button type="button" className="btn-danger" onClick={() => removeProduct(p.id)}>刪除</button>
                        </div>
                      </div>
                    ) : (
                      // 編輯模式
                      <form onSubmit={(e) => handleUpdateProductAndRecipe(p.id, e)} className="grid" style={{ background: "#f9f9f9", padding: "15px", borderRadius: "8px" }}>
                        <h3>修改商品資料</h3>
                        <label>
                          商品名稱
                          <input value={productEditForm.name} onChange={(e) => setProductEditForm({...productEditForm, name: e.target.value})} placeholder="商品名稱" required />
                        </label>
                        <label>
                          商品描述
                          <input value={productEditForm.description} onChange={(e) => setProductEditForm({...productEditForm, description: e.target.value})} placeholder="商品描述" />
                        </label>
                        <label>
                          價格
                          <input type="number" value={productEditForm.price} onChange={(e) => setProductEditForm({...productEditForm, price: e.target.value})} placeholder="價格" required />
                        </label>                        
                        <h4>配方調整</h4>
                        {materials.map((m) => {
                          // 1. 精準找出該原料是否已存在於當前編輯商品的配方中
                          const currentRecipeItem = productEditForm.recipe.find(r => Number(r.materialId) === Number(m.id));
                          
                          // 2. 決定輸入框要顯示的值：如果配方裡有，就拿它的用量（ratio 或 usageKg），否則就留空
                          // 這樣能完美解決你「數字輸入不流暢、卡 0」以及「顯示目前數量」的痛點
                          const inputValue = currentRecipeItem 
                            ? (currentRecipeItem.ratio ?? currentRecipeItem.usageKg ?? "") 
                            : "";

                          return (
                            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                              <span>
                                {m.name} ({m.unit}) 
                                {/* 如果目前配方有包含此原料，在旁邊貼心顯示提示小字 */}
                                {currentRecipeItem && <small style={{ color: "var(--primary)", marginLeft: "8px" }}>(已在配方中)</small>}
                              </span>
                              
                              <input 
                                type="number" 
                                style={{ width: "120px" }} 
                                placeholder="不用請留空"
                                value={inputValue} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  
                                  // 過濾掉舊的該項原料，避免重複資料留在陣列裡導致 duplicate key 錯誤
                                  const otherRecipeItems = productEditForm.recipe.filter(r => Number(r.materialId) !== Number(m.id));
                                  
                                  let nextRecipe = [...otherRecipeItems];

                                  // 如果使用者有輸入有效數字（且大於 0）
                                  if (val !== "" && Number(val) > 0) {
                                    // 統一格式：確保傳給後端的欄位名稱同時具備 materialId、ratio 與後端可能需要的 usageKg/materialName
                                    nextRecipe.push({
                                      materialId: Number(m.id),
                                      materialName: m.name,
                                      ratio: Number(val),
                                      usageKg: Number(val) // 順便附帶 usageKg 欄位，徹底對齊你後端的資料模型
                                    });
                                  }

                                  // 一口氣更新 State
                                  setProductEditForm({ 
                                    ...productEditForm, 
                                    recipe: nextRecipe 
                                  });
                                }}
                              />
                            </div>
                          );
                        })}
                        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                          <button type="submit">儲存所有變更</button>
                          <button type="button" style={{ background: "#ccc" }} onClick={() => setEditingProductId(null)}>取消</button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {isVendor && activeTab === "materials" && (
            <section className="card">
              <h2>原料管理</h2>
              <div className="tabs subTabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "20px" }}>
                {materialSubTabs.map((subTab, idx) => (
                  <button
                    key={subTab.key}
                    type="button"
                    draggable
                    className={activeMaterialSubTab === subTab.key ? "active" : ""}
                    style={{
                      cursor: "move",
                      opacity: draggedTabIdx === idx ? 0.4 : 1,
                      transition: "opacity 0.2s ease",
                      padding: "8px 16px",
                      fontSize: "0.9rem"
                    }}
                    onClick={() => setActiveMaterialSubTab(subTab.key)}
                    onDragStart={(e) => {
                      setDraggedTabIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => {
                      if (draggedTabIdx === null || draggedTabIdx === idx) return;
                      const updatedTabs = [...materialSubTabs];
                      const draggedItem = updatedTabs[draggedTabIdx];
                      updatedTabs.splice(draggedTabIdx, 1);
                      updatedTabs.splice(idx, 0, draggedItem);
                      setDraggedTabIdx(idx);
                      setMaterialSubTabs(updatedTabs);
                    }}
                    onDragEnd={() => setDraggedTabIdx(null)}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>
              {activeMaterialSubTab === "create" && (
                <form onSubmit={createMaterial} className="grid">
                  <h3>新增原料</h3>
                  <input
                    placeholder="原料名稱"
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                    disabled={isSubmitting}
                  />
                  <label>
                    庫存量
                    <input
                    type="number"
                    min="0"
                    step="1"
                    value={materialForm.stock}
                    onChange={(e) =>
                      setMaterialForm({ ...materialForm, stock: e.target.value === "" ? "" : nonNegativeFromInput(e.target.value) })
                    }
                    disabled={isSubmitting}
                  />
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label>單位</label>
                  {!isCustomUnit ? (
                    <select 
                      value={materialForm.unit || "公斤"} 
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          setIsCustomUnit(true);
                          setMaterialForm({ ...materialForm, unit: "" }); // 清空讓商家輸入
                        } else {
                          setMaterialForm({ ...materialForm, unit: e.target.value });
                        }
                      }} 
                      disabled={isSubmitting}
                    >
                      {unitList.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                      <option value="custom" style={{ color: "var(--primary)", fontWeight: "bold" }}>➕ 新增自訂單位...</option>
                    </select>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input 
                        placeholder="請輸入新單位（如：罐、箱）" 
                        value={customUnitInput} 
                        onChange={(e) => {
                          setCustomUnitInput(e.target.value);
                          setMaterialForm({ ...materialForm, unit: e.target.value });
                        }}
                        disabled={isSubmitting}
                      />
                      <button 
                        type="button" 
                        style={{ 
                            width: "150px",
                            whiteSpace: "nowrap",
                            padding: "12px 0",
                        }}
                        onClick={() => {
                          // 取消自訂，換回預設的第一個單位
                          setIsCustomUnit(false);
                          setCustomUnitInput("");
                          setMaterialForm({ ...materialForm, unit: unitList[0] });
                        }}
                      >
                      取消
                    </button>
                  </div>
                )}
              </div>
                <button type="submit" disabled={isSubmitting}>
                  新增原料
                </button>
              </form>
              )}
              {activeMaterialSubTab === "list" && (
              <div className="subsection">
                <h3>原料列表</h3>
                  <div className="materialEditRow" style={{ marginBottom: "5px", boxShadow: "none", background: "transparent" }}>
                    <input 
                      value="原料名稱" 
                      disabled 
                      style={{ background: "transparent", border: "none", paddingLeft: "14px", fontWeight: "600", color: "var(--subtext)", boxShadow: "none" }} 
                    />
                    <input 
                      value="庫存量" 
                      disabled 
                      style={{ background: "transparent", border: "none", paddingLeft: "14px", fontWeight: "600", color: "var(--subtext)", boxShadow: "none" }} 
                    />
                    <input 
                      value="單位" 
                      disabled 
                      style={{ background: "transparent", border: "none", paddingLeft: "14px", fontWeight: "600", color: "var(--subtext)", boxShadow: "none" }} 
                    />
                    <input 
                      value="補貨警示量" 
                      disabled 
                      style={{ background: "transparent", border: "none", paddingLeft: "14px", fontWeight: "600", color: "var(--subtext)", boxShadow: "none" }} 
                    />
                    {/* 後方保留兩個空的隱形區塊，用來對齊儲存與刪除按鈕的 Grid 格子 */}
                    <div style={{ width: "70px" }} />
                    <div style={{ width: "70px" }} />
                  </div>
                  {materials.map((m) => {
                    const edit = materialEdits[m.id] || {};
                    const isMaterialEditing = editingMaterialId === m.id;

                    return (
                      <div key={m.id} className="materialEditRow">
                        {/* 欄位 1：原料名稱 */}
                        <input 
                          value={edit.name ?? m.name} 
                          onChange={(e) => setMaterialEdits({...materialEdits, [m.id]: { ...edit, name: e.target.value } })} 
                          disabled={isSubmitting || !isMaterialEditing} 
                          style={{ 
                            // 核心修正：非編輯模式下背景微灰、保留原本的邊框，使其看起來像一般框框但鎖死
                            background: isMaterialEditing ? "#ffffff" : "#f5f7f6", 
                            borderColor: "var(--border)",
                            cursor: isMaterialEditing ? "text" : "not-allowed"
                          }}
                        />

                        {/* 欄位 2：庫存量 */}
                        <input 
                          type="number" 
                          min="0" 
                          step="1" 
                          value={edit.stock ?? m.stock} 
                          className={m.is_low_stock ? "lowStock" : ""} 
                          disabled={true} 
                          style={{ 
                            background: m.is_low_stock ? "" : "#f5f7f6", 
                            borderColor: m.is_low_stock ? "var(--danger)" : "var(--border)",
                            borderWidth: m.is_low_stock ? "2px" : "1px",
                            cursor: "not-allowed"
                          }}
                        />

                        {/* 欄位 3：單位選擇 / 自訂 */}
                        {!isMaterialEditing ? (
                          <input 
                            value={m.unit || "公斤"} 
                            disabled 
                            style={{ 
                              background: "#f5f7f6", 
                              borderColor: "var(--border)",
                              cursor: "not-allowed"
                            }} 
                          />
                        ) : editingCustomUnitId !== m.id ? (
                          <select 
                            value={edit.unit ?? m.unit ?? "公斤"} 
                            onChange={(e) => {
                              if (e.target.value === "custom") {
                                setEditingCustomUnitId(m.id);
                                setMaterialEdits({ ...materialEdits, [m.id]: { ...edit, unit: "" } });
                              } else {
                                setMaterialEdits({ ...materialEdits, [m.id]: { ...edit, unit: e.target.value } });
                              }
                            }} 
                            disabled={isSubmitting} 
                          >
                            {m.unit && !unitList.includes(m.unit) && <option value={m.unit}>{m.unit}</option>}
                            {unitList.map((u) => (<option key={u} value={u}>{u}</option>))}
                            <option value="custom">➕ 新增...</option>
                          </select>
                        ) : (
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <input style={{ width: "70px" }} placeholder="新單位" value={editCustomUnitInput} onChange={(e) => { setEditCustomUnitInput(e.target.value); setMaterialEdits({ ...materialEdits, [m.id]: { ...edit, unit: e.target.value } }); }} disabled={isSubmitting} />
                            <button type="button" style={{ padding: "2px 6px", fontSize: "12px", background: "#efefef", color: "#333" }} onClick={() => { setEditingCustomUnitId(null); setEditCustomUnitInput(""); setMaterialEdits({ ...materialEdits, [m.id]: { ...edit, unit: m.unit } }); }}>✖</button>
                          </div>
                        )}

                        {/* 欄位 4：補貨警示量 */}
                        <input 
                          type="number" 
                          min="0" 
                          step="1" 
                          value={edit.low_stock_threshold ?? m.low_stock_threshold ?? 10} 
                          onChange={(e) => setMaterialEdits({...materialEdits, [m.id]: {...edit, low_stock_threshold: nonNegativeStringFromInput(e.target.value) } })} 
                          disabled={isSubmitting || !isMaterialEditing} 
                          style={{ 
                            background: isMaterialEditing ? "#ffffff" : "#f5f7f6", 
                            borderColor: "var(--border)",
                            cursor: isMaterialEditing ? "text" : "not-allowed"
                          }}
                        />

                        {/* 欄位 5：修改 / 儲存按鈕切換 */}
                        {!isMaterialEditing ? (
                          <button 
                            type="button" 
                            style={{ background: "var(--primary)" }} 
                            onClick={() => setEditingMaterialId(m.id)} 
                            disabled={isSubmitting}
                          >
                            修改
                          </button>
                        ) : (
                          <button 
                            type="button" 
                            onClick={async () => {
                              await saveMaterial(m.id); 
                              setEditingMaterialId(null); 
                            }} 
                            disabled={isSubmitting}
                          >
                            儲存
                          </button>
                        )}

                        {!isMaterialEditing ? (
                          // 1. 瀏覽模式：顯示刪除鍵，並保留你原本的防誤刪確認機制
                          <button 
                            type="button" 
                            className="btn-danger" 
                            onClick={() => removeMaterial(m.id)} 
                            disabled={isSubmitting}
                          >
                            刪除
                          </button>
                        ) : (
                          // 2. 編輯模式：切換為取消鍵
                          <button 
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              setMaterialEdits({
                                ...materialEdits,
                                [m.id]: {
                                  name: m.name,
                                  stock: m.stock,
                                  unit: m.unit,
                                  low_stock_threshold: m.low_stock_threshold
                                }
                              });
                              if (editingCustomUnitId === m.id) {
                                setEditingCustomUnitId(null);
                                setEditCustomUnitInput("");
                              }
                              setEditingMaterialId(null);
                            }}
                          >
                            取消
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeMaterialSubTab === "inbound" && (
                <form onSubmit={submitInbound} className="grid subsection">
                  <h3>進貨登錄</h3>
                  <select
                    value={inboundForm.materialId}
                    onChange={(e) => setInboundForm({ ...inboundForm, materialId: e.target.value })}
                    disabled={isSubmitting}
                  >
                    <option value="">選擇原料</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="進貨數量"
                    value={inboundForm.quantity}
                    onChange={(e) =>
                      setInboundForm({ ...inboundForm, quantity: nonNegativeStringFromInput(e.target.value) })
                    }
                    disabled={isSubmitting}
                  />
                  <input
                    placeholder="備註"
                    value={inboundForm.note}
                    onChange={(e) => setInboundForm({ ...inboundForm, note: e.target.value })}
                    disabled={isSubmitting}
                  />
                  <button type="submit" disabled={isSubmitting}>
                    登錄進貨
                  </button>
                </form>
              )}
              {activeMaterialSubTab === "stats" && (
                <div className="subsection">
                  <h3>原料消耗統計（近 30 天）</h3>
                  {consumptionStats.length === 0 ? (
                    <p>尚無消耗紀錄。</p>
                  ) : (
                    consumptionStats.map((s) => (
                      <p key={s.id}>
                        {s.name}: {s.total_consumed} {s.unit}
                      </p>
                    ))
                  )}
                </div>
              )}
              {activeMaterialSubTab === "history" && (
                <div className="subsection">
                  <h3>進出貨紀錄（最近 50 筆）</h3>
                  {movements.length === 0 ? (
                    <p>尚無紀錄。</p>
                  ) : (
                    <table className="movementTable">
                      <thead>
                        <tr>
                          <th>時間</th>
                          <th>原料</th>
                          <th>類型</th>
                          <th>數量</th>
                          <th>訂單</th>
                          <th>備註</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((mm) => (
                          <tr key={mm.id}>
                            <td>{formatDateTime(mm.created_at)}</td>
                            <td>{mm.material_name}</td>
                            <td>{movementTypeLabel[mm.movement_type] || mm.movement_type}</td>
                            <td>{mm.quantity}</td>
                            <td>{mm.order_id ? `#${mm.order_id}` : "-"}</td>
                            <td>{mm.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          )}

          {isVendor && activeTab === "orders" && (
            <section className="card">
              <h2>訂單確認（待處理）</h2>
              <p className="hint">每 15 秒自動更新訂單列表</p>
              {pendingOrders.length === 0 ? (
                <p>目前沒有待處理訂單。</p>
              ) : (
                pendingOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    actions={
                      <>
                        <button type="button" onClick={() => confirmOrder(o.id)} disabled={isSubmitting}>
                          確認接單
                        </button>
                        <button type="button" onClick={() => cancelOrder(o.id)} disabled={isSubmitting}>
                          取消訂單
                        </button>
                      </>
                    }
                  />
                ))
              )}
            </section>
          )}

          {isVendor && activeTab === "orderHistory" && (
            <section className="card">
              <h2>訂單紀錄</h2>
              {/* 新增商家專用的狀態切換頁籤 */}
              <div className="tabs subTabs">
                <button 
                  type="button" 
                  className={vendorHistoryTab === "confirmed" ? "active" : ""} 
                  onClick={() => setVendorHistoryTab("confirmed")}
                  disabled={isSubmitting}
                >
                  已確認 (待完成)
                </button>
                <button 
                  type="button" 
                  className={vendorHistoryTab === "completed" ? "active" : ""} 
                  onClick={() => setVendorHistoryTab("completed")}
                  disabled={isSubmitting}
                >
                  已完成
                </button>
                <button 
                  type="button" 
                  className={vendorHistoryTab === "cancelled" ? "active" : ""} 
                  onClick={() => setVendorHistoryTab("cancelled")}
                  disabled={isSubmitting}
                >
                  已取消
                </button>
              </div>

              {/* 根據選擇的頁籤過濾訂單 */}
              {historyOrders.filter((o) => o.status === vendorHistoryTab).length === 0 ? (
                <p>此分類尚無歷史訂單。</p>
              ) : (
                historyOrders
                  .filter((o) => o.status === vendorHistoryTab)
                  .map((o) => (
                    <OrderCard 
                      key={o.id} 
                      order={o} 
                      actions={null} 
                    />
                  ))
              )}
            </section>
          )}

          {isVendor && activeTab === "reminders" && (
            <RemindersList 
              reminders={historyOrders.filter(o => o.status === "confirmed")} 
              products={products} 
              showCustomer 
              onComplete={completeOrder} // 傳遞標記完成功能
              isSubmitting={isSubmitting} // 傳遞提交鎖定狀態
            />
          )}

          {isVendor && activeTab === "stats" && (
            <section className="card">
              <h2>統計數據</h2>
              <h3>暢銷商品</h3>
              {stats.topProducts.map((s) => (
                <p key={s.name}>
                  {s.name}: {s.total_qty} 件
                </p>
              ))}
              <h3>客戶下單週期</h3>
              {stats.customerFrequency.map((c) => (
                <p key={c.username}>
                  {c.name} - 訂單數 {c.order_count} - 平均週期{" "}
                  {c.avg_cycle_days == null ? "資料不足" : `${c.avg_cycle_days} 天`}
                </p>
              ))}
            </section>
          )}

          {isVendor && activeTab === "profile" && (
            <section className="card">
              <h2>個人資料與商家設定</h2>
              <VendorSettingsForm isSubmitting={isSubmitting} runAction={runAction} />
              <hr />
              <ProfileForm
                isVendor
                isSubmitting={isSubmitting}
                runAction={runAction}
                onUserUpdate={handleUserUpdate}
              />
              <hr />
              <ChangePasswordForm
                isSubmitting={isSubmitting}
                runAction={runAction}
                onUserUpdate={handleUserUpdate}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
