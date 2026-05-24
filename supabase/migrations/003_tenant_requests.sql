-- ============================================================
-- Migration 003: Tenant Registration Requests
-- Supports public self-service registration flow with
-- super-admin approval. Future-ready for subscription/billing.
-- ============================================================

CREATE TABLE tenant_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name   TEXT        NOT NULL,
  owner_name      TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  city            TEXT,
  message         TEXT,
  -- Lifecycle status
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note  TEXT,
  reviewed_by     UUID        REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate pending registration for the same email
CREATE UNIQUE INDEX tenant_requests_email_pending_idx
  ON tenant_requests (email)
  WHERE status = 'pending';

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE tenant_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can submit a registration request
CREATE POLICY "public_insert_tenant_requests"
  ON tenant_requests FOR INSERT
  WITH CHECK (true);

-- Only super admin can read all requests
CREATE POLICY "super_admin_select_tenant_requests"
  ON tenant_requests FOR SELECT
  USING (public.is_super_admin());

-- Only super admin can update status (approve / reject)
CREATE POLICY "super_admin_update_tenant_requests"
  ON tenant_requests FOR UPDATE
  USING (public.is_super_admin());
