-- ============================================================
-- DIAGNOSA: Cek kenapa Pendapatan Hari Ini = 0
-- Jalankan SATU PER SATU, lihat outputnya, kirim ke saya.
-- ============================================================

-- 1. Total Pembayaran Invoice di Juni 2026 (yang seharusnya muncul di Pendapatan Juni)
SELECT
  COUNT(*) AS jumlah_entry,
  SUM(amount) AS total_amount,
  MIN(created_at) AS earliest,
  MAX(created_at) AS latest
FROM public.ledger
WHERE category = 'Pembayaran Invoice'
  AND transaction_type = 'kas_masuk'
  AND created_at >= '2026-06-01T00:00:00Z'
  AND created_at < '2026-07-01T00:00:00Z';

-- 2. Detail per entry untuk Juni — bandingkan created_at vs paid_at invoice
SELECT
  l.created_at AS ledger_created_at,
  i.paid_at AS invoice_paid_at,
  i.invoice_number,
  l.amount,
  l.notes,
  l.reference_id,
  CASE
    WHEN l.reference_id IS NULL THEN 'NULL_REF (tidak terhubung invoice)'
    WHEN l.created_at = i.paid_at THEN 'SINKRON'
    ELSE 'BEDA (perlu backfill)'
  END AS status
FROM public.ledger l
LEFT JOIN public.invoices i ON i.id = l.reference_id
WHERE l.category = 'Pembayaran Invoice'
  AND l.transaction_type = 'kas_masuk'
  AND (
    l.created_at >= '2026-06-01T00:00:00Z'
    OR i.paid_at >= '2026-06-01T00:00:00Z'
  )
ORDER BY i.paid_at DESC NULLS LAST, l.created_at DESC;

-- 3. Khusus hari ini (5 Juni 2026 UTC)
SELECT
  COUNT(*) AS jumlah_entry,
  SUM(amount) AS total_today
FROM public.ledger
WHERE category = 'Pembayaran Invoice'
  AND transaction_type = 'kas_masuk'
  AND created_at >= '2026-06-05T00:00:00Z'
  AND created_at < '2026-06-06T00:00:00Z';
