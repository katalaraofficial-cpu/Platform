# Development Progress Log

Last updated: 6 Juni 2026 (commit `d12cc64`)

## Ringkasan Status Saat Ini

- **Katalog Item implicit** sudah live: halaman `/owner/katalog` audit klasifikasi `invoice_items` per tenant, reklasifikasi bulk via `reclassifyItemDescription` (admin client, ILIKE per deskripsi).
- **Autocomplete invoice editor** sekarang autofill tipe + satuan + harga jual + harga beli dari transaksi terakhir, plus warning kuning saat user mengetik nama yang pernah tercatat di tipe berbeda.
- **WA share invoice** pakai nama bisnis tenant + label status ID + template kustom (`settings.wa_template` dengan placeholder `{items}`); link membuka halaman print publik `/print/invoices/[id]` dengan OG metadata bersih.
- **Dashboard donut komposisi** menghitung baris invoice_items, bukan menjumlahkan `quantity`.

- Platform aktif stabil di Next.js 15 + Supabase multi-tenant.
- Modul Kas & Keuangan sudah lengkap dengan COA UMKM + export jurnal PDF + filter berbasis `transaction_date`.
- Dashboard owner sudah bersih dari mismatch tanggal: KPI, kas bulan ini, dan invoice terbaru semua mengacu kolom bisnis (`transaction_date` / `invoice_date`).
- Modul Invoice DP/PPN/PPh dapat dinyalakan/matikan per tenant (`module_invoice_dp/ppn/pph`).
- Mekanik dapat upload struk untuk pekerjaan invoice maupun klaim non-invoice (bensin/kesehatan/lainnya), dengan upload kamera atau galeri.
- Sinkron point owner sekarang invoice-aware (assignment terkini + reset transaksi orphan invoice yang sudah dihapus).
- Generator nomor invoice tahan duplicate karena baca nomor terakhir + retry idempotent.
- WA share dari modal print menyajikan format pesan blok (Struk/Nota) dan menambahkan link preview untuk Invoice.
- Brand icon homescreen pakai `Logo.jpg` Katalara via icon route + versioning manifest.
- Alur lama (point earn/redeem, complaint, owner customers, PWA, mobile UX) tetap berlaku.

## Milestone Build Terbaru

