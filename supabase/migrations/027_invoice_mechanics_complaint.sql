-- ============================================================
-- Migration 027: Invoice Mechanic Complaint Tracking
-- - Adds complaint flag per mechanic assignment on an invoice
-- - Used by owner/admin to mark complaint and resolve complaint
-- ============================================================

ALTER TABLE public.invoice_mechanics
  ADD COLUMN IF NOT EXISTS is_complaint BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS complaint_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complaint_resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inv_mech_tenant_complaint
  ON public.invoice_mechanics (tenant_id, is_complaint);
