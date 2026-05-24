-- Migration 008: Add is_paid to mechanic_debt_ledger
-- Owner/admin can mark a debt entry as paid.
-- Mechanic can read the flag for transparency.
-- Run in Supabase SQL Editor after migration 007.

ALTER TABLE public.mechanic_debt_ledger
    ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;

-- Allow owner/admin to update is_paid
CREATE POLICY "mechanic_debt_ledger__owner_admin_update"
    ON public.mechanic_debt_ledger FOR UPDATE
    USING (
        public.get_my_role() IN ('owner', 'admin')
        AND tenant_id = public.get_my_tenant_id()
    )
    WITH CHECK (
        public.get_my_role() IN ('owner', 'admin')
        AND tenant_id = public.get_my_tenant_id()
    );
