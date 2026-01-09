-- Remove reference column from transactions table
ALTER TABLE transactions DROP COLUMN IF EXISTS reference;
