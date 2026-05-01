import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import db from "./db.js";
import { requireAuth, requireRole, signToken } from "./auth.js";
import { initDatabase } from "./initDb.js";

initDatabase();

const app = express();
const PORT = process.env.PORT || 4000;
const PENDING_ALERT_THRESHOLD = Number(process.env.PENDING_ALERT_THRESHOLD || 5);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password are required" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const stmt = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')"
  );
  const result = stmt.run(name, email, bcrypt.hashSync(password, 10));
  const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(result.lastInsertRowid);

  return res.status(201).json({ token: signToken(user), user });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = db
    .prepare("SELECT id, name, email, role, password_hash FROM users WHERE email = ?")
    .get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return res.json({ token: signToken(safeUser), user: safeUser });
});

app.get("/api/products", (_req, res) => {
  const products = db
    .prepare(
      `SELECT p.id, p.name, p.description, p.price, p.is_active,
              COALESCE(
                json_group_array(
                  CASE WHEN m.id IS NOT NULL THEN
                    json_object('materialId', m.id, 'materialName', m.name, 'ratio', pm.ratio)
                  END
                ),
                json('[]')
              ) AS recipe
       FROM products p
       LEFT JOIN product_materials pm ON pm.product_id = p.id
       LEFT JOIN materials m ON m.id = pm.material_id
       GROUP BY p.id
       ORDER BY p.id DESC`
    )
    .all()
    .map((p) => ({
      ...p,
      recipe: JSON.parse(p.recipe).filter(Boolean)
    }));

  return res.json(products);
});

app.post("/api/products", requireAuth, requireRole("vendor"), (req, res) => {
  const { name, description = "", price = 0, isActive = true } = req.body;
  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }
  const result = db
    .prepare("INSERT INTO products (name, description, price, is_active) VALUES (?, ?, ?, ?)")
    .run(name, description, price, isActive ? 1 : 0);
  const created = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json(created);
});

app.put("/api/products/:id", requireAuth, requireRole("vendor"), (req, res) => {
  const { name, description = "", price = 0, isActive = true } = req.body;
  db.prepare("UPDATE products SET name = ?, description = ?, price = ?, is_active = ? WHERE id = ?").run(
    name,
    description,
    price,
    isActive ? 1 : 0,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  return res.json(updated);
});

app.delete("/api/products/:id", requireAuth, requireRole("vendor"), (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  return res.status(204).send();
});

app.put("/api/products/:id/recipe", requireAuth, requireRole("vendor"), (req, res) => {
  const { recipe } = req.body;
  if (!Array.isArray(recipe)) {
    return res.status(400).json({ message: "recipe must be an array" });
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM product_materials WHERE product_id = ?").run(req.params.id);
    const insert = db.prepare(
      "INSERT INTO product_materials (product_id, material_id, ratio) VALUES (?, ?, ?)"
    );
    for (const item of recipe) {
      if (!item.materialId || item.ratio == null) continue;
      insert.run(req.params.id, item.materialId, item.ratio);
    }
  });
  tx();
  return res.json({ ok: true });
});

app.get("/api/materials", requireAuth, requireRole("vendor"), (_req, res) => {
  const materials = db.prepare("SELECT * FROM materials ORDER BY id DESC").all();
  return res.json(materials);
});

