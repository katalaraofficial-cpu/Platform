-- ============================================================
-- Migration 013: Allow mechanics to insert their own debt entries
-- ============================================================
-- submitMechanicReceipt server action inserts into mechanic_debt_ledger
-- on behalf of the mechanic (client supabase). The existing policy only
-- grants SELECT. Add a scoped INSERT policy so mechanics can record
-- their own advance purchases (struk upload).
-- ============================================================

CREATE POLICY "debt_ledger__mechanic_insert_own"
    ON public.mechanic_debt_ledger FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'mechanic'
        AND mechanic_id = auth.uid()
        AND tenant_id = public.get_my_tenant_id()
        AND transaction_type = 'advance'
        AND created_by = auth.uid()
    );
