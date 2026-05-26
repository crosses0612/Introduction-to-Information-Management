import { useState } from "react";
import OrderCard from "./OrderCard";

export default function CustomerOrders({ orders, isSubmitting, clearedExpiredIds }) {
  const [activeSubTab, setActiveSubTab] = useState("pending");
  const now = new Date();
  const filteredOrders = orders.filter((o) => {
    const deliveryTime = o.delivery_at ?? o.deliveryAt ?? o.delivery_date;
    const isOverdue = deliveryTime && new Date(deliveryTime) < now;
    const isSweptByClearButton = clearedExpiredIds.includes(o.id);

    if (activeSubTab === "expired") {
      return (o.status === "confirmed" && isOverdue) || (o.status === "completed" && isSweptByClearButton);
    } else if (activeSubTab === "completed") {
      return o.status === "completed" && !isSweptByClearButton;
    } else if (activeSubTab === "confirmed") {
      return o.status === "confirmed" && !isOverdue;
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
            actions={
              o.status === "pending" ? (
                <button type="button" onClick={() => onCancel(o.id)} disabled={isSubmitting}>
                  取消訂單
                </button>
              ) : null
            }
          />
        ))
      )}
    </section>
  );
}