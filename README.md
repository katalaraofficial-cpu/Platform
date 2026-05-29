# Katalara POS — Platform Status & Handoff

Platform manajemen bengkel multi-tenant berbasis Next.js + Supabase.

**Live URL:** https://katalara-pos.vercel.app  
**GitHub:** https://github.com/katalaraofficial-cpu/Platform  
**Supabase Project:** https://nmggvtewovganrwcbpzk.supabase.co  
**Branch aktif:** `main`  
**Last updated:** 29 Mei 2026 — commit `1fd746d`

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

## Histori Commit Terbaru

| Commit | Jenis | Ringkasan |
|---|---|---|
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

Catatan: migrasi awal `011`–`015` yang sempat bertanda pending di dokumen lama juga perlu dipastikan status eksekusinya di production.

## Prioritas Kelanjutan (Untuk Agent Berikutnya)

1. Integrasikan data nyata untuk tab `Kehadiran` dan `Payroll` di dashboard mekanik.
2. Tambahkan modul pelanggan admin (`/admin/customers`) agar parity dengan owner.
3. Sempurnakan program point helper agar tidak hilang karena pembulatan `floor` pada nominal kecil.
4. Tambahkan observability sederhana (audit trail action penting owner: rollback, delete user, sinkron point).

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
- install PWA (A2HS Android / Add to Home Screen iOS)
