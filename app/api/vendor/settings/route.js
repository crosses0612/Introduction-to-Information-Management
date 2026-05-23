import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";
import { invalidateClockCache } from "@/lib/dbClock";

function mapSettings(row) {
  return {
    businessName: row.business_name,
    contactPhone: row.contact_phone,
    factoryAddress: row.factory_address,
    clockOffsetMinutes: Number(row.clock_offset_minutes ?? 0)
  };
}

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const result = await query("SELECT * FROM vendor_settings WHERE id = 1");
    return NextResponse.json(mapSettings(result.rows[0] || {}));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "vendor");

    const { businessName, contactPhone, factoryAddress, clockOffsetMinutes } = await request.json();
    const offset = Number(clockOffsetMinutes ?? 0);
    if (Number.isNaN(offset)) {
      return NextResponse.json({ message: "時鐘偏移必須為數字" }, { status: 400 });
    }

    const result = await query(
      `UPDATE vendor_settings SET
         business_name = COALESCE($1, business_name),
         contact_phone = COALESCE($2, contact_phone),
         factory_address = COALESCE($3, factory_address),
         clock_offset_minutes = $4
       WHERE id = 1
       RETURNING *`,
      [businessName, contactPhone, factoryAddress, offset]
    );
    invalidateClockCache();
    return NextResponse.json(mapSettings(result.rows[0]));
  } catch (error) {
    return handleRouteError(error);
  }
}
