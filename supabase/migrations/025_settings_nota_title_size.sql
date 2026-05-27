-- Migration 025: tambah pengaturan ukuran judul nota/invoice

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS nota_title_size INTEGER NOT NULL DEFAULT 28;

UPDATE settings
SET nota_title_size = COALESCE(nota_title_size, 28);

ALTER TABLE settings
  DROP CONSTRAINT IF EXISTS settings_nota_title_size_check;

ALTER TABLE settings
  ADD CONSTRAINT settings_nota_title_size_check
  CHECK (nota_title_size BETWEEN 16 AND 42);
