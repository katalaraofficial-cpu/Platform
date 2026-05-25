-- ============================================================
-- Migration 017: Add owner/admin upload policy for receipt bucket
-- Allows owner and admin to upload payment proof images
-- Path format used by reimburse-modal: payment-proofs/{tenant_id}/{timestamp}.{ext}
-- ============================================================

-- INSERT: owner & admin can upload payment proofs under their tenant folder
DROP POLICY IF EXISTS "receipt__owner_admin_upload" ON storage.objects;

CREATE POLICY "receipt__owner_admin_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'receipt'
        AND public.get_my_role() IN ('owner', 'admin')
        AND (storage.foldername(name))[2] = public.get_my_tenant_id()::text
    );

-- DELETE: owner & admin can delete files under their tenant folder (for retry)
DROP POLICY IF EXISTS "receipt__owner_admin_delete" ON storage.objects;

CREATE POLICY "receipt__owner_admin_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'receipt'
        AND public.get_my_role() IN ('owner', 'admin')
        AND (storage.foldername(name))[2] = public.get_my_tenant_id()::text
    );
