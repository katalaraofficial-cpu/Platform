-- 041_settings_feature_catalog.sql
-- Feature flag modul katalog per-tenant (owner menu + route guard).

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS feature_catalog_enabled BOOLEAN NOT NULL DEFAULT false;
