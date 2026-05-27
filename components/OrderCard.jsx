import { useState, useMemo } from "react";
import { formatDateTime } from "@/lib/format";
import { orderStatusLabel, deliveryMethodLabel } from "@/lib/labels";

export default function OrderCard({ order, actions }) {
  const deliveryAt = order.delivery_at ?? order.delivery_date;
  const items = order.items || [];

  // 1. 初始化讀取：已確認/歷史訂單，優先載入當時客製化的價格快取
  const savedPriceCache = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(`custom_price_order_${order.id}`);
    return raw ? JSON.parse(raw) : null;
  }, [order.id]);

  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // 以商品的 productId 或 product_id 作為鍵值快取
  const [customPrices, setCustomPrices] = useState(() => {
    if (savedPriceCache) return savedPriceCache.prices;
    return {};
  });

  const finalTotalAmount = useMemo(() => {
    // 先寫好一個基礎加總公式，隨時預備當後端沒給金額時動態計算
    const calculateItemsTotal = () => {
      return items.reduce((sum, item) => {
        const prodId = item.productId ?? item.product_id;
        const originalPrice = item.unitPrice ?? item.price ?? item.productPrice ?? 0;
        const currentPrice = customPrices[prodId] !== undefined ? customPrices[prodId] : originalPrice;
        const qty = item.quantity ?? item.count ?? 0;
        return sum + (currentPrice * qty);
      }, 0);
    };

    if (order.status === "pending") {
      return calculateItemsTotal();
    }

    // 已確認、已取消、已過期、已完成等歷史訂單：
    // 第一優先：讀取商家確認時留下的客製化改價快取
    if (savedPriceCache) return savedPriceCache.total;

    // 第二優先：讀取後端回傳的金額（必須大於 0 才採用）
    const backendTotal = order.total_amount ?? order.total_price ?? 0;
    if (backendTotal > 0) return backendTotal;

    // 第三優先（防線）：如果前面都沒有（例如客人自行取消或未確認就過期，後端金額為 0），直接前端重算明細總和！
    return calculateItemsTotal();
  }, [items, customPrices, order.status, order.total_amount, order.total_price, savedPriceCache]);

  // 3. 點下確認接單時，就地寫入快取
  const handleConfirmPriceIntercept = () => {
    const hasChanged = Object.keys(customPrices).length > 0;
    if (hasChanged) {
      localStorage.setItem(
        `custom_price_order_${order.id}`,
        JSON.stringify({
          prices: customPrices,
          total: finalTotalAmount
        })
      );
    }
  };

  return (
    <div className="orderItem">
      {/* 這裡完全保留你原本的排版結構，只將總金額修正為相容多欄位的 finalTotalAmount */}
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

        {actions && (
          <div className="rowActions" onClick={(e) => {
            if (e.target && e.target.textContent.includes("確認")) {
              handleConfirmPriceIntercept();
            }
          }}>
            {order.status === "pending" && actions.props?.children && Array.isArray(actions.props.children) && (
              <button 
                type="button" 
                style={{ marginRight: "0.5px"}}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditingPrice) {
                    const cachedPrices = savedPriceCache ? savedPriceCache.prices : {};
                    setCustomPrices(cachedPrices);
                  }
                  setIsEditingPrice(!isEditingPrice);
                }}
              >
                {isEditingPrice ? "重置單價" : "調整單價"}
              </button>
            )}
            {actions}
          </div>
        )}
      </div>

      {/* 100% 還原你原本最原始的商品明細條列 UI 結構 */}
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
                    
                    {isEditingPrice ? (
                      <div style={{ display: "inline-flex", alignItems: "left", gap: "1px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>NT$ </span>
                        <input 
                          type="number"
                          min="0"
                          value={customPrices[prodId] ?? originalPrice}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, Number(e.target.value));
                            setCustomPrices(prev => ({ ...prev, [prodId]: val }));
                          }}
                          style={{ width: "70px", padding: "2px 4px", fontSize: "0.85rem", textAlign: "right", margin: 0 }}
                        />
                      </div>
                    ) : (
                      <span>
                        {currentPrice != null ? `NT$ ${currentPrice}` : ""}
                      </span>
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