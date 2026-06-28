import { useState, useMemo } from "react";
import { formatDateTime } from "@/lib/format";
import { orderStatusLabel, deliveryMethodLabel } from "@/lib/labels";

export default function OrderCard({ order, actions, onConfirm, onCancel, isSubmitting }) {
  const deliveryAt = order.delivery_at ?? order.delivery_date;
  const items = order.items || [];

  const isPending = order.status === "pending";
  const canAdjustPrice = isPending && typeof onConfirm === "function";

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [customPrices, setCustomPrices] = useState({});

  const finalTotalAmount = useMemo(() => {
    const calculateItemsTotal = () =>
      items.reduce((sum, item) => {
        const prodId = item.productId ?? item.product_id;
        const originalPrice = item.unitPrice ?? item.price ?? item.productPrice ?? 0;
        const currentPrice = customPrices[prodId] !== undefined ? customPrices[prodId] : originalPrice;
        const qty = item.quantity ?? item.count ?? 0;
        return sum + currentPrice * qty;
      }, 0);

    if (isPending) {
      return calculateItemsTotal();
    }

    // 已確認/歷史訂單：優先採用後端金額（已含折後單價），否則前端重算
    const backendTotal = order.total_amount ?? order.total_price ?? 0;
    if (backendTotal > 0) return backendTotal;
    return calculateItemsTotal();
  }, [items, customPrices, isPending, order.total_amount, order.total_price]);

  const handleConfirm = () => {
    const adjusted = {};
    for (const [prodId, price] of Object.entries(customPrices)) {
      if (price !== "" && price != null) adjusted[prodId] = Number(price);
    }
    onConfirm(order.id, Object.keys(adjusted).length > 0 ? { customPrices: adjusted } : undefined);
  };

  return (
    <div className="orderItem">
      <div className="row">
        <div>
          <p>
            <strong>#{order.id}</strong> — {orderStatusLabel(order.status)}
          </p>
          <p>交貨時間：{formatDateTime(deliveryAt)}</p>
          {order.customer_name && <p>客戶：{order.customer_name}</p>}
          {order.customer_phone && <p>客戶電話：{order.customer_phone}</p>}
          {order.delivery_method && (
            <p>
              配送方式：{deliveryMethodLabel(order.delivery_method)}
              {order.delivery_method === "delivery" && order.delivery_address ? ` — ${order.delivery_address}` : ""}
            </p>
          )}
          {order.note && <p>備註：{order.note}</p>}
          <p>金額：NT$ {finalTotalAmount}</p>
        </div>

        {canAdjustPrice ? (
          <div className="rowActions">
            <button
              type="button"
              style={{ marginRight: "0.5px" }}
              disabled={isSubmitting}
              onClick={() => {
                if (isEditingPrice) setCustomPrices({});
                setIsEditingPrice(!isEditingPrice);
              }}
            >
              {isEditingPrice ? "重置單價" : "調整單價"}
            </button>
            <button type="button" onClick={handleConfirm} disabled={isSubmitting}>
              確認接單
            </button>
            {typeof onCancel === "function" && (
              <button type="button" onClick={() => onCancel(order.id)} disabled={isSubmitting}>
                取消訂單
              </button>
            )}
          </div>
        ) : (
          actions && <div className="rowActions">{actions}</div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          {isEditingPrice && (
            <div style={{ fontSize: "0.82rem", color: "var(--primary-dark)", background: "#eef7f4", padding: "6px 10px", borderRadius: "4px", marginBottom: "8px", display: "inline-block", fontWeight: "500" }}>
              提示：修改完單價後，直接按下「確認接單」即可自動儲存並送出訂單！
            </div>
          )}
          <ul>
            {items.map((item, idx) => {
              const prodId = item.productId ?? item.product_id;
              const originalPrice = item.unitPrice ?? item.price ?? item.productPrice ?? 0;
              const currentPrice = customPrices[prodId] !== undefined ? customPrices[prodId] : originalPrice;
              const qty = item.quantity ?? item.count ?? 0;

              return (
                <li key={idx} style={{ padding: "3px 0" }}>
                  <div style={{ display: "inline-flex", justifyContent: "space-between", width: "100%", maxWidth: "250px", alignItems: "center" }}>
                    <span>{item.productName ?? item.product_name} x {qty}</span>

                    {isEditingPrice && canAdjustPrice ? (
                      <div style={{ display: "inline-flex", alignItems: "left", gap: "1px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>NT$ </span>
                        <input
                          type="number"
                          min="0"
                          value={customPrices[prodId] ?? originalPrice}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, Number(e.target.value));
                            setCustomPrices((prev) => ({ ...prev, [prodId]: val }));
                          }}
                          style={{ width: "70px", padding: "2px 4px", fontSize: "0.85rem", textAlign: "right", margin: 0 }}
                        />
                      </div>
                    ) : (
                      <span>{currentPrice != null ? `NT$ ${currentPrice}` : ""}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
