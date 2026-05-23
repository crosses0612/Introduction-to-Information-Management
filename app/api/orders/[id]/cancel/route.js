import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function PUT(request, context) {
  try {
    const user = getUserFromRequest(request);
    const { id } = await context.params;

    const order = await withTransaction(async (client) => {
      const current = await client.query("SELECT * FROM orders WHERE id = $1", [id]);
      if (!current.rows.length) throw new Error("Order not found");
      const o = current.rows[0];
      if (o.status !== "pending") throw new Error("僅能取消待處理訂單");
      if (user.role === "customer" && String(o.user_id) !== String(user.sub)) {
        throw new Error("Forbidden");
      }
      const result = await client.query(
        "UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *",
        [id]
      );
      return result.rows[0];
    });
    return NextResponse.json(order);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ message: error.message }, { status });
  }
}
