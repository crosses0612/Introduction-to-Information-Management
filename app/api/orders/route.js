import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertSafeInteger } from "@/lib/numbers";
import { handleRouteError, ApiError } from "@/lib/apiError";
import { mapOrderRow, validateDeliveryAt, validateDeliveryMethod } from "@/lib/orders";
import { buildVendorOrdersQuery } from "@/lib/orderQueries";

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "customer");

    const { deliveryAt, deliveryMethod, deliveryAddress, note, items } = await request.json();
    if (!deliveryAt || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "deliveryAt and items are required" }, { status: 400 });
    }

    const deliveryAtIso = validateDeliveryAt(deliveryAt);
    validateDeliveryMethod(deliveryMethod, deliveryAddress);

    const orderId = await withTransaction(async (client) => {
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, delivery_date, delivery_at, delivery_method, delivery_address, note, status)
         VALUES ($1, $2::date, $3, $4, $5, $6, 'pending') RETURNING id`,
        [
          user.sub,
          deliveryAtIso.slice(0, 10),
          deliveryAtIso,
          deliveryMethod,
          deliveryMethod === "delivery" ? String(deliveryAddress).trim() : null,
          note ? String(note).trim() : null
        ]
      );
      const id = orderResult.rows[0].id;

      for (const item of items) {
        const productResult = await client.query(
          "SELECT id, price FROM products WHERE id = $1 AND is_active = TRUE",
          [item.productId]
        );
        const product = productResult.rows[0];
        if (!product) throw new Error("Product not found");
        const qty = assertSafeInteger(item.quantity, "商品數量");
        if (qty <= 0) throw new Error("商品數量必須大於 0");
        await client.query(
          "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
          [id, product.id, qty, product.price]
        );
      }
      return id;
    });

    const created = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
    return NextResponse.json(mapOrderRow(created.rows[0]), { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return handleRouteError(error);
  }
}

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const scope = request.nextUrl.searchParams.get("scope") || "all";
    const { sql, params } = buildVendorOrdersQuery(
      scope === "pending" || scope === "history" ? scope : "all"
    );
    const result = await query(sql, params);
    return NextResponse.json(result.rows.map(mapOrderRow));
  } catch (error) {
    return handleRouteError(error);
  }
}
