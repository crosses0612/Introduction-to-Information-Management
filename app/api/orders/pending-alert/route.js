import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { PENDING_ALERT_THRESHOLD } from "@/lib/config";
import { handleRouteError } from "@/lib/apiError";

export async function GET(request) {
  try {
    getUserFromRequest(request);

    const result = await query("SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending'");
    const pendingCount = result.rows[0].count;
    return NextResponse.json({
      pendingCount,
      threshold: PENDING_ALERT_THRESHOLD,
      warning: pendingCount >= PENDING_ALERT_THRESHOLD
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
