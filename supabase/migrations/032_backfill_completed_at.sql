-- ============================================================
-- Migration 032: Backfill completed_at for retroactive invoices
-- Sebelum fix updateInvoiceMechanicStatus, mekanik yang menyelesaikan
-- invoice retroaktif menyebabkan completed_at = waktu klik (bukan
-- invoice_date). Ini mempengaruhi pendapatan bulan berjalan secara
-- keliru. Migration ini memperbaiki baris yang completed_at-nya jatuh
-- di hari yang lebih baru daripada invoice_date.
-- ============================================================

UPDATE public.invoices
SET completed_at = (invoice_date::timestamp + INTERVAL '12 hours') AT TIME ZONE 'UTC'
WHERE completed_at IS NOT NULL
  AND invoice_date IS NOT NULL
  AND completed_at::date > invoice_date
  AND status IN ('completed', 'paid');
