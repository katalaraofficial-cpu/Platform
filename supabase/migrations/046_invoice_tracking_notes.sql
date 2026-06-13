-- Migration 046: Tambah kolom tracking_notes (JSONB) untuk catatan khusus per invoice
-- Digunakan untuk mencatat aktivitas tracking (mis. barang sudah diambil pelanggan walau belum lunas)
-- Format: [{ "id": "uuid", "date": "YYYY-MM-DD", "text": "...", "created_at": "ISO" }, ...]

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tracking_notes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.invoices.tracking_notes IS
  'Daftar catatan tracking pekerjaan (per-entry: id, date, text, created_at).';
