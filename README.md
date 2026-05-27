# Katalara POS — B2B SaaS Workshop & POS Management

Platform manajemen bengkel multi-tenant berbasis web. Dibangun dengan Next.js 15 App Router, Supabase, TypeScript, dan Tailwind CSS.

**Live URL:** https://katalara-pos.vercel.app  
**GitHub:** https://github.com/katalaraofficial-cpu/Platform  
**Supabase Project:** https://nmggvtewovganrwcbpzk.supabase.co  
**Branch aktif:** `main`  
**Last updated:** 27 Mei 2026 — commit `0df5fad`

> Untuk konteks lengkap (AI agent briefing, keputusan teknis, status modul, known issues): lihat [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)

> Log progres pengembangan: [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md)

> Kerangka kerja AI agent: [`docs/AI_AGENT_FRAMEWORK.md`](docs/AI_AGENT_FRAMEWORK.md)

---

## Progress Build Terbaru

| Commit | Jenis | Ringkasan |
|---|---|---|
| `0df5fad` | fix | Stabilkan build Vercel: perbaikan narrowing `window` pada prefetch sidebar |
| `3f12dd7` | perf | Prefetch route owner dari navigasi sidebar dan bottom nav |
| `2efa3ac` | perf | Paralelisasi query KPI + tabel pada halaman Kas |
| `6792240` | perf | Pangkas payload query owner (settings/kas/dashboard) |
| `8524ad8` | fix | Prioritaskan fallback metadata nota agar field settings tidak reset |
| `4c1ba01` | fix | Sinkronisasi state form Nota & Printer setelah save |
| `ab99944` | fix | Perbaikan save toggle pajak agar tidak menyimpan state stale |
| `9558dfd` | fix | Tambah konfigurasi ukuran judul nota + refinemen layout invoice |

Catatan: untuk histori detail dan checklist verifikasi per build, gunakan [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md).

### Dampak Optimasi Navigasi (Point 1-3)

- Navigasi owner lebih responsif karena route diprefetch saat idle dan saat hover/focus.
- Beban query owner berkurang karena pengurangan kolom `select` yang tidak terpakai.
- Halaman Kas membaik karena query KPI dan query tabel kini berjalan paralel.
- Build Vercel lebih stabil setelah perbaikan TypeScript pada fallback prefetch sidebar.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 15.5+ (App Router, TypeScript, `src/`) |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| SSR Auth | @supabase/ssr ^0.6.1 |
| Styling | Tailwind CSS v3.4 |
| Icons | lucide-react |
| Email | Resend (REST API, domain: `katalara.com`) |
| Deploy | Vercel (branch: `main`) |

---

## Arsitektur Multi-Tenant & RBAC

```
super_admin  → /super-admin/*  — Platform owner, kelola semua tenant
owner        → /owner/*        — Pemilik bengkel, akses penuh ke tenant sendiri
admin        → /admin/*        — Kasir, operasional harian
mechanic     → /mechanic/*     — Mekanik, work order & struk
```

---

## Environment Variables

```env
# Supabase (wajib)
NEXT_PUBLIC_SUPABASE_URL=https://nmggvtewovganrwcbpzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App URL (wajib untuk invite link)
NEXT_PUBLIC_SITE_URL=https://katalara-pos.vercel.app

# Email via Resend (wajib untuk invite flow)
RESEND_API_KEY=<resend-api-key>
```

---

## Progress Pengembangan

### ✅ Selesai

**Infrastruktur & Auth**
- [x] Database schema + RLS policies (`001`–`010` sudah dijalankan, `011`–`015` pending)
- [x] Supabase clients: browser, server, middleware, admin/service-role
- [x] TypeScript types semua tabel (`src/types/database.ts`)
- [x] Middleware RBAC — route protection + role-based redirect
- [x] Login page + Error page
- [x] Auth callback (PKCE, token_hash, hash fragment fallback via `/auth/exchange`)
- [x] Set-password page — invited user buat password pertama
- [x] Deploy ke Vercel (auto-deploy dari `main`)

**Super Admin**
- [x] Dashboard, daftar + detail + buat + edit tenant
- [x] Registrasi bengkel baru (form publik `/register`) + approval/reject
- [x] Invite user via email (Resend, `noreply@katalara.com`) + copy-link fallback
- [x] User table dengan checkbox, bulk delete, pagination

