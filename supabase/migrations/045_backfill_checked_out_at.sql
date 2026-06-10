-- ============================================================
-- Migration 045: Backfill checked_out_at untuk data lama
-- Tujuan:
-- 1) Menandai record historis yang jam pulangnya kurang dari auto 8 jam
--    sebagai checkout manual/aktual.
-- 2) Membuat tampilan log absensi tidak salah label "auto" pada data lama.
--
-- Catatan:
-- - Idempotent: aman dijalankan berulang.
-- - Hanya update baris yang checked_out_at masih NULL.
-- ============================================================

UPDATE public.attendance_records
SET checked_out_at = check_out_at
WHERE checked_out_at IS NULL
  AND check_out_at IS NOT NULL
  AND check_in_at IS NOT NULL
  AND check_out_at > check_in_at
  AND check_out_at < (check_in_at + INTERVAL '8 hours');
