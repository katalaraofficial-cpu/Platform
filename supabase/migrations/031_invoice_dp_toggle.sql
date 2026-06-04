-- ============================================================
-- Migration 031: Backfill module_invoice_dp feature toggle
-- Default OFF for all existing tenants. UI hides DP feature
-- entirely unless owner explicitly enables it in settings.
-- ============================================================

UPDATE public.tenants
SET feature_toggles = feature_toggles || '{"module_invoice_dp": false}'::jsonb
WHERE NOT (feature_toggles ? 'module_invoice_dp');
