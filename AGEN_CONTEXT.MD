# KONDISI PROYEK & PANDUAN AGEN — Katalara POS

> **Dokumen ini adalah SUMBER KEBENARAN untuk aktualisasi progres.** Baca dulu sebelum
> coding, dan WAJIB perbarui di akhir setiap sesi (lihat Seksi 5). Detail arsitektur
> mendalam tetap di `docs/PROJECT_CONTEXT.md`; histori commit lengkap di
> `docs/DEVELOPMENT_PROGRESS.md`; pakem operasional di `docs/AI_AGENT_FRAMEWORK.md`.

Terakhir Diperbarui: 2026-06-13 (commit acuan: `72ff6d4`)
Branch aktif: `main` · Stack: Next.js 15 (App Router, TypeScript) + Supabase + Tailwind v3.4

---

## 1. ATURAN PENTING (System Instructions)

* Jangan ubah arsitektur folder utama atau alur RBAC `src/middleware.ts` tanpa izin user.
* Stack ini **TypeScript murni + App Router**. Semua file `.ts`/`.tsx` — tidak ada `.js`/`.jsx`,
  tidak ada `src/pages`, `src/api`, atau React `Context` untuk auth.
* Styling **hanya Tailwind CSS** (tanpa shadcn/ui) — pakai utility class langsung.
* **Auth = Supabase SSR (cookie, PKCE)**, BUKAN JWT di LocalStorage. Role dibaca dari DB
  (`profiles.role`) di middleware, bukan dari klaim JWT. Jangan simpan token di client.
* **Multi-tenant**: setiap query tenant diproteksi RLS + `get_my_tenant_id()`. Admin client
  (service_role) hanya boleh di Server Actions dan wajib pakai guard `WHERE tenant_id` manual.
* **Sinkron schema 4 titik**: setiap perubahan schema wajib selaras di
  SQL migration → `src/types/database.ts` → server action → UI/form.
* **Ledger**: setiap insert ke `ledger` WAJIB isi `transaction_date` dari tanggal bisnis
  (`paymentDate`, tgl kas), jangan andalkan default `CURRENT_DATE`. Laporan/dashboard
  filter pakai kolom bisnis (`transaction_date` / `invoice_date`), bukan `created_at`.
* **Nomor invoice**: baca nomor terakhir (`order invoice_number desc`) + loop retry yang
  mengenali Postgres `23505` pada `invoices_tenant_id_invoice_number_key`. Jangan pakai `count`.
* **Point mekanik**: konsisten antara `processPayment()` (earn) & `rollbackInvoiceStatus()`
  (reverse). Hitung net per invoice (idempotent) + order-agnostic + orphan-aware.
* **PWA icon**: saat ganti logo, naikkan `ICON_VERSION` (`src/app/layout.tsx`) & `iconVersion`
  (`src/app/manifest.ts`) untuk bust cache launcher.
* **Feature flag katalog**: sumber kontrol modul ada di `settings.feature_catalog_enabled`.
  Jika OFF, menu owner `Katalog Item` harus tersembunyi, route `/owner/katalog` harus ter-guard,
  dan server action katalog wajib menolak akses.
* **Verifikasi wajib sebelum commit**: `npx tsc --noEmit` clean DAN `npm run build` lolos.
  Server Action wajib `"use server"` di baris pertama file. `useActionState` di modal taruh
  di sub-komponen yang hanya mount saat modal terbuka.

## 2. REKAPITULASI PROGRES TERAKHIR (State)

