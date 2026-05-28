-- ============================================================
-- Migration 026: Point Redemption Requests (Engineer -> Owner Approval)
-- - Adds request table for redeem workflow
-- - Owner/Admin approve or reject requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.point_redemption_requests (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id              UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requested_by            UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    points                  INTEGER      NOT NULL CHECK (points > 0),
    point_value             NUMERIC(12,2) NOT NULL CHECK (point_value >= 0),
    payout_amount           NUMERIC(14,2) NOT NULL CHECK (payout_amount >= 0),
    notes                   TEXT,
    status                  TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by             UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_note             TEXT,
    reviewed_at             TIMESTAMPTZ,
    point_transaction_id    UUID         REFERENCES public.employee_point_transactions(id) ON DELETE SET NULL,
    ledger_id               UUID         REFERENCES public.ledger(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prr_tenant_status_created
    ON public.point_redemption_requests (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prr_profile_created
    ON public.point_redemption_requests (profile_id, created_at DESC);

ALTER TABLE public.point_redemption_requests ENABLE ROW LEVEL SECURITY;

-- Owner/Admin can read and manage requests in own tenant
CREATE POLICY "prr__owner_admin_all"
    ON public.point_redemption_requests FOR ALL
    USING (public.get_my_role() IN ('owner', 'admin') AND tenant_id = public.get_my_tenant_id())
    WITH CHECK (public.get_my_role() IN ('owner', 'admin') AND tenant_id = public.get_my_tenant_id());

-- Mechanic can create request for themselves
CREATE POLICY "prr__mechanic_insert_own"
    ON public.point_redemption_requests FOR INSERT
    WITH CHECK (
      public.get_my_role() = 'mechanic'
      AND tenant_id = public.get_my_tenant_id()
      AND profile_id = auth.uid()
      AND requested_by = auth.uid()
      AND status = 'pending'
    );

-- Mechanic can read own requests
CREATE POLICY "prr__mechanic_read_own"
    ON public.point_redemption_requests FOR SELECT
    USING (public.get_my_role() = 'mechanic' AND profile_id = auth.uid());
