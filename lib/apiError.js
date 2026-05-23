import { NextResponse } from "next/server";
import { mapPgError } from "./pgErrors.js";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handleRouteError(error) {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  const pgMsg = mapPgError(error);
  if (pgMsg) {
    return NextResponse.json({ message: pgMsg }, { status: 400 });
  }
  if (error?.message) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}
