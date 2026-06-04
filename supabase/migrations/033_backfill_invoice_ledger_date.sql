-- ============================================================
-- Migration 033: Backfill ledger.created_at from invoices.paid_at
-- Dashboard owner menggunakan ledger.created_at untuk kartu
-- "Pendapatan Hari Ini". Jika pembayaran invoice dulu dicatat dengan
-- created_at=now(), maka angka harian bisa salah saat nota lama dibayar
-- dengan tanggal bayar mundur.
-- ============================================================

UPDATE public.ledger AS l
SET created_at = i.paid_at
FROM public.invoices AS i
WHERE l.reference_id = i.id
  AND l.tenant_id = i.tenant_id
  AND l.transaction_type = 'kas_masuk'
  AND l.category = 'Pembayaran Invoice'
  AND i.paid_at IS NOT NULL
  AND l.created_at <> i.paid_at;
