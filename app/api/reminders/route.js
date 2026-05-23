import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { handleRouteError, ApiError } from "@/lib/apiError";
import { sqlNow } from "@/lib/dbClock";
import { mapOrderRow } from "@/lib/orders";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const nowExpr = await sqlNow();

    if (user.role === "customer") {
      const result = await query(
        `SELECT id, delivery_date, delivery_at, status, delivery_method, delivery_address, note
         FROM orders
         WHERE user_id = $1 AND status = 'confirmed'
           AND COALESCE(delivery_at, delivery_date::timestamptz) >= ${nowExpr}
         ORDER BY COALESCE(delivery_at, delivery_date::timestamptz) ASC
         LIMIT 10`,
        [user.sub]
      );
      return NextResponse.json(result.rows.map(mapOrderRow));
    }

    if (user.role === "vendor") {
      const result = await query(
        `SELECT o.id, o.delivery_date, o.delivery_at, o.status, o.delivery_method, o.delivery_address, o.note,
                u.name AS customer_name, u.phone AS customer_phone
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.status = 'confirmed'
           AND COALESCE(o.delivery_at, o.delivery_date::timestamptz) >= ${nowExpr}
         ORDER BY COALESCE(o.delivery_at, o.delivery_date::timestamptz) ASC
         LIMIT 20`
      );
      return NextResponse.json(result.rows.map(mapOrderRow));
    }

    throw new ApiError(403, "Forbidden");
  } catch (error) {
    return handleRouteError(error);
  }
}
