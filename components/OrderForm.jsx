import { useEffect, useState } from "react";
import { nonNegativeFromInput } from "@/lib/numbers";
import ShopInfo from "@/components/ShopInfo";

export default function OrderForm({ products, isSubmitting, onSubmit, resetToken = 0 }) {
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("12:00");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

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
    setErrorMessage("");
  }, [resetToken]);

  function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    // 1. 檢查是否有選購商品
    const items = Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({
        productId: Number(productId),
        quantity: Number(qty),
      }));

    if (items.length === 0) {
      setErrorMessage("請至少選擇一項商品的數量！");
      return;
    }

    // 2. 檢查交貨時間是否為過去的時間
    const now = new Date();
    const selectedDateTime = new Date(`${deliveryDate}T${deliveryTime}`);

    if (selectedDateTime < now) {
      setErrorMessage("交貨時間不能早於當前時間，請重新選擇。");
      return;
    }

    // 3. 檢查配送地址
    if (deliveryMethod === "delivery" && !deliveryAddress.trim()) {
      setErrorMessage("選擇配送時，收貨地址不能為空。");
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
      <section className="card">
        <h2>下單介面</h2>
        
        <form onSubmit={handleSubmit} className="grid">
          <label>
            交貨日
            <input
              type="date"
              value={deliveryDate}
              min={getTodayString()} /* 限制不能選過去的日期 */
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

          {/* 取貨方式 UI 優化：改為 Tabs 頁籤式按鈕切換 */}
          <div className="radioGroup">
            <span style={{ fontSize: "0.95rem", color: "var(--subtext)", display: "block", marginBottom: "8px" }}>
              取貨方式
            </span>
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
                配送到府
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
              rows={5}
              style={{ resize: "none" }}
            />
          </label>

          <h3 style={{ marginTop: "10px", marginBottom: "5px" }}>商品清單</h3>
          {products
            .filter((p) => p.is_active)
            .map((product) => (
              <div key={product.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div>
                    {product.name} <strong style={{ color: "var(--primary-dark)" }}>(NT$ {product.price})</strong>
                  </div>
                  {product.description && (
                    <p style={{ margin: "5px 0 0 0", color: "var(--subtext)", fontSize: "0.9rem" }}>
                      {product.description}
                    </p>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max="99999"
                  step="1"
                  style={{ width: "100px", textAlign: "left" }}
                  value={quantities[product.id] || ""}
                  onChange={(e) =>
                    setQuantities({
                      ...quantities,
                      [product.id]: e.target.value === "" ? "" : nonNegativeFromInput(e.target.value),
                    })
                  }
                  disabled={isSubmitting}
                />
              </div>
            ))}
          {/* 錯誤提示區塊 */}
          {errorMessage && (
            <div className="alert" style={{ borderLeft: "5px solid var(--danger)", color: "#a94442", background: "#f2dede" }}>
             {errorMessage}
            </div>
          )}
          <button type="submit" disabled={isSubmitting} style={{ marginTop: "10px" }}>
            {isSubmitting ? "訂單送出中..." : "確認送出訂單"}
          </button>
        </form>
      </section>
    </>
  );
}