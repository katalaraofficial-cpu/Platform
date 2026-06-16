# Katalara POS — Platform Status & Handoff

Platform manajemen bengkel multi-tenant berbasis Next.js + Supabase.

**Live URL:** https://katalara-pos.vercel.app  
**GitHub:** https://github.com/katalaraofficial-cpu/Platform  
**Supabase Project:** https://nmggvtewovganrwcbpzk.supabase.co  
**Branch aktif:** `main`  
**Last updated:** 13 Juni 2026 — commit `72ff6d4`

Referensi utama untuk kelanjutan development:

- ★ Mulai di sini — [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md) (konteks agent standar 4-seksi: Aturan · State · Path Anchors · Next Actions; aktualisasi progres antar-sesi distandarkan di file ini)
- Konteks proyek: [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)
- Log progres build: [docs/DEVELOPMENT_PROGRESS.md](docs/DEVELOPMENT_PROGRESS.md)
- Framework kerja AI agent: [docs/AI_AGENT_FRAMEWORK.md](docs/AI_AGENT_FRAMEWORK.md)
- Rencana mobile/PWA: [docs/MOBILE_PWA_ROLLOUT.md](docs/MOBILE_PWA_ROLLOUT.md)

## Snapshot Progres Terkini

Format status mengikuti pola ringkas `AGEN_CONTEXT.MD`.

### [SELESAI]

- **Catatan tracking per invoice** (`64e1d77`, `72ff6d4`): kolom **Catatan** di list invoice owner & admin punya tombol bundar (badge jumlah) dengan dropdown Buat Catatan / Preview Catatan, modal create (tanggal + textarea, Simpan/Batal, X corner, klik backdrop & Esc untuk batal) dan modal preview (list catatan + tombol hapus). Backed by migrasi `046_invoice_tracking_notes.sql` (kolom `tracking_notes JSONB`).
- **Reorder baris item invoice** (`5f46687`): aksi naik/turun (ChevronUp/Down) di tabel item invoice editor (desktop + mobile).
- **Owner invoice list UX lanjutan**:
  - Filter **Cari Item** (ILIKE `invoice_items.description`) + persempit field Cari Pelanggan (`3bdd3a4`).
  - Auto-flip dropdown row actions saat ruang bawah kurang (`6f4aa5b`).
  - Bulk select + bulk **Tandai Lunas** + bulk **Hapus** (`b8dd418`).
  - **Preview Invoice** modal di row actions (`11503b8`).
  - Preview pelanggan menampilkan histori service + tombol Lihat Invoice (filter `no` di list invoice) (`e77f393`).

- **Modul Kehadiran terintegrasi data riil**: check-in GPS mekanik aktif, rekap owner aktif, filter periode rekap (minggu/tanggal/bulan/tahun), kolom **Rata-rata Jam/Hari**, dan tab owner sudah disejajarkan di tengah.
- **Checkout manual opsional**: engineer dapat check-out sebelum 8 jam, durasi kerja otomatis berkurang di rekap owner, plus log absensi harian engineer tampil tabel.
- **Pembaruan navigasi engineer**: bottom nav mengganti item Piutang Saya menjadi tombol menu (hide/unhide daftar menu) agar akses menu pribadi lebih rapi.
- **Backfill data attendance historis**: migration `045_backfill_checked_out_at.sql` mengisi `checked_out_at` untuk record lama yang pulang < 8 jam agar tidak salah label auto.

- **Poin 5 katalog tenant-aware**: `settings.feature_catalog_enabled` (migrasi `041`) sudah aktif di codebase, dengan toggle Pengaturan Platform, nav owner hide/show, guard route `/owner/katalog`, dan gate server action katalog.
- **Inline edit tipe item invoice** (desktop + mobile): baris item kini bisa ubah `item_type` langsung, dengan opsi **Perbarui katalog master** untuk sinkronisasi tipe di data katalog.
- **Perbaikan harga jual barang saat H.Beli 0**: perhitungan simpan item kini menghormati harga jual eksplisit agar `final_price` tidak tersimpan nol.
- **Owner invoice filter UX**: status dipindah ke filter tabel, KPI kembali fokus ke ringkasan.
- **Reimburse proof visibility**: bukti transfer pada reimbursement tampil konsisten di riwayat mekanik.

