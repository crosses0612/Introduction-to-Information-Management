import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import { query, withTransaction } from "./db.js";
import { requireAuth, requireRole, signToken } from "./auth.js";
import {
  deductStockForOrder,
  getLowStockFromRows,
  mapMaterialRow,
  recordAdjustment,
  recordInbound
} from "./inventory.js";
import { assertNonNegative, assertPositive } from "./numbers.js";

const app = express();
const PORT = process.env.PORT || 4000;
const PENDING_ALERT_THRESHOLD = Number(process.env.PENDING_ALERT_THRESHOLD || 5);
const DEFAULT_LOW_STOCK = Number(process.env.MATERIAL_LOW_STOCK_THRESHOLD || 10);

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password are required" });
  }

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const result = await query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'customer') RETURNING id, name, email, role",
    [name, email, bcrypt.hashSync(password, 10)]
  );
  const user = result.rows[0];

  return res.status(201).json({ token: signToken(user), user });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const result = await query(
    "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return res.json({ token: signToken(safeUser), user: safeUser });
});

app.get("/api/products", async (_req, res) => {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.price, p.is_active,
            COALESCE(
              json_agg(
                json_build_object(
                  'materialId', m.id,
                  'materialName', m.name,
                  'ratio', pm.ratio,
                  'usageKg', pm.ratio
                )
                ORDER BY pm.id
              ) FILTER (WHERE m.id IS NOT NULL),
              '[]'::json
            ) AS recipe
     FROM products p
     LEFT JOIN product_materials pm ON pm.product_id = p.id
     LEFT JOIN materials m ON m.id = pm.material_id
     GROUP BY p.id
     ORDER BY p.id DESC`
  );

  const products = result.rows.map((p) => ({
    ...p,
    recipe: typeof p.recipe === "string" ? JSON.parse(p.recipe) : p.recipe || []
  }));

  return res.json(products);
});

app.post("/api/products", requireAuth, requireRole("vendor"), async (req, res) => {
  const { name, description = "", price = 0, isActive = true } = req.body;
  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }
  try {
    const safePrice = assertNonNegative(price, "價格");
    const result = await query(
      "INSERT INTO products (name, description, price, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, description, safePrice, isActive]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.put("/api/products/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const { name, description = "", price = 0, isActive = true } = req.body;
  try {
    const safePrice = assertNonNegative(price, "價格");
    const result = await query(
      "UPDATE products SET name = $1, description = $2, price = $3, is_active = $4 WHERE id = $5 RETURNING *",
      [name, description, safePrice, isActive, req.params.id]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/products/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  await query("DELETE FROM products WHERE id = $1", [req.params.id]);
  return res.status(204).send();
});

app.put("/api/products/:id/recipe", requireAuth, requireRole("vendor"), async (req, res) => {
  const { recipe } = req.body;
  if (!Array.isArray(recipe)) {
    return res.status(400).json({ message: "recipe must be an array" });
  }

  try {
    await withTransaction(async (client) => {
      await client.query("DELETE FROM product_materials WHERE product_id = $1", [req.params.id]);
      for (const item of recipe) {
        if (!item.materialId || item.ratio == null) continue;
        const usageKg = assertNonNegative(
          item.ratio ?? item.usageKg,
          "每件原料用量(kg)"
        );
        await client.query(
          "INSERT INTO product_materials (product_id, material_id, ratio) VALUES ($1, $2, $3)",
          [req.params.id, item.materialId, usageKg]
        );
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/materials/low-stock", requireAuth, requireRole("vendor"), async (_req, res) => {
  const result = await query(
    `SELECT * FROM materials WHERE stock < COALESCE(low_stock_threshold, $1) ORDER BY stock ASC`,
    [DEFAULT_LOW_STOCK]
  );
  return res.json(result.rows.map(mapMaterialRow));
});

app.get("/api/materials/movements", requireAuth, requireRole("vendor"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const materialId = req.query.materialId ? Number(req.query.materialId) : null;
  const params = [limit];
  let sql = `
    SELECT mm.id, mm.material_id, m.name AS material_name, mm.movement_type, mm.quantity,
           mm.order_id, mm.note, mm.created_at, u.name AS created_by_name
    FROM material_movements mm
    JOIN materials m ON m.id = mm.material_id
    LEFT JOIN users u ON u.id = mm.created_by`;
  if (materialId) {
    sql += ` WHERE mm.material_id = $2`;
    params.push(materialId);
  }
  sql += ` ORDER BY mm.created_at DESC LIMIT $1`;
  const result = await query(sql, params);
  return res.json(result.rows);
});

app.get("/api/materials/consumption-stats", requireAuth, requireRole("vendor"), async (_req, res) => {
  const result = await query(
    `SELECT m.id, m.name, m.unit,
            COALESCE(SUM(mm.quantity), 0) AS total_consumed
     FROM materials m
     LEFT JOIN material_movements mm ON mm.material_id = m.id AND mm.movement_type = 'outbound'
       AND mm.created_at >= NOW() - INTERVAL '30 days'
     GROUP BY m.id, m.name, m.unit
     ORDER BY total_consumed DESC`
  );
  return res.json(
    result.rows.map((r) => ({
      ...r,
      total_consumed: Number(r.total_consumed)
    }))
  );
});

app.get("/api/materials", requireAuth, requireRole("vendor"), async (_req, res) => {
  const result = await query("SELECT * FROM materials ORDER BY id DESC");
  return res.json(result.rows.map(mapMaterialRow));
});

app.post("/api/materials", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const { name, stock = 0, unit = "kg", lowStockThreshold } = req.body;
    const safeStock = assertNonNegative(stock, "庫存量");
    const threshold = assertNonNegative(lowStockThreshold ?? DEFAULT_LOW_STOCK, "低庫存門檻");
    const result = await query(
      `INSERT INTO materials (name, stock, unit, low_stock_threshold) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, safeStock, unit, threshold]
    );
    return res.status(201).json(mapMaterialRow(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.post("/api/materials/:id/inbound", requireAuth, requireRole("vendor"), async (req, res) => {
  const { quantity, note } = req.body;
  try {
    await withTransaction(async (client) => {
      const exists = await client.query("SELECT id FROM materials WHERE id = $1", [req.params.id]);
      if (!exists.rows.length) throw new Error("Material not found");
      await recordInbound(client, req.params.id, assertPositive(quantity, "進貨數量"), note, req.user.sub);
    });
    const updated = await query("SELECT * FROM materials WHERE id = $1", [req.params.id]);
    return res.json(mapMaterialRow(updated.rows[0]));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.put("/api/materials/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const { name, stock, unit, lowStockThreshold } = req.body;
  try {
    const updated = await withTransaction(async (client) => {
      const current = await client.query("SELECT * FROM materials WHERE id = $1", [req.params.id]);
      if (!current.rows.length) throw new Error("Material not found");
      const old = current.rows[0];
      const newStock = stock != null ? assertNonNegative(stock, "庫存量") : Number(old.stock);
      const newThreshold =
        lowStockThreshold != null
          ? assertNonNegative(lowStockThreshold, "低庫存門檻")
          : Number(old.low_stock_threshold ?? DEFAULT_LOW_STOCK);
      const result = await client.query(
        `UPDATE materials SET name = $1, stock = $2, unit = $3, low_stock_threshold = $4 WHERE id = $5 RETURNING *`,
        [name ?? old.name, newStock, unit ?? old.unit, newThreshold, req.params.id]
      );
      if (newStock !== Number(old.stock)) {
        await recordAdjustment(
          client,
          req.params.id,
          Number(old.stock),
          newStock,
          "手動調整庫存",
          req.user.sub
        );
      }
      return result.rows[0];
    });
    return res.json(mapMaterialRow(updated));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/materials/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  await query("DELETE FROM materials WHERE id = $1", [req.params.id]);
  return res.status(204).send();
});

app.post("/api/orders", requireAuth, requireRole("customer"), async (req, res) => {
  const { deliveryDate, items } = req.body;
  if (!deliveryDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "deliveryDate and items are required" });
  }

  try {
    const orderId = await withTransaction(async (client) => {
      const orderResult = await client.query(
        "INSERT INTO orders (user_id, delivery_date, status) VALUES ($1, $2, 'pending') RETURNING id",
        [req.user.sub, deliveryDate]
      );
      const id = orderResult.rows[0].id;

      for (const item of items) {
        const productResult = await client.query(
          "SELECT id, price FROM products WHERE id = $1 AND is_active = TRUE",
          [item.productId]
        );
        const product = productResult.rows[0];
        if (!product) throw new Error("Product not found");
        const qty = assertPositive(item.quantity, "商品數量");
        await client.query(
          "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
          [id, product.id, qty, product.price]
        );
      }
      return id;
    });

    const created = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/orders/my", requireAuth, requireRole("customer"), async (req, res) => {
  const result = await query(
    `SELECT o.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', oi.product_id,
                  'productName', p.name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price
                )
                ORDER BY oi.id
              ) FILTER (WHERE oi.id IS NOT NULL),
              '[]'::json
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.id DESC`,
    [req.user.sub]
  );

  const orders = result.rows.map((o) => ({
    ...o,
    items: typeof o.items === "string" ? JSON.parse(o.items) : o.items || []
  }));
  return res.json(orders);
});

app.get("/api/orders", requireAuth, requireRole("vendor"), async (_req, res) => {
  const result = await query(
    `SELECT o.id, o.delivery_date, o.status, o.created_at, o.confirmed_at,
            u.name AS customer_name, u.email AS customer_email,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY o.id, u.name, u.email
     ORDER BY o.id DESC`
  );
  return res.json(result.rows);
});

app.put("/api/orders/:id/cancel", requireAuth, async (req, res) => {
  try {
    const order = await withTransaction(async (client) => {
      const current = await client.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      if (!current.rows.length) throw new Error("Order not found");
      const o = current.rows[0];
      if (o.status !== "pending") throw new Error("僅能取消待處理訂單");
      if (req.user.role === "customer" && String(o.user_id) !== String(req.user.sub)) {
        throw new Error("Forbidden");
      }
      const result = await client.query(
        "UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *",
        [req.params.id]
      );
      return result.rows[0];
    });
    return res.json(order);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    return res.status(status).json({ message: error.message });
  }
});

app.put("/api/orders/:id/confirm", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const { order, lowStockMaterials } = await withTransaction(async (client) => {
      const current = await client.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      if (!current.rows.length) throw new Error("Order not found");
      if (current.rows[0].status !== "pending") throw new Error("僅能確認待處理訂單");

      await deductStockForOrder(client, req.params.id, req.user.sub);

      const result = await client.query(
        "UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1 RETURNING *",
        [req.params.id]
      );

      const materialsResult = await client.query("SELECT * FROM materials ORDER BY id DESC");
      const mapped = materialsResult.rows.map(mapMaterialRow);
      return { order: result.rows[0], lowStockMaterials: getLowStockFromRows(mapped) };
    });
    return res.json({ order, lowStockMaterials });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/reminders", requireAuth, requireRole("customer"), async (req, res) => {
  const result = await query(
    `SELECT id, delivery_date, status
     FROM orders
     WHERE user_id = $1 AND status = 'confirmed' AND delivery_date >= CURRENT_DATE
     ORDER BY delivery_date ASC
     LIMIT 5`,
    [req.user.sub]
  );
  return res.json(result.rows);
});

app.get("/api/orders/pending-alert", requireAuth, async (_req, res) => {
  const result = await query("SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending'");
  const pendingCount = result.rows[0].count;
  return res.json({
    pendingCount,
    threshold: PENDING_ALERT_THRESHOLD,
    warning: pendingCount >= PENDING_ALERT_THRESHOLD
  });
});

app.get("/api/stats", requireAuth, requireRole("vendor"), async (_req, res) => {
  const topProductsResult = await query(
    `SELECT p.name, SUM(oi.quantity)::int AS total_qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.status != 'cancelled'
     GROUP BY oi.product_id, p.name
     ORDER BY total_qty DESC
     LIMIT 5`
  );

  const customerFrequencyResult = await query(
    `SELECT u.name, u.email,
            COUNT(o.id)::int AS order_count,
            ROUND(
              EXTRACT(EPOCH FROM (MAX(o.created_at) - MIN(o.created_at))) / 86400,
              2
            ) AS span_days
     FROM users u
     JOIN orders o ON o.user_id = u.id
     WHERE u.role = 'customer' AND o.status != 'cancelled'
     GROUP BY u.id, u.name, u.email
     ORDER BY order_count DESC`
  );

  const customerFrequency = customerFrequencyResult.rows.map((c) => ({
    ...c,
    span_days: c.span_days != null ? Number(c.span_days) : null,
    avg_cycle_days:
      c.order_count > 1 && c.span_days != null
        ? Number((c.span_days / (c.order_count - 1)).toFixed(2))
        : null
  }));

  return res.json({
    topProducts: topProductsResult.rows,
    customerFrequency
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
