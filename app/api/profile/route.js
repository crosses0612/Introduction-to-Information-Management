import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getUserFromRequest, signToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiError";

function safeUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    phone: row.phone ?? null,
    cust_tabs_order: row.cust_tabs_order ?? null,
    vend_tabs_order: row.vend_tabs_order ?? null,
    material_sub_tabs_order: row.material_sub_tabs_order ?? null
  };
}

export async function GET(request) {
  try {
    const authUser = getUserFromRequest(request);
    const result = await query(
      `SELECT id, name, username, role, phone, cust_tabs_order, vend_tabs_order, material_sub_tabs_order FROM users WHERE id = $1`,
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
    const { username, phone, password, currentPassword, cust_tabs_order, vend_tabs_order, material_sub_tabs_order } = body;

    const hasUsername =
      username !== undefined && username !== null && String(username).trim() !== "";
    const hasPhone = phone !== undefined;
    const hasPassword = password !== undefined && String(password).trim() !== "";

    const hasTabsOrder = cust_tabs_order !== undefined || vend_tabs_order !== undefined || material_sub_tabs_order !== undefined;
    if (!hasUsername && !hasPhone && !hasPassword && !hasTabsOrder) {
      return NextResponse.json({ message: "請至少更新一項資料" }, { status: 400 });
    }

    const current = await query(
      "SELECT id, name, username, role, phone, password_hash FROM users WHERE id = $1",
      [authUser.sub]
    );
    if (!current.rows.length) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    const user = current.rows[0];

    const newUsername = hasUsername ? String(username).trim() : user.username;
    if (hasUsername && !newUsername) {
      return NextResponse.json({ message: "使用者名稱不可為空白" }, { status: 400 });
    }
    const usernameChanged = hasUsername && newUsername !== user.username;

    if (hasPassword && String(password).length < 6) {
      return NextResponse.json({ message: "新密碼至少 6 個字元" }, { status: 400 });
    }

    const needsCurrentPassword = usernameChanged || hasPassword;
    if (needsCurrentPassword && !currentPassword) {
      return NextResponse.json({ message: "變更帳號或密碼時請輸入目前密碼" }, { status: 400 });
    }

    if (needsCurrentPassword && !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return NextResponse.json({ message: "目前密碼不正確" }, { status: 400 });
    }

    if (usernameChanged) {
      const existing = await query("SELECT id FROM users WHERE username = $1 AND id != $2", [
        newUsername,
        user.id
      ]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ message: "此使用者名稱已被使用" }, { status: 409 });
      }
    }

    const newPhone = hasPhone ? (phone == null ? null : String(phone).trim()) : user.phone;
    const newPasswordHash = hasPassword ? bcrypt.hashSync(password, 10) : user.password_hash;

    // 動態組合 SQL
    const fields = ["username", "phone", "password_hash"];
    const values = [newUsername, newPhone || null, newPasswordHash];
    if (cust_tabs_order !== undefined) {
      fields.push("cust_tabs_order");
      values.push(cust_tabs_order);
    }
    if (vend_tabs_order !== undefined) {
      fields.push("vend_tabs_order");
      values.push(vend_tabs_order);
    }
    if (material_sub_tabs_order !== undefined) {
      fields.push("material_sub_tabs_order");
      values.push(material_sub_tabs_order);
    }
    fields.push("id");
    values.push(user.id);

    const setClause = fields.slice(0, -1).map((f, i) => `${f} = $${i + 1}`).join(", ");
    const result = await query(
      `UPDATE users SET ${setClause} WHERE id = $${fields.length}
       RETURNING id, name, username, role, phone, cust_tabs_order, vend_tabs_order, material_sub_tabs_order`,
      values
    );
    const updated = safeUser(result.rows[0]);
    return NextResponse.json({ token: signToken(updated), user: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
