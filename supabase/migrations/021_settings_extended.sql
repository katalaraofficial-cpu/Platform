-- ============================================================
-- Migration 021: Extend settings table for full settings page
-- Adds: store info, platform config, nota/printer columns
-- (Reward columns already added in migration 020)
-- ============================================================

ALTER TABLE public.settings
    -- ── Store info ───────────────────────────────────────────
    ADD COLUMN IF NOT EXISTS store_name         TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS store_address      TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS store_phone        TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS store_email        TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS store_logo_url     TEXT            DEFAULT '',

    -- ── Platform config ──────────────────────────────────────
    ADD COLUMN IF NOT EXISTS qty_decimal        BOOLEAN         NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS price_tier_labels  JSONB           NOT NULL DEFAULT '{"HET":"HET","HG1":"HG1","HG2":"HG2","HG3":"HG3"}'::jsonb,

    -- ── Nota & Printer ───────────────────────────────────────
    ADD COLUMN IF NOT EXISTS nota_header        TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS nota_footer        TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS nota_signature_url TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS nota_stamp_url     TEXT            DEFAULT '',
    ADD COLUMN IF NOT EXISTS nota_active_format TEXT            NOT NULL DEFAULT 'A4'
        CHECK (nota_active_format IN ('A4', 'A5', 'thermal'));
