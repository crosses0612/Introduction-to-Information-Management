-- Order extensions, completed status, vendor shop settings, test clock offset

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE orders
SET delivery_at = delivery_date::timestamptz
WHERE delivery_at IS NULL AND delivery_date IS NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'));

CREATE TABLE IF NOT EXISTS vendor_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  factory_address TEXT NOT NULL DEFAULT '',
  clock_offset_minutes INT NOT NULL DEFAULT 0
);

INSERT INTO vendor_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
