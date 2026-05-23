import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { assertNonNegative } from "@/lib/numbers";
import { handleRouteError, ApiError } from "@/lib/apiError";

function mapProducts(rows) {
  return rows.map((p) => ({
    ...p,
    recipe: typeof p.recipe === "string" ? JSON.parse(p.recipe) : p.recipe || []
  }));
}

export async function GET() {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.description, p.price, p.is_active,
              COALESCE(
                json_agg(
                  json_build_object(
                    'materialId', m.id,
                    'materialName', m.name,
                    'ratio', pm.ratio,
                    'usageKg', pm.ratio
                  )
                  ORDER BY pm.id
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'::json
              ) AS recipe
       FROM products p
       LEFT JOIN product_materials pm ON pm.product_id = p.id
       LEFT JOIN materials m ON m.id = pm.material_id
       GROUP BY p.id
       ORDER BY p.id DESC`
    );
    return NextResponse.json(mapProducts(result.rows));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { name, description = "", price = 0, isActive = true } = await request.json();
    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      return NextResponse.json({ message: "name is required" }, { status: 400 });
    }

    const duplicate = await query("SELECT id FROM products WHERE name ILIKE $1", [trimmedName]);
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ message: "商品名稱已存在" }, { status: 409 });
    }

    const safePrice = assertNonNegative(price, "價格");
    const result = await query(
      "INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
      [trimmedName, description, safePrice, isActive]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
