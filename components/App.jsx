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

const DEFAULT_UNITS = ["公斤 (kg)", "公克 (g)", "磅 (lb)", "公升 (L)", "加侖 (gal)", "桶", "包", "罐"];
const emptyProduct = { name: "", description: "", price: "", isActive: true }; // price 改為 ""
const emptyMaterial = { name: "", stock: "", unit: "公斤", lowStockThreshold: 10 }; // stock 改為 ""

export default function App() {
  const { modalOpen, modalMessage, modalType, isSubmitting, closeModal, runAction, notifyError, runActionNoScroll, notifyErrorNoScroll } =
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
  const [orderFormResetToken, setOrderFormResetToken] = useState(0);
  const [stats, setStats] = useState({ topProducts: [], customerFrequency: [] });
  const [pendingAlert, setPendingAlert] = useState({ pendingCount: 0, threshold: 5, warning: false });

  const [authForm, setAuthForm] = useState({ name: "", username: "", password: "", phone: "" });
  const [productForm, setProductForm] = useState(emptyProduct);
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
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
  const [custTabs, setCustTabs] = useState(() => {
    const defaultTabs = [
      ["order", "下單"],
      ["reminders", "交貨日提醒"],
      ["orders", "訂單紀錄"],
      ["profile", "個人資料"]
    ];
    if (typeof window === "undefined") return defaultTabs;
    const raw = localStorage.getItem("cust_tabs_order");
    return raw ? JSON.parse(raw) : defaultTabs;
  });

  const [vendTabs, setVendTabs] = useState(() => {
    const defaultTabs = [
      ["products", "商品與配方"],
      ["materials", "原料管理"],
      ["orders", "訂單確認"],
      ["orderHistory", "訂單紀錄"],
      ["reminders", "交貨日提醒"],
      ["stats", "統計數據"],
      ["profile", "個人資料"]
    ];
    if (typeof window === "undefined") return defaultTabs;
    const raw = localStorage.getItem("vend_tabs_order");
    return raw ? JSON.parse(raw) : defaultTabs;
  });

  const [clearedExpiredIds, setClearedExpiredIds] = useState(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("cleared_expired_ids");
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("cleared_expired_ids", JSON.stringify(clearedExpiredIds));
  }, [clearedExpiredIds]);



  const [draggedMainTabIdx, setDraggedMainTabIdx] = useState(null);

  const [materialSubTabs, setMaterialSubTabs] = useState(() => {
    const defaultSubTabs = [
      { key: "create", label: "新增原料" },
      { key: "list", label: "原料列表" },
      { key: "inbound", label: "進貨登錄" },
      { key: "stats", label: "原料消耗統計" },
      { key: "history", label: "進出貨紀錄" }
    ];
    if (typeof window === "undefined") return defaultSubTabs;
    const raw = localStorage.getItem("material_sub_tabs_order");
    return raw ? JSON.parse(raw) : defaultSubTabs;
  });

  // 初始化 tabs 狀態（在 user 身份改變時執行一次）
  useEffect(() => {
    if (!user?.id) return;
    if (user.role === "customer" && user.cust_tabs_order && JSON.stringify(user.cust_tabs_order) !== JSON.stringify(custTabs)) {
      setCustTabs(user.cust_tabs_order);
      try { localStorage.setItem("cust_tabs_order", JSON.stringify(user.cust_tabs_order)); } catch {}
    }
    if (user.role === "vendor" && user.vend_tabs_order && JSON.stringify(user.vend_tabs_order) !== JSON.stringify(vendTabs)) {
      setVendTabs(user.vend_tabs_order);
      try { localStorage.setItem("vend_tabs_order", JSON.stringify(user.vend_tabs_order)); } catch {}
    }
    if (user.material_sub_tabs_order && JSON.stringify(user.material_sub_tabs_order) !== JSON.stringify(materialSubTabs)) {
      setMaterialSubTabs(user.material_sub_tabs_order);
      try { localStorage.setItem("material_sub_tabs_order", JSON.stringify(user.material_sub_tabs_order)); } catch {}
    }
  }, [user?.id]);

  // 當 tabs 狀態變動時自動同步到後端
  useEffect(() => {
    if (!user) return;
    if (user.role === "customer") {
      // 更新 localStorage（不 setUser，避免觸發初始化 effect）
      try {
        const next = { ...user, cust_tabs_order: custTabs };
        localStorage.setItem("user", JSON.stringify(next));
      } catch {}
      api.updateProfile({ cust_tabs_order: custTabs }).catch(() => {});
    }
  }, [custTabs]);
  useEffect(() => {
    if (!user) return;
    if (user.role === "vendor") {
      try {
        const next = { ...user, vend_tabs_order: vendTabs };
        localStorage.setItem("user", JSON.stringify(next));
      } catch {}
      api.updateProfile({ vend_tabs_order: vendTabs }).catch(() => {});
    }
  }, [vendTabs]);
  useEffect(() => {
    if (!user) return;
    try {
      const next = { ...user, material_sub_tabs_order: materialSubTabs };
      localStorage.setItem("user", JSON.stringify(next));
    } catch {}
    api.updateProfile({ material_sub_tabs_order: materialSubTabs }).catch(() => {});
  }, [materialSubTabs]);

  const [vendorAlertDays, setVendorAlertDays] = useState(3);
  const [customerAlertDays, setCustomerAlertDays] = useState(3);

  const [activeMaterialSubTab, setActiveMaterialSubTab] = useState("list");

  const [draggedTabIdx, setDraggedTabIdx] = useState(null);

  const isVendor = user?.role === "vendor";
  const isCustomer = user?.role === "customer";
  const [isNoticeOpen, setIsNoticeOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hidePendingAlert, setHidePendingAlert] = useState(false);
  const [hideCycleAlert, setHideCycleAlert] = useState(false);
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
      const myOrders = await api.getMyOrders();
      setOrders(myOrders);
    }

    if (isVendor) {
      const [materialData, pending, history, statsData] = await Promise.all([
        api.getMaterials(),
        api.getVendorOrders("pending"),
        api.getVendorOrders("history"),
        api.getStats()
      ]);
      setMaterials(materialData);
      setPendingOrders(pending);
      setHistoryOrders(history);
      setStats(statsData);
    }
  }

  useEffect(() => {
    if (!user) return;
    setActiveTab(user.role === "customer" ? "order" : "products");
  }, [user?.id, user?.role]);

  useEffect(() => {
    refreshCoreData().catch((err) => notifyErrorNoScroll(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 當有 user（包含從 localStorage 讀取）時，嘗試從後端取得完整 profile，避免 local user 缺少 tabs 欄位
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        // 若 profile 含有額外欄位（例如 cust_tabs_order），則合併並更新 local user
        const merged = { ...user, ...profile };
        localStorage.setItem("user", JSON.stringify(merged));
        setUser(merged);
        setIsNoticeOpen(true);
      })
      .catch(() => {
        /* 忽略錯誤，保持現有 user */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
      // 先儲存基本登入回傳的 user，再向後端取得完整 profile（包含 tabs 設定）
      localStorage.setItem("user", JSON.stringify(data.user));
      // 嘗試取得完整 profile，若成功則合併並儲存
      try {
        const full = await api.getProfile();
        const merged = { ...data.user, ...full };
        localStorage.setItem("user", JSON.stringify(merged));
        setUser(merged);
        setIsNoticeOpen(true);
      } catch (err) {
        setUser(data.user);
        setIsNoticeOpen(true);
      }
      setAuthForm({ name: "", username: "", password: "", phone: "" });
    }, { successMessage: authMode === "register" ? "註冊成功" : null });
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setOrders([]);
    setPendingOrders([]);
    setHistoryOrders([]);
    setStats({ topProducts: [], customerFrequency: [] });
    setMaterials([]);
    setMovements([]);
    setConsumptionStats([]);
    setMaterialEdits({});
    setHidePendingAlert(false);
    setHideCycleAlert(false);
    setIsNoticeOpen(false);
  }

  async function handleOrderSubmit(payload) {
    await runActionNoScroll(async () => {
      if (!payload.deliveryAt || !payload.items?.length) {
        throw new Error("請選擇交貨日時間並至少選擇一項商品");
      }
      await api.createOrder(payload);
      setOrderFormResetToken((t) => t + 1);
      await refreshCoreData();
    }, { successMessage: "訂單送出成功，在廠商確認前可於訂單紀錄中取消" });
  }

  async function completeOrder(id) {
    await runActionNoScroll(async () => {
      await api.completeOrder(id);
      await refreshCoreData();
    }, { successMessage: "訂單已標記為已完成" });
  }

  async function createProduct(e) {
    e.preventDefault();
    
    // 新增防呆：檢查價格是否為空字串或未填
    if (productForm.price === "" || productForm.price === undefined || productForm.price === null) {
      notifyErrorNoScroll("新增失敗：請輸入商品價格！");
      return;
    }
    // 前端直接阻擋名稱重複
    const isDuplicate = products.some(p => p.name.trim() === productForm.name.trim());
    if (isDuplicate) {
      notifyErrorNoScroll("新增失敗：商品名稱「" + productForm.name + "」已存在，請使用其他名稱！");
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
      notifyError("新增失敗：原料名稱「" + materialForm.name + "」已存在，請確認是否重複！");
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
    await runActionNoScroll(async () => {
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
    await runActionNoScroll(
      async () => {
        const result = await api.confirmOrder(id);
        await refreshCoreData();
        return result;
      },
      {
        successMessage: (result) => {
          let msg = "訂單已確認，客戶首頁將顯示交貨提醒";
          return msg;
        }
      }
    );
  }

  async function cancelOrder(id) {
    if (!window.confirm("確定要取消這筆訂單嗎？此動作將無法復原！")) {
      return;
    }
    await runActionNoScroll(async () => {
      await api.cancelOrder(id);
      await refreshCoreData();
    }, { successMessage: "訂單已成功取消" });
  }

  async function saveMaterial(id) {
    const edit = materialEdits[id];
    if (!edit) return;
    await runActionNoScroll(async () => {
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
      alert("無法刪除商品！\n\n因為此商品目前已存在於客戶的訂單紀錄中，因此無法刪除。\n若不繼續販售，請在商品列中對應商品按下停售商品鍵。");
      return;
    }

    if (!window.confirm("確定要將此商品下架並刪除嗎？此動作將無法復原！")) {
      return;
    }

    await runActionNoScroll(async () => {
      await api.deleteProduct(id);
      await refreshCoreData();
    }, { successMessage: "商品已下架刪除" });
  }

  async function removeMaterial(id) {
    if (!window.confirm("確定要刪除此原料嗎？此動作將無法復原！")) {
      return;
    }
    await runActionNoScroll(async () => {
      await api.deleteMaterial(id);
      await refreshCoreData();
    }, { successMessage: "原料已刪除" });
  }

  async function clearAllExpiredOrders() {
    const now = new Date();
    const expiredIds = historyOrders
      .filter(o => o.status === "confirmed")
      .filter(o => {
        const time = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
        return time && new Date(time) < now;
      })
      .map(o => o.id);

    if (expiredIds.length === 0) {
      alert("目前沒有任何已確認的過期訂單。");
      return;
    }

    if (!window.confirm("提醒：會將目前交貨日提醒中的所有過期訂單\n全數移到訂單紀錄『已過期』分項中\n請先檢查過期訂單中是否有已完成訂單但只是尚未標註完成！\n\n確定要進行清除嗎？")) {
      return;
    }

    await runActionNoScroll(async () => {
      setClearedExpiredIds(prev => [...new Set([...prev, ...expiredIds])]);
      await Promise.all(expiredIds.map(id => api.completeOrder(id))); 
      await refreshCoreData();
    }, { successMessage: "所有過期訂單已成功清除！" });
  }

  const tabs = isCustomer ? custTabs : isVendor ? vendTabs : [];
  const setTabs = isCustomer ? setCustTabs : isVendor ? setVendTabs : () => {};

  const getTabBadgeCount = (key) => {
    if (isVendor) {
      if (key === "orders") {
        return pendingOrders.length;
      }
      if (key === "reminders") {
        return historyOrders.filter((o) => {
          if (o.status !== "confirmed") return false;
          const deliveryTime = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
          if (!deliveryTime) return false;
          const diffDays = (new Date(deliveryTime) - new Date()) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= vendorAlertDays;
        }).length;
      }
    }

    if (isCustomer) {
      if (key === "reminders") {
        return orders.filter((o) => {
          if (o.status !== "confirmed") return false;
          const deliveryTime = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
          if (!deliveryTime) return false;
          const diffDays = (new Date(deliveryTime) - new Date()) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= customerAlertDays;
        }).length;
      }
    }

    return 0;
  };

  const activeTabLabel = tabs.find(([key]) => key === activeTab)?.[1] ?? "";

  const nearestOrderNotice = useMemo(() => {
    const targetOrders = isVendor 
      ? historyOrders.filter(o => o.status === "confirmed")
      : isCustomer 
        ? orders.filter(o => o.status === "confirmed")
        : [];

    const now = new Date();
    const unexpired = targetOrders
      .map(o => {
        const time = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
        return { ...o, parsedTime: time ? new Date(time) : null };
      })
      .filter(o => o.parsedTime && o.parsedTime >= now)
      .sort((a, b) => a.parsedTime - b.parsedTime);

    if (unexpired.length === 0) return null;
    
    const next = unexpired[0];
    const diffHours = (next.parsedTime - now) / (1000 * 60 * 60);
    let timeLeftStr = diffHours <= 24 
      ? `剩餘不到 ${Math.ceil(diffHours)} 小時！`
      : `剩餘 ${Math.ceil(diffHours / 24)} 天`;

    return {
      id: next.id,
      customer: next.customer_name || next.customerName || next.user_name || "未知客戶",
      phone: next.customer_phone || next.customerPhone || "無",
      deliveryMethod: next.delivery_method ?? next.deliveryMethod ?? "來店自取",
      address: next.delivery_address ?? next.deliveryAddress ?? "",
      timeStr: formatDateTime(next.delivery_at ?? next.deliveryAt ?? next.delivery_date),
      timeLeftStr
    };
  }, [isVendor, isCustomer, historyOrders, orders]);

  const expiredConfirmedCount = useMemo(() => {
    if (!isVendor) return 0;
    const now = new Date();
    
    return historyOrders.filter((o) => {
      // 1. 必須是已確認狀態
      if (o.status !== "confirmed") return false;
      
      // 2. 且交貨時間小於現在時間 (已過期)
      const deliveryTime = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
      return deliveryTime && new Date(deliveryTime) < now;
    }).length;
  }, [isVendor, historyOrders]);

  return (
    <div className="page dashboardShell">
      <FeedbackModal
        open={modalOpen}
        message={modalMessage}
        type={modalType}
        onClose={closeModal}
      />

      <div className={`dashboardHeader ${user ? "withSidebar" : ""}`}>
        <div>
          <h1 className="dashboardTitle">智慧訂單系統</h1>
          
        </div>
        {user && (
          <div className="headerActions">
            <button
              type="button"
              className="sidebarToggleBtn"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label="切換選單"
            >
              ☰
            </button>
            <button type="button" className="secondary" onClick={() => setIsNoticeOpen(!isNoticeOpen)} title="通知中心">
              通知中心
            </button>
          </div>
        )}
      </div>
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
                  placeholder="電話" 
                  value={authForm.phone} 
                  onChange={(e) => {
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
        </section>
      ) : (
        <div className="dashboardLayout">
          <div className={"sidebarBackdrop" + (isSidebarOpen ? " open" : "")} onClick={() => setIsSidebarOpen(false)} />
          <aside className={"sidebar" + (isSidebarOpen ? " open" : "")}>
            <div className="sidebarPanel">
              <div className="sidebarUser">
                {!isVendor && (
                  <>
                    <p className="sidebarUserName">{user.name}</p>
                    <p className="sidebarUserMeta">
                      {user.role} · {user.phone || "未設定電話"}
                    </p>
                  </>
                )}

                {isVendor && (
                  <>
                    <p className="sidebarUserName">{user.name}</p>
                    <p className="sidebarUserMeta">{user.role}</p>
                  </>
                )}
              </div>

              <nav className="sidebarNav">
                {tabs.map(([key, label], idx) => {
                  const badgeCount = getTabBadgeCount(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={activeTab === key ? "active" : ""}
                      onClick={() => {
                        setActiveTab(key);
                        if (isSidebarOpen) setIsSidebarOpen(false);
                      }}
                      disabled={isSubmitting}
                      draggable
                      title="按住左右拖曳可調整選單順序"
                      onDragStart={(e) => {
                        setDraggedMainTabIdx(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={(e) => {
                        if (draggedMainTabIdx === null || draggedMainTabIdx === idx) return;
                        const updatedTabs = [...tabs];
                        const draggedItem = updatedTabs[draggedMainTabIdx];
                        updatedTabs.splice(draggedMainTabIdx, 1);
                        updatedTabs.splice(idx, 0, draggedItem);
                        setDraggedMainTabIdx(idx);
                        setTabs(updatedTabs);
                      }}
                      onDragEnd={() => setDraggedMainTabIdx(null)}
                    >
                      <span>{label}</span>
                      {badgeCount > 0 && <span className="sidebarBadge">{badgeCount}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="mainContent">
            <section className="card headerRow">
              <p>
                目前身份：<strong>{user.name}</strong> ({user.role})
                {user.phone ? ` · 電話 ${user.phone}` : ""}
              </p>
              <button type="button" onClick={logout} disabled={isSubmitting}>
                登出
              </button>
            </section>


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
              reminders={orders.filter(o => o.status === "confirmed")} 
              products={products}
              alertDays={customerAlertDays}
              onAlertDaysChange={setCustomerAlertDays}
            />
          )}

          {isCustomer && activeTab === "orders" && (
            <CustomerOrders 
              orders={orders}
              isSubmitting={isSubmitting}
              onCancel={cancelOrder}
              clearedExpiredIds={clearedExpiredIds}
            />
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

              <div className="productCardGrid">
                {products.map((p) => {
                  const isDiscontinued = p.name.includes("[已下架停售]");
                  const cleanName = isDiscontinued
                    ? p.name.replace(" [已下架停售]", "").replace("[已下架停售]", "")
                    : p.name;

                  return (
                    <article key={p.id} className="productCard">
                      <div className="productCardHeader">
                        <div>
                          <p className="productCardTitle">{cleanName}</p>
                          <p className="productCardMeta">NT$ {p.price}</p>
                        </div>
                        <span className={`statusBadge ${isDiscontinued ? "statusBadgeWarning" : "statusBadgeSuccess"}`}>
                          {isDiscontinued ? "已停售" : "販售中"}
                        </span>
                      </div>
                      {p.description && <p className="productCardDescription">{p.description}</p>}
                      <p className="productCardRecipe">
                        <strong>配方：</strong>
                        {p.recipe?.length > 0
                          ? p.recipe
                              .map((r) => {
                                const currentMaterial = materials.find((m) => Number(m.id) === Number(r.materialId));
                                const latestUnit = currentMaterial ? currentMaterial.unit : (r.materialUnit || "kg");
                                return `${r.materialName} ${r.ratio} ${latestUnit}`;
                              })
                              .join(" / ")
                          : "尚未設定"}
                      </p>
                      <div className="productCardActions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setEditingProductId(p.id);
                            setProductEditForm({ name: p.name, description: p.description, price: p.price, recipe: p.recipe || [] });
                          }}
                        >
                          編輯商品與配方
                        </button>
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

                            await runActionNoScroll(async () => {
                              await api.updateProduct(p.id, {
                                name: newName,
                                description: p.description,
                                price: Number(p.price),
                              });
                              await refreshCoreData();
                            }, { successMessage: isDiscontinued ? "商品已恢復販售！" : "商品已成功停售！" });
                          }}
                          className={isDiscontinued ? "secondary" : ""}
                        >
                          {isDiscontinued ? "恢復販售" : "停售商品"}
                        </button>
                        <button type="button" className="btn-danger" onClick={() => removeProduct(p.id)}>
                          刪除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {editingProductId && (
              <div className="drawerOverlay" onClick={() => setEditingProductId(null)}>
                <aside className="drawerPanel" onClick={(e) => e.stopPropagation()}>
                  <div className="drawerHeader">
                    <div>
                      <p className="drawerTitle">編輯商品與配方</p>
                      <p className="drawerHint">調整商品資訊與原料用量，保存後即時生效。</p>
                    </div>
                    <button type="button" className="iconButton" onClick={() => setEditingProductId(null)}>
                      ✕
                    </button>
                  </div>
                  <form onSubmit={(e) => handleUpdateProductAndRecipe(editingProductId, e)} className="drawerForm">
                    <div className="grid drawerGrid">
                      <label>
                        商品名稱
                        <input
                          value={productEditForm.name}
                          onChange={(e) => setProductEditForm({ ...productEditForm, name: e.target.value })}
                          placeholder="商品名稱"
                          required
                        />
                      </label>
                      <label>
                        商品描述
                        <input
                          value={productEditForm.description}
                          onChange={(e) => setProductEditForm({ ...productEditForm, description: e.target.value })}
                          placeholder="商品描述"
                        />
                      </label>
                      <label>
                        價格
                        <input
                          type="number"
                          value={productEditForm.price}
                          onChange={(e) => setProductEditForm({ ...productEditForm, price: e.target.value })}
                          placeholder="價格"
                          required
                        />
                      </label>
                    </div>

                    <div className="drawerSection">
                      <h3>配方調整</h3>
                      <div className="recipeGrid">
                        {materials.map((m) => {
                          const currentRecipeItem = productEditForm.recipe.find((r) => Number(r.materialId) === Number(m.id));
                          const inputValue = currentRecipeItem ? (currentRecipeItem.ratio ?? currentRecipeItem.usageKg ?? "") : "";

                          return (
                            <label key={m.id} className="recipeRow">
                              <span>{m.name} ({m.unit})</span>
                              <input
                                type="number"
                                value={inputValue}
                                placeholder="用量"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const otherRecipeItems = productEditForm.recipe.filter((r) => Number(r.materialId) !== Number(m.id));
                                  let nextRecipe = [...otherRecipeItems];
                                  if (val !== "" && Number(val) > 0) {
                                    nextRecipe.push({
                                      materialId: Number(m.id),
                                      materialName: m.name,
                                      ratio: Number(val),
                                      usageKg: Number(val),
                                    });
                                  }
                                  setProductEditForm({ ...productEditForm, recipe: nextRecipe });
                                }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="drawerActions">
                      <button type="submit" className="primary">
                        儲存變更
                      </button>
                      <button type="button" className="secondary" onClick={() => setEditingProductId(null)}>
                        取消
                      </button>
                    </div>
                  </form>
                </aside>
              </div>
            )}

          {isVendor && activeTab === "materials" && (
            <section className="card">
              <h2>原料管理</h2>
              <div className="tabs subTabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "20px"}}>
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
                      fontSize: "0.9rem",
                      borderRadius: "12px"
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
                  <div className="materialEditRow materialHeaderRow">
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
                          <div className="customUnitField">
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
                <button 
                  type="button" 
                  className={vendorHistoryTab === "expired" ? "active" : ""} 
                  onClick={() => setVendorHistoryTab("expired")} 
                  disabled={isSubmitting}
                >
                  已過期
                </button>
              </div>

              {(() => {
                const now = new Date();
                
                const filteredOrders = historyOrders.filter((o) => {
                  const deliveryTime = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
                  const isOverdue = deliveryTime && new Date(deliveryTime) < now;
                  const isSweptByClearButton = clearedExpiredIds.includes(o.id);

                  if (vendorHistoryTab === "expired") {
                    return (o.status === "confirmed" && isOverdue) || (o.status === "completed" && isSweptByClearButton);
                  } else if (vendorHistoryTab === "completed") {
                    return o.status === "completed" && !isSweptByClearButton;
                  } else if (vendorHistoryTab === "confirmed") {
                    return o.status === "confirmed" && !isOverdue;
                  } else {
                    return o.status === vendorHistoryTab;
                  }
                });

                return filteredOrders.length === 0 ? (
                  <p>此分類尚無歷史訂單。</p>
                ) : (
                  filteredOrders.map((o) => (
                    <OrderCard key={o.id} order={o} actions={null} />
                  ))
                );
              })()}
            </section>
          )}

          {isVendor && activeTab === "reminders" && (
            <RemindersList 
              reminders={historyOrders.filter(o => o.status === "confirmed")} 
              products={products} 
              showCustomer 
              onComplete={completeOrder}
              isSubmitting={isSubmitting}
              alertDays={vendorAlertDays}
              onAlertDaysChange={setVendorAlertDays}
              onClearExpired={clearAllExpiredOrders}
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
          </main>
        </div>
      )}
      {user && (
        <>
          <div className="mobileActionBar">
            <div>
              <p className="mobileActionLabel">{activeTabLabel}</p>
            </div>
          </div>
          <div className="notice-wrapper">
            {isNoticeOpen && (
              <div
                className="notice-overlay"
                onClick={() => setIsNoticeOpen(false)}
              />
            )}

            {isNoticeOpen && (
              <div
                className="notice-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="notice-header">
                  <span className="notice-title">系統即時通知中心</span>
                </div>

              {nearestOrderNotice ? (
                <div className="notice-item-red">
                  <div className="notice-item-red-header">
                    <span>最近的交貨任務：</span>
                    <span>{nearestOrderNotice.timeLeftStr}</span>
                  </div>
                  <div style={{ fontSize: "0.9rem", lineHeight: "1.5" }}>
                    <div><strong>訂單編號：</strong> #{nearestOrderNotice.id}</div>
                    {isVendor && (
                      <>
                        <div><strong>客戶資訊：</strong> {nearestOrderNotice.customer} / Tel: {nearestOrderNotice.phone}</div>
                        <div><strong>配送方式：</strong> {nearestOrderNotice.deliveryMethod === "delivery" ? `配送到府 (${nearestOrderNotice.address})` : "來店自取"}</div>
                      </>
                    )}
                    <div><strong>交貨時間：</strong> <span>{nearestOrderNotice.timeStr}</span></div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "6px", color: "var(--subtext)", fontSize: "0.88rem", textAlign: "center" }}>
                  目前暫無即將到期的交貨日訂單。
                </div>
              )}

              {isVendor && expiredConfirmedCount > 0 && (
                <div className="notice-item-red">
                  <div className="notice-item-red-header">
                    <span>逾期訂單警示：</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", lineHeight: "1.6", color: "#262626" }}>
                    目前有 <strong style={{ color: "var(--danger)"}}>{expiredConfirmedCount}</strong> 筆訂單<strong>已超過交貨時間</strong>！
                    <div style={{ fontSize: "0.85rem"}}>
                      請前往「交貨日提醒」確認過期訂單狀態，完成的訂單請補選『標記已完成』，剩餘訂單如未完成可按下『清除所有過期訂單』。
                    </div>
                  </div>
                </div>
              )}

              {isVendor && lowStockMaterials.length > 0 && (
                <div className="notice-item-red">
                  <div className="notice-item-red-header">
                    <span>原料庫存不足補貨警示：</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.85rem", color: "var(--text)" }}>
                    {lowStockMaterials.map((m) => (
                      <li key={m.id}>
                        {m.name}：剩餘 <strong style={{ color: "var(--danger)" }}>{m.stock}</strong> {m.unit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

                {isVendor && (
                  <>
                    {pendingAlert.warning && !hidePendingAlert && (
                      <div className="notice-item-yellow">
                        <span className="notice-item-yellow-text">
                          <strong>待確認訂單偏高：</strong>
                          目前 <strong>{pendingAlert.pendingCount}</strong> 筆待確認訂單，請加速審核以免客戶久候。
                        </span>

                        <button
                          type="button"
                          className="notice-item-dismiss"
                          onClick={() => setHidePendingAlert(true)}
                        >
                          ✖
                        </button>
                      </div>
                    )}

                    {stats.customerFrequency &&
                      stats.customerFrequency.filter(
                        (c) => c.avg_cycle_days !== null && c.avg_cycle_days <= 3
                      ).length > 0 &&
                      !hideCycleAlert && (
                        <div className="notice-item-yellow">
                          <span className="notice-item-yellow-text">
                            <strong>下單週期預警：</strong>
                            <strong>
                              {stats.customerFrequency
                                .filter(
                                  (c) =>
                                    c.avg_cycle_days !== null &&
                                    c.avg_cycle_days <= 3
                                )
                                .map((c) => c.name)
                                .join("、")}
                            </strong>
                            預計近期再度訂購，請調配原料產能。
                          </span>

                          <button
                            type="button"
                            className="notice-item-dismiss"
                            onClick={() => setHideCycleAlert(true)}
                          >
                            ✖
                          </button>
                        </div>
                      )}
                  </>
                )}

                {isCustomer && (
                  <>
                    {pendingAlert.warning && !hideCycleAlert && (
                      <div className="notice-item-yellow">
                        <span className="notice-item-yellow-text">
                          <strong>待確認訂單偏高：</strong>
                          目前店家訂單排單較滿，新成立訂單等候確認之時間可能稍長，請多包涵。
                        </span>

                        <button
                          type="button"
                          className="notice-item-dismiss"
                          onClick={() => setHideCycleAlert(true)}
                        >
                          ✖
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button 
              type="button"
              className="notice-toggle-btn"
              onClick={() => setIsNoticeOpen(!isNoticeOpen)}
              title="開啟通知中心"
            >
              {((isVendor && (lowStockMaterials.length > 0 || (pendingAlert.warning && !hidePendingAlert) || nearestOrderNotice || expiredConfirmedCount > 0)) || 
                (isCustomer && (nearestOrderNotice || (pendingAlert.warning && !hidePendingAlert)))) && (
                <span className="notice-badge-dot" />
              )}
            </button>

          </div>
          </>
        )}
      </div>
    );
}

