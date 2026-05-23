import { query } from "./db.js";

let cachedOffset = 0;
let cacheTime = 0;
const CACHE_MS = 5000;

export async function getClockOffsetMinutes() {
  const now = Date.now();
  if (now - cacheTime < CACHE_MS) return cachedOffset;
  try {
    const result = await query("SELECT clock_offset_minutes FROM vendor_settings WHERE id = 1");
    cachedOffset = Number(result.rows[0]?.clock_offset_minutes ?? 0);
    cacheTime = now;
    return cachedOffset;
  } catch {
    return 0;
  }
}

export function invalidateClockCache() {
  cacheTime = 0;
}

/** SQL expression for "current" time with test offset applied */
export async function sqlNow() {
  const offset = await getClockOffsetMinutes();
  if (offset === 0) return "NOW()";
  return `(NOW() + (${offset} || ' minutes')::interval)`;
}
