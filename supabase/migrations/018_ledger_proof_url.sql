-- ============================================================
-- Migration 018: Add proof_url column to ledger
-- Stores optional transfer/payment proof image URL (Supabase Storage URL)
-- Separate from transfer_ref which is reserved for UUID cross-references
-- between paired ledger entries (kas_tunai ↔ bank transfers).
-- ============================================================

ALTER TABLE public.ledger
    ADD COLUMN IF NOT EXISTS proof_url TEXT;
