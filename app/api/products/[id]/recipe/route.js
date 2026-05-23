import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertNonNegative } from "@/lib/numbers";
import { handleRouteError, ApiError } from "@/lib/apiError";

export async function PUT(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;
    const { recipe } = await request.json();
    if (!Array.isArray(recipe)) {
      return NextResponse.json({ message: "recipe must be an array" }, { status: 400 });
    }

    await withTransaction(async (client) => {
      await client.query("DELETE FROM product_materials WHERE product_id = $1", [id]);
      for (const item of recipe) {
        if (!item.materialId || item.ratio == null) continue;
        const usageKg = assertNonNegative(item.ratio ?? item.usageKg, "每件原料用量(kg)");
        await client.query(
          "INSERT INTO product_materials (product_id, material_id, ratio) VALUES ($1, $2, $3)",
          [id, item.materialId, usageKg]
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
