import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: "email and password are required" }, { status: 400 });
    }

    const result = await query(
      "SELECT id, name, email, role, phone, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone ?? null
    };
    return NextResponse.json({ token: signToken(safeUser), user: safeUser });
  } catch (error) {
    return handleRouteError(error);
  }
}