**Owner — Invoice & Keuangan**
- [x] Invoice list dengan filter tab status + row actions (detail, cetak, rollback, hapus)
- [x] Buat invoice baru (draft) — pilih/buat customer langsung dari form
- [x] Invoice editor: items (service/part), toggle margin %, PPN/PPh, diskon
- [x] Assign mekanik (lead/helper), hapus assignment
- [x] Transisi status: draft → in_progress → completed → paid / cancelled
- [x] Rollback status dari row actions
- [x] Konfirmasi pembayaran dengan modal custom (bukan native browser dialog)
- [x] Print invoice — modal pilih ukuran Thermal / A5 / A4
- [x] Mekanik & Hutang: daftar mekanik, riwayat hutang, FIFO paid status
- [x] Reimburse hutang mekanik, delete hutang + undo 5 detik
- [x] **Owner Dashboard**: KPI Omzet bulan ini, Outstanding, Piutang Mekanik
- [x] Donut chart Jasa vs Barang (breakdown nama item per kategori)
- [x] Bar chart pendapatan 6 bulan terakhir

**Admin — Invoice & Dashboard**
- [x] Semua fitur invoice Owner (shared via `InvoiceEditor`)
- [x] **Admin Dashboard**: Pemasukan Hari Ini, Perlu Dilunasi, Sedang Dikerjakan, Invoice Bulan Ini
- [x] Semua dialog konfirmasi custom (tidak ada native browser `confirm()`)

**Mechanic**
- [x] Dashboard: daftar work order aktif + history
- [x] Work order detail: tombol Mulai & Selesai Dikerjakan
- [x] Update status invoice via admin client (bypass RLS)
- [x] Hutang Saya: daftar hutang dengan FIFO paid status
- [x] Upload struk ke Supabase Storage bucket `receipts`

**UI/UX**
- [x] Sidebar collapsible (desktop)
- [x] Mobile bottom nav (mekanik)
- [x] Komponen `ConfirmDialog` reusable (5 dialog konfirmasi di seluruh app)

---

### ⚠️ Migrasi Pending — Jalankan di Supabase SQL Editor

Status di bawah adalah baseline historis. Untuk build terbaru, pastikan migration tambahan berikut juga sudah dieksekusi di environment target:

- `020_employee_points.sql`
- `021_settings_extended.sql`
- `022_settings_assets_bucket.sql`
- `023_invoice_new_fields.sql`
- `024_settings_nota_config.sql`
- `025_settings_nota_title_size.sql`

| File | Status | Isi |
|------|--------|-----|
| `001`–`010` | ✅ Sudah dijalankan | Schema, RLS, invoice columns, mechanic RLS fixes |
| `011_mechanic_item_permissions.sql` | ❌ Belum | Izin mekanik tambah item ke invoice |
| `012_storage_receipt_bucket.sql` | ❌ Belum | Storage bucket `receipts` |
| `013_mechanic_debt_insert.sql` | ❌ Belum | RLS insert `mechanic_debt_ledger` |
| `014_ledger_account_type.sql` | ❌ Belum | Kolom `account_type` di `ledger` |
| `015_admin_reimburse_policy.sql` | ❌ Belum | RLS admin reimburse hutang mekanik |

---

### ⬜ Backlog Berikutnya

**Prioritas Tinggi**
- [ ] Modul Kas Owner (`/owner/kas`) — ledger transaksi, KPI pemasukan/pengeluaran
- [ ] Pelanggan — CRUD data pelanggan per tenant (`/owner/customers`, `/admin/customers`)
- [ ] Invoice list: text search + pagination

**Prioritas Sedang**
- [ ] Admin: Kas Kecil (`/admin/petty-cash`) — petty cash ledger kasir
- [ ] Owner: Pengaturan — markup default, nama bengkel, logo
- [ ] Notifikasi / alert — invoice overdue, hutang mekanik tinggi

**Prioritas Rendah**
- [ ] Owner: Laporan — export PDF/Excel, ringkasan bulanan
- [ ] Super Admin: Dashboard summary platform

---

## Cara Invite User (Alur Terkini)

1. Super Admin → Tenant Detail → **Tambah Pengguna**
2. Isi nama, email, role → **Buat Link Undangan**
3. Email dikirim via Resend (`noreply@katalara.com`)
4. User klik link → `/auth/exchange` (proses hash token) → `/auth/set-password`
5. User buat password → redirect ke dashboard sesuai role

