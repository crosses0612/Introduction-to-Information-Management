import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";
import { mapOrderRow } from "@/lib/orders";

export async function PUT(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;
    const current = await query("SELECT * FROM orders WHERE id = $1", [id]);
    if (!current.rows.length) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    if (current.rows[0].status !== "confirmed") {
      return NextResponse.json({ message: "僅能將已確認訂單標記為已完成" }, { status: 400 });
    }

    const result = await query(
      "UPDATE orders SET status = 'completed' WHERE id = $1 RETURNING *",
      [id]
    );
    return NextResponse.json(mapOrderRow(result.rows[0]));
  } catch (error) {
    return handleRouteError(error);
  }
}
