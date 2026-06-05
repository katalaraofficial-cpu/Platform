-- ─────────────────────────────────────────────────────────────────────────
-- Migration 035: Backfill module_invoice_ppn & module_invoice_pph toggles
-- ─────────────────────────────────────────────────────────────────────────
-- Tujuan:
--   Menambahkan dua flag baru ke kolom feature_toggles (JSONB) di tabel tenants.
--   - module_invoice_ppn : true (default ON, agar invoice yang sudah memakai
--                          PPN tetap berfungsi tanpa intervensi owner)
--   - module_invoice_pph : true (idem)
--
-- Owner dapat me-non-aktifkan modul ini dari halaman Settings → Modul Invoice.
-- Bila modul OFF, kolom PPN/PPh tidak akan tampil di editor invoice baru.
-- Invoice lama yang sudah tersimpan dengan PPN/PPh > 0 akan tetap menampilkan
-- nilai tersebut secara read-only sebagai jejak historis.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE public.tenants
SET feature_toggles = feature_toggles || '{"module_invoice_ppn": true}'::jsonb
WHERE NOT (feature_toggles ? 'module_invoice_ppn');

UPDATE public.tenants
SET feature_toggles = feature_toggles || '{"module_invoice_pph": true}'::jsonb
WHERE NOT (feature_toggles ? 'module_invoice_pph');
