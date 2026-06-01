-- ============================================================
-- Migration 028: Add transaction_date to ledger
-- Allows users to specify the actual transaction date
-- (separate from created_at which records when it was entered)
-- ============================================================

ALTER TABLE public.ledger
  ADD COLUMN IF NOT EXISTS transaction_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Backfill existing rows using created_at date
UPDATE public.ledger
  SET transaction_date = (created_at AT TIME ZONE 'Asia/Jakarta')::date
  WHERE true;

-- Index for efficient date-range queries
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_txdate
  ON public.ledger(tenant_id, transaction_date DESC);
