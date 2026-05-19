import "dotenv/config";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

export async function seedData() {
  const existingVendor = await query("SELECT id FROM users WHERE email = $1", [
    "vendor@example.com"
  ]);
  if (existingVendor.rows.length === 0) {
    await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      ["Vendor Admin", "vendor@example.com", bcrypt.hashSync("vendor123", 10), "vendor"]
    );
    await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      ["Demo Customer", "customer@example.com", bcrypt.hashSync("customer123", 10), "customer"]
    );
  }

  const productCount = await query("SELECT COUNT(*)::int AS count FROM products");
  if (productCount.rows[0].count === 0) {
    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "招牌蛋糕",
      "經典口味蛋糕",
      580,
      true
    ]);
    await query("INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4)", [
      "手工餅乾禮盒",
      "節慶熱銷商品",
      350,
      true
    ]);
  }

  const materialCount = await query("SELECT COUNT(*)::int AS count FROM materials");
  if (materialCount.rows[0].count === 0) {
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["麵粉", 120, "kg"]);
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["奶油", 80, "kg"]);
    await query("INSERT INTO materials (name, stock, unit) VALUES ($1, $2, $3)", ["砂糖", 95, "kg"]);
  }

  const recipeCount = await query("SELECT COUNT(*)::int AS count FROM product_materials");
  if (recipeCount.rows[0].count === 0) {
    const products = (await query("SELECT id, name FROM products")).rows;
    const materials = (await query("SELECT id, name FROM materials")).rows;
    const getId = (arr, name) => arr.find((x) => x.name === name)?.id;

    const recipes = [
      [getId(products, "招牌蛋糕"), getId(materials, "麵粉"), 0.6],
      [getId(products, "招牌蛋糕"), getId(materials, "奶油"), 0.3],
      [getId(products, "招牌蛋糕"), getId(materials, "砂糖"), 0.1],
      [getId(products, "手工餅乾禮盒"), getId(materials, "麵粉"), 0.5],
      [getId(products, "手工餅乾禮盒"), getId(materials, "奶油"), 0.25],
      [getId(products, "手工餅乾禮盒"), getId(materials, "砂糖"), 0.25]
    ];

    for (const [productId, materialId, ratio] of recipes) {
      if (!productId || !materialId) continue;
      await query(
        "INSERT INTO product_materials (product_id, material_id, ratio) VALUES ($1, $2, $3)",
        [productId, materialId, ratio]
      );
    }
  }
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
