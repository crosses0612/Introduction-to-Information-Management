-- Inventory ledger, low-stock threshold, order cancellation

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS low_stock_threshold DOUBLE PRECISION NOT NULL DEFAULT 10;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled'));

CREATE TABLE IF NOT EXISTS material_movements (
  id BIGSERIAL PRIMARY KEY,
  material_id BIGINT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inbound', 'outbound', 'adjustment')),
  quantity DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  note TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_movements_material_id ON material_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_order_id ON material_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_created_at ON material_movements(created_at DESC);
