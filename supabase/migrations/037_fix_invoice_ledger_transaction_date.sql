-- ============================================================
-- Migration 037: Fix wrong ledger.transaction_date for invoice payments
-- ============================================================
-- Root cause:
-- processPayment inserted ledger rows without transaction_date,
-- so PostgreSQL used DEFAULT CURRENT_DATE (tanggal hari input).
-- This makes historical payments appear in today's cashflow.
--
-- This migration aligns transaction_date to invoice paid date
-- for payment ledger rows.
-- ============================================================

UPDATE public.ledger AS l
SET transaction_date = (i.paid_at AT TIME ZONE 'Asia/Jakarta')::date
FROM public.invoices AS i
WHERE l.reference_id = i.id
  AND l.tenant_id = i.tenant_id
  AND l.transaction_type = 'kas_masuk'
  AND l.category = 'Pembayaran Invoice'
  AND i.paid_at IS NOT NULL
  AND l.transaction_date <> (i.paid_at AT TIME ZONE 'Asia/Jakarta')::date;
