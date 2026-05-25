-- ============================================================
-- Migration 012: Create receipt storage bucket + RLS policies
-- ============================================================
-- Upload path format: {tenant_id}/{mechanic_id}/{timestamp}-receipt.{ext}
-- foldername(name)[1] = tenant_id
-- foldername(name)[2] = mechanic_id
-- ============================================================

-- 1. Create bucket if not exists (private bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipt',
    'receipt',
    false,
    3145728, -- 3 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INSERT policy: mechanic can upload to their own folder
-- Path: {tenant_id}/{mechanic_id}/...
-- ============================================================
DROP POLICY IF EXISTS "receipt__mechanic_upload" ON storage.objects;

CREATE POLICY "receipt__mechanic_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'receipt'
        AND public.get_my_role() = 'mechanic'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- ============================================================
-- SELECT policy: mechanic can read their own uploads;
--               owner/admin can read all receipts in their tenant
-- ============================================================
DROP POLICY IF EXISTS "receipt__mechanic_read_own" ON storage.objects;
DROP POLICY IF EXISTS "receipt__owner_read_tenant" ON storage.objects;

CREATE POLICY "receipt__mechanic_read_own"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'receipt'
        AND public.get_my_role() = 'mechanic'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

CREATE POLICY "receipt__owner_read_tenant"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'receipt'
        AND public.get_my_role() IN ('owner', 'admin')
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

-- ============================================================
-- DELETE policy: mechanic can delete their own (in case of retry)
-- ============================================================
DROP POLICY IF EXISTS "receipt__mechanic_delete_own" ON storage.objects;

CREATE POLICY "receipt__mechanic_delete_own"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'receipt'
        AND public.get_my_role() = 'mechanic'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );
