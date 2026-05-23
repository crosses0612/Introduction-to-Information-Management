-- Add phone for user profile management

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
