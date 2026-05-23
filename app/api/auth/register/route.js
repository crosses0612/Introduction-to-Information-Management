import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function POST(request) {
  try {
    const { name, email, password, phone } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ message: "name, email, password are required" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ message: "密碼至少 6 個字元" }, { status: 400 });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ message: "Email already exists" }, { status: 409 });
    }

    const phoneValue = phone != null && String(phone).trim() !== "" ? String(phone).trim() : null;
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1, $2, $3, 'customer', $4) RETURNING id, name, email, role, phone",
      [name, email, bcrypt.hashSync(password, 10), phoneValue]
    );
    const user = {
      ...result.rows[0],
      phone: result.rows[0].phone ?? null
    };

    return NextResponse.json({ token: signToken(user), user }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
