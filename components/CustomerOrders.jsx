import { useState } from "react";
import OrderCard from "./OrderCard";

// ✨ 核心修正：在解構參數中正式補上 onCancel，徹底解決 onCancel is not defined 崩潰！
export default function CustomerOrders({ orders, isSubmitting, onCancel }) {
  const [activeSubTab, setActiveSubTab] = useState("pending");
  const now = new Date();

  const filteredOrders = orders.filter((o) => {
    const deliveryTime = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
    const isOverdue = deliveryTime && new Date(deliveryTime) < now;

    if (activeSubTab === "expired") {
      // 1. 商家還沒清（confirmed 且過期） 2. 商家按了一鍵清理（cancelled 且過期）
      return (o.status === "confirmed" && isOverdue) || (o.status === "cancelled" && isOverdue);
    } else if (activeSubTab === "completed") {
      // 2. 只要商家有點擊「標記已完成」，不管有沒有遲到交貨，客人都會歸類在「已完成」
      return o.status === "completed";
    } else if (activeSubTab === "confirmed") {
      return o.status === "confirmed" && !isOverdue;
    } else if (activeSubTab === "cancelled") {
      // 3. 真正的取消：時間還沒過，就被客人或商家點按取消的
      return o.status === "cancelled" && !isOverdue;
    } else {
      return o.status === activeSubTab;
    }
  });

  return (
    <section className="card">
      <h2>我的訂單紀錄</h2>
      <div className="tabs subTabs" style={{ marginBottom: "20px" }}>
        <button type="button" className={activeSubTab === "pending" ? "active" : ""} onClick={() => setActiveSubTab("pending")} disabled={isSubmitting}>待處理</button>
        <button type="button" className={activeSubTab === "confirmed" ? "active" : ""} onClick={() => setActiveSubTab("confirmed")} disabled={isSubmitting}>已確認 (待交貨)</button>
        <button type="button" className={activeSubTab === "completed" ? "active" : ""} onClick={() => setActiveSubTab("completed")} disabled={isSubmitting}>已完成</button>
        <button type="button" className={activeSubTab === "cancelled" ? "active" : ""} onClick={() => setActiveSubTab("cancelled")} disabled={isSubmitting}>已取消</button>
        <button type="button" className={activeSubTab === "expired" ? "active" : ""} onClick={() => setActiveSubTab("expired")} disabled={isSubmitting}>已過期</button>
      </div>

      {filteredOrders.length === 0 ? (
        <p>此分類尚無訂單。</p>
      ) : (
        filteredOrders.map((o) => (
          <OrderCard 
            key={o.id} 
            order={o} 
            actions={o.status === "pending" ? (
              <button type="button" onClick={() => onCancel(o.id)} disabled={isSubmitting}>
                取消訂單
              </button>
            ) : null} 
          />
        ))
      )}
    </section>
  );
}