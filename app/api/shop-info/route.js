import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleRouteError } from "@/lib/apiError";

export async function GET() {
  try {
    const result = await query(
      "SELECT business_name, contact_phone, factory_address FROM vendor_settings WHERE id = 1"
    );
    const row = result.rows[0] || {
      business_name: "",
      contact_phone: "",
      factory_address: ""
    };
    return NextResponse.json({
      businessName: row.business_name,
      contactPhone: row.contact_phone,
      factoryAddress: row.factory_address
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