**Jika email gagal:** link muncul di UI untuk disalin manual (WhatsApp/chat).

---

## Migrasi Database

Jalankan secara berurutan di Supabase SQL Editor:

```
# ✅ Sudah dijalankan
supabase/migrations/001_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_tenant_requests.sql
supabase/migrations/004_invoice_tax.sql
supabase/migrations/005_invoice_discount.sql
supabase/migrations/006_invoice_payment.sql
supabase/migrations/007_mechanic_status_update.sql
supabase/migrations/008_mechanic_debt_is_paid.sql
supabase/migrations/009_fix_mechanic_rls.sql
supabase/migrations/010_fix_invoice_mechanic_policy.sql

# ❌ Belum dijalankan — jalankan berurutan
supabase/migrations/011_mechanic_item_permissions.sql
supabase/migrations/012_storage_receipt_bucket.sql
supabase/migrations/013_mechanic_debt_insert.sql
supabase/migrations/014_ledger_account_type.sql
supabase/migrations/015_admin_reimburse_policy.sql
```

Semua migrasi menggunakan `IF NOT EXISTS` — aman dijalankan ulang tanpa efek samping.


---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 15.3+ (App Router, TypeScript, `src/`) |
| Auth & DB | Supabase (PostgreSQL + Auth + Storage) |
| SSR Auth | @supabase/ssr ^0.6.1 |
| Styling | Tailwind CSS v3.4 + CSS Variables (shadcn/ui compatible) |
| Icons | lucide-react ^0.503 |
| Deploy | Vercel (branch: `main`, root: `./`) |
| React | React 19 |

---

## Arsitektur Multi-Tenant & RBAC

```
super_admin  → /super-admin/*  — Platform owner, kelola semua tenant
owner        → /owner/*        — Pemilik bengkel, akses penuh ke tenant sendiri
admin        → /admin/*        — Kasir, operasional harian (no: ledger, debt)
mechanic     → /mechanic/*     — Mekanik, mobile-first, work order & struk
```

**Isolasi tenant:** Setiap query difilter `tenant_id = get_my_tenant_id()` via Supabase RLS.  
**super_admin** punya `tenant_id = NULL` dan bypass semua RLS tenant check.

---

## Struktur Folder Penting

```
src/
├── app/
│   ├── (auth)/login/          — Halaman login (public)
│   ├── (auth)/error/          — Halaman error auth
│   ├── (super-admin)/         — Layout + pages Super Admin
│   ├── (owner)/               — Layout + pages Owner
│   ├── (admin)/               — Layout + pages Admin
│   ├── (mechanic)/            — Layout + pages Mekanik (mobile)
│   ├── layout.tsx             — Root layout (Inter font)
│   └── page.tsx               — Landing page (public)
├── components/layout/
│   ├── sidebar.tsx            — Desktop sidebar (Client Component)
│   ├── mobile-bottom-nav.tsx  — Bottom nav mekanik (Client Component)
│   └── types.ts               — NavItem: { label, href, icon: ReactNode }
├── lib/
│   ├── supabase/client.ts     — Browser client (createBrowserClient)
│   ├── supabase/server.ts     — Server client (createServerClient + cookies)
│   ├── supabase/middleware.ts — Middleware client (session refresh)
│   ├── get-user-context.ts    — Server helper: ambil user+profile+tenant
│   └── actions/auth.ts        — Server Action: signOut
├── middleware.ts              — RBAC routing, session refresh
└── types/database.ts          — TypeScript types semua tabel + Database interface
supabase/migrations/
├── 001_schema.sql             — Schema: 10 tabel, enums, triggers, views
└── 002_rls_policies.sql       — RLS: semua policy per role per tabel
```

---

## Database Schema (Ringkasan)

### Tabel Utama
| Tabel | Keterangan |
|-------|------------|
| `tenants` | Satu row per bengkel. `feature_toggles` JSONB kontrol modul. |
| `profiles` | 1-to-1 dengan `auth.users`. `tenant_id = NULL` untuk super_admin. |
| `settings` | Konfigurasi per tenant (markup default, dll). Auto-create via trigger. |
| `customers` | Data pelanggan per tenant. |
| `invoices` | Invoice utama. Status: draft→in_progress→completed→paid→cancelled. |
| `invoice_items` | Item per invoice (service / part_internal / part_external). |
| `invoice_mechanics` | Mekanik yang terlibat per invoice (lead/helper). |
| `mechanic_debt_ledger` | Hutang mekanik (bayar part pakai uang sendiri). |
| `ledger` | Kas utama. **Owner only** — Admin & Mekanik zero access. |
| `petty_cash_transactions` | Kas kecil Admin. Terpisah dari ledger utama. |

