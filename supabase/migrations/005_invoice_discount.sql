-- Migration 005: Add global discount column to invoices
-- Run this in Supabase SQL Editor.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
