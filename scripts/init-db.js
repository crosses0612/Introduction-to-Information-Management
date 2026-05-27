import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });

const { query } = await import("../lib/db.js");

export async function seedData() {
  const existingVendor = await query("SELECT id FROM users WHERE username = $1", [
    "vendor@example.com"
  ]);
  if (existingVendor.rows.length === 0) {
    await query(
      "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4)",
      ["Vendor Admin", "vendor@example.com", bcrypt.hashSync("vendor123", 10), "vendor"]
    );
    await query(
      "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4)",
      ["Demo Customer", "customer@example.com", bcrypt.hashSync("customer123", 10), "customer"]
    );
  }

  const productCount = await query("SELECT COUNT(*)::int AS count FROM products");
  if (productCount.rows[0].count === 0) {
    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "按摩油 4L",
      "",
      420,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "薰衣草油 4L",
      "",
      450,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "玫瑰油 4L",
      "",
      450,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "茶樹油 4L",
      "",
      450,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "葵花油 4L",
      "",
      450,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "檸檬香茅油 4L",
      "",
      450,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "全身乳液(無味) 4L",
      "",
      380,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "全身乳液(花香) 4L",
      "",
      450,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "全身乳霜(無味) 4L",
      "",
      480,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "全身乳霜(果香) 4L",
      "",
      400,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "全身乳霜 20L",
      "",
      2200,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "全身乳霜 4.5L",
      "",
      500,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "精華霜 20L",
      "",
      2600,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "精華霜 4.5L",
      "",
      585,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "潤膚康 1000ML",
      "",
      200,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "推拿霜 500ML",
      "",
      135,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "洗衣精 20L",
      "",
      800,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "洗衣精 4L",
      "",
      180,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "沐浴乳 4L",
      "",
      240,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "沐浴乳 2L",
      "",
      160,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "核桃去角質膠 1L",
      "",
      395,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "去角質凝膠 250ML",
      "",
      300,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "好運油 250ML",
      "",
      90,
      true
    ]);

    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "純精油 20ML",
      "",
      380,
      true
    ]);
  }

  const materialCount = await query("SELECT COUNT(*)::int AS count FROM materials");
  if (materialCount.rows[0].count === 0) {
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["植物萃取精華液", 50, "公升(L)"]);
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["乳化劑", 36, "公升(L)"]);
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["椰子油", 67, "公升(L)"]);
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["植物油", 101, "公升(L)"]);
  }

  const recipeCount = await query("SELECT COUNT(*)::int AS count FROM product_materials");
  if (recipeCount.rows[0].count === 0) {
    const products = (await query("SELECT id, name FROM products")).rows;
    const materials = (await query("SELECT id, name FROM materials")).rows;
    const getId = (arr, name) => arr.find((x) => x.name === name)?.id;

    const recipes = [
      [getId(products, "全身乳液(無味) 4L"), getId(materials, "乳化劑"), 1],
      [getId(products, "全身乳液(無味) 4L"), getId(materials, "植物油"), 3],
      [getId(products, "按摩油 4L"), getId(materials, "植物萃取精華液"), 0.3],
      [getId(products, "按摩油 4L"), getId(materials, "椰子油"), 2.8],
      [getId(products, "按摩油 4L"), getId(materials, "乳化劑"), 0.9]
    ];

    for (const [productId, materialId, ratio] of recipes) {
      if (!productId || !materialId) continue;
      await query(
        "INSERT INTO product_materials (product_id, material_id, ratio) VALUES ($1, $2, $3)",
        [productId, materialId, ratio]
      );
    }
  }

  await query(
    `INSERT INTO vendor_settings (id, business_name, contact_phone, factory_address)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    ["DIJIA玓家有限公司", "07-6141005", "高雄市燕巢區瓊林里安林三街62號"]
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedData()
    .then(() => {
      console.log("Seed data applied.");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
