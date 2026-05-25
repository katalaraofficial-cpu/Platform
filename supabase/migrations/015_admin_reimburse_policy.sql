-- ============================================================
-- Migration 015: Grant admin access to mechanic_debt_ledger
--                for reimbursement operations
-- ============================================================
-- Previously admin had ZERO access. Now admin can:
--   SELECT  : view all debt records for their tenant (to process)
--   INSERT  : add reimbursement entries only (NOT advance)
-- Owner retains full CRUD. Mechanic retains SELECT-own only.
-- ============================================================

-- Admin SELECT: view full history to process reimbursements
CREATE POLICY "debt_ledger__admin_select"
    ON public.mechanic_debt_ledger FOR SELECT
    USING (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin INSERT: reimbursement entries only
CREATE POLICY "debt_ledger__admin_reimburse"
    ON public.mechanic_debt_ledger FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
        AND transaction_type = 'reimbursement'
        AND created_by = auth.uid()
    );
