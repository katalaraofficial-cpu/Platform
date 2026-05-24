-- Migration 007: Allow mechanics to update status of invoices they are assigned to
-- Mechanics can only set status to 'in_progress' or 'completed'.
-- Valid transitions (enforced in server action): draft → in_progress → completed
-- Run in Supabase SQL Editor after migration 006.

CREATE POLICY "invoices__mechanic_update_assigned"
    ON public.invoices FOR UPDATE
    USING (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.invoice_mechanics im
            WHERE im.invoice_id = id
              AND im.mechanic_id = auth.uid()
        )
    )
    WITH CHECK (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
        AND status IN ('in_progress', 'completed')
    );
