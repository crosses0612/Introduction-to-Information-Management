import { useEffect, useState } from "react";
import { nonNegativeFromInput } from "@/lib/numbers";
import ShopInfo from "@/components/ShopInfo";

export default function OrderForm({ products, isSubmitting, onSubmit, resetToken = 0, notifyError }) {
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("12:00");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState({});

  // 取得今天的日期字串 (YYYY-MM-DD)，用於設定日期的 min 屬性
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    setDeliveryDate("");
    setDeliveryTime("12:00");
    setDeliveryMethod("pickup");
    setDeliveryAddress("");
    setNote("");
    setQuantities({});
  }, [resetToken]);

  function handleSubmit(e) {
    e.preventDefault();

    // 1. 檢查是否有選購商品
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

    // 2. 檢查交貨時間是否為過去的時間
    const now = new Date();
    const selectedDateTime = new Date(`${deliveryDate}T${deliveryTime}`);

    if (selectedDateTime < now) {
      notifyError("交貨時間不能早於當前時間，請重新選擇。");
      return;
    }

    // 3. 檢查配送地址
    if (deliveryMethod === "delivery" && !deliveryAddress.trim()) {
      notifyError("選擇配送時，收貨地址不能為空。");
      return;
    }

    const deliveryAt = `${deliveryDate}T${deliveryTime}:00`;

    // 通過所有檢查，送出資料
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
                    <div key={product.id} className={`product-item${isDiscontinued ? " is-discontinued" : ""}`}>
                      <div className="product-item-meta">
                        <div className="product-item-name">
                          {cleanName}
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
                            [product.id]: e.target.value === "" ? "" : nonNegativeFromInput(e.target.value),
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