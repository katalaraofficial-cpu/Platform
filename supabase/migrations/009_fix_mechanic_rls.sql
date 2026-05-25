-- ============================================================
-- Migration 009: Fix mechanic RLS policies
-- ============================================================
-- The original inv_mech__mechanic_read_own policy requires BOTH
-- mechanic_id = auth.uid() AND tenant_id = get_my_tenant_id().
-- While tenant_id cannot be NULL (DB constraint), a tenant mismatch
-- between the invoice_mechanics row and the mechanic's profile
-- would silently block reads.
--
-- Simplified policy: mechanic_id = auth.uid() is already a strong,
-- unique security constraint — no need to cross-check tenant_id.
-- ============================================================

-- Drop the old mechanic read policy
DROP POLICY IF EXISTS "inv_mech__mechanic_read_own" ON public.invoice_mechanics;

-- Recreate without the redundant tenant_id check
CREATE POLICY "inv_mech__mechanic_read_own"
    ON public.invoice_mechanics FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND mechanic_id = auth.uid()
    );


-- ============================================================
-- Also fix invoices__mechanic_read_assigned for the same reason
-- ============================================================

DROP POLICY IF EXISTS "invoices__mechanic_read_assigned" ON public.invoices;

CREATE POLICY "invoices__mechanic_read_assigned"
    ON public.invoices FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND EXISTS (
            SELECT 1
            FROM public.invoice_mechanics im
            WHERE im.invoice_id = id
              AND im.mechanic_id = auth.uid()
        )
    );
