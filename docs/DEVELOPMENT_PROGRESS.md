# Development Progress Log

Last updated: 27 Mei 2026 (commit `bd1cfe1`)

## Ringkasan Status Saat Ini

- Platform aktif di Next.js 15 + Supabase multi-tenant.
- Modul inti invoice owner/admin sudah berjalan end-to-end.
- Print format sekarang mengikuti pengaturan aktif di tab Nota & Printer.
- Konfigurasi detail Nota & Printer (judul, jabatan, watermark, header/footer, tanda tangan, stempel) sudah tersimpan ke settings.

## Milestone Build Terbaru

| Commit | Tipe | Ringkasan |
|---|---|---|
| `bd1cfe1` | feat | Tab Nota & Printer detail fields + sinkron output cetak dari settings |
| `87d6e70` | feat | Watermark LUNAS, redesign invoice (gambar referensi 5), perbaikan A5 |
| `d4871a0` | fix | Cetak dari list buka tab baru + koreksi harga/unit + redesign invoice |
| `3db1002` | fix | Perbaikan lint/type error (`as any`) pada insert invoice |
| `f0a718d` | fix | Perbaikan type Insert untuk `due_date`, `shipping_cost`, `unit_label` |
| `d15fd1f` | feat | Penambahan due date, satuan item, biaya kirim + redesign template |

## Status Migrasi Penting (Invoice & Settings)

- `020_employee_points.sql` -> pending eksekusi Supabase (jika belum dijalankan di production)
- `021_settings_extended.sql` -> pending eksekusi Supabase (jika belum dijalankan di production)
- `022_settings_assets_bucket.sql` -> pending eksekusi Supabase (jika belum dijalankan di production)
- `023_invoice_new_fields.sql` -> wajib untuk due_date, shipping_cost, unit_label
- `024_settings_nota_config.sql` -> wajib untuk nota_title, nota_jabatan, nota_show_watermark

## Checklist Verifikasi Setelah Deploy

1. Tab Settings > Nota & Printer menyimpan field baru tanpa error.
2. Cetak dari list invoice membuka halaman print sesuai format aktif settings.
3. A4/A5/thermal masing-masing menampilkan layout dan data sesuai konfigurasi.
4. Watermark LUNAS hanya muncul jika status paid dan toggle watermark aktif.
5. Signature + stamp tampil sesuai file upload terbaru di settings-assets.
