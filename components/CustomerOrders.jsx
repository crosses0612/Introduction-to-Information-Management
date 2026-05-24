import { useState } from "react";
import OrderCard from "@/components/OrderCard";

const STATUS_TABS = [
  ["pending", "待確認"],
  ["confirmed", "已確認"],
  ["completed", "已完成"],
  ["cancelled", "已取消"]
];

export default function CustomerOrders({ orders, isSubmitting, onCancel }) {
  const [statusTab, setStatusTab] = useState("pending");
  const filtered = orders.filter((o) => o.status === statusTab);

  return (
    <section className="card">
      <h2>我的訂單紀錄</h2>
      <div className="tabs subTabs">
        {STATUS_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={statusTab === key ? "active" : ""}
            onClick={() => setStatusTab(key)}
            disabled={isSubmitting}
          >
            {label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p>此分類尚無訂單。</p>
      ) : (
        filtered.map((o) => (
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
