-- ============================================================
-- Migration 043: Attendance module (Lokasi Kerja + Kehadiran)
-- - work_locations: titik koordinat kantor/proyek per tenant
--   dengan radius geofence (meter) untuk validasi check-in.
-- - attendance_records: catatan kehadiran engineer. Fokus tahap
--   ini: catat MASUK (manual) + KELUAR OTOMATIS +8 jam.
-- Multi-tenant: diproteksi RLS berbasis profiles.
-- ============================================================

-- ── Tabel lokasi kerja ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  latitude         NUMERIC(10,7) NOT NULL,
  longitude        NUMERIC(10,7) NOT NULL,
  radius_m         INTEGER NOT NULL DEFAULT 100 CHECK (radius_m > 0),
  allow_field_work BOOLEAN NOT NULL DEFAULT false,  -- lokasi proyek (tak wajib di kantor)
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabel catatan kehadiran ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id      UUID REFERENCES public.work_locations(id) ON DELETE SET NULL,
  mode             TEXT NOT NULL DEFAULT 'office' CHECK (mode IN ('office', 'field')),
  attendance_date  DATE NOT NULL DEFAULT CURRENT_DATE,  -- tanggal bisnis untuk 1 absen/hari
  check_in_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at     TIMESTAMPTZ NOT NULL,            -- otomatis = check_in_at + 8 jam
  check_in_lat     NUMERIC(10,7),
  check_in_lng     NUMERIC(10,7),
  distance_m       INTEGER,                          -- jarak ke titik lokasi saat check-in
  status           TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'invalid')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cegah double check-in di hari yang sama per engineer.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_per_day
  ON public.attendance_records (tenant_id, profile_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_work_locations_tenant
  ON public.work_locations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_profile
  ON public.attendance_records (tenant_id, profile_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.work_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Owner kelola penuh lokasi kerja di tenantnya.
CREATE POLICY "owner manage work_locations"
  ON public.work_locations FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Semua user tenant boleh membaca lokasi aktif (engineer butuh untuk absen).
CREATE POLICY "tenant members read work_locations"
  ON public.work_locations FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Owner melihat semua kehadiran di tenantnya.
CREATE POLICY "owner read attendance"
  ON public.attendance_records FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Engineer melihat & membuat kehadiran miliknya sendiri.
CREATE POLICY "engineer read own attendance"
  ON public.attendance_records FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "engineer insert own attendance"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );
