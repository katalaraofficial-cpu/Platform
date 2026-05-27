-- Migration 024: Tambah field konfigurasi nota/printer pada settings
-- nota_title, nota_subtitle, nota_customer_layout, nota_signature_layout, nota_jabatan, nota_show_watermark

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS nota_title TEXT,
  ADD COLUMN IF NOT EXISTS nota_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS nota_customer_layout TEXT NOT NULL DEFAULT 'stacked',
  ADD COLUMN IF NOT EXISTS nota_signature_layout TEXT NOT NULL DEFAULT 'double',
  ADD COLUMN IF NOT EXISTS nota_jabatan TEXT,
  ADD COLUMN IF NOT EXISTS nota_show_watermark BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE settings
SET
  nota_customer_layout = COALESCE(nota_customer_layout, 'stacked'),
  nota_signature_layout = COALESCE(nota_signature_layout, 'double');
