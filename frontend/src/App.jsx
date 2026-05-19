import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { nonNegativeFromInput, nonNegativeStringFromInput } from "./numbers.js";

function formatRecipeLine(r) {
  const kg = r.usageKg ?? r.ratio;
  return `${r.materialName} ${kg} kg`;
}

const emptyProduct = { name: "", description: "", price: 0, isActive: true };
const emptyMaterial = { name: "", stock: 0, unit: "kg", lowStockThreshold: 10 };

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [stats, setStats] = useState({ topProducts: [], customerFrequency: [] });
  const [pendingAlert, setPendingAlert] = useState({ pendingCount: 0, threshold: 5, warning: false });

  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [productForm, setProductForm] = useState(emptyProduct);
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [quantities, setQuantities] = useState({});
  const [recipeEditor, setRecipeEditor] = useState({ productId: "", materialId: "", ratio: "" });
  const [activeTab, setActiveTab] = useState("products");
  const [materialEdits, setMaterialEdits] = useState({});
  const [inboundForm, setInboundForm] = useState({ materialId: "", quantity: "", note: "" });
  const [movements, setMovements] = useState([]);
  const [consumptionStats, setConsumptionStats] = useState([]);

  const isVendor = user?.role === "vendor";
  const isCustomer = user?.role === "customer";

  const cartItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([productId, qty]) => ({ productId: Number(productId), quantity: Number(qty) })),
    [quantities]
  );

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
      const [materialData, orderData, statsData] = await Promise.all([
        api.getMaterials(),
        api.getAllOrders(),
        api.getStats()
      ]);
      setMaterials(materialData);
      setOrders(orderData);
      setStats(statsData);
    }
  }

  useEffect(() => {
    refreshCoreData().catch((err) => setMessage(err.message));
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
      .catch((err) => setMessage(err.message));
  }, [isVendor, activeTab, materials]);

  const lowStockMaterials = useMemo(
    () => materials.filter((m) => m.is_low_stock),
    [materials]
  );

  async function handleAuthSubmit(e) {
    e.preventDefault();
    try {
      const data =
        authMode === "register"
          ? await api.register(authForm)
          : await api.login({ email: authForm.email, password: authForm.password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setMessage("登入成功");
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setOrders([]);
    setReminders([]);
    setStats({ topProducts: [], customerFrequency: [] });
    setMaterials([]);
    setMovements([]);
    setConsumptionStats([]);
    setMaterialEdits({});
  }

  async function submitOrder(e) {
    e.preventDefault();
    try {
      if (!deliveryDate || cartItems.length === 0) throw new Error("請選擇交貨日並至少選擇一項商品");
      await api.createOrder({ deliveryDate, items: cartItems });
      setMessage("訂單送出成功，等待廠商確認");
      setQuantities({});
      setDeliveryDate("");
      await refreshCoreData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createProduct(e) {
    e.preventDefault();
    try {
      await api.createProduct(productForm);
      setProductForm(emptyProduct);
      await refreshCoreData();
      setMessage("商品已新增");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createMaterial(e) {
    e.preventDefault();
    try {
      await api.createMaterial({
        name: materialForm.name,
        stock: nonNegativeFromInput(materialForm.stock),
        unit: materialForm.unit,
        lowStockThreshold: nonNegativeFromInput(materialForm.lowStockThreshold, 10)
      });
      setMaterialForm(emptyMaterial);
      await refreshCoreData();
      setMessage("原料已新增");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function applyRecipe(e) {
    e.preventDefault();
    try {
      if (!recipeEditor.productId || !recipeEditor.materialId || recipeEditor.ratio === "") {
        throw new Error("請先選擇商品、原料與每件用量(kg)");
      }
      const usageKg = nonNegativeFromInput(recipeEditor.ratio);
      const product = products.find((p) => p.id === Number(recipeEditor.productId));
      const existing = product?.recipe || [];
      const next = [...existing.filter((x) => x.materialId !== Number(recipeEditor.materialId))];
      next.push({ materialId: Number(recipeEditor.materialId), ratio: usageKg, usageKg });
      await api.updateRecipe(recipeEditor.productId, next);
      setRecipeEditor({ productId: "", materialId: "", ratio: "" });
      await refreshCoreData();
      setMessage("配方用量已更新");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmOrder(id) {
    try {
      const result = await api.confirmOrder(id);
      await refreshCoreData();
      let msg = "訂單已確認，客戶首頁將顯示交貨提醒";
      if (result.lowStockMaterials?.length) {
        msg += `（低庫存：${result.lowStockMaterials.map((m) => m.name).join("、")}）`;
      }
      setMessage(msg);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelOrder(id) {
    try {
      await api.cancelOrder(id);
      await refreshCoreData();
      setMessage("訂單已取消");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveMaterial(id) {
    const edit = materialEdits[id];
    if (!edit) return;
    try {
      await api.updateMaterial(id, {
        name: edit.name,
        stock: nonNegativeFromInput(edit.stock),
        unit: edit.unit,
        lowStockThreshold: nonNegativeFromInput(edit.low_stock_threshold, 10)
      });
      await refreshCoreData();
      setMessage("原料已更新");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitInbound(e) {
    e.preventDefault();
    try {
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
      setMessage("進貨紀錄已新增");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const movementTypeLabel = {
    inbound: "進貨",
    outbound: "出貨",
    adjustment: "調整"
  };

  async function removeProduct(id) {
    try {
      await api.deleteProduct(id);
      await refreshCoreData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeMaterial(id) {
    try {
      await api.deleteMaterial(id);
      await refreshCoreData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page">
      <h1>資訊管理導論 - 訂單與原料管理系統</h1>
      {message && <p className="message">{message}</p>}

      {!user ? (
        <section className="card">
          <h2>{authMode === "login" ? "會員登入" : "會員註冊"}</h2>
          <form onSubmit={handleAuthSubmit} className="grid">
            {authMode === "register" && (
              <input
                placeholder="姓名"
                value={authForm.name}
                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
              />
            )}
            <input
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="密碼"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            />
            <button type="submit">{authMode === "login" ? "登入" : "註冊"}</button>
          </form>
          <button
            type="button"
            className="link"
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
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
            </p>
            <button onClick={logout}>登出</button>
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

          {isCustomer && (
            <>
              <section className="card">
                <h2>下單介面</h2>
                <form onSubmit={submitOrder} className="grid">
                  <label>
                    交貨日
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </label>
                  {products
                    .filter((p) => p.is_active)
                    .map((product) => (
                      <label key={product.id}>
                        {product.name} (NT$ {product.price})
                        <input
                          type="number"
                          min="0"
                          value={quantities[product.id] || ""}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [product.id]: nonNegativeFromInput(e.target.value)
                            })
                          }
                        />
                      </label>
                    ))}
                  <button type="submit">送出訂單</button>
                </form>
              </section>

              <section className="card">
                <h2>交貨日提醒（已確認訂單）</h2>
                {reminders.length === 0 ? (
                  <p>目前沒有已確認訂單。</p>
                ) : (
                  reminders.map((r) => (
                    <p key={r.id}>
                      訂單 #{r.id} 交貨日：{r.delivery_date}
                    </p>
                  ))
                )}
              </section>

              <section className="card">
                <h2>我的訂單紀錄</h2>
                {orders.map((o) => (
                  <div key={o.id} className="orderItem">
                    <div className="row">
                      <p>
                        #{o.id} - {o.status} - 交貨日 {o.delivery_date}
                      </p>
                      {o.status === "pending" && (
                        <button type="button" onClick={() => cancelOrder(o.id)}>
                          取消訂單
                        </button>
                      )}
                    </div>
                    <ul>
                      {o.items.map((item, idx) => (
                        <li key={idx}>
                          {item.productName} x {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </>
          )}

          {isVendor && (
            <>
              <section className="tabs">
                {[
                  ["products", "商品與配方"],
                  ["materials", "原料管理"],
                  ["orders", "訂單確認"],
                  ["stats", "統計數據"]
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={activeTab === key ? "active" : ""}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </section>

              {activeTab === "products" && (
                <section className="card">
                  <h2>商品管理與配方用量</h2>
                  <form onSubmit={createProduct} className="grid">
                    <input
                      placeholder="商品名稱"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    />
                    <input
                      placeholder="商品描述"
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="價格"
                      value={productForm.price}
                      onChange={(e) =>
                        setProductForm({ ...productForm, price: nonNegativeFromInput(e.target.value) })
                      }
                    />
                    <button type="submit">新增商品</button>
                  </form>

                  <form onSubmit={applyRecipe} className="grid recipeBox">
                    <select
                      value={recipeEditor.productId}
                      onChange={(e) => setRecipeEditor({ ...recipeEditor, productId: e.target.value })}
                    >
                      <option value="">選擇商品</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={recipeEditor.materialId}
                      onChange={(e) => setRecipeEditor({ ...recipeEditor, materialId: e.target.value })}
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
                      placeholder="每件用量 (kg)"
                      value={recipeEditor.ratio}
                      onChange={(e) =>
                        setRecipeEditor({ ...recipeEditor, ratio: nonNegativeStringFromInput(e.target.value) })
                      }
                    />
                    <button type="submit">更新配方用量</button>
                  </form>

                  {products.map((p) => (
                    <div key={p.id} className="row">
                      <div>
                        <strong>{p.name}</strong> - NT$ {p.price}
                        <p>{p.description}</p>
                        <small>
                          配方：
                          {p.recipe.map((r) => formatRecipeLine(r)).join(" / ") || "尚未設定"}
                        </small>
                      </div>
                      <button onClick={() => removeProduct(p.id)}>刪除</button>
                    </div>
                  ))}
                </section>
              )}

              {activeTab === "materials" && (
                <section className="card">
                  <h2>原料管理</h2>
                  <form onSubmit={createMaterial} className="grid">
                    <input
                      placeholder="原料名稱"
                      value={materialForm.name}
                      onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="庫存量 (kg)"
                      value={materialForm.stock}
                      onChange={(e) =>
                        setMaterialForm({ ...materialForm, stock: nonNegativeFromInput(e.target.value) })
                      }
                    />
                    <input
                      placeholder="單位"
                      value={materialForm.unit}
                      onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    />
                    <button type="submit">新增原料</button>
                  </form>

                  <div className="subsection">
                    <h3>原料列表（可編輯庫存）</h3>
                    {materials.map((m) => {
                      const edit = materialEdits[m.id] || {};
                      return (
                        <div key={m.id} className="materialEditRow">
                          <input
                            value={edit.name ?? m.name}
                            onChange={(e) =>
                              setMaterialEdits({
                                ...materialEdits,
                                [m.id]: { ...edit, name: e.target.value }
                              })
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            title="庫存 (kg)"
                            value={edit.stock ?? m.stock}
                            className={m.is_low_stock ? "lowStock" : ""}
                            onChange={(e) =>
                              setMaterialEdits({
                                ...materialEdits,
                                [m.id]: { ...edit, stock: nonNegativeStringFromInput(e.target.value) }
                              })
                            }
                          />
                          <input
                            value={edit.unit ?? m.unit}
                            title="單位"
                            onChange={(e) =>
                              setMaterialEdits({
                                ...materialEdits,
                                [m.id]: { ...edit, unit: e.target.value }
                              })
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            title="低庫存門檻 (kg)"
                            value={edit.low_stock_threshold ?? m.low_stock_threshold ?? 10}
                            onChange={(e) =>
                              setMaterialEdits({
                                ...materialEdits,
                                [m.id]: {
                                  ...edit,
                                  low_stock_threshold: nonNegativeStringFromInput(e.target.value)
                                }
                              })
                            }
                          />
                          <button type="button" onClick={() => saveMaterial(m.id)}>
                            儲存
                          </button>
                          <button type="button" onClick={() => removeMaterial(m.id)}>
                            刪除
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={submitInbound} className="grid subsection">
                    <h3>進貨登錄</h3>
                    <select
                      value={inboundForm.materialId}
                      onChange={(e) => setInboundForm({ ...inboundForm, materialId: e.target.value })}
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
                      placeholder="進貨數量 (kg)"
                      value={inboundForm.quantity}
                      onChange={(e) =>
                        setInboundForm({ ...inboundForm, quantity: nonNegativeStringFromInput(e.target.value) })
                      }
                    />
                    <input
                      placeholder="備註"
                      value={inboundForm.note}
                      onChange={(e) => setInboundForm({ ...inboundForm, note: e.target.value })}
                    />
                    <button type="submit">登錄進貨</button>
                  </form>

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
                              <td>{new Date(mm.created_at).toLocaleString()}</td>
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
                </section>
              )}

              {activeTab === "orders" && (
                <section className="card">
                  <h2>訂單確認</h2>
                  {orders.map((o) => (
                    <div key={o.id} className="row">
                      <span>
                        #{o.id} / {o.customer_name} / {o.status} / 交貨日 {o.delivery_date} / NT$ {o.total_amount}
                      </span>
                      {o.status === "pending" && (
                        <div className="rowActions">
                          <button type="button" onClick={() => confirmOrder(o.id)}>
                            確認接單
                          </button>
                          <button type="button" onClick={() => cancelOrder(o.id)}>
                            取消訂單
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {activeTab === "stats" && (
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
                    <p key={c.email}>
                      {c.name} - 訂單數 {c.order_count} - 平均週期{" "}
                      {c.avg_cycle_days == null ? "資料不足" : `${c.avg_cycle_days} 天`}
                    </p>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
