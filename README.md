# Katalara POS — B2B SaaS Workshop & POS Management

Platform manajemen bengkel multi-tenant berbasis web. Dibangun dengan Next.js 15 App Router, Supabase, TypeScript, dan Tailwind CSS.

**Live URL:** https://katalara-pos.vercel.app  
**GitHub:** https://github.com/katalaraofficial-cpu/Platform  
**Supabase Project:** https://nmggvtewovganrwcbpzk.supabase.co  
**Branch aktif:** `main`  
**Last updated:** 24 Mei 2026 — commit `17b1303`

> Untuk konteks lengkap (AI agent briefing, keputusan teknis, status modul, known issues): lihat [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)

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
- [x] Database schema lengkap + RLS policies (`001_schema.sql`, `002_rls_policies.sql`)
- [x] Supabase clients (browser, server, middleware, admin/service-role)
- [x] TypeScript types semua tabel (`src/types/database.ts`)
- [x] Middleware RBAC — route protection + role-based redirect
- [x] Login page + Error page
- [x] Auth callback route (PKCE code, token_hash, hash fragment fallback)
- [x] Auth exchange page — manual `setSession()` dari hash fragment invite link
- [x] Set-password page — invited user buat password pertama
- [x] Deploy ke Vercel

**Super Admin**
- [x] Super Admin dashboard
- [x] Daftar semua tenant
- [x] Detail tenant (info + daftar user)
- [x] Buat tenant baru
- [x] Edit tenant (nama, status aktif, feature toggles)
- [x] Registrasi bengkel baru (form publik `/register`)
- [x] Approval/reject pendaftaran tenant
- [x] Invite user ke tenant via email (Resend API, `katalara.com`)
- [x] Copy-link fallback jika email gagal
- [x] User table dengan checkbox, bulk delete, pagination

**Owner — Modul Invoice**
- [x] Running Invoice — list halaman dengan filter tab status
- [x] Buat invoice baru (draft) + pilih/buat customer baru langsung dari form
- [x] Invoice detail / edit (unified InvoiceEditor component)
- [x] Tambah item: service, part_internal, part_external
- [x] Part Ext/Int dengan H.Jual = 0 (harga belum diketahui saat entry)
- [x] Toggle margin profit % → auto-hitung H.Jual dari H.Beli
- [x] Badge "Set Harga" di item tabel jika H.Jual belum diisi (klik untuk edit)
- [x] Assign mekanik ke invoice (lead / helper, hapus assignment)
- [x] Transisi status invoice (draft → in_progress → completed → paid / cancelled)
- [x] Quick add customer dengan field nama, telepon, alamat
- [x] Tanggal invoice editable saat buat baru
- [x] Simpan draft invoice tanpa perlu ada item dulu

**Admin — Modul Invoice**
- [x] Semua fitur invoice Owner (shared via `InvoiceEditor` component)
- [x] Buat invoice baru
- [x] Invoice detail / edit termasuk assign mekanik

**UI/UX**
- [x] Sidebar collapsible (desktop)
- [x] Mobile bottom nav (mekanik)
- [x] Shared layout per role (sidebar + konten)

---

### ⚠️ Perlu Tindakan Manual — Migrasi Database

Jalankan secara berurutan di **Supabase SQL Editor** (semua pakai `IF NOT EXISTS`, aman dijalankan ulang):

| File | Status | Isi |
|------|--------|-----|
| `001_schema.sql` | ✅ Sudah | Schema utama |
| `002_rls_policies.sql` | ✅ Sudah | RLS semua tabel |
| `003_tenant_requests.sql` | ❓ Cek | Tabel pendaftaran bengkel baru |
| `004_invoice_tax.sql` | ❓ Cek | Kolom PPN/PPh di `invoices` |
| `005_invoice_discount.sql` | ❓ Cek | Kolom `discount_amount` di `invoices` |
| `006_invoice_payment.sql` | ❓ Cek | Kolom `payment_method` di `invoices` |

---

### 🔄 Diketahui Belum Berfungsi / Halaman Kosong
- [ ] Owner: Pelanggan, Mekanik & Hutang, Kas Kecil, Pengaturan — halaman ada tapi konten placeholder
- [ ] Owner: Dashboard — belum ada data summary nyata
- [ ] Owner: Kas & Keuangan — halaman ada, konten belum
- [ ] Admin: Dashboard — placeholder
- [ ] Mechanic: semua halaman — layout ada, konten belum

### ⬜ Sprint Berikutnya
- [ ] Invoice list: text search + pagination
- [ ] Partial payment: migration 007 (`amount_paid`, tabel `invoice_payments`)
- [ ] Modul Kas (`/owner/kas`): ledger KPI + tabel transaksi
- [ ] Owner Dashboard: data summary nyata (pendapatan, invoice aktif, dll)
- [ ] Pelanggan: CRUD data pelanggan
- [ ] Cetak / export invoice PDF
- [ ] Admin: Dashboard kas kecil
- [ ] Mechanic: Work order detail, upload struk (Supabase Storage)

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
supabase/migrations/001_schema.sql          ← Sudah dijalankan
supabase/migrations/002_rls_policies.sql    ← Sudah dijalankan
supabase/migrations/003_tenant_requests.sql ← Jalankan jika belum
supabase/migrations/004_invoice_tax.sql     ← Jalankan jika belum
supabase/migrations/005_invoice_discount.sql← Jalankan jika belum
supabase/migrations/006_invoice_payment.sql ← Jalankan jika belum
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