- **Katalog Item implicit** (`/owner/katalog`): audit klasifikasi nama item lintas invoice, filter "Tipe campur", reklasifikasi bulk (`reclassifyItemDescription` admin-client `UPDATE invoice_items` per tenant).
- **Autocomplete cerdas** di invoice editor: pilih saran → autofill tipe + satuan + harga jual (`final_price/quantity`) + harga beli (`unit_price`). Warning kuning saat nama yang diketik pernah tercatat di tipe berbeda, dengan tombol pindah tab cepat.
- **Dashboard donut komposisi** menghitung jumlah baris (bukan menjumlahkan `quantity`), sehingga "Jasa vs Barang" mencerminkan jumlah transaksi, bukan total satuan.
- **WA share invoice**: judul preview pakai nama bisnis tenant (bukan brand platform), label status ID (`Selesai - Lunas` / `Selesai - Belum Bayar`), template WA per tenant dengan placeholder `{customer}`, `{invoice_no}`, `{total}`, `{status}`, `{items}` (di Pengaturan).
- **Halaman print publik** `/print/invoices/[id]` (lewat `createAdminClient` + middleware allowlist) dengan `generateMetadata` OG bersih (og:title, og:description, og:image = `storeLogoUrl`, robots `noindex`) supaya link preview WhatsApp rapi.
- Workflow invoice owner/admin end-to-end (draft → in_progress → completed → paid/cancelled)
- Complaint workflow per assignment mekanik (`invoice_mechanics.is_complaint`)
- Program point mekanik + klaim redeem + approval owner
- Perbaikan rollback point saat status invoice diturunkan kembali (deterministic + invoice-aware)
- Ringkasan point engineer stabil (saldo/earned/redeemed konsisten setelah rollback)
- Owner users invite flow (owner-scoped invite action)
- Owner users delete flow sudah bisa dipakai owner (dengan guard tenant + role)
- Owner invoice list menampilkan badge `Komplain` bila complaint aktif
- Halaman owner pelanggan lengkap: pagination, bulk action, preview/edit/hapus, alamat terstruktur
- Dashboard mekanik memiliki 4 tab scaffold: Aktivitas, Kehadiran, Insentif, Payroll
- PWA install support sudah aktif (manifest, icon, service worker)
- Modul Kas & Keuangan: COA UMKM lengkap, jurnal PDF, filter `transaction_date`, hutang/piutang
- Dashboard owner berbasis ledger (`Pendapatan Hari Ini` & `Bulan Ini`) memakai `transaction_date`, bukan `created_at`
- Modul Invoice DP/PPN/PPh per tenant via `module_invoice_dp/ppn/pph` (Settings → Modul Invoice)
- Kasbon karyawan: COA `108`, halaman saldo & cicilan untuk mekanik, sidebar toggle private
- Mekanik upload struk: dua mode (terkait invoice / klaim non-invoice bensin · kesehatan · lainnya), upload kamera + galeri
- Sinkron point owner-aware: rebuild expected dari assignment + setting reward saat ini, dan netralkan transaksi orphan
- Pesan WhatsApp invoice/nota/struk format blok ringkas + link preview untuk format Invoice
- Generator nomor invoice anti-duplicate (baca nomor terakhir + retry idempotent)
- Brand icon homescreen pakai logo Katalara (proxy `Logo.jpg` + versioning manifest)

### [PROSES]

- Mobile polish lanjutan: owner layout sudah aman di viewport kecil, admin bottom nav masih belum parity (masih sidebar).

### [BELUM]

