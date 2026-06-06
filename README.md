# Katalara POS — Platform Status & Handoff

Platform manajemen bengkel multi-tenant berbasis Next.js + Supabase.

**Live URL:** https://katalara-pos.vercel.app  
**GitHub:** https://github.com/katalaraofficial-cpu/Platform  
**Supabase Project:** https://nmggvtewovganrwcbpzk.supabase.co  
**Branch aktif:** `main`  
**Last updated:** 6 Juni 2026 — commit `4a1036f`

Referensi utama untuk kelanjutan development:

- Konteks proyek: [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)
- Log progres build: [docs/DEVELOPMENT_PROGRESS.md](docs/DEVELOPMENT_PROGRESS.md)
- Framework kerja AI agent: [docs/AI_AGENT_FRAMEWORK.md](docs/AI_AGENT_FRAMEWORK.md)
- Rencana mobile/PWA: [docs/MOBILE_PWA_ROLLOUT.md](docs/MOBILE_PWA_ROLLOUT.md)

## Snapshot Progres Terkini

Fitur yang sudah stabil pada branch `main`:

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

## Histori Commit Terbaru

| Commit | Jenis | Ringkasan |
|---|---|---|
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

Catatan: migrasi awal `011`–`015` yang sempat bertanda pending di dokumen lama juga perlu dipastikan status eksekusinya di production.

## Prioritas Kelanjutan (Untuk Agent Berikutnya)

1. Integrasikan data riil tab `Kehadiran` (GPS attendance) dan `Payroll` di dashboard mekanik (Lokasi Kerja sudah ada placeholder di Settings).
2. Tambahkan modul pelanggan admin (`/admin/customers`) parity dengan owner.
3. Approval flow klaim non-invoice (`mechanic_debt_ledger.claim_category`) di sisi owner sebelum di-reimburse.
4. Audit log untuk action sensitif: rollback invoice, sinkron point, delete user, klaim non-invoice.
5. Perbaikan akumulasi helper point untuk nominal kecil (hindari loss karena `floor`).

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
- WA share dari modal print: 3 format (struk/nota/invoice) menghasilkan blok pesan benar + link preview untuk Invoice
