-- =====================================================
-- Migración: Motivo de Cancelación (Soft Delete)
-- Fecha: 2026-01-25
-- Descripción: Agrega columna cancellation_reason a sessions.
-- =====================================================

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;
