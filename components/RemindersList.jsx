import { formatDateTime } from "@/lib/format";
import { deliveryMethodLabel } from "@/lib/labels";

export default function RemindersList({ reminders, showCustomer = false }) {
  return (
    <section className="card">
      <h2>交貨日提醒（已確認訂單）</h2>
      {reminders.length === 0 ? (
        <p>目前沒有即將到期的已確認訂單。</p>
      ) : (
        reminders.map((r) => (
          <div key={r.id} className="orderItem">
            <p>
              訂單 #{r.id} — 交貨：{formatDateTime(r.delivery_at ?? r.delivery_date)}
            </p>
            {showCustomer && r.customer_name && <p>客戶：{r.customer_name}</p>}
            {showCustomer && r.customer_phone && <p>電話：{r.customer_phone}</p>}
            {r.delivery_method && (
              <p>
                {deliveryMethodLabel(r.delivery_method)}
                {r.delivery_address ? ` — ${r.delivery_address}` : ""}
              </p>
            )}
          </div>
        ))
      )}
    </section>
  );
}
