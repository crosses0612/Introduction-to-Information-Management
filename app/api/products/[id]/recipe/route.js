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

      const validItems = recipe.filter(item => item.materialId && item.ratio != null);

      if (validItems.length > 0) {
        const insertValues = [];
        const valuePlaceholders = [];

        validItems.forEach((item, index) => {
          const usageKg = assertNonNegative(item.ratio ?? item.usageKg, "每件原料用量(kg)");

          const offset = index * 3;
          valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
          
          insertValues.push(id, item.materialId, usageKg);
        });

        // 組合成：INSERT INTO ... VALUES ($1,$2,$3), ($4,$5,$6)
        const bulkInsertSql = `
          INSERT INTO product_materials (product_id, material_id, ratio) 
          VALUES ${valuePlaceholders.join(", ")}
        `;

        await client.query(bulkInsertSql, insertValues);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}