import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { deductStockForOrder, mapMaterialRow, getLowStockFromRows } from "@/lib/inventory";
import { handleRouteError } from "@/lib/apiError";
import { mapPgError } from "@/lib/pgErrors";

export async function PUT(request, context) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { id } = await context.params;

    let customPrices = {};
    try {
      const body = await request.json();
      if (body && body.customPrices && typeof body.customPrices === "object") {
        customPrices = body.customPrices;
      }
    } catch {
      // 無 body 時維持原價
    }

    const { order, lowStockMaterials } = await withTransaction(async (client) => {
      const current = await client.query("SELECT * FROM orders WHERE id = $1", [id]);
      if (!current.rows.length) throw new Error("Order not found");
      if (current.rows[0].status !== "pending") throw new Error("僅能確認待處理訂單");

      for (const [productId, price] of Object.entries(customPrices)) {
        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
          throw new Error("折價後單價不可為負數或無效");
        }
        await client.query(
          "UPDATE order_items SET unit_price = $1 WHERE order_id = $2 AND product_id = $3",
          [numericPrice, id, productId]
        );
      }

      await deductStockForOrder(client, id, user.sub);

      const result = await client.query(
        "UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );

      const materialsResult = await client.query("SELECT * FROM materials ORDER BY id DESC");
      const mapped = materialsResult.rows.map(mapMaterialRow);
      return { order: result.rows[0], lowStockMaterials: getLowStockFromRows(mapped) };
    });
    return NextResponse.json({ order, lowStockMaterials });
  } catch (error) {
    const pgMsg = mapPgError(error);
    return NextResponse.json({ message: pgMsg || error.message }, { status: 400 });
  }
}
