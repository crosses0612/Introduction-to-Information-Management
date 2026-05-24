const DEFAULT_LOW_STOCK = Number(process.env.MATERIAL_LOW_STOCK_THRESHOLD || 10);

// product_materials.ratio = 每件商品消耗的原料公斤數
export async function computeOrderMaterialNeeds(client, orderId) {
  const result = await client.query(
    `SELECT pm.material_id, m.name AS material_name, m.stock, m.low_stock_threshold,
            SUM(oi.quantity * pm.ratio) AS required_qty
     FROM order_items oi
     JOIN product_materials pm ON pm.product_id = oi.product_id
     JOIN materials m ON m.id = pm.material_id
     WHERE oi.order_id = $1
     GROUP BY pm.material_id, m.name, m.stock, m.low_stock_threshold`,
    [orderId]
  );
  return result.rows.map((r) => ({
    materialId: r.material_id,
    materialName: r.material_name,
    stock: Number(r.stock),
    lowStockThreshold: Number(r.low_stock_threshold ?? DEFAULT_LOW_STOCK),
    requiredQty: Number(r.required_qty)
  }));
}

export async function deductStockForOrder(client, orderId, userId) {
  const needs = await computeOrderMaterialNeeds(client, orderId);
  const insufficient = needs.filter((n) => n.stock < n.requiredQty);
  if (insufficient.length > 0) {
    const names = insufficient
      .map((n) => `${n.materialName}（需 ${n.requiredQty}，現有 ${n.stock}）`)
      .join("、");
    throw new Error(`庫存不足：${names}`);
  }

  for (const n of needs) {
    await client.query("UPDATE materials SET stock = stock - $1 WHERE id = $2", [
      n.requiredQty,
      n.materialId
    ]);
    await client.query(
      `INSERT INTO material_movements (material_id, movement_type, quantity, order_id, note, created_by)
       VALUES ($1, 'outbound', $2, $3, $4, $5)`,
      [n.materialId, n.requiredQty, orderId, `訂單 #${orderId} 自動從庫存扣除`, userId]
    );
  }

  return needs;
}

export async function recordInbound(client, materialId, quantity, note, userId) {
  if (!quantity || quantity <= 0) throw new Error("進貨數量必須大於 0");
  await client.query("UPDATE materials SET stock = stock + $1 WHERE id = $2", [quantity, materialId]);
  await client.query(
    `INSERT INTO material_movements (material_id, movement_type, quantity, note, created_by)
     VALUES ($1, 'inbound', $2, $3, $4)`,
    [materialId, quantity, note || "進貨", userId]
  );
}

export async function recordAdjustment(client, materialId, oldStock, newStock, note, userId) {
  const delta = Math.abs(newStock - oldStock);
  if (delta === 0) return;
  await client.query(
    `INSERT INTO material_movements (material_id, movement_type, quantity, note, created_by)
     VALUES ($1, 'adjustment', $2, $3, $4)`,
    [materialId, delta, note || `手動調整：${oldStock} → ${newStock}`, userId]
  );
}

export function mapMaterialRow(row) {
  const threshold = Number(row.low_stock_threshold ?? DEFAULT_LOW_STOCK);
  const stock = Number(row.stock);
  return {
    ...row,
    stock,
    low_stock_threshold: threshold,
    is_low_stock: stock < threshold
  };
}

export function getLowStockFromRows(rows) {
  return rows.filter((r) => r.is_low_stock);
}
