-- ============================================================
-- Migration 020: Employee Points / Reward System
-- - Adds reward config columns to settings table
-- - Creates employee_points balance table (1 row per mechanic)
-- - Creates employee_point_transactions log table
-- ============================================================

-- ── Extend settings table ────────────────────────────────────
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS reward_employee_enabled     BOOLEAN         NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reward_spend_per_point      NUMERIC(12,2)   NOT NULL DEFAULT 100000,
    ADD COLUMN IF NOT EXISTS reward_point_value          NUMERIC(12,2)   NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS reward_min_redeem           INTEGER         NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS reward_point_validity_days  INTEGER         NOT NULL DEFAULT 365,
    ADD COLUMN IF NOT EXISTS reward_lead_multiplier      NUMERIC(5,2)    NOT NULL DEFAULT 1.00,
    ADD COLUMN IF NOT EXISTS reward_helper_multiplier    NUMERIC(5,2)    NOT NULL DEFAULT 0.50;

-- ── employee_points: saldo per mekanik ──────────────────────
CREATE TABLE IF NOT EXISTS public.employee_points (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    points_balance   INTEGER       NOT NULL DEFAULT 0,
    total_earned     INTEGER       NOT NULL DEFAULT 0,
    total_redeemed   INTEGER       NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_points_tenant
    ON public.employee_points (tenant_id);

-- ── employee_point_transactions: riwayat earn/redeem ────────
CREATE TABLE IF NOT EXISTS public.employee_point_transactions (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type TEXT          NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust')),
    points           INTEGER       NOT NULL,
    reference_id     UUID,
    notes            TEXT,
    expires_at       DATE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ept_tenant_profile
    ON public.employee_point_transactions (tenant_id, profile_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.employee_points             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_point_transactions ENABLE ROW LEVEL SECURITY;

-- employee_points: owner/admin full CRUD on own tenant
CREATE POLICY "ep__owner_admin_all"
    ON public.employee_points FOR ALL
    USING  (public.get_my_role() IN ('owner', 'admin') AND tenant_id = public.get_my_tenant_id())
    WITH CHECK (public.get_my_role() IN ('owner', 'admin') AND tenant_id = public.get_my_tenant_id());

-- employee_points: mechanic can read own row
CREATE POLICY "ep__mechanic_read_own"
    ON public.employee_points FOR SELECT
    USING (public.get_my_role() = 'mechanic' AND profile_id = auth.uid());

-- employee_point_transactions: owner/admin full CRUD
CREATE POLICY "ept__owner_admin_all"
    ON public.employee_point_transactions FOR ALL
    USING  (public.get_my_role() IN ('owner', 'admin') AND tenant_id = public.get_my_tenant_id())
    WITH CHECK (public.get_my_role() IN ('owner', 'admin') AND tenant_id = public.get_my_tenant_id());

-- employee_point_transactions: mechanic can read own records
CREATE POLICY "ept__mechanic_read_own"
    ON public.employee_point_transactions FOR SELECT
    USING (public.get_my_role() = 'mechanic' AND profile_id = auth.uid());

-- ── Auto-update updated_at on employee_points ───────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
    CREATE TRIGGER trg_employee_points_updated_at
        BEFORE UPDATE ON public.employee_points
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
