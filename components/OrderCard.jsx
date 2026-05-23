import { formatDateTime } from "@/lib/format";
import { orderStatusLabel, deliveryMethodLabel } from "@/lib/labels";

export default function OrderCard({ order, actions }) {
  const deliveryAt = order.delivery_at ?? order.delivery_date;

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
              {order.delivery_method === "delivery" && order.delivery_address
                ? ` — ${order.delivery_address}`
                : ""}
            </p>
          )}
          {order.note && <p>備註：{order.note}</p>}
          {order.total_amount != null && <p>金額：NT$ {order.total_amount}</p>}
        </div>
        {actions && <div className="rowActions">{actions}</div>}
      </div>
      {order.items?.length > 0 && (
        <ul>
          {order.items.map((item, idx) => (
            <li key={idx}>
              {item.productName} x {item.quantity}
              {item.unitPrice != null ? `（NT$ ${item.unitPrice}）` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
