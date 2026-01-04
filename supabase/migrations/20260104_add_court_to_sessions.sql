-- Migration: Add court column to sessions table
-- Description: Adds a flexible text field for court reference to the sessions table.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS court text;
