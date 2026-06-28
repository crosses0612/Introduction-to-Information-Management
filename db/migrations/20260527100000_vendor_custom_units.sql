-- Persist vendor-defined custom material units so they survive reloads and devices

ALTER TABLE vendor_settings
  ADD COLUMN IF NOT EXISTS custom_units JSONB NOT NULL DEFAULT '[]'::jsonb;
