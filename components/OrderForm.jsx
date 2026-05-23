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

  useEffect(() => {
    setDeliveryDate("");
    setDeliveryTime("12:00");
    setDeliveryMethod("pickup");
    setDeliveryAddress("");
    setNote("");
    setQuantities({});
  }, [resetToken]);

  function handleSubmit(e) {
    e.preventDefault();
    const items = Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({ productId: Number(productId), quantity: Number(qty) }));

    const deliveryAt = deliveryDate && deliveryTime ? `${deliveryDate}T${deliveryTime}:00` : "";

    onSubmit({
      deliveryAt,
      deliveryMethod,
      deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : "",
      note,
      items
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
          <fieldset className="radioGroup" disabled={isSubmitting}>
            <legend>取貨方式</legend>
            <label className="inlineRadio">
              <input
                type="radio"
                name="deliveryMethod"
                value="pickup"
                checked={deliveryMethod === "pickup"}
                onChange={() => setDeliveryMethod("pickup")}
              />
              來店自取
            </label>
            <label className="inlineRadio">
              <input
                type="radio"
                name="deliveryMethod"
                value="delivery"
                checked={deliveryMethod === "delivery"}
                onChange={() => setDeliveryMethod("delivery")}
              />
              配送
            </label>
          </fieldset>
          {deliveryMethod === "delivery" && (
            <label>
              收貨地址
              <input
                placeholder="請填寫配送地址"
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
              placeholder="選填"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              rows={2}
            />
          </label>
          {products
            .filter((p) => p.is_active)
            .map((product) => (
              <label key={product.id}>
                {product.name} (NT$ {product.price})
                <input
                  type="number"
                  min="0"
                  max="99999"
                  step="1"
                  value={quantities[product.id] || ""}
                  onChange={(e) =>
                    setQuantities({
                      ...quantities,
                      [product.id]: nonNegativeFromInput(e.target.value)
                    })
                  }
                  disabled={isSubmitting}
                />
              </label>
            ))}
          <button type="submit" disabled={isSubmitting}>
            送出訂單
          </button>
        </form>
      </section>
    </>
  );
}