app.post("/api/materials", requireAuth, requireRole("vendor"), (req, res) => {
  const { name, stock = 0, unit = "kg" } = req.body;
  const result = db
    .prepare("INSERT INTO materials (name, stock, unit) VALUES (?, ?, ?)")
    .run(name, stock, unit);
  const created = db.prepare("SELECT * FROM materials WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json(created);
});

app.put("/api/materials/:id", requireAuth, requireRole("vendor"), (req, res) => {
  const { name, stock, unit } = req.body;
  db.prepare("UPDATE materials SET name = ?, stock = ?, unit = ? WHERE id = ?").run(
    name,
    stock,
    unit,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM materials WHERE id = ?").get(req.params.id);
  return res.json(updated);
});

app.delete("/api/materials/:id", requireAuth, requireRole("vendor"), (req, res) => {
  db.prepare("DELETE FROM materials WHERE id = ?").run(req.params.id);
  return res.status(204).send();
});

app.post("/api/orders", requireAuth, requireRole("customer"), (req, res) => {
  const { deliveryDate, items } = req.body;
  if (!deliveryDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "deliveryDate and items are required" });
  }

  const tx = db.transaction(() => {
    const orderResult = db
      .prepare("INSERT INTO orders (user_id, delivery_date, status) VALUES (?, ?, 'pending')")
      .run(req.user.sub, deliveryDate);
    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
    );
    const getProduct = db.prepare("SELECT id, price FROM products WHERE id = ? AND is_active = 1");

    for (const item of items) {
      const product = getProduct.get(item.productId);
      if (!product) throw new Error("Product not found");
      insertItem.run(orderResult.lastInsertRowid, product.id, item.quantity, product.price);
    }
    return orderResult.lastInsertRowid;
  });

  try {
    const orderId = tx();
    const created = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/orders/my", requireAuth, requireRole("customer"), (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.*,
              COALESCE(
                json_group_array(
                  json_object(
                    'productId', oi.product_id,
                    'productName', p.name,
                    'quantity', oi.quantity,
                    'unitPrice', oi.unit_price
                  )
                ),
                json('[]')
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.id DESC`
    )
    .all(req.user.sub)
    .map((o) => ({ ...o, items: JSON.parse(o.items).filter(Boolean) }));
  return res.json(orders);
});

app.get("/api/orders", requireAuth, requireRole("vendor"), (_req, res) => {
  const orders = db
    .prepare(
      `SELECT o.id, o.delivery_date, o.status, o.created_at, o.confirmed_at,
              u.name AS customer_name, u.email AS customer_email,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id
       ORDER BY o.id DESC`
    )
    .all();
  return res.json(orders);
});

app.put("/api/orders/:id/confirm", requireAuth, requireRole("vendor"), (req, res) => {
  db.prepare("UPDATE orders SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?").run(
    req.params.id
  );
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  return res.json(order);
});

app.get("/api/reminders", requireAuth, requireRole("customer"), (req, res) => {
  const reminders = db
    .prepare(
      `SELECT id, delivery_date, status
       FROM orders
       WHERE user_id = ? AND status = 'confirmed' AND date(delivery_date) >= date('now')
       ORDER BY date(delivery_date) ASC
       LIMIT 5`
    )
    .all(req.user.sub);
  return res.json(reminders);
});

app.get("/api/orders/pending-alert", requireAuth, (_req, res) => {
  const pendingCount = db
    .prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'")
    .get().count;
  return res.json({
    pendingCount,
    threshold: PENDING_ALERT_THRESHOLD,
    warning: pendingCount >= PENDING_ALERT_THRESHOLD
  });
});

app.get("/api/stats", requireAuth, requireRole("vendor"), (_req, res) => {
  const topProducts = db
    .prepare(
      `SELECT p.name, SUM(oi.quantity) AS total_qty
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       GROUP BY oi.product_id
       ORDER BY total_qty DESC
       LIMIT 5`
    )
    .all();

  const customerFrequency = db
    .prepare(
      `SELECT u.name, u.email,
              COUNT(o.id) AS order_count,
              ROUND(julianday(MAX(o.created_at)) - julianday(MIN(o.created_at)), 2) AS span_days
       FROM users u
       JOIN orders o ON o.user_id = u.id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY order_count DESC`
    )
    .all()
    .map((c) => ({
      ...c,
      avg_cycle_days: c.order_count > 1 ? Number((c.span_days / (c.order_count - 1)).toFixed(2)) : null
    }));

  return res.json({ topProducts, customerFrequency });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
