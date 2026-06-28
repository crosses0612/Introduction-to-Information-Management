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
    clockOffsetMinutes: Number(row.clock_offset_minutes ?? 0),
    customUnits: Array.isArray(row.custom_units) ? row.custom_units : []
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

    const { businessName, contactPhone, factoryAddress, clockOffsetMinutes, customUnits } = await request.json();
    const offset = Number(clockOffsetMinutes ?? 0);
    if (Number.isNaN(offset)) {
      return NextResponse.json({ message: "時鐘偏移必須為數字" }, { status: 400 });
    }

    let customUnitsJson = null;
    if (customUnits !== undefined) {
      if (!Array.isArray(customUnits)) {
        return NextResponse.json({ message: "自訂單位格式錯誤" }, { status: 400 });
      }
      const cleaned = [...new Set(customUnits.map((u) => String(u).trim()).filter(Boolean))];
      customUnitsJson = JSON.stringify(cleaned);
    }

    const result = await query(
      `UPDATE vendor_settings SET
         business_name = COALESCE($1, business_name),
         contact_phone = COALESCE($2, contact_phone),
         factory_address = COALESCE($3, factory_address),
         clock_offset_minutes = $4,
         custom_units = COALESCE($5::jsonb, custom_units)
       WHERE id = 1
       RETURNING *`,
      [businessName, contactPhone, factoryAddress, offset, customUnitsJson]
    );
    invalidateClockCache();
    return NextResponse.json(mapSettings(result.rows[0]));
  } catch (error) {
    return handleRouteError(error);
  }
}
