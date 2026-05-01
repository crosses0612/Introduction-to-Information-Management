import bcrypt from "bcryptjs";
import db from "./db.js";

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'vendor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      stock REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      ratio REAL NOT NULL,
      UNIQUE(product_id, material_id),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delivery_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed')) DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
}

function seedData() {
  const existingVendor = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("vendor@example.com");
  if (!existingVendor) {
    const insertUser = db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    );
    insertUser.run("Vendor Admin", "vendor@example.com", bcrypt.hashSync("vendor123", 10), "vendor");
    insertUser.run("Demo Customer", "customer@example.com", bcrypt.hashSync("customer123", 10), "customer");
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (productCount === 0) {
    const insertProduct = db.prepare(
      "INSERT INTO products (name, description, price, is_active) VALUES (?, ?, ?, ?)"
    );
    insertProduct.run("招牌蛋糕", "經典口味蛋糕", 580, 1);
    insertProduct.run("手工餅乾禮盒", "節慶熱銷商品", 350, 1);
  }

  const materialCount = db.prepare("SELECT COUNT(*) AS count FROM materials").get().count;
  if (materialCount === 0) {
    const insertMaterial = db.prepare(
      "INSERT INTO materials (name, stock, unit) VALUES (?, ?, ?)"
    );
    insertMaterial.run("麵粉", 120, "kg");
    insertMaterial.run("奶油", 80, "kg");
    insertMaterial.run("砂糖", 95, "kg");
  }

  const recipeCount = db.prepare("SELECT COUNT(*) AS count FROM product_materials").get().count;
  if (recipeCount === 0) {
    const products = db.prepare("SELECT id, name FROM products").all();
    const materials = db.prepare("SELECT id, name FROM materials").all();
    const getId = (arr, name) => arr.find((x) => x.name === name)?.id;
    const insertRecipe = db.prepare(
      "INSERT INTO product_materials (product_id, material_id, ratio) VALUES (?, ?, ?)"
    );

    insertRecipe.run(getId(products, "招牌蛋糕"), getId(materials, "麵粉"), 0.6);
    insertRecipe.run(getId(products, "招牌蛋糕"), getId(materials, "奶油"), 0.3);
    insertRecipe.run(getId(products, "招牌蛋糕"), getId(materials, "砂糖"), 0.1);
    insertRecipe.run(getId(products, "手工餅乾禮盒"), getId(materials, "麵粉"), 0.5);
    insertRecipe.run(getId(products, "手工餅乾禮盒"), getId(materials, "奶油"), 0.25);
    insertRecipe.run(getId(products, "手工餅乾禮盒"), getId(materials, "砂糖"), 0.25);
  }
}

export function initDatabase() {
  createTables();
  seedData();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
  console.log("Database initialized with seed data.");
}
