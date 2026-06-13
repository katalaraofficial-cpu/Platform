-- ============================================================
-- Migration 047: Tambah kolom job_title pada invoices
-- Tujuan:
-- - Field "Judul Pekerjaan" di invoice editor (menggantikan UI Jatuh Tempo)
-- - Tampil di kolom list invoice (owner + admin) setelah Pelanggan.
-- Catatan:
-- - Idempotent: aman dijalankan berulang.
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS job_title TEXT;
