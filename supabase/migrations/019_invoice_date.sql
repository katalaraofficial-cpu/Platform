-- ============================================================
-- Migration 019: Add invoice_date column to invoices
-- Stores the document date set by the user (may differ from
-- created_at which is always the system timestamp of record creation).
-- ============================================================

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS invoice_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Backfill existing rows: set invoice_date = DATE(created_at)
UPDATE public.invoices
   SET invoice_date = DATE(created_at)
 WHERE invoice_date = CURRENT_DATE
   AND created_at::date != CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_invoice_date
    ON public.invoices (tenant_id, invoice_date DESC);
