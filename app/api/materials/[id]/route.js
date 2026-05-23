import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertNonNegative } from "@/lib/numbers";
import { mapMaterialRow, recordAdjustment } from "@/lib/inventory";
import { DEFAULT_LOW_STOCK } from "@/lib/config";
import { handleRouteError, ApiError } from "@/lib/apiError";

export async function PUT(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;
    const { name, stock, unit, lowStockThreshold } = await request.json();

    const updated = await withTransaction(async (client) => {
      const current = await client.query("SELECT * FROM materials WHERE id = $1", [id]);
      if (!current.rows.length) throw new Error("Material not found");
      const old = current.rows[0];
      const newStock = stock != null ? assertNonNegative(stock, "庫存量") : Number(old.stock);
      const newThreshold =
        lowStockThreshold != null
          ? assertNonNegative(lowStockThreshold, "低庫存門檻")
          : Number(old.low_stock_threshold ?? DEFAULT_LOW_STOCK);
      const result = await client.query(
        `UPDATE materials SET name = $1, stock = $2, unit = $3, low_stock_threshold = $4 WHERE id = $5 RETURNING *`,
        [name ?? old.name, newStock, unit ?? old.unit, newThreshold, id]
      );
      if (newStock !== Number(old.stock)) {
        await recordAdjustment(
          client,
          id,
          Number(old.stock),
          newStock,
          "手動調整庫存",
          user.sub
        );
      }
      return result.rows[0];
    });
    return NextResponse.json(mapMaterialRow(updated));
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
    await query("DELETE FROM materials WHERE id = $1", [id]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
