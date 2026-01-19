-- =====================================================
-- Script Manual: Limpiar Tabla de Transacciones
-- Objetivo: Borrar todos los cobros y pagos para reiniciar el estado.
-- =====================================================

DELETE FROM transactions;

-- Opcional: Reiniciar secuencias si las hubiera (no aplica con UUIDs gen_random_uuid)
