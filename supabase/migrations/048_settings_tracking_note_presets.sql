-- Migration 048: Preset aksi cepat untuk catatan tracking invoice
-- Disimpan per-tenant di settings sebagai daftar label (mis. "Diambil", "Diantar", "Dipasang").
-- Dipakai di modal Buat Catatan sebagai tombol aksi cepat antara field Tanggal & Catatan.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tracking_note_presets JSONB NOT NULL
  DEFAULT '["Diambil","Diantar","Dipasang"]'::jsonb;

COMMENT ON COLUMN public.settings.tracking_note_presets IS
  'Daftar label aksi cepat catatan tracking invoice (array of string).';
