# Development Progress Log

Last updated: 28 Mei 2026 (local workspace)

## Ringkasan Status Saat Ini

- Platform aktif di Next.js 15 + Supabase multi-tenant.
- Modul inti invoice owner/admin sudah berjalan end-to-end.
- Print format sekarang mengikuti pengaturan aktif di tab Nota & Printer.
- Konfigurasi detail Nota & Printer (judul, jabatan, watermark, header/footer, tanda tangan, stempel) sudah tersimpan ke settings.

## Milestone Build Terbaru

| Commit | Tipe | Ringkasan |
|---|---|---|
| `local` | feat | Phase 2 point claim workflow: mechanic submit claim, owner approve/reject, payout ledger + point transaction, UI status panel |
| `3cdbd1c` | fix | Mobile invoice editor: field strip full-width, toggle rata tengah, fix overflow form Barang |
| `f79681f` | feat | Polish mobile invoice editor: sticky save bar + collapsible totals panel |
| `98aab12` | feat | Owner mobile bottom nav: FAB invoice, drawer menu, 4 fixed slot (Dashboard/Kas/Pengaturan/Menu) |
| `adf1681` | fix | Hotfix JSX malformed pada invoice list owner (Vercel build error) |
| `0df5fad` | fix | Perbaikan build Vercel: hindari narrowing `window` di fallback prefetch sidebar |
| `3f12dd7` | perf | Prefetch route owner dari sidebar + mobile bottom nav |
| `2efa3ac` | perf | Paralelisasi query KPI + tabel halaman Kas |
| `6792240` | perf | Pangkas payload query owner (`dashboard`, `settings`, `kas`) |
| `8524ad8` | fix | Prioritas baca fallback metadata nota saat kolom modern belum sinkron |
| `4c1ba01` | fix | Sinkron state form Nota & Printer setelah save (`router.refresh`) |
| `ab99944` | fix | Simpan toggle pajak dengan next-state eksplisit (hindari stale state) |
| `6ee3c32` | fix | Rapikan struktur kolom tabel invoice + separator vertikal |
| `9558dfd` | fix | Konfigurasi ukuran judul nota + refinemen layout invoice |

## Status Migrasi Penting (Invoice & Settings)

- `020_employee_points.sql` -> pending eksekusi Supabase (jika belum dijalankan di production)
- `021_settings_extended.sql` -> pending eksekusi Supabase (jika belum dijalankan di production)
- `022_settings_assets_bucket.sql` -> pending eksekusi Supabase (jika belum dijalankan di production)
- `023_invoice_new_fields.sql` -> wajib untuk due_date, shipping_cost, unit_label
- `024_settings_nota_config.sql` -> wajib untuk nota_title, nota_jabatan, nota_show_watermark
- `025_settings_nota_title_size.sql` -> wajib untuk kontrol ukuran judul nota/invoice
- `026_point_redemption_requests.sql` -> wajib untuk workflow pengajuan klaim point (pending/approved/rejected)

## Checklist Verifikasi Setelah Deploy

1. Tab Settings > Nota & Printer menyimpan field baru tanpa error.
2. Cetak dari list invoice membuka halaman print sesuai format aktif settings.
3. A4/A5/thermal masing-masing menampilkan layout dan data sesuai konfigurasi.
4. Watermark LUNAS hanya muncul jika status paid dan toggle watermark aktif.
5. Signature + stamp tampil sesuai file upload terbaru di settings-assets.
6. Toggle PPh/PPN tidak kembali ke nilai lama setelah pindah halaman.
7. Nilai form Nota & Printer tetap konsisten setelah save dan reload.
8. Navigasi owner terasa lebih cepat pada perpindahan via sidebar/bottom nav.
9. Build Vercel lolos tanpa error TypeScript pada `sidebar.tsx`.
10. Mekanik bisa submit klaim point dari tab Point (status: pending).
11. Owner bisa approve/reject klaim point dari halaman Engineer (tab Performa).
12. Approval sukses membuat `employee_point_transactions(redeem)` + `ledger(kas_keluar)` + update status request.

## Checklist Mobile UX (Per Halaman Owner — 27 Mei 2026)

| Halaman | Status | Catatan |
|---|---|---|
| Invoice List (`/owner/invoices`) | ✅ Selesai | Card mobile + tabel desktop, KPI grid responsive |
| Invoice Baru (`/owner/invoices/new`) | ✅ Selesai | Single-column mobile, form item full-width, sticky save bar |
| Invoice Edit (`/owner/invoices/[id]`) | ✅ Selesai | Shared `InvoiceEditor`, layout sama dengan new |
| Bottom Nav Owner | ✅ Selesai | FAB Invoice, drawer menu, 4 slot tetap (Dashboard/Kas/Pengaturan/Menu) |
| Dashboard (`/owner/dashboard`) | 🔄 Belum | Kartu KPI perlu audit 360px |
| Kas (`/owner/kas`) | 🔄 Belum | Tabel transaksi perlu card list di mobile |
| Settings (`/owner/settings`) | 🔄 Belum | Form panjang perlu single-column audit |
| Admin Invoice List | ✅ Selesai | Card mobile + tabel desktop |
| Admin Invoice New/Edit | ✅ Selesai | Shared InvoiceEditor |
| Admin Bottom Nav | 🔄 Belum | Masih sidebar lama tanpa bottom nav mobile |