- Integrasi data riil tab `Payroll` mekanik.
- Modul pelanggan admin (`/admin/customers`) parity dengan owner.
- Approval flow klaim non-invoice di sisi owner sebelum reimburse.
- Audit log aksi sensitif (rollback invoice, sinkron point, delete user, klaim, reklasifikasi).

## Histori Commit Terbaru

| Commit | Jenis | Ringkasan |
|---|---|---|
| `7ba1837` | chore | Attendance: backfill `checked_out_at` untuk data historis checkout < 8 jam |
| `e4b4cff` | feat | Attendance: checkout manual opsional, log harian engineer, menu navbar engineer, kolom rata-rata jam/hari, tab owner center |
| `d29d689` | feat | Rekap kehadiran owner: filter periode tanggal/bulan/tahun + akumulasi jam lintas mode |
| `4da6e37` | feat | Poin 5: feature flag katalog per tenant + guard route/action + inline edit `item_type` invoice + opsi sinkron katalog master |
| `749b66c` | fix | Perbaiki simpan harga jual barang saat harga beli 0 agar `final_price` tidak menjadi 0 |
| `0ecc6e0` | fix | Owner invoice list: filter status pindah ke tabel, KPI diringkas |
| `b2ea170` | fix | Bukti transfer reimburse tampil di riwayat mekanik + penyempurnaan complaint filter |
| `b46e5f6` | fix | Kas: filter tanggal `from`/`to` pakai state lokal, hilangkan race condition yang membuat data di luar rentang masih tampil |
| `caec78f` | feat | Kas: footer total dinamis sesuai filter (in/out/net/count) + search auto-apply (debounce) + transisi mulus dengan `useTransition` |
| `d12cc64` | feat | Katalog item implicit + autofill harga & satuan dari riwayat + reklasifikasi bulk + warning mismatch tipe |
| `c29fde4` | fix | Donut komposisi hitung baris (bukan sum qty), WA template tambah `{items}`, metadata OG bersih untuk link preview |
| `16d525a` | feat | WA share pakai nama bisnis tenant + template WA kustom + halaman print publik `/print/invoices/[id]` + label status ID |
| `3145460` | docs | Update progres + pakem AI agent (sampai commit `4a1036f`) |
| `4a1036f` | fix | Pembayaran invoice mengisi `ledger.transaction_date` sesuai tanggal bayar (bukan default hari ini) |
| `87aac87` | fix | Nomor invoice anti-duplicate + WA template per format + refresh icon homescreen |
| `50e247a` | feat | Mekanik klaim non-invoice + upload galeri + ikon brand Katalara |
| `d2841a3` | fix | Dashboard `Invoice Terbaru` pakai `invoice_date` + sinkron point bersihkan transaksi orphan |
| `76628c2` | fix | Dashboard kas bulan ini & pendapatan hari ini pakai `transaction_date` |
| `7ac00ba` | fix | Sinkron point berdasarkan assignment terkini + perbaikan engineer panel toggle |
| `7a44ef1` | feat | Kasbon karyawan COA + saldo/cicilan + private sidebar toggle |
| `cd7b090` | feat | Settings tab Modul Invoice (DP/PPN/PPh) + placeholder Lokasi Kerja |
| `bc4e399` | feat | Invoice tanggal selesai eksplisit + kolom lama kerja |
| `162562b` | feat | Kas mobile layout: action 2x2 grid + tabel jadi card list |
| `4d419e4` | feat | Kas COA UMKM lengkap + export jurnal ke PDF |
| `33824e9` | fix | Dashboard filter by `invoice_date`, month picker, top customers by revenue |
| `1fd746d` | fix | Stabilkan total point engineer + wording riwayat rollback lebih profesional |
| `35173a0` | feat | Aktivasi PWA install support (manifest, icon routes, service worker) |
| `b919b08` | fix | Owner delete user flow + sinkron pembersihan stale point invoice non-paid |
| `1c998e7` | feat | Alamat pelanggan terstruktur Jateng + chart scope + point summary berbasis histori |
| `329d889` | feat | Owner customers table: pagination, bulk, preview/edit/hapus |
| `3a9ffdb` | fix | Customer page pakai alamat + tombol sinkron point engineer |
| `a9ceea1` | feat | Pindah tab engineer ke owner view + pembaruan docs |
| `7179bd1` | feat | Owner customers page awal + mechanic 4-tab scaffold + sinkron rollback point card |
| `e9a788b` | fix | Reverse mechanic points ketika invoice paid di-rollback |
| `0e5b6ad` | fix | Badge komplain di owner invoice list + owner invite flow tanpa super admin gate |
| `131e400` | feat | Surface complaint status pada invoice/mechanic views |
| `683e3c5` | fix | Kompatibilitas baca settings owner + refresh setelah save |

