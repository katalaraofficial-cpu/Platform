-- ============================================================
-- Migration 010: Fix invoices read policy for mechanics
-- ============================================================
-- The EXISTS subquery inside invoices__mechanic_read_assigned
-- queries invoice_mechanics, which itself has RLS. This causes
-- a recursive RLS evaluation that silently returns no rows.
--
-- Fix: use a SECURITY DEFINER helper function that bypasses
-- RLS on invoice_mechanics internally.
-- ============================================================

-- Helper function: checks if the current mechanic is assigned
-- to a given invoice. SECURITY DEFINER bypasses inner RLS.
CREATE OR REPLACE FUNCTION public.mechanic_is_assigned(p_invoice_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.invoice_mechanics
        WHERE invoice_id = p_invoice_id
          AND mechanic_id = auth.uid()
    );
$$;

-- Drop the old policy and recreate using the helper function
DROP POLICY IF EXISTS "invoices__mechanic_read_assigned" ON public.invoices;

CREATE POLICY "invoices__mechanic_read_assigned"
    ON public.invoices FOR SELECT
    USING (
        public.get_my_role() = 'mechanic'
        AND public.mechanic_is_assigned(id)
    );
