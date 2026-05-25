-- ============================================================
-- Migration 014: Add account_type + transfer_ref to ledger
-- Enables Kas Tunai / Bank split in the main Ledger module.
-- Transfer between accounts creates two linked entries via
-- transfer_ref (each row references the paired row).
-- ============================================================

-- 1. Create the account_type enum
DO $$ BEGIN
    CREATE TYPE public.account_type AS ENUM ('kas_tunai', 'bank');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to ledger
ALTER TABLE public.ledger
    ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'kas_tunai',
    ADD COLUMN IF NOT EXISTS transfer_ref UUID REFERENCES public.ledger(id) ON DELETE SET NULL;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_account
    ON public.ledger(tenant_id, account_type);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_created
    ON public.ledger(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_transfer_ref
    ON public.ledger(transfer_ref)
    WHERE transfer_ref IS NOT NULL;
