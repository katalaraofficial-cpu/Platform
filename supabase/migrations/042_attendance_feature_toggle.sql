-- 042_attendance_feature_toggle.sql
-- Master switch modul Absensi/Kehadiran per-tenant (dikontrol Super Admin).
-- Disimpan di tenants.feature_toggles (JSONB) mengikuti pola modul lain.

UPDATE public.tenants
SET feature_toggles = feature_toggles || '{"module_attendance": false}'::jsonb
WHERE NOT (feature_toggles ? 'module_attendance');
