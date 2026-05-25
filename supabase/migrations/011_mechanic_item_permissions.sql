-- ============================================================
-- Migration 011: Fix invoice_items RLS for mechanics
--               + Allow mechanics to add service items
-- ============================================================
-- The existing policies have recursive RLS issues (EXISTS on
-- invoice_mechanics). Fix using mechanic_is_assigned() helper.
-- Also expand INSERT to allow 'service' item type (not just part_external).
-- ============================================================

-- ── Fix SELECT policy ────────────────────────────────────────
DROP POLICY IF EXISTS "inv_items__mechanic_read_assigned" ON public.invoice_items;

CREATE POLICY "inv_items__mechanic_read_assigned"
    ON public.invoice_items FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND public.mechanic_is_assigned(invoice_id)
    );

-- ── Replace INSERT policy ────────────────────────────────────
-- Old policy only allowed part_external + payment_source='mechanic'.
-- New policy allows service (no payment_source) OR part_external
-- (payment_source must be 'mechanic' or 'owner').
DROP POLICY IF EXISTS "inv_items__mechanic_insert_external" ON public.invoice_items;

CREATE POLICY "inv_items__mechanic_insert"
    ON public.invoice_items FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
        AND item_type IN ('service', 'part_external')
        AND submitted_by = auth.uid()
        AND public.mechanic_is_assigned(invoice_id)
        AND (
            item_type = 'service'
            OR (item_type = 'part_external' AND payment_source IN ('mechanic', 'owner'))
        )
    );
