import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ message: "請輸入使用者名稱與密碼" }, { status: 400 });
    }

    const loginName = String(username).trim();
    const result = await query(
      "SELECT id, name, username, role, phone, password_hash, cust_tabs_order, vend_tabs_order, material_sub_tabs_order FROM users WHERE username = $1",
      [loginName]
    );
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ message: "使用者名稱或密碼錯誤" }, { status: 401 });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      phone: user.phone ?? null,
      cust_tabs_order: user.cust_tabs_order ?? null,
      vend_tabs_order: user.vend_tabs_order ?? null,
      material_sub_tabs_order: user.material_sub_tabs_order ?? null
    };
    return NextResponse.json({ token: signToken(safeUser), user: safeUser });
  } catch (error) {
    return handleRouteError(error);
  }
}
