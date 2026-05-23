import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertPositive } from "@/lib/numbers";
import { mapMaterialRow, recordInbound } from "@/lib/inventory";
import { handleRouteError, ApiError } from "@/lib/apiError";

export async function POST(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;
    const { quantity, note } = await request.json();

    await withTransaction(async (client) => {
      const exists = await client.query("SELECT id FROM materials WHERE id = $1", [id]);
      if (!exists.rows.length) throw new Error("Material not found");
      await recordInbound(client, id, assertPositive(quantity, "進貨數量"), note, user.sub);
    });
    const updated = await query("SELECT * FROM materials WHERE id = $1", [id]);
    return NextResponse.json(mapMaterialRow(updated.rows[0]));
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
