# Development Progress Log

Last updated: 29 Mei 2026 (commit `1fd746d`)

## Ringkasan Status Saat Ini

- Platform aktif stabil di Next.js 15 + Supabase multi-tenant.
- Alur invoice owner/admin sudah end-to-end dan complaint-aware.
- Program point mekanik sudah mencakup earn, klaim, approval/reject, dan rollback sync saat invoice diturunkan statusnya.
- Konsistensi card point engineer sudah diperbaiki (order-agnostic summary + wording histori rollback profesional).
- Owner customers page sudah aktif sehingga menu pelanggan tidak 404.
- Owner customers page sudah naik level ke tabel interaktif (pagination, bulk action, preview/edit/hapus, wilayah terstruktur Jateng).
- Dashboard mekanik telah disiapkan dengan kerangka 4 tab untuk fase lanjutan.
- PWA install support sudah aktif (manifest + service worker + icon set).

## Milestone Build Terbaru

| Commit | Tipe | Ringkasan |
|---|---|---|
| `1fd746d` | fix | Stabilkan total point engineer + wording riwayat rollback profesional |
| `35173a0` | feat | Aktivasi PWA install support (manifest, icons, SW) |
| `b919b08` | fix | Owner delete user + sinkron stale point invoice non-paid |
| `1c998e7` | feat | Alamat pelanggan terstruktur + chart scope + point summary by history |
| `329d889` | feat | Owner customers table interaktif (pagination, bulk, actions) |
| `3a9ffdb` | fix | Customer page pakai alamat + sinkron point engineer |
| `a9ceea1` | feat | Pindah tab engineer ke owner view + update docs |
| `7179bd1` | feat | Tambah halaman owner customers, scaffold 4 tab mechanic, sinkron rollback point card |
| `e9a788b` | fix | Reverse point mekanik saat invoice paid di-rollback |
| `0e5b6ad` | fix | Badge komplain di owner invoice list + owner invite flow tanpa super-admin gate |
| `131e400` | feat | Surface complaint status di invoice owner/admin dan mechanic views |
| `683e3c5` | fix | Settings owner: baca schema-compatible + refresh setelah save |
| `86b93f5` | fix | Settings save lebih resilien tanpa bergantung upsert conflict |
| `bc41691` | fix | Persist settings updates lintas tab owner |
| `ae9ef45` | fix | Stabilkan persistence reward settings setelah refresh |

## Status Migrasi Penting

Minimum migration yang harus sudah ada di environment target:

- `020_employee_points.sql`
- `021_settings_extended.sql`
- `022_settings_assets_bucket.sql`
- `023_invoice_new_fields.sql`
- `024_settings_nota_config.sql`
- `025_settings_nota_title_size.sql`
- `026_point_redemption_requests.sql`
- `027_invoice_mechanics_complaint.sql`

Catatan: cek juga status `011`–`015` karena historisnya pernah ditandai pending di sebagian environment.

## Checklist Verifikasi Setelah Deploy

1. Owner invoice list menampilkan badge `Komplain` untuk invoice completed yang complaint aktif.
2. Owner/users bisa membuat invite tanpa error forbidden, dan fallback copy-link tetap tersedia.
3. Mechanic dashboard tab `Insentif` menampilkan mutasi point terbaru.
4. Rollback invoice dari paid menghasilkan penurunan point card mekanik (cek `employee_points` dan `employee_point_transactions`).
4a. Jalankan sinkron point di settings owner dan pastikan invoice non-paid tidak menyisakan saldo/earned phantom.
5. Owner customers page (`/owner/customers`) tampil tanpa 404 dengan KPI + pie lokasi + tabel pelanggan.
5a. Uji edit pelanggan dengan selector kabupaten/kecamatan Jateng dan chart scope badge.
6. Settings tab owner tetap persisten setelah save dan refresh (uji lintas tab).
7. PWA: cek install prompt/Add to Home Screen pada Android/iOS (jika browser mendukung).

## Catatan Risiko Terbuka

- Persistence settings owner masih perlu validasi ulang di production real traffic.
- Skema point helper masih rawan nominal kecil karena pembulatan `floor`.
- Tab `Kehadiran` dan `Payroll` mekanik masih scaffold, belum tersinkron data riil.
