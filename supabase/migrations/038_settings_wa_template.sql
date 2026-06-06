-- ============================================================
-- Migration 038: WhatsApp share message template per tenant
-- ============================================================
-- Adds a configurable WA message template stored in settings.
-- Placeholders supported by app code:
--   {bisnis}    -> nama bisnis (store_name / tenant name)
--   {format}    -> jenis dokumen (INVOICE / NOTA KONTAN / STRUK)
--   {no}        -> nomor invoice
--   {tgl}       -> tanggal invoice (dd/mm/yyyy)
--   {pelanggan} -> nama pelanggan
--   {total}     -> grand total dalam format Rp
--   {status}    -> status bisnis (Selesai - Lunas / Selesai - Belum Bayar / dll)
--   {link}      -> link preview publik invoice (akan kosong jika format bukan invoice)
-- ============================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS wa_message_template TEXT;

COMMENT ON COLUMN public.settings.wa_message_template IS
  'Template pesan WhatsApp untuk share invoice. Mendukung placeholder {bisnis}, {format}, {no}, {tgl}, {pelanggan}, {total}, {status}, {link}.';
