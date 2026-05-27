-- Migration 024: Tambah field konfigurasi nota/printer pada settings
-- nota_title, nota_jabatan, nota_show_watermark

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS nota_title TEXT,
  ADD COLUMN IF NOT EXISTS nota_jabatan TEXT,
  ADD COLUMN IF NOT EXISTS nota_show_watermark BOOLEAN NOT NULL DEFAULT TRUE;
