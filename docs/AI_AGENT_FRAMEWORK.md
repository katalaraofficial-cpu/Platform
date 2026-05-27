# AI Agent Framework - Katalara POS

Last updated: 27 Mei 2026 (commit `bd1cfe1`)

## Tujuan Dokumen

Dokumen ini menjadi kerangka cepat bagi AI agent agar perubahan kode konsisten dengan arsitektur platform dan aman untuk production.

## 1) Peta Area Kode Utama

- App routes: `src/app/(super-admin)`, `src/app/(owner)`, `src/app/(admin)`, `src/app/(mechanic)`, `src/app/(print)`
- Server actions: `src/lib/actions/*`
- Context auth+role+tenant: `src/lib/get-user-context.ts`
- Supabase clients:
  - browser: `src/lib/supabase/client.ts`
  - server: `src/lib/supabase/server.ts`
  - admin/service role: `src/lib/supabase/admin.ts`
- Types DB: `src/types/database.ts`
- Migration SQL: `supabase/migrations/*.sql`

## 2) Aturan Kerja Agent (Wajib)

1. Jangan ubah RBAC flow di `middleware.ts` tanpa alasan kuat.
2. Setiap perubahan kolom DB wajib sinkron:
   - migration SQL
   - `src/types/database.ts`
   - server action terkait
   - UI form terkait
3. Untuk fitur print/invoice, update sumber data di:
   - `src/app/(print)/print/invoices/[id]/page.tsx`
   - setting save action (`src/lib/actions/settings.ts`) jika field dari pengaturan.
4. Jangan hardcode format print jika sudah ada `nota_active_format`.
5. Selalu cek type/lint error setelah edit file inti.

## 3) Alur Perubahan Fitur Settings -> Output Print

1. Tambah field di tabel `settings` via migration.
2. Update interface `Settings` di `src/types/database.ts`.
3. Update payload server action `saveNotaSettings`.
4. Update UI tab `owner/settings` untuk field baru.
5. Update print page agar membaca field settings dan merender output.
6. Verifikasi output di 3 format: A4, A5, thermal.

## 4) Konvensi Build Log

Saat merge fitur penting, catat minimal:

- commit hash
- ruang lingkup perubahan (settings, invoice, print, auth, dashboard)
- dampak migration (ya/tidak)
- langkah verifikasi manual

Simpan ringkasan build di `docs/DEVELOPMENT_PROGRESS.md` dan update ringkasan di `README.md`.

## 5) Risiko Tinggi yang Perlu Dicek Ulang

- Ketidaksinkronan migration vs type TS -> memicu error build Vercel.
- Perbedaan nilai harga item (`unit_price` vs `final_price`) di template print.
- Props tambahan di `commonProps` yang tidak dipakai template tertentu.
- Status paid + watermark toggle (harus konsisten lintas format).