| Commit | Tipe | Ringkasan |
|---|---|---|
| `d12cc64` | feat | Katalog item implicit (`/owner/katalog`) + autofill harga/satuan/tipe dari riwayat + reklasifikasi bulk + warning mismatch tipe di invoice editor |
| `c29fde4` | fix | Donut komposisi hitung baris (bukan `SUM(quantity)`), `{items}` ditambahkan di template WA, generateMetadata bersih (og:title/description/image) di print page |
| `16d525a` | feat | WA share pakai nama bisnis tenant + template WA per tenant via `settings.wa_template` (migrasi 038) + halaman print publik `/print/invoices/[id]` lewat middleware allowlist + label status ID (Selesai - Lunas / Selesai - Belum Bayar) |
| `3145460` | docs | Update progres + pakem AI agent (cutoff `4a1036f`) |
| `4a1036f` | fix | Pembayaran invoice mengisi `ledger.transaction_date` dari `paymentDate` (bukan default hari ini) |
| `87aac87` | fix | Nomor invoice anti-duplicate (baca last + retry) + WA template per format + refresh ikon homescreen |
| `50e247a` | feat | Mekanik klaim non-invoice (bensin/kesehatan/lainnya) + upload galeri + ikon brand Katalara |
| `d2841a3` | fix | Dashboard `Invoice Terbaru` pakai `invoice_date` + sinkron point membersihkan transaksi orphan |
| `76628c2` | fix | Dashboard kas bulan ini & pendapatan hari ini bersumber dari `ledger.transaction_date` |
| `7ac00ba` | fix | Sinkron point berdasarkan assignment terkini + engineer panel toggle |
| `7a44ef1` | feat | Kasbon karyawan COA `108` + saldo/cicilan + private sidebar toggle mekanik |
| `cd7b090` | feat | Settings: tab Modul Invoice (DP/PPN/PPh) + placeholder Lokasi Kerja |
| `bc4e399` | feat | Invoice tanggal selesai eksplisit + kolom lama kerja |
| `162562b` | feat | Kas mobile layout: action 2x2 grid + card list |
| `fd7a574` | feat | Keterangan ledger Pembayaran Invoice menyertakan nama pelanggan + migration backfill |
| `4d419e4` | feat | Kas COA UMKM lengkap + export jurnal PDF |
| `33824e9` | fix | Dashboard filter `invoice_date`, month picker, top customers by revenue |
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
- `028_ledger_transaction_date.sql`
- `029_kas_hutang_piutang.sql`
- `030_invoice_dp.sql`
- `031_invoice_dp_toggle.sql`
- `032_backfill_completed_at.sql`
- `033_backfill_invoice_ledger_date.sql`
- `034_backfill_ledger_notes_customer.sql`
- `035_invoice_ppn_pph_toggle.sql`
- `036_mechanic_debt_claim.sql`
- `037_fix_invoice_ledger_transaction_date.sql` (wajib jalan setelah deploy commit `4a1036f`)
- `038_settings_wa_template.sql` (kolom `wa_template TEXT` pada `settings`; default template di-resolve dari `DEFAULT_WA_TEMPLATE` lib bila kolom NULL)

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
7. PWA: install ke homescreen menampilkan logo Katalara (bukan inisial "V"). Hapus shortcut lama dulu untuk bust cache launcher.
8. Pembayaran invoice retroaktif: bayar invoice tanggal lalu, cek dashboard → Pendapatan Bulan Ini sesuai tanggal bayar, bukan tanggal input.
9. Invoice baru: buat 5–10 invoice berurutan (termasuk setelah cancel/delete) tanpa error duplicate `invoices_tenant_id_invoice_number_key`.
10. WA share dari modal print: 3 format (struk/nota/invoice) menghasilkan blok pesan benar; format Invoice membawa link preview yang bisa dibuka pelanggan.
11. Mekanik upload struk: tab `Untuk Invoice` (jika ada assignment) dan tab `Klaim` (bensin/kesehatan/lainnya) keduanya berhasil simpan dengan upload kamera atau galeri.
12. Halaman `Piutang Saya` mekanik menampilkan badge kategori klaim + thumbnail struk untuk entri non-invoice.
13. `/owner/katalog`: filter "Tipe campur" menampilkan nama duplikat antar tipe; klik tombol Pindah memperbarui semua `invoice_items` dengan deskripsi sama (ILIKE) dan dashboard donut komposisi ikut berubah setelah refresh.
14. Input item invoice: ketik nama existing → daftar saran muncul dengan label tipe + harga; klik saran mengisi tipe + satuan + harga jual (+ harga beli kalau part). Pilih tab Jasa tapi nama tercatat sebagai Barang → muncul banner kuning + tombol pindah.
15. WA share Invoice: link preview membuka `/print/invoices/[id]` tanpa login, title pakai nama bisnis tenant, gambar OG pakai `storeLogoUrl`, status pakai label ID.

## Catatan Risiko Terbuka

- Persistence settings owner masih perlu validasi ulang di production real traffic.
- Skema point helper masih rawan nominal kecil karena pembulatan `floor`.
- Tab `Kehadiran` dan `Payroll` mekanik masih scaffold, belum tersinkron data riil.
- Klaim non-invoice (`mechanic_debt_ledger.claim_category`) belum punya approval flow di owner; saat ini langsung tercatat sebagai `advance` dan terhitung di Piutang Mekanik.
- Generator nomor invoice masih level aplikasi (read-then-insert + retry). Jika trafik konkuren tinggi, pertimbangkan trigger / sequence di DB untuk garansi atomik.
- Backfill `037` hanya menyentuh ledger `Pembayaran Invoice`. Untuk transaksi kas manual yang salah tanggal, koreksi dilakukan via UI Kas (edit transaksi).
- Katalog masih implicit (sumber `invoice_items`). Tidak ada tabel master `catalog_items` — mengubah "harga kanonik" berarti memperbarui transaksi terakhir, bukan record master. Bila kebutuhan owner berkembang (mis. harga jual standar per item lepas dari riwayat), pertimbangkan promote ke tabel master.
- `reclassifyItemDescription` melakukan UPDATE massal lewat admin client (bypass RLS). Tenant scope dijaga manual via `WHERE tenant_id`; jangan ubah signature tanpa mempertahankan filter ini.
- Halaman print publik `/print/invoices/[id]` dapat diakses tanpa login (allowlist `/print` di middleware). Pastikan tidak menampilkan data sensitif di luar lingkup invoice (mis. data pelanggan lain).
