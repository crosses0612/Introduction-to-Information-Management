import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const result = await query(
      `SELECT m.id, m.name, m.unit,
              COALESCE(SUM(mm.quantity), 0) AS total_consumed
       FROM materials m
       LEFT JOIN material_movements mm ON mm.material_id = m.id AND mm.movement_type = 'outbound'
         AND mm.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY m.id, m.name, m.unit
       ORDER BY total_consumed DESC`
    );
    return NextResponse.json(
      result.rows.map((r) => ({
        ...r,
        total_consumed: Number(r.total_consumed)
      }))
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