## Arsitektur Role & Route

```text
super_admin  -> /super-admin/*
owner        -> /owner/*
admin        -> /admin/*
mechanic     -> /mechanic/*
```

Semua query tenant diproteksi RLS Supabase, `profiles.role` adalah source RBAC utama.

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://nmggvtewovganrwcbpzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# URL app
NEXT_PUBLIC_SITE_URL=https://katalara-pos.vercel.app

# Email invite
RESEND_API_KEY=<resend-api-key>
```

## Status Migrasi

Pastikan environment target sudah menjalankan migrasi bisnis terbaru minimal sampai:

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
- `037_fix_invoice_ledger_transaction_date.sql`
- `038_settings_wa_template.sql` (kolom `settings.wa_template` untuk template WhatsApp per tenant)
- `041_settings_feature_catalog.sql` (kolom `settings.feature_catalog_enabled` default `false`)
- `044_attendance_manual_checkout.sql` (kolom `attendance_records.checked_out_at` + policy update engineer checkout)
- `045_backfill_checked_out_at.sql` (backfill histori checkout manual berdasarkan durasi < 8 jam)

Catatan: migrasi awal `011`–`015` yang sempat bertanda pending di dokumen lama juga perlu dipastikan status eksekusinya di production.

## Prioritas Kelanjutan (Untuk Agent Berikutnya)

1. Integrasikan data riil tab `Kehadiran` (GPS attendance) dan `Payroll` di dashboard mekanik (Lokasi Kerja sudah ada placeholder di Settings).
2. Tambahkan modul pelanggan admin (`/admin/customers`) parity dengan owner.
3. Approval flow klaim non-invoice (`mechanic_debt_ledger.claim_category`) di sisi owner sebelum di-reimburse.
4. Audit log untuk action sensitif: rollback invoice, sinkron point, delete user, klaim non-invoice, reklasifikasi katalog.
5. Perbaikan akumulasi helper point untuk nominal kecil (hindari loss karena `floor`).
6. Subdomain per tenant (`*.katalara.app` vs custom domain) — belum diputuskan, menunggu konfirmasi owner.
7. Opsional: promote katalog implicit jadi tabel master `catalog_items` jika owner butuh harga kanonik terpisah dari riwayat invoice.

## Perintah Verifikasi Standar

```bash
npm run build
```

Jika build lolos, lanjutkan smoke test manual pada alur:

- owner invoice list/detail
- mechanic dashboard point + activity
- owner users invite
- owner users delete engineer
- owner customers
- install PWA (A2HS Android / Add to Home Screen iOS) — homescreen icon harus tampil logo Katalara, bukan inisial
- pembayaran invoice retroaktif: pastikan masuk ke bulan/tanggal `paymentDate`, bukan hari input
- WA share dari modal print: 3 format (struk/nota/invoice) menghasilkan blok pesan benar + link preview untuk Invoice yang membuka halaman print publik
- `/owner/katalog`: filter "Tipe campur" menampilkan nama yang pernah dipakai di lebih dari satu `item_type`; tombol pindah berhasil memperbarui semua `invoice_items` terkait
- input item invoice: pilih saran autocomplete mengisi tipe + satuan + harga jual (+ harga beli untuk part); warning kuning muncul saat tab aktif beda dari tipe historis
