import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getUserFromRequest, signToken } from "@/lib/auth";
import { handleRouteError, ApiError } from "@/lib/apiError";

function safeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? null
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(request) {
  try {
    const authUser = getUserFromRequest(request);
    const result = await query(
      "SELECT id, name, email, role, phone FROM users WHERE id = $1",
      [authUser.sub]
    );
    if (!result.rows.length) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json(safeUser(result.rows[0]));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request) {
  try {
    const authUser = getUserFromRequest(request);
    const body = await request.json();
    const { email, phone, password, currentPassword } = body;

    const hasEmail = email !== undefined && email !== null && String(email).trim() !== "";
    const hasPhone = phone !== undefined;
    const hasPassword = password !== undefined && String(password).trim() !== "";

    if (!hasEmail && !hasPhone && !hasPassword) {
      return NextResponse.json({ message: "請至少更新一項資料" }, { status: 400 });
    }

    const current = await query(
      "SELECT id, name, email, role, phone, password_hash FROM users WHERE id = $1",
      [authUser.sub]
    );
    if (!current.rows.length) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    const user = current.rows[0];

    const newEmail = hasEmail ? String(email).trim() : user.email;
    const emailChanged = hasEmail && newEmail !== user.email;

    if (hasEmail && !isValidEmail(newEmail)) {
      return NextResponse.json({ message: "電子郵件格式不正確" }, { status: 400 });
    }

    if (hasPassword && String(password).length < 6) {
      return NextResponse.json({ message: "新密碼至少 6 個字元" }, { status: 400 });
    }

    const needsCurrentPassword = emailChanged || hasPassword;
    if (needsCurrentPassword && !currentPassword) {
      return NextResponse.json({ message: "變更帳號或密碼時請輸入目前密碼" }, { status: 400 });
    }

    if (needsCurrentPassword && !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return NextResponse.json({ message: "目前密碼不正確" }, { status: 400 });
    }

    if (emailChanged) {
      const existing = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [
        newEmail,
        user.id
      ]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ message: "此電子郵件已被使用" }, { status: 409 });
      }
    }

    const newPhone = hasPhone ? (phone == null ? null : String(phone).trim()) : user.phone;
    const newPasswordHash = hasPassword ? bcrypt.hashSync(password, 10) : user.password_hash;

    const result = await query(
      `UPDATE users SET email = $1, phone = $2, password_hash = $3 WHERE id = $4
       RETURNING id, name, email, role, phone`,
      [newEmail, newPhone || null, newPasswordHash, user.id]
    );
    const updated = safeUser(result.rows[0]);
    return NextResponse.json({ token: signToken(updated), user: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
