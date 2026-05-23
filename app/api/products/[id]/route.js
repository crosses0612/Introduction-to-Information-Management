import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertNonNegative } from "@/lib/numbers";
import { handleRouteError, ApiError } from "@/lib/apiError";

export async function PUT(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;
    const { name, description = "", price = 0, isActive = true } = await request.json();
    const safePrice = assertNonNegative(price, "價格");
    const result = await query(
      "UPDATE products SET name = $1, description = $2, price = $3, is_active = $4 WHERE id = $5 RETURNING *",
      [name, description, safePrice, isActive, id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function DELETE(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;
    await query("DELETE FROM products WHERE id = $1", [id]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
