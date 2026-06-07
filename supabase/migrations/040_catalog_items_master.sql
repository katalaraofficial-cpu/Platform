-- 040_catalog_items_master.sql
-- Single Source of Truth untuk deskripsi & harga default per tenant.
-- Menggantikan "katalog implisit" yang sebelumnya di-derive dari tabel invoice_items.

-- 1. Tabel master.
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    description        TEXT NOT NULL CHECK (length(btrim(description)) > 0),
    -- Kolom normalisasi untuk unique key (lowercased & trimmed).
    -- Dibuat STORED agar bisa dipakai di unique index.
    description_norm   TEXT GENERATED ALWAYS AS (lower(btrim(description))) STORED,
    item_type          public.item_type NOT NULL,
    unit_label         TEXT,
    default_buy_price  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (default_buy_price  >= 0),
    default_sell_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (default_sell_price >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-healing: kalau tabel sudah pernah dibuat dari percobaan sebelumnya
-- tanpa kolom-kolom ini, tambahkan sekarang. Aman untuk dijalankan ulang.
ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS unit_label TEXT;
ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS default_buy_price NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS default_sell_price NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS description_norm TEXT
    GENERATED ALWAYS AS (lower(btrim(description))) STORED;

-- Bersihkan unique index lama (kalau ada) yang mungkin punya target kolom berbeda.
DROP INDEX IF EXISTS public.catalog_items_tenant_desc_uidx;
DROP INDEX IF EXISTS public.catalog_items_tenant_description_idx;

-- Unique key: (tenant, description_norm, item_type).
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_tenant_norm_type_uidx
    ON public.catalog_items (tenant_id, description_norm, item_type);

-- Index pencarian autocomplete (prefix/substring).
CREATE INDEX IF NOT EXISTS catalog_items_tenant_desc_idx
    ON public.catalog_items (tenant_id, description_norm text_pattern_ops);

-- updated_at trigger.
CREATE OR REPLACE FUNCTION public.tg_catalog_items_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_items_set_updated_at ON public.catalog_items;
CREATE TRIGGER catalog_items_set_updated_at
    BEFORE UPDATE ON public.catalog_items
    FOR EACH ROW EXECUTE FUNCTION public.tg_catalog_items_set_updated_at();

-- 2. RLS.
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_items service_role full" ON public.catalog_items;
CREATE POLICY "catalog_items service_role full"
    ON public.catalog_items FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Anggota tenant boleh baca katalog miliknya.
DROP POLICY IF EXISTS "catalog_items tenant read" ON public.catalog_items;
CREATE POLICY "catalog_items tenant read"
    ON public.catalog_items FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

-- Hanya owner/admin boleh menulis langsung dari client.
-- (Auto-upsert dari addInvoiceItem dilakukan via service_role / admin client.)
DROP POLICY IF EXISTS "catalog_items owner_admin write" ON public.catalog_items;
CREATE POLICY "catalog_items owner_admin write"
    ON public.catalog_items FOR ALL TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    )
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- 3. Backfill: untuk tiap (tenant, description, item_type), ambil harga
--    dari invoice_item TERAKHIR (paling baru, by created_at) — strategi (a).
INSERT INTO public.catalog_items (
    tenant_id, description, item_type, unit_label,
    default_buy_price, default_sell_price
)
SELECT DISTINCT ON (ii.tenant_id, lower(btrim(ii.description)), ii.item_type)
    ii.tenant_id,
    btrim(ii.description),
    ii.item_type,
    NULL::TEXT                                                                 AS unit_label,
    COALESCE(ii.unit_price, 0)                                                 AS default_buy_price,
    COALESCE(ii.unit_price * (1 + COALESCE(ii.markup_pct, 0) / 100.0), 0)      AS default_sell_price
FROM public.invoice_items ii
WHERE ii.description IS NOT NULL
  AND length(btrim(ii.description)) > 0
ORDER BY
    ii.tenant_id,
    lower(btrim(ii.description)),
    ii.item_type,
    ii.created_at DESC NULLS LAST,
    ii.id DESC
ON CONFLICT (tenant_id, description_norm, item_type) DO NOTHING;
