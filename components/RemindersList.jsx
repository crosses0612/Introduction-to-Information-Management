import { useState, useEffect } from "react";
import { formatDateTime } from "@/lib/format";
import { deliveryMethodLabel } from "@/lib/labels";

export default function RemindersList({ reminders, products, showCustomer = false, onComplete, isSubmitting, alertDays = 3, onAlertDaysChange, onClearExpired }) {
  const [tempDays, setTempDays] = useState(alertDays);
  const [isEditingDays, setIsEditingDays] = useState(false);

  useEffect(() => {
    setTempDays(alertDays);
  }, [alertDays]);

  // ✨ 修正 1：純粹移除「過期沉底」的 4 行，完全保留其餘時間軸排序
  const sortedReminders = [...(reminders || [])].sort((a, b) => {
    const timeA = new Date((a.delivery_at ?? a.deliveryAt ?? a.delivery_date) || 0);
    const timeB = new Date((b.delivery_at ?? b.deliveryAt ?? b.delivery_date) || 0);
    return timeA - timeB;
  });

  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px", borderBottom: "2px solid var(--border)", paddingBottom: "12px" }}>
        <h2 style={{ margin: 0 }}>交貨日提醒（已確認訂單）</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {showCustomer && onClearExpired && (
            <button type="button" onClick={onClearExpired}>
              清除所有過期訂單
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px", background: "#f8fbfa", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "0px" }}>
          <h3>訂單交貨日到期警示設定：</h3>
          <input 
            type="number" 
            min="1" 
            max="30" 
            value={tempDays} 
            onChange={(e) => {
              setTempDays(e.target.value === "" ? "" : Math.max(1, Math.min(30, Number(e.target.value))));
              setIsEditingDays(true);
            }} 
            style={{ width: "60px", padding: "8px", textAlign: "center", borderRadius: "8px", marginBottom: 15 }} 
          />
          <h3>日內訂單</h3>
          {isEditingDays && (
            <div style={{ display: "inline-flex", gap: "5px", marginLeft: "4px" }}>
              <button type="button" style={{ padding:"8px 12px", marginBottom: "15px" }} onClick={() => { if (onAlertDaysChange) onAlertDaysChange(tempDays); setIsEditingDays(false); }}>
                套用
              </button>
              <button type="button" style={{ padding:"8px 12px", background: "#ccc", color: "#333", marginBottom: "15px" }} onClick={() => { setTempDays(alertDays); setIsEditingDays(false); }}>
                取消
              </button>
            </div>
          )}
        </div>

        {/* 隨 n 更新的警示訂單數計數列 */}
        <div style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
          <h3>當前設定下，警示訂單共計：</h3>
          <strong style={{ color: "var(--danger)", fontSize: "1.1rem", marginBottom: "15px" }}>
            {(() => {
              const now = new Date();
              const targetDays = isEditingDays ? (Number(tempDays) || alertDays) : alertDays;
              return (reminders || []).filter(o => {
                const time = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
                if (!time) return false;
                const diffDays = (new Date(time) - now) / (1000 * 60 * 60 * 24);
                return diffDays >= 0 && diffDays <= targetDays;
              }).length;
            })()}
          </strong>
          <h3>筆</h3>
        </div>
      </div>

      {sortedReminders.length === 0 ? (
        <p>目前沒有即將到期的已確認訂單。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", fontSize: "18px" }}>
          {sortedReminders.map((r, index) => {
            // ✨ 100% 還原你原本的金額與小計邏輯
            const itemsSubtotal = r.items?.reduce((sum, item) => {
              const targetProductId = item.productId ?? item.product_id;
              const matchedProduct = products?.find(p => Number(p.id) === Number(targetProductId));
              
              // 補上：如果是被客製化過，優先從全域快取取用該項單價
              let itemPrice = Number(matchedProduct?.price ?? item.price ?? item.productPrice ?? item.unitPrice ?? 0);
              if (typeof window !== "undefined") {
                const cached = localStorage.getItem(`custom_price_order_${r.id}`);
                if (cached) {
                  const savedPrices = JSON.parse(cached).prices;
                  if (savedPrices[item.productId ?? item.product_id] !== undefined) {
                    itemPrice = savedPrices[item.productId ?? item.product_id];
                  }
                }
              }
              const itemQuantity = Number(item.quantity || 0);
              return sum + (itemPrice * itemQuantity);
            }, 0) ?? 0;

            const backendTotal = r.total_amount ?? r.total_price ?? r.totalPrice ?? r.totalAmount ?? 0;
            
            // ✨ 如果快取裡有新總價，優先顯示新總價；否則遵循你原本的 backendTotal : itemsSubtotal
            let finalTotal = backendTotal > 0 ? backendTotal : itemsSubtotal;
            if (typeof window !== "undefined") {
              const cached = localStorage.getItem(`custom_price_order_${r.id}`);
              if (cached) finalTotal = JSON.parse(cached).total;
            }

            const deliveryTime = r.delivery_at ?? r.deliveryAt ?? r.delivery_date;
            let isUrgent = false;
            let isOverdue = false;
            let timeWarningText = "";
            
            if (deliveryTime) {
              const now = new Date();
              const deliveryDateObj = new Date(deliveryTime);
              const diffMs = deliveryDateObj - now;
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              if (diffDays < 0) {
                timeWarningText = "已過交貨時間！";
                isOverdue = true;
              } else if (diffDays <= 1) {
                timeWarningText = deliveryDateObj.getDate() === now.getDate() ? "今天交貨！" : "明天交貨！";
                isUrgent = true;
              } else if (diffDays <= alertDays) {
                timeWarningText = `剩餘不到 ${Math.ceil(diffDays)} 天`;
                isUrgent = true;
              }
            }

            return (
              <div key={r.id || index} className="orderItem" style={{ borderLeft: isOverdue ? "6px solid #8c8c8c" : isUrgent ? "6px solid var(--danger)" : "5px solid var(--primary)", padding: "15px", background: isOverdue ? "#fcfcfc" : isUrgent ? "#fffafb" : "#fff", opacity: isOverdue ? 0.75 : 1, borderRadius: "6px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span><strong>訂單 #{r.id}</strong></span>
                    {timeWarningText && <span style={{ fontSize: "16px", background: isOverdue ? "#8c8c8c" : "var(--danger)", color: "white", padding: "3px 9px", borderRadius: "20px", fontWeight: "bold" }}>{timeWarningText}</span>}
                  </div>
                  <span style={{ color: (isUrgent || isOverdue) ? "var(--danger)" : "var(--text)", fontWeight: "bold" }}>交貨時間：{deliveryTime ? formatDateTime(deliveryTime) : "未設定"}</span>
                </div>

                {showCustomer && (r.customer_name || r.customerName || r.customer_phone || r.customerPhone || r.user_name) && (
                  <div style={{ fontSize: "0.9rem", color: "var(--text)", background: isOverdue ? "#eee" : isUrgent ? "#fdf2f4" : "#f9f9f9", padding: "8px", borderRadius: "4px" }}>
                    {(r.customer_name || r.customerName || r.user_name) && <div><strong>客戶：</strong> {r.customer_name || r.customerName || r.user_name}</div>}
                    {(r.customer_phone || r.customerPhone) && <div><strong>電話：</strong> {r.customer_phone || r.customerPhone}</div>}
                  </div>
                )}

                {/* 訂購明細：100% 保留你原有的全部明細表格結構 */}
                <div style={{ padding: "5px 0" }}>
                  <strong style={{ block: "block", marginBottom: "5px", color: "var(--subtext)", fontSize: "0.9rem" }}>訂購明細：</strong>
                  {r.items && r.items.length > 0 ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                      <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px dotted #ccc", color: "gray" }}>
                          <th style={{ padding: "4px" }}>商品名稱</th>
                          <th style={{ padding: "4px", textAlign: "right" }}>數量</th>
                          <th style={{ padding: "4px", textAlign: "right" }}>小計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.items.map((item, i) => {
                          const targetProductId = item.productId ?? item.product_id;
                          const matchedProduct = products?.find(p => Number(p.id) === Number(targetProductId));
                          
                          // 優先從客製化快取抽取單價
                          let itemPrice = Number(matchedProduct?.price ?? item.price ?? item.productPrice ?? item.unitPrice ?? 0);
                          if (typeof window !== "undefined") {
                            const cached = localStorage.getItem(`custom_price_order_${r.id}`);
                            if (cached) {
                              const savedPrices = JSON.parse(cached).prices;
                              if (savedPrices[item.productId ?? item.product_id] !== undefined) {
                                itemPrice = savedPrices[item.productId ?? item.product_id];
                              }
                            }
                          }
                          const itemQuantity = Number(item.quantity || 0);

                          return (
                            <tr key={i} style={{ borderBottom: "1px dotted #efefef" }}>
                              <td style={{ padding: "6px 4px" }}>{item.productName || item.product_name || matchedProduct?.name || `商品ID: ${targetProductId}`}</td>
                              <td style={{ padding: "6px 4px", textAlign: "right" }}>{itemQuantity} 件</td>
                              <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: "600" }}>NT$ {itemPrice * itemQuantity}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: "var(--subtext)", fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>（目前無法載入，完整明細請至「訂單確認」或「訂單紀錄」頁籤查看）</p>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #eee", fontSize: "0.9rem" }}>
                  <div>
                    <strong>配送資訊：</strong> 
                    {r.delivery_method ?? r.deliveryMethod ? deliveryMethodLabel(r.delivery_method ?? r.deliveryMethod) : "未指定"}
                    {(r.delivery_address ?? r.deliveryAddress) && ` — ${r.delivery_address ?? r.deliveryAddress}`}
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--primary-dark)" }}>
                    總金額：<span style={{ color: "var(--danger)" }}>NT$ {finalTotal}</span>
                  </div>
                </div>

                {r.note && (
                  <div style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic", marginTop: "5px", borderTop: "1px dashed #eee", paddingTop: "5px" }}>
                    備註：{r.note}
                  </div>
                )}

                {/* 🔒 完好如初的核心原裝按鈕 */}
                {showCustomer && onComplete && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "5px" }}>
                    <button type="button" style={{ padding: "8px 16px", fontSize: "0.9rem" }} onClick={() => onComplete(r.id)} disabled={isSubmitting}>
                      標記已完成
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}