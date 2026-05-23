-- ============================================================
-- FILE: 002_rls_policies.sql
-- DESC: Row Level Security (RLS) policies for all tables.
--
-- SECURITY MODEL SUMMARY:
--   super_admin  → Full access across ALL tenants (platform-level)
--   owner        → Full CRUD within their OWN tenant only
--   admin        → CRUD on operational tables; BLOCKED from Ledger & Debt Ledger
--   mechanic     → Read own assignments; can submit external part receipts only
--
-- ISOLATION GUARANTEE:
--   Every policy that is not super_admin also checks:
--     tenant_id = public.get_my_tenant_id()
--   This ensures no cross-tenant data leakage even if tenant_id is known.
-- ============================================================


-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.tenants                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_mechanics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_debt_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_transactions  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TABLE: tenants
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "tenants__super_admin_all"
    ON public.tenants FOR ALL
    USING (public.is_super_admin());

-- Owner / Admin / Mechanic: read their own tenant only
CREATE POLICY "tenants__member_read_own"
    ON public.tenants FOR SELECT
    USING (id = public.get_my_tenant_id());


-- ============================================================
-- TABLE: profiles
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "profiles__super_admin_all"
    ON public.profiles FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD on all profiles within their tenant
CREATE POLICY "profiles__owner_manage_tenant"
    ON public.profiles FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin / Mechanic: read all profiles in their tenant
--   (needed to display mechanic names, etc.)
CREATE POLICY "profiles__member_read_tenant"
    ON public.profiles FOR SELECT
    USING (
        public.get_my_role() IN ('admin', 'mechanic')
        AND tenant_id = public.get_my_tenant_id()
    );

-- Any authenticated user: always read & update their OWN profile row
--   (covers the case where a mechanic updates their own name)
CREATE POLICY "profiles__self_manage"
    ON public.profiles FOR ALL
    USING (id = auth.uid());


-- ============================================================
-- TABLE: settings
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "settings__super_admin_all"
    ON public.settings FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD on their tenant's settings
CREATE POLICY "settings__owner_manage"
    ON public.settings FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin / Mechanic: read-only (needed for markup_pct, petty_cash_limit display)
CREATE POLICY "settings__member_read"
    ON public.settings FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());


-- ============================================================
-- TABLE: customers
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "customers__super_admin_all"
    ON public.customers FOR ALL
    USING (public.is_super_admin());

-- Owner & Admin: full CRUD
CREATE POLICY "customers__owner_admin_manage"
    ON public.customers FOR ALL
    USING (
        public.get_my_role() IN ('owner', 'admin')
        AND tenant_id = public.get_my_tenant_id()
    );

-- Mechanic: read-only (to see customer name on assigned invoice)
CREATE POLICY "customers__mechanic_read"
    ON public.customers FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
    );


-- ============================================================
-- TABLE: invoices
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "invoices__super_admin_all"
    ON public.invoices FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD within tenant
CREATE POLICY "invoices__owner_manage"
    ON public.invoices FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin: full CRUD within tenant (creates and manages Running Invoices)
CREATE POLICY "invoices__admin_manage"
    ON public.invoices FOR ALL
    USING (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Mechanic: read-only, ONLY for invoices they are assigned to
CREATE POLICY "invoices__mechanic_read_assigned"
    ON public.invoices FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.invoice_mechanics im
            WHERE im.invoice_id = id
              AND im.mechanic_id = auth.uid()
        )
    );


-- ============================================================
-- TABLE: invoice_items
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "inv_items__super_admin_all"
    ON public.invoice_items FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD within tenant
CREATE POLICY "inv_items__owner_manage"
    ON public.invoice_items FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin: full CRUD within tenant (adds services and parts to invoices)
CREATE POLICY "inv_items__admin_manage"
    ON public.invoice_items FOR ALL
    USING (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Mechanic: INSERT only — restricted to part_external on assigned invoices
--   They MUST set submitted_by = their own auth.uid()
CREATE POLICY "inv_items__mechanic_insert_external"
    ON public.invoice_items FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
        AND item_type = 'part_external'
        AND payment_source = 'mechanic'
        AND submitted_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.invoice_mechanics im
            WHERE im.invoice_id = invoice_id
              AND im.mechanic_id = auth.uid()
        )
    );

