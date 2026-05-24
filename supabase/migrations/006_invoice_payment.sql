-- Migration 006: Add payment_method column to invoices
-- Run this in Supabase SQL Editor AFTER migration 005.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash', 'transfer', 'other'));
