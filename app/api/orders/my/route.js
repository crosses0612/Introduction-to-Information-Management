import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest, assertRole } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";
import { mapOrderRow } from "@/lib/orders";
import { CUSTOMER_ORDER_SELECT } from "@/lib/orderQueries";

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    assertRole(user, "customer");

    const result = await query(CUSTOMER_ORDER_SELECT, [user.sub]);
    return NextResponse.json(result.rows.map(mapOrderRow));
  } catch (error) {
    return handleRouteError(error);
  }
}
