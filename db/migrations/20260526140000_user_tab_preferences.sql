-- Add user preference columns for tab ordering persistence across devices

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cust_tabs_order JSONB,
  ADD COLUMN IF NOT EXISTS vend_tabs_order JSONB,
  ADD COLUMN IF NOT EXISTS material_sub_tabs_order JSONB;
