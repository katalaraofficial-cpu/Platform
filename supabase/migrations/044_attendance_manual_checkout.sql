-- ============================================================
-- Migration 044: Manual checkout untuk kehadiran
-- - checked_out_at: waktu engineer menekan tombol "Pulang".
--   NULL = belum checkout manual (masih memakai auto +8 jam).
--   Saat diisi, check_out_at ikut diset = checked_out_at agar
--   durasi kerja aktual berkurang & tampil di rekap owner.
-- ============================================================

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- Engineer boleh memperbarui kehadiran miliknya (untuk checkout).
DROP POLICY IF EXISTS "engineer update own attendance" ON public.attendance_records;
CREATE POLICY "engineer update own attendance"
  ON public.attendance_records FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
