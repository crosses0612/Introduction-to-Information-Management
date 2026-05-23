import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { mapMaterialRow } from "@/lib/inventory";
import { DEFAULT_LOW_STOCK } from "@/lib/config";
import { handleRouteError } from "@/lib/apiError";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const result = await query(
      `SELECT * FROM materials WHERE stock < COALESCE(low_stock_threshold, $1) ORDER BY stock ASC`,
      [DEFAULT_LOW_STOCK]
    );
    return NextResponse.json(result.rows.map(mapMaterialRow));
  } catch (error) {
    return handleRouteError(error);
  }
}
