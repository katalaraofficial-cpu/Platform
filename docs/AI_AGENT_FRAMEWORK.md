# AI Agent Framework - Katalara POS

Last updated: 29 Mei 2026 (commit `1fd746d`)

## Tujuan Dokumen

Kerangka operasional untuk AI agent yang melanjutkan pengembangan platform tanpa mengulang bug lama atau merusak baseline produksi.

## 1) Startup Checklist Agent Baru

1. Baca [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) untuk peta modul dan constraints.
2. Baca [docs/DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) untuk histori commit terbaru.
3. Jalankan build awal: `npm run build`.
4. Cek migrasi terbaru (`020` s.d. `027`) sudah tersedia di environment target.
5. Saat selesai coding, update README + docs progres sebelum commit akhir.

## 2) Peta Area Kode Kritis

- Routes: `src/app/(super-admin)`, `src/app/(owner)`, `src/app/(admin)`, `src/app/(mechanic)`, `src/app/(print)`
- Server Actions: `src/lib/actions/*`
- Context auth-role-tenant: `src/lib/get-user-context.ts`
- Supabase clients:
  - browser: `src/lib/supabase/client.ts`
  - server: `src/lib/supabase/server.ts`
  - admin/service role: `src/lib/supabase/admin.ts`
- DB types: `src/types/database.ts`
- Migrations: `supabase/migrations/*.sql`

## 3) Aturan Kerja Wajib

1. Jangan ubah alur RBAC pada `src/middleware.ts` tanpa kebutuhan jelas.
2. Setiap perubahan schema wajib sinkron pada 4 titik:
   - SQL migration
   - `src/types/database.ts`
   - server action terkait
   - UI/form terkait
3. Untuk fitur invoice/print, jangan hardcode format; hormati `nota_active_format`.
4. Untuk perubahan poin mekanik, konsistenkan dua jalur:
   - `processPayment()` (earn)
   - `rollbackInvoiceStatus()` (reverse/adjust)
5. Rollback point harus menghitung net transaksi per invoice (`earn + adjust`) agar idempotent.
6. Ringkasan point (`saldo`, `total earned`, `total redeemed`) harus order-agnostic terhadap histori transaksi.
7. Untuk owner users delete, gunakan guard tenant + role (owner tidak boleh hapus diri sendiri/owner lain).
6. Setelah edit file inti, wajib jalankan build.

## 4) Guardrail Produksi (Berdasarkan Insiden Sebelumnya)

- Hindari query settings dengan daftar kolom kaku jika production schema berpotensi drift.
- Undangan user owner jangan memakai action yang khusus super-admin.
- Badge status invoice list harus complaint-aware, tidak hanya `inv.status` mentah.
- Perubahan cache-sensitive wajib `revalidatePath` ke halaman consumer (owner/mechanic).
- Wording riwayat transaksi point harus bahasa bisnis yang jelas untuk user operasional, hindari teks teknis internal.

## 5) Baseline Performa yang Harus Dipertahankan

- Prefetch route owner dari navigasi yang aman SSR.
- Query independen diparalelkan bila memungkinkan.
- Payload `select` dipangkas ke kolom yang benar-benar dipakai.

## 6) Build Log Ringkas Terbaru

- `1fd746d`: stabilkan total point engineer + profesionalisasi teks riwayat rollback
- `35173a0`: aktivasi PWA install support
- `b919b08`: owner user deletion fix + sync cleanup stale point
- `1c998e7`: alamat pelanggan terstruktur + point summary by history
- `7179bd1`: owner customers page + mechanic 4-tab scaffold + sinkron rollback point card
- `e9a788b`: reverse point mekanik saat invoice paid di-rollback
- `0e5b6ad`: complaint badge invoice list owner + owner invite flow fix
- `131e400`: complaint surfaced di owner/admin/mechanic views
- `683e3c5`: settings read schema-compatible + refresh after save

## 7) Fokus Fase Berikutnya

1. Integrasi data riil tab `Kehadiran` dan `Payroll` mekanik.
2. Tambahkan parity modul pelanggan untuk role admin.
3. Perbaikan akumulasi helper point untuk nominal kecil (hindari loss karena `floor`).
4. Tambahkan observability (audit log) untuk rollback invoice, sinkron point, dan delete user owner.