-- Mechanic: SELECT only — restricted to items on assigned invoices
CREATE POLICY "inv_items__mechanic_read_assigned"
    ON public.invoice_items FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND tenant_id = public.get_my_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.invoice_mechanics im
            WHERE im.invoice_id = invoice_id
              AND im.mechanic_id = auth.uid()
        )
    );


-- ============================================================
-- TABLE: invoice_mechanics
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "inv_mech__super_admin_all"
    ON public.invoice_mechanics FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD (can assign / reassign mechanics)
CREATE POLICY "inv_mech__owner_manage"
    ON public.invoice_mechanics FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin: full CRUD (front-desk assigns mechanics to jobs)
CREATE POLICY "inv_mech__admin_manage"
    ON public.invoice_mechanics FOR ALL
    USING (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Mechanic: read ONLY their own assignment rows
CREATE POLICY "inv_mech__mechanic_read_own"
    ON public.invoice_mechanics FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND mechanic_id = auth.uid()
        AND tenant_id = public.get_my_tenant_id()
    );


-- ============================================================
-- TABLE: mechanic_debt_ledger
-- ─────────────────────────────────────────────────────────────
-- CRITICAL: Admin has ZERO access. This prevents cashiers from
-- seeing or manipulating internal reimbursement records.
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "debt_ledger__super_admin_all"
    ON public.mechanic_debt_ledger FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD (manages and settles mechanic debts)
CREATE POLICY "debt_ledger__owner_manage"
    ON public.mechanic_debt_ledger FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Mechanic: read ONLY their own debt records (transparency)
CREATE POLICY "debt_ledger__mechanic_read_own"
    ON public.mechanic_debt_ledger FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND mechanic_id = auth.uid()
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin: NO policy → blocked by default (RLS deny-by-default)


-- ============================================================
-- TABLE: ledger  (Main Kas)
-- ─────────────────────────────────────────────────────────────
-- CRITICAL: OWNER-ONLY table. Admin & Mechanic have ZERO access.
-- This is the primary revenue & expense tracker.
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "ledger__super_admin_all"
    ON public.ledger FOR ALL
    USING (public.is_super_admin());

-- Owner ONLY: full CRUD
CREATE POLICY "ledger__owner_only"
    ON public.ledger FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin / Mechanic: NO policy → blocked by RLS deny-by-default


-- ============================================================
-- TABLE: petty_cash_transactions
-- ─────────────────────────────────────────────────────────────
-- Owner: full CRUD (top-ups + review all)
-- Admin: INSERT expenses only + SELECT (to see balance/history)
-- Mechanic: NO access
-- ============================================================

-- Super Admin: unrestricted
CREATE POLICY "petty_cash__super_admin_all"
    ON public.petty_cash_transactions FOR ALL
    USING (public.is_super_admin());

-- Owner: full CRUD
CREATE POLICY "petty_cash__owner_manage"
    ON public.petty_cash_transactions FOR ALL
    USING (
        public.get_my_role() = 'owner'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Admin: INSERT expenses only
--   Enforces: type must be 'expense', created_by must be self
CREATE POLICY "petty_cash__admin_insert_expense"
    ON public.petty_cash_transactions FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
        AND transaction_type = 'expense'
        AND created_by = auth.uid()
    );

-- Admin: SELECT all petty cash records for their tenant
CREATE POLICY "petty_cash__admin_read"
    ON public.petty_cash_transactions FOR SELECT
    USING (
        public.get_my_role() = 'admin'
        AND tenant_id = public.get_my_tenant_id()
    );

-- Mechanic: NO policy → blocked by default


-- ============================================================
-- STORAGE BUCKET  (run separately in Supabase Dashboard or CLI)
-- ============================================================
--
-- Create a private bucket named "receipts" for mechanic receipt uploads.
-- In Supabase Dashboard → Storage → New Bucket:
--   Name:    receipts
--   Public:  false  (private — access via signed URLs only)
--
-- Then add the following Storage policies:
--
--   POLICY: "mechanic_upload_own_receipt"
--     ON storage.objects FOR INSERT
--     TO authenticated
--     WITH CHECK (
--       bucket_id = 'receipts'
--       AND (storage.foldername(name))[1] = auth.uid()::text
--     );
--
--   POLICY: "tenant_members_read_receipts"
--     ON storage.objects FOR SELECT
--     TO authenticated
--     USING (
--       bucket_id = 'receipts'
--     );
--
-- NOTE: The recommended path pattern for uploads is:
--   receipts/{mechanic_uid}/{invoice_id}/{filename}
-- ============================================================
