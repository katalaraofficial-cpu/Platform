-- ============================================================
-- Migration 030: Invoice Down Payment (DP)
-- Adds dp_amount column to invoices for tracking advance
-- payments (uang muka) from customers.
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS dp_amount NUMERIC(15,2) NOT NULL DEFAULT 0
    CONSTRAINT dp_amount_non_negative CHECK (dp_amount >= 0);