* [SELESAI] Multi-tenant RBAC (super_admin/owner/admin/mechanic) + RLS + invite flow Resend.
* [SELESAI] Invoice end-to-end (draft→in_progress→completed→paid/cancelled), editor unified owner+admin.
* [SELESAI] Katalog item implicit `/owner/katalog` + autofill tipe/satuan/harga + reklasifikasi bulk + warning mismatch tipe.
* [SELESAI] Poin 5 katalog tenant-aware: `settings.feature_catalog_enabled` (migrasi `041`) + toggle settings platform + owner nav hide/show + guard route `/owner/katalog` + gate action katalog.
* [SELESAI] Invoice editor: inline edit `item_type` per baris (desktop+mobile) + opsi sinkron katalog master.
* [SELESAI] Perbaikan penyimpanan harga jual barang saat harga beli 0 (hindari `final_price` nol).
* [SELESAI] Owner invoice filter UX (status ke filter tabel, KPI tetap ringkas) + visibilitas bukti transfer reimburse mekanik.
* [SELESAI] WA share + halaman print publik `/print/invoices/[id]` + template WA per tenant (`settings.wa_template`) + OG metadata bersih.
* [SELESAI] Modul Kas & Keuangan (COA UMKM, jurnal PDF, hutang/piutang) berbasis `transaction_date`.
* [SELESAI] Kas filter UX: footer total mengikuti filter aktif (in/out/net/count) di tabel desktop & ringkasan mobile; search auto-apply (debounce 350 ms) + indikator `useTransition`; filter tanggal pakai state lokal (`fromInput`/`toInput`) untuk tahan race condition saat user pilih `from` lalu cepat ke `to` (`b46e5f6`).
* [SELESAI] Point mekanik (earn/redeem/rollback idempotent) + sinkron owner invoice-aware + complaint badge.
* [SELESAI] Kasbon karyawan (COA `108`) + klaim non-invoice (bensin/kesehatan/lainnya, upload kamera+galeri).
* [SELESAI] Modul Invoice DP/PPN/PPh toggle per tenant + PWA installable (manifest/icon/SW) + brand icon Katalara.
* [SELESAI] Modul Kehadiran mekanik terintegrasi data riil: check-in GPS, rekap owner, filter periode (minggu/tanggal/bulan/tahun), kolom rata-rata jam/hari, tab owner center, log absensi harian engineer, checkout manual opsional (mengurangi durasi dari auto 8 jam), serta backfill histori checkout.
* [SELESAI] Owner invoice list UX lanjutan (`3bdd3a4` → `e77f393`): filter Cari Item (LIKE `invoice_items.description`) + persempit Cari Pelanggan, auto-flip dropdown row actions, bulk select + bulk Tandai Lunas / Hapus massal, Preview Invoice modal di row actions, preview pelanggan kini menampilkan histori service + filter no invoice.
* [SELESAI] Invoice editor: aksi naik/turun urutan baris item (desktop + mobile) via `moveItem` lokal di state (`5f46687`).
* [SELESAI] Catatan tracking per invoice (`64e1d77`, `72ff6d4`): kolom Catatan di list invoice owner & admin dapat tombol bundar (badge jumlah), dropdown Buat / Preview, modal create (tanggal + textarea, Simpan/Batal, X corner, klik backdrop & Esc) dan modal preview (list catatan + hapus). Backed by migrasi `046_invoice_tracking_notes.sql` (kolom `tracking_notes JSONB`).
* [PROSES] Mobile polish: Dashboard owner & Kas aman di 360px; Admin bottom nav belum ada (masih sidebar).
* [BELUM] Integrasi data riil tab `Payroll` mekanik masih scaffold.
* [BELUM] Parity modul pelanggan untuk admin (`/admin/customers`).
* [BELUM] Approval flow klaim non-invoice di owner (kini langsung tercatat `advance`).
* [BELUM] Audit log untuk aksi sensitif (rollback invoice, sinkron point, delete user, klaim, reklasifikasi).
* [PERLU CEK] Migrasi `011`–`015` historisnya pernah pending di sebagian environment — verifikasi status eksekusi di production.
* [PERLU CEK] Rollout migration `041_settings_feature_catalog.sql` di semua environment target sebelum uji toggle katalog.
* [PERLU CEK] Pastikan rollout migration `044_attendance_manual_checkout.sql` dan `045_backfill_checked_out_at.sql` di semua environment target.
* [PERLU CEK] Rollout migration `046_invoice_tracking_notes.sql` di semua environment target sebelum fitur Catatan Tracking dipakai produksi.

## 3. STRUKTUR FILE KRITIS (Path Anchors)

