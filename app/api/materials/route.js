import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertNonNegative } from "@/lib/numbers";
import { mapMaterialRow } from "@/lib/inventory";
import { DEFAULT_LOW_STOCK } from "@/lib/config";
import { handleRouteError, ApiError } from "@/lib/apiError";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const result = await query("SELECT * FROM materials ORDER BY id DESC");
    return NextResponse.json(result.rows.map(mapMaterialRow));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { name, stock = 0, unit = "kg", lowStockThreshold } = await request.json();
    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      return NextResponse.json({ message: "請填寫原料名稱" }, { status: 400 });
    }

    const safeStock = assertNonNegative(stock, "庫存量");
    const threshold = assertNonNegative(lowStockThreshold ?? DEFAULT_LOW_STOCK, "低庫存門檻");
    const result = await query(
      `INSERT INTO materials (name, stock, unit, low_stock_threshold) VALUES ($1, $2, $3, $4) RETURNING *`,
      [trimmedName, safeStock, unit, threshold]
    );
    return NextResponse.json(mapMaterialRow(result.rows[0]), { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
