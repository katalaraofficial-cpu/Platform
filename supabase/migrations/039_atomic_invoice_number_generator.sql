-- 039_atomic_invoice_number_generator.sql
-- Atomic invoice number generator: per-tenant, per-year counter.
-- Eliminates race condition (PG error 23505) caused by app-level read-then-write retry loop.

-- 1. Counter table: one row per (tenant, year). Reset every year.
CREATE TABLE IF NOT EXISTS public.tenant_invoice_counters (
    tenant_id   UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    year        INT     NOT NULL,
    last_number BIGINT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, year)
);

ALTER TABLE public.tenant_invoice_counters ENABLE ROW LEVEL SECURITY;

-- Tabel ini hanya boleh diakses lewat fungsi SECURITY DEFINER di bawah.
-- Tidak ada policy untuk authenticated → otomatis terblokir untuk anon/authenticated.
DROP POLICY IF EXISTS "service_role full access" ON public.tenant_invoice_counters;
CREATE POLICY "service_role full access"
    ON public.tenant_invoice_counters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Atomic next-sequence function (upsert + RETURNING).
CREATE OR REPLACE FUNCTION public.get_next_invoice_sequence(
    p_tenant_id UUID,
    p_year      INT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    IF p_tenant_id IS NULL OR p_year IS NULL THEN
        RAISE EXCEPTION 'tenant_id and year are required';
    END IF;

    -- Pastikan caller benar-benar anggota tenant tsb (kecuali service_role).
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'forbidden: not a member of tenant %', p_tenant_id;
        END IF;
    END IF;

    INSERT INTO public.tenant_invoice_counters (tenant_id, year, last_number)
    VALUES (p_tenant_id, p_year, 1)
    ON CONFLICT (tenant_id, year)
    DO UPDATE SET
        last_number = tenant_invoice_counters.last_number + 1,
        updated_at  = NOW()
    RETURNING last_number INTO v_next;

    RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_invoice_sequence(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_sequence(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_sequence(UUID, INT) TO service_role;

-- 3. Backfill counter dari invoice yang sudah ada.
--    Ekstrak 4 digit terakhir dari invoice_number lama (format `INV-YYYY-NNNN` maupun
--    format baru `INV-MMYY-NNNN`). Tahun diambil dari invoice_date agar konsisten
--    dengan kebijakan "reset per tahun".
INSERT INTO public.tenant_invoice_counters (tenant_id, year, last_number)
SELECT
    tenant_id,
    EXTRACT(YEAR FROM COALESCE(invoice_date, created_at::date))::INT AS year,
    MAX(
        COALESCE(
            NULLIF(regexp_replace(invoice_number, '.*?(\d+)$', '\1'), '')::BIGINT,
            0
        )
    ) AS last_number
FROM public.invoices
WHERE invoice_number IS NOT NULL
GROUP BY tenant_id, EXTRACT(YEAR FROM COALESCE(invoice_date, created_at::date))
ON CONFLICT (tenant_id, year) DO UPDATE
    SET last_number = GREATEST(tenant_invoice_counters.last_number, EXCLUDED.last_number),
        updated_at  = NOW();
