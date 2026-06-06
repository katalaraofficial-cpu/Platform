-- ============================================================
-- Migration 036: Mechanic non-invoice claim support
-- ============================================================
-- Mekanik kini dapat mengupload klaim non-invoice (mis. bensin,
-- kesehatan, lain-lain). Untuk itu mechanic_debt_ledger perlu
-- menyimpan kategori klaim dan URL struk pendukungnya secara
-- mandiri (tanpa harus terhubung ke invoice_items).
-- ============================================================

ALTER TABLE public.mechanic_debt_ledger
    ADD COLUMN IF NOT EXISTS claim_category TEXT,
    ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

COMMENT ON COLUMN public.mechanic_debt_ledger.claim_category IS
    'Kategori klaim non-invoice: bensin | kesehatan | lainnya. NULL = pembelian part terkait invoice.';
COMMENT ON COLUMN public.mechanic_debt_ledger.receipt_image_url IS
    'URL bukti struk untuk klaim non-invoice (entri dengan invoice_item_id NULL).';
