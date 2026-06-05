-- ============================================================
-- Migration 034: Backfill ledger.notes untuk Pembayaran Invoice
-- Tambahkan nama pelanggan ke depan keterangan agar konsisten
-- dengan format baru: "{customer_name} — Pembayaran {invoice_number} via {method}"
--
-- Heuristik: hanya update entry yang notes-nya MASIH dalam format lama
-- (`Pembayaran invoice INV-...`) agar tidak menimpa edit manual user.
-- ============================================================

UPDATE public.ledger AS l
SET notes = COALESCE(NULLIF(TRIM(c.name), ''), 'Pelanggan')
            || ' — Pembayaran '
            || i.invoice_number
            || ' via '
            || CASE
                 WHEN i.payment_method = 'cash' THEN 'Tunai'
                 WHEN i.payment_method = 'transfer' THEN 'Transfer Bank'
                 WHEN i.payment_method = 'other' THEN 'Lainnya'
                 ELSE COALESCE(i.payment_method, 'Lainnya')
               END
FROM public.invoices AS i
LEFT JOIN public.customers AS c ON c.id = i.customer_id
WHERE l.reference_id = i.id
  AND l.tenant_id = i.tenant_id
  AND l.transaction_type = 'kas_masuk'
  AND l.category = 'Pembayaran Invoice'
  AND l.notes LIKE 'Pembayaran invoice %';