* `@/src/middleware.ts` -> RBAC + refresh session; `PUBLIC_PATHS` & `AUTH_FLOW_PATHS`.
* `@/src/lib/get-user-context.ts` -> Server helper: user + profile + tenant (pengganti AuthContext).
* `@/src/lib/supabase/client.ts` -> browser client (Client Component).
* `@/src/lib/supabase/server.ts` -> server client (Server Component / Action).
* `@/src/lib/supabase/admin.ts` -> service_role client (Server Action saja, guard tenant manual).
* `@/src/lib/supabase/middleware.ts` -> client khusus `middleware.ts`.
* `@/src/lib/actions/` -> Semua Server Actions (`auth.ts`, `invoice.ts`, `catalog.ts`, `settings.ts`, `tenant.ts`, `customer.ts`, `mechanics.ts`, `employee-points.ts`, `kas*.ts`, dst).
* `@/src/types/database.ts` -> Tipe TypeScript semua tabel + `Database` interface.
* `@/src/lib/wa-template.ts` -> `DEFAULT_WA_TEMPLATE` + `buildItemsBlock` (placeholder `{customer}`/`{invoice_no}`/`{total}`/`{status}`/`{items}`).
* `@/src/components/invoices/invoice-editor.tsx` -> Editor invoice unified (autocomplete + warning mismatch + reorder naik/turun baris item).
* `@/src/components/invoices/invoice-row-actions.tsx` -> Dropdown aksi per baris invoice (auto-flip, Preview Invoice, Detail/Edit, Cetak, Tandai Lunas, Rollback, Hapus).
* `@/src/components/invoices/invoice-bulk-bar.tsx` -> Bulk action bar (Tandai Lunas massal + Hapus massal) untuk list invoice owner.
* `@/src/components/invoices/invoice-preview-modal.tsx` -> Modal preview invoice (data + item + total) dari row actions.
* `@/src/components/invoices/invoice-notes-cell.tsx` -> Tombol catatan tracking per baris invoice (badge + dropdown Buat/Preview + modal).
* `@/src/components/invoices/print-options-modal.tsx` -> Modal print + builder pesan WA (sinkron dgn halaman print).
* `@/src/app/(auth)/login/page.tsx` -> Halaman login (App Router).
* `@/src/app/auth/callback/route.ts` · `@/src/app/auth/exchange/page.tsx` · `@/src/app/auth/set-password/page.tsx` -> Invite/PKCE flow (parse hash manual + `setSession`).
* `@/src/app/(owner)/owner/katalog/page.tsx` (+ `katalog-client.tsx`) -> Katalog item implicit.
* `@/src/app/(print)/print/invoices/[id]/page.tsx` -> Print publik + `generateMetadata` OG.
* `@/src/app/_brand-logo.ts` · `@/src/app/icon.tsx` · `@/src/app/manifest.ts` · `@/src/app/layout.tsx` -> Brand icon PWA + cache busting.
* `@/supabase/migrations/` -> Migrasi SQL berurutan (terbaru: `046_invoice_tracking_notes.sql`).

## 4. TUGAS BERIKUTNYA UNTUK ANDA (Next Action Items)

1. Integrasikan data riil tab `Payroll` mekanik.
2. Tambahkan modul pelanggan admin (`/admin/customers`) parity dengan owner.
3. Bangun approval flow klaim non-invoice (`mechanic_debt_ledger.claim_category`) di sisi owner sebelum reimburse.
4. Tambahkan audit log untuk aksi sensitif (rollback invoice, sinkron point, delete user, klaim non-invoice, reklasifikasi katalog).
5. Perbaiki akumulasi helper point untuk nominal kecil (hindari loss karena `floor`).
6. Verifikasi & jalankan migrasi pending `011`–`015` di environment target bila belum, dan pastikan migration `041`, `044`, `045`, `046` sudah terpasang lintas environment.

## 5. STANDAR FORMAT & CARA UPDATE (Wajib Diikuti Agent Berikutnya)

Dokumen ini adalah **format standar aktualisasi progres** platform. Setiap akhir sesi:

1. Perbarui **Terakhir Diperbarui** + **commit acuan** di header.
2. Seksi 2 (State): geser item antar status `[SELESAI]` / `[PROSES]` / `[BELUM]` / `[PERLU CEK]`
   sesuai hasil sesi. Tambah baris baru bila ada fitur/temuan baru.
3. Seksi 4 (Next Actions): perbarui prioritas berikutnya (terurut).
4. Seksi 1 (Aturan) & 3 (Path Anchors): tambah HANYA jika ada pakem/anti-regresi atau
   file kritis baru. Setiap path WAJIB sudah diverifikasi ada di repo sebelum ditulis.
5. Untuk histori commit detail, tetap catat di `docs/DEVELOPMENT_PROGRESS.md`; untuk pakem
   teknis mendalam di `docs/AI_AGENT_FRAMEWORK.md`. Dokumen ini hanya ringkasan hidup + anchor.

Aturan isi: ringkas, faktual, dan **tidak boleh** menulis path/aturan yang belum terverifikasi
di codebase (cek `npx tsc --noEmit` + `npm run build` lolos sebelum commit perubahan apa pun).
