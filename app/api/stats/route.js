import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const topProductsResult = await query(
      `SELECT p.name, SUM(oi.quantity)::int AS total_qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status != 'cancelled'
       GROUP BY oi.product_id, p.name
       ORDER BY total_qty DESC
       LIMIT 5`
    );

    const customerFrequencyResult = await query(
      `SELECT u.name, u.username,
              COUNT(o.id)::int AS order_count,
              ROUND(
                EXTRACT(EPOCH FROM (MAX(o.created_at) - MIN(o.created_at))) / 86400,
                2
              ) AS span_days
       FROM users u
       JOIN orders o ON o.user_id = u.id
       WHERE u.role = 'customer' AND o.status != 'cancelled'
       GROUP BY u.id, u.name, u.username
       ORDER BY order_count DESC`
    );

    const customerFrequency = customerFrequencyResult.rows.map((c) => ({
      ...c,
      span_days: c.span_days != null ? Number(c.span_days) : null,
      avg_cycle_days:
        c.order_count > 1 && c.span_days != null
          ? Number((c.span_days / (c.order_count - 1)).toFixed(2))
          : null
    }));

    return NextResponse.json({
      topProducts: topProductsResult.rows,
      customerFrequency
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
