import { formatDateTime } from "@/lib/format";
import { deliveryMethodLabel } from "@/lib/labels";

export default function RemindersList({ reminders, products, showCustomer = false, onComplete, isSubmitting }) {
  return (
    <section className="card">
      <h2>交貨日提醒（已確認訂單）</h2>

      {!reminders || reminders.length === 0 ? (
        <p>目前沒有即將到期的已確認訂單。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {reminders.map((r, index) => {
            // 1. 先計算出這筆提醒中，所有商品品項的小計總和
            const itemsSubtotal = r.items?.reduce((sum, item) => {
              const targetProductId = item.productId ?? item.product_id;
              const matchedProduct = products?.find(p => Number(p.id) === Number(targetProductId));
              const itemPrice = Number(matchedProduct?.price ?? item.price ?? item.productPrice ?? item.unitPrice ?? 0);
              const itemQuantity = Number(item.quantity || 0);
              return sum + (itemPrice * itemQuantity);
            }, 0) ?? 0;

            // 2. 核心修正：優先抓取後端各種金額欄位（包含對齊 OrderCard 的 total_amount）
            // 如果抓出來的金額是 0，就由前端剛才算好的商品小計總和（itemsSubtotal）頂替！
            const backendTotal = r.total_amount ?? r.total_price ?? r.totalPrice ?? r.totalAmount ?? 0;
            const finalTotal = backendTotal > 0 ? backendTotal : itemsSubtotal;

            // 修正交貨時間欄位讀取
            const deliveryTime = r.delivery_at ?? r.deliveryAt ?? r.delivery_date;

            return (
              <div
                key={r.id || index}
                className="orderItem"
                style={{
                  borderLeft: "5px solid var(--primary)",
                  padding: "15px",
                  background: "#fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                {/* 頂部：訂單編號與交貨時間 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
                  <span>
                    <strong>訂單 #{r.id}</strong>
                  </span>
                  <span style={{ color: "var(--danger)", fontWeight: "bold" }}>
                    交貨時間：{deliveryTime ? formatDateTime(deliveryTime) : "未設定"}
                  </span>
                </div>

                {/* 客戶資訊 */}
                {showCustomer && (r.customer_name || r.customerName || r.customer_phone || r.customerPhone || r.user_name) && (
                  <div style={{ fontSize: "0.9rem", color: "var(--text)", background: "#f9f9f9", padding: "8px", borderRadius: "4px" }}>
                    {(r.customer_name || r.customerName || r.user_name) && (
                      <div><strong>客戶：</strong> {r.customer_name || r.customerName || r.user_name}</div>
                    )}
                    {(r.customer_phone || r.customerPhone) && (
                      <div><strong>電話：</strong> {r.customer_phone || r.customerPhone}</div>
                    )}
                  </div>
                )}

                {/* 商品明細呈現與防呆 */}
                <div style={{ padding: "5px 0" }}>
                  <strong style={{ display: "block", marginBottom: "5px", color: "var(--subtext)", fontSize: "0.9rem" }}>訂購明細：</strong>
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
                          // 核心修正：同時相容 item.productId 與 item.product_id 去比對全域商品的 p.id
                          const targetProductId = item.productId ?? item.product_id ?? item.product_id;
                          const matchedProduct = products?.find(p => Number(p.id) === Number(targetProductId));

                          // 抓取單價：優先拿 matchedProduct 的最新價格，沒有才拿備用欄位
                          const itemPrice = Number(matchedProduct?.price ?? item.price ?? item.productPrice ?? 0);
                          const itemQuantity = Number(item.quantity || 0);
                          
                          // 計算小計
                          const subTotal = itemPrice * itemQuantity;

                          return (
                            <tr key={i} style={{ borderBottom: "1px dotted #efefef" }}>
                              <td style={{ padding: "6px 4px" }}>
                                {item.productName || item.product_name || matchedProduct?.name || `商品ID: ${targetProductId}`}
                              </td>
                              <td style={{ padding: "6px 4px", textAlign: "right" }}>
                                {itemQuantity} 件
                              </td>
                              <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: "600" }}>
                                NT$ {subTotal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: "var(--subtext)", fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>
                      （目前無法載入，完整明細請至「訂單確認」或「訂單紀錄」頁籤查看）
                    </p>
                  )}
                </div>

                {/* 底部：取貨方式與總金額 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #eee", fontSize: "0.9rem" }}>
                  <div>
                    <strong>配送資訊：</strong>
                    {r.delivery_method ?? r.deliveryMethod ? deliveryMethodLabel(r.delivery_method ?? r.deliveryMethod) : "未指定"}
                    {(r.delivery_address ?? r.deliveryAddress) && ` — ${r.delivery_address ?? r.deliveryAddress}`}
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--primary-dark)" }}>
                    總金額：<span>NT$ {finalTotal}</span>
                  </div>
                </div>

                {/* 備註欄位 */}
                {r.note && (
                  <div style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic", marginTop: "5px", borderTop: "1px dashed #eee", paddingTop: "5px" }}>
                    備註：{r.note}
                  </div>
                )}

                {showCustomer && onComplete && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                    <button 
                      type="button" 
                      onClick={() => onComplete(r.id)}
                      disabled={isSubmitting}
                    >
                      完成該訂單
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