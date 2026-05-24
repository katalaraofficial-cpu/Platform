-- Migration 004: Add PPN/PPh tax columns to invoices
-- Run this in Supabase SQL Editor before deploying the tax feature.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ppn_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ppn_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pph_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pph_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