### Enums Penting
- `user_role`: super_admin, owner, admin, mechanic
- `invoice_status`: draft, in_progress, completed, paid, cancelled
- `item_type`: service, part_internal, part_external
- `payment_source`: owner, mechanic, petty_cash

### Helper Functions (SECURITY DEFINER)
- `get_my_tenant_id()` — tenant_id user yang sedang login
- `get_my_role()` — role user yang sedang login
- `is_super_admin()` — boolean check super admin

---

## Catatan Penting untuk Developer

### React 19 RSC Rule
**JANGAN** pass React component function sebagai prop dari Server Component ke Client Component.  
❌ `icon: LayoutDashboard` (function — tidak serializable)  
✅ `icon: <LayoutDashboard className="h-4 w-4" />` (ReactNode — serializable)

### Route Groups
Folder `(auth)`, `(owner)`, dll **tidak menambah prefix ke URL**.  
`src/app/(auth)/login/page.tsx` → URL: `/login` (bukan `/auth/login`)

### Server Actions
File dengan `"use server"` harus ada di **level file** (baris pertama), bukan di dalam function body. Ini syarat Next.js 15 saat di-import dari Client Component.

### Supabase SSR
Gunakan tiga client yang berbeda:
- `createBrowserClient` → Client Components
- `createServerClient` (server.ts) → Server Components & Server Actions
- `createServerClient` (middleware.ts) → Middleware saja

---

## Progress Pengembangan

### ✅ Selesai
- [x] **Step 1** — Database schema + RLS policies (001_schema.sql, 002_rls_policies.sql)
- [x] **Step 2** — Auth: Supabase clients, TypeScript types, middleware RBAC, login page, error page
- [x] **Step 3** — UI Layouts: Sidebar, MobileBottomNav, 4 role layouts (feature toggle di Owner/Admin)
- [x] Landing page (sistem internal, tombol Login)
- [x] Deploy ke Vercel + Super Admin user pertama

### 🔄 Sedang / Berikutnya
- [ ] **Step 4** — Running Invoice module (PRIORITAS UTAMA)
  - [ ] Invoice list page (`/owner/invoices`, `/admin/invoices`)
  - [ ] Buat invoice baru (draft) — nama pelanggan, nomor kendaraan
  - [ ] Tambah item (service, part_internal, part_external)
  - [ ] Assign mekanik ke invoice
  - [ ] Transisi status (draft → in_progress → completed → paid)
  - [ ] Invoice detail view

### ⬜ Belum Dimulai
- [ ] **Super Admin pages** — Kelola Tenant (CRUD tenant), Pengaturan Platform (feature toggles)
- [ ] **Owner pages** — Dashboard summary, Kas & Keuangan, Pelanggan, Mekanik & Hutang, Pengaturan
- [ ] **Admin pages** — Dashboard, Kas Kecil
- [ ] **Mechanic pages** — Work Order detail, Upload Struk (Supabase Storage), Piutang Saya
- [ ] Supabase Storage bucket `receipts` (setup manual di dashboard)
- [ ] Registrasi tenant baru (oleh Super Admin, bukan self-service)

---

## Cara Membuat User Baru

### Via SQL (Supabase SQL Editor)
```sql
-- 1. Buat auth user (trigger akan auto-create profile)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
  'authenticated', 'authenticated', 'email@contoh.com',
  crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Nama User","role":"owner","tenant_id":"<uuid-tenant>"}',
  FALSE, '', '', '', ''
);

-- 2. Untuk super_admin (tenant_id = NULL):
-- raw_user_meta_data: '{"full_name":"Nama","role":"super_admin"}'
-- Lalu UPDATE profiles SET tenant_id = NULL WHERE id = '<user-id>';
```

### Via Supabase Dashboard
Authentication → Users → Add User → set email & password  
Lalu update `public.profiles` via Table Editor atau SQL.

---

## Environment Variables (Vercel & .env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://nmggvtewovganrwcbpzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Kedua variable harus di-set di Vercel untuk **Production**, **Preview**, dan **Development**.
