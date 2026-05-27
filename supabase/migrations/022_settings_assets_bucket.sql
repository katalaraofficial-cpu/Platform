-- ============================================================
-- Migration 022: Create settings-assets storage bucket
-- Used for storing owner-uploaded signature & stamp images.
-- Upload path: {tenant_id}/signature.{ext} | {tenant_id}/stamp.{ext}
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'settings-assets',
    'settings-assets',
    true,  -- public so images render directly in print/nota
    2097152, -- 2 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Owner: full access to their own tenant folder ────────────
DROP POLICY IF EXISTS "settings_assets__owner_upload" ON storage.objects;
CREATE POLICY "settings_assets__owner_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'settings-assets'
        AND public.get_my_role() = 'owner'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

DROP POLICY IF EXISTS "settings_assets__owner_update" ON storage.objects;
CREATE POLICY "settings_assets__owner_update"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'settings-assets'
        AND public.get_my_role() = 'owner'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

DROP POLICY IF EXISTS "settings_assets__owner_delete" ON storage.objects;
CREATE POLICY "settings_assets__owner_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'settings-assets'
        AND public.get_my_role() = 'owner'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

-- ── Public read (bucket is public, but add explicit policy) ──
DROP POLICY IF EXISTS "settings_assets__public_read" ON storage.objects;
CREATE POLICY "settings_assets__public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'settings-assets');
