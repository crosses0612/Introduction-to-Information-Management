import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { searchParams } = request.nextUrl;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const materialId = searchParams.get("materialId") ? Number(searchParams.get("materialId")) : null;
    const params = [limit];
    let sql = `
      SELECT mm.id, mm.material_id, m.name AS material_name, mm.movement_type, mm.quantity,
             mm.order_id, mm.note, mm.created_at, u.name AS created_by_name
      FROM material_movements mm
      JOIN materials m ON m.id = mm.material_id
      LEFT JOIN users u ON u.id = mm.created_by`;
    if (materialId) {
      sql += ` WHERE mm.material_id = $2`;
      params.push(materialId);
    }
    sql += ` ORDER BY mm.created_at DESC LIMIT $1`;
    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
