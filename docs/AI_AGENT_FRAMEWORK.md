# AI Agent Framework - Katalara POS

Last updated: 27 Mei 2026 (commit `3cdbd1c`)

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
6. Untuk optimasi performa route owner, prioritaskan:
   - pengurangan payload query (`select` kolom spesifik)
   - paralelisasi query independen
   - prefetch route navigasi (aman untuk SSR auth)
7. Untuk perbaikan settings nota, pertahankan kompatibilitas dua sumber data:
   - kolom modern `settings.*`
   - fallback metadata pada `nota_header`

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
- Type narrowing browser API (`window.requestIdleCallback`/`setTimeout`) yang bisa lolos lokal tapi gagal di build Vercel.

## 6) Baseline Performa (Mei 2026)

Perubahan baseline performa yang sudah aktif:

- `getUserContext` dicache per-request untuk mengurangi hit auth/profile berulang.
- Payload query owner dipangkas pada route utama (`dashboard`, `settings`, `kas`).
- Halaman kas menjalankan query KPI dan query tabel secara paralel.
- Navigasi owner melakukan prefetch route saat idle dan hover/focus.

Saat melakukan perubahan baru, jangan regress baseline di atas tanpa justifikasi.

## 7) Log Build Terbaru (Ringkas)

- `3cdbd1c`: fix mobile invoice editor — field strip full-width, toggle centered, overflow form Barang
- `f79681f`: polish mobile invoice editor — sticky save bar + collapsible totals panel
- `98aab12`: owner mobile bottom nav — FAB invoice, drawer, 4 fixed slots
- `adf1681`: hotfix JSX malformed owner invoice list (Vercel build error)
- `0df5fad`: fix window narrowing issue in sidebar prefetch fallback
- `3f12dd7`: prefetch owner routes from navigation
- `2efa3ac`: parallelize kas KPI and table queries
- `6792240`: trim owner route query payloads

## 8) Komponen Mobile Kritis (Jangan Regress)

| Komponen | File | Catatan |
|---|---|---|
| Owner mobile nav | `src/components/layout/owner-mobile-nav.tsx` | FAB + drawer, 5 slot; `pb-28` di layout |
| Invoice editor | `src/components/invoices/invoice-editor.tsx` | Mobile: single-col, card items, sticky bar |
| Invoice list owner | `src/app/(owner)/owner/invoices/page.tsx` | `md:hidden` card / `hidden md:block` table |
| Invoice list admin | `src/app/(admin)/admin/invoices/page.tsx` | Sama pola dengan owner |
| Owner layout | `src/app/(owner)/layout.tsx` | `pb-28 lg:pb-6` agar konten tidak ketutup nav |

Pattern kunci yang sudah diterapkan:
- `md:hidden` = hanya mobile
- `hidden md:block` = hanya desktop  
- `pb-28` = padding bawah untuk konten agar tidak tertutup bottom nav
- `fixed inset-x-0 bottom-20 z-40` = sticky bar di atas bottom nav (80px dari bawah)
