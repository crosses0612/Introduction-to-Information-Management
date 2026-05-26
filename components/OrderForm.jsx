import { useEffect, useRef, useState } from "react";
import { nonNegativeFromInput } from "@/lib/numbers";
import ShopInfo from "@/components/ShopInfo";

const STORAGE_KEYS = {
  deliveryDate: "draft_deliveryDate",
  deliveryTime: "draft_deliveryTime",
  deliveryMethod: "draft_deliveryMethod",
  deliveryAddress: "draft_deliveryAddress",
  note: "draft_note",
  quantities: "draft_quantities",
};

function safeGetItem(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetItem(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 可視情況記錄錯誤
  }
}

function safeRemoveItem(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 可視情況記錄錯誤
  }
}

function safeParseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function OrderForm({
  products,
  isSubmitting,
  onSubmit,
  resetToken = 0,
  notifyError = () => {},
}) {
  // 先用預設值，等掛載後再從 localStorage 載入
  const [isReady, setIsReady] = useState(false);

  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("12:00");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState({});

  const prevResetTokenRef = useRef(resetToken);

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // 第一次進到瀏覽器後，讀取草稿
  useEffect(() => {
    const savedDate = safeGetItem(STORAGE_KEYS.deliveryDate, "");
    const savedTime = safeGetItem(STORAGE_KEYS.deliveryTime, "12:00");
    const savedMethod = safeGetItem(STORAGE_KEYS.deliveryMethod, "pickup");
    const savedAddress = safeGetItem(STORAGE_KEYS.deliveryAddress, "");
    const savedNote = safeGetItem(STORAGE_KEYS.note, "");
    const savedQuantities = safeParseJSON(
      safeGetItem(STORAGE_KEYS.quantities, ""),
      {}
    );

    setDeliveryDate(savedDate);
    setDeliveryTime(savedTime);
    setDeliveryMethod(savedMethod);
    setDeliveryAddress(savedAddress);
    setNote(savedNote);
    setQuantities(savedQuantities);

    setIsReady(true);
  }, []);

  // 掛載完成後，變動就即時寫回 localStorage
  useEffect(() => {
    if (!isReady) return;
    safeSetItem(STORAGE_KEYS.deliveryDate, deliveryDate);
  }, [deliveryDate, isReady]);

  useEffect(() => {
    if (!isReady) return;
    safeSetItem(STORAGE_KEYS.deliveryTime, deliveryTime);
  }, [deliveryTime, isReady]);

  useEffect(() => {
    if (!isReady) return;
    safeSetItem(STORAGE_KEYS.deliveryMethod, deliveryMethod);
  }, [deliveryMethod, isReady]);

  useEffect(() => {
    if (!isReady) return;
    safeSetItem(STORAGE_KEYS.deliveryAddress, deliveryAddress);
  }, [deliveryAddress, isReady]);

  useEffect(() => {
    if (!isReady) return;
    safeSetItem(STORAGE_KEYS.note, note);
  }, [note, isReady]);

  useEffect(() => {
    if (!isReady) return;
    safeSetItem(STORAGE_KEYS.quantities, JSON.stringify(quantities));
  }, [quantities, isReady]);

  // 只有 resetToken「真的變動」時才清除，不會在初次掛載誤刪
  useEffect(() => {
    if (!isReady) return;

    if (prevResetTokenRef.current === resetToken) return;
    prevResetTokenRef.current = resetToken;

    setDeliveryDate("");
    setDeliveryTime("12:00");
    setDeliveryMethod("pickup");
    setDeliveryAddress("");
    setNote("");
    setQuantities({});

    safeRemoveItem(STORAGE_KEYS.deliveryDate);
    safeRemoveItem(STORAGE_KEYS.deliveryTime);
    safeRemoveItem(STORAGE_KEYS.deliveryMethod);
    safeRemoveItem(STORAGE_KEYS.deliveryAddress);
    safeRemoveItem(STORAGE_KEYS.note);
    safeRemoveItem(STORAGE_KEYS.quantities);
  }, [resetToken, isReady]);

  function handleSubmit(e) {
    e.preventDefault();

    const items = Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({
        productId: Number(productId),
        quantity: Number(qty),
      }));

    if (items.length === 0) {
      notifyError("請至少選擇一項商品的數量！");
      return;
    }

    if (!deliveryDate || !deliveryTime) {
      notifyError("請先選擇交貨日與交貨時間。");
      return;
    }

    const now = new Date();
    const selectedDateTime = new Date(`${deliveryDate}T${deliveryTime}:00`);

    if (Number.isNaN(selectedDateTime.getTime())) {
      notifyError("交貨日期或時間格式不正確。");
      return;
    }

    if (selectedDateTime < now) {
      notifyError("交貨時間不能早於當前時間，請重新選擇。");
      return;
    }

    if (deliveryMethod === "delivery" && !deliveryAddress.trim()) {
      notifyError("選擇配送時，收貨地址不能為空。");
      return;
    }

    const deliveryAt = `${deliveryDate}T${deliveryTime}:00`;

    onSubmit({
      deliveryAt,
      deliveryMethod,
      deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : "",
      note,
      items,
    });
  }

  return (
    <>
      <ShopInfo />
      <section className="card order-form-shell">
        <h2>下單介面</h2>
        <form onSubmit={handleSubmit} className="order-form-layout">
          <div className="order-form-main">
            <div className="order-form-grid-2">
              <label>
                交貨日
                <input
                  type="date"
                  value={deliveryDate}
                  min={getTodayString()}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                交貨時間
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </label>
            </div>

            <div>
              <h3 className="order-form-section-title">商品清單</h3>
              <div className="product-list">
                {products.map((product) => {
                  const isDiscontinued = product.name.includes("[已下架停售]");
                  const cleanName = isDiscontinued
                    ? product.name.replace(" [已下架停售]", "").replace("[已下架停售]", "")
                    : product.name;

                  return (
                    <div
                      key={product.id}
                      className={`product-item${isDiscontinued ? " is-discontinued" : ""}`}
                    >
                      <div className="product-item-meta">
                        <div className="product-item-name">
                          {cleanName}{" "}
                          {isDiscontinued ? (
                            <strong className="product-item-status">(❌ 已停售)</strong>
                          ) : (
                            <strong className="product-item-price">(NT$ {product.price})</strong>
                          )}
                        </div>

                        {product.description && (
                          <p className="product-item-description">{product.description}</p>
                        )}
                      </div>

                      <input
                        type="number"
                        min="0"
                        max="99999"
                        step="1"
                        className="product-item-input"
                        value={isDiscontinued ? "" : quantities[product.id] || ""}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            [product.id]:
                              e.target.value === ""
                                ? ""
                                : nonNegativeFromInput(e.target.value),
                          })
                        }
                        disabled={isSubmitting || isDiscontinued}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="order-form-sidebar">
            <div className="order-form-sidebar-card">
              <h3 className="order-form-section-title">訂單備註與配送資訊</h3>

              <div className="radioGroup">
                <span className="order-form-label">取貨方式</span>
                <div className="tabs" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className={deliveryMethod === "pickup" ? "active" : ""}
                    onClick={() => setDeliveryMethod("pickup")}
                    disabled={isSubmitting}
                  >
                    來店自取
                  </button>
                  <button
                    type="button"
                    className={deliveryMethod === "delivery" ? "active" : ""}
                    onClick={() => setDeliveryMethod("delivery")}
                    disabled={isSubmitting}
                  >
                    宅配
                  </button>
                </div>
              </div>

              {deliveryMethod === "delivery" && (
                <label>
                  收貨地址
                  <input
                    placeholder="請填寫完整的配送地址"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </label>
              )}

              <label>
                訂單備註
                <textarea
                  placeholder="如有特殊需求請在此註明（選填）"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                  rows={8}
                />
              </label>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "訂單送出中..." : "確認送出訂單"}
              </button>
            </div>
          </aside>
        </form>
      </section>
    </>
  );
}