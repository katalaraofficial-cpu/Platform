# Katalara POS — Project Context untuk AI Agent

> **Baca file ini dulu sebelum mulai coding.** Ini adalah briefing lengkap tentang platform, keputusan teknis yang sudah dibuat, status setiap modul, dan hal-hal yang tidak boleh diubah tanpa alasan kuat.
>
> **Last updated:** 24 Mei 2026 — commit `17b1303`

---

## 1. Identitas Platform

| | |
|---|---|
| **Nama** | Katalara POS |
| **Live URL** | https://katalara-pos.vercel.app |
| **GitHub** | https://github.com/katalaraofficial-cpu/Platform (branch: `main`) |
| **Supabase** | https://nmggvtewovganrwcbpzk.supabase.co |
| **Deskripsi** | B2B SaaS multi-tenant untuk manajemen bengkel (workshop). Super admin onboard bengkel, lalu setiap bengkel punya owner/admin/mekanik. |

---

## 2. Tech Stack (Jangan Ganti Tanpa Diskusi)

| Layer | Pilihan | Catatan |
|-------|---------|---------|
| Framework | **Next.js 15.5** App Router | TypeScript, `src/` dir, `@/*` alias |
| Auth + DB | **Supabase** | PostgreSQL + Auth + RLS |
| SSR Auth | **@supabase/ssr ^0.6.1** | PKCE flow default |
| Styling | **Tailwind CSS v3.4** | Tidak pakai shadcn/ui component, pakai class langsung |
| Icons | **lucide-react** | Sudah terpasang |
| Email | **Resend REST API** | Domain `katalara.com` sudah verifikasi, `noreply@katalara.com` |
| Deploy | **Vercel** | Auto-deploy dari branch `main` |
| React | **React 19** | |

---

## 3. Environment Variables (Semua Wajib Ada di Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=https://nmggvtewovganrwcbpzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=https://katalara-pos.vercel.app
RESEND_API_KEY=<resend-api-key>   ← key dari akun Resend yang punya domain katalara.com
```

---

## 4. Arsitektur & RBAC

### Role → Route → Dashboard

```
super_admin  →  /super-admin/dashboard   Platform owner, kelola semua tenant
owner        →  /owner/dashboard         Pemilik bengkel, full access ke tenant sendiri
admin        →  /admin/dashboard         Kasir, operasional harian
mechanic     →  /mechanic/dashboard      Mekanik, mobile-first
```

### Isolasi Tenant

- Setiap tabel memiliki `tenant_id` dan di-filter via Supabase RLS
- Helper `get_my_tenant_id()` dipakai di semua RLS policy
- `super_admin` memiliki `tenant_id = NULL` dan bypass semua tenant check
- `profiles.role` adalah source of truth RBAC (bukan JWT claims langsung)

### Middleware (`src/middleware.ts`)

- Refresh session cookie setiap request
- Cek `profiles.role` dari DB (bukan dari JWT supaya tidak bisa dimanipulasi)
- Redirect ke login jika unauthenticated
- Redirect ke role-home jika akses route yang tidak sesuai role
- `PUBLIC_PATHS`: `/`, `/login`, `/error`, `/register`, `/auth/callback`, `/auth/set-password`, `/auth/exchange`
- `AUTH_FLOW_PATHS`: `/auth/callback`, `/auth/set-password`, `/auth/exchange` — user yang sudah login pun boleh akses (untuk flow invite/reset)

---

## 5. Struktur Folder

```
src/
├── app/
│   ├── (auth)/login/              Halaman login
│   ├── (auth)/error/              Halaman error auth
│   ├── (super-admin)/
│   │   ├── layout.tsx             Layout super admin (sidebar)
│   │   └── super-admin/
│   │       ├── dashboard/page.tsx
│   │       ├── tenants/
│   │       │   ├── page.tsx       Daftar semua tenant
│   │       │   ├── new/page.tsx   Buat tenant baru
│   │       │   └── [id]/page.tsx  Detail tenant + user list
│   │       ├── registrations/page.tsx  Approval pendaftaran
│   │       └── settings/page.tsx
│   ├── (owner)/
│   │   ├── layout.tsx
│   │   └── owner/
│   │       ├── dashboard/page.tsx
│   │       └── invoices/
│   │           ├── page.tsx       List invoice
│   │           ├── new/page.tsx   Buat invoice baru
│   │           └── [id]/page.tsx  Detail/edit invoice
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       └── invoices/
│   │           ├── page.tsx       List invoice
│   │           ├── new/page.tsx   Buat invoice baru
│   │           └── [id]/page.tsx  Detail/edit invoice
│   ├── (mechanic)/
│   │   ├── layout.tsx
│   │   └── mechanic/...
│   ├── auth/
│   │   ├── callback/route.ts      Server: proses PKCE code / token_hash / fallback ke exchange
│   │   ├── exchange/page.tsx      Client: parse hash fragment, setSession(), redirect
│   │   └── set-password/page.tsx  Client: form set password untuk user yang baru diundang
│   ├── register/page.tsx          Pendaftaran bengkel baru (public)
│   ├── layout.tsx                 Root layout
│   └── page.tsx                   Landing page
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx            Collapsible sidebar (Client Component)
│   │   ├── mobile-bottom-nav.tsx  Bottom nav mekanik
│   │   └── types.ts               NavItem type
│   ├── invoices/
│   │   ├── invoice-editor.tsx     ★ Unified create+edit editor (Client Component, owner+admin)
│   │   ├── invoice-filters.tsx
│   │   ├── print-button.tsx
│   │   └── status-badge.tsx
│   └── super-admin/
│       ├── add-user-form.tsx      Modal invite user (PENTING: useActionState di sub-komponen ModalContent)
│       ├── registration-actions.tsx
│       ├── tenant-detail-forms.tsx
│       └── tenant-user-table.tsx  Tabel user dengan checkbox, bulk delete, pagination
├── lib/
│   ├── supabase/
│   │   ├── client.ts              createBrowserClient — gunakan di Client Components
│   │   ├── server.ts              createServerClient — gunakan di Server Components & Actions
│   │   ├── middleware.ts          createServerClient — gunakan di middleware.ts SAJA
│   │   └── admin.ts               createAdminClient (service_role) — HANYA untuk Server Actions
│   ├── actions/
│   │   ├── auth.ts                signOut action
│   │   ├── invoice.ts             CRUD invoice actions (addItemToInvoice, updateInvoiceItem, dll)
│   │   ├── register.ts            Pendaftaran tenant baru
│   │   └── tenant.ts              Super admin: CRUD tenant, invite user
│   ├── get-user-context.ts        Server helper: ambil user + profile + tenant sekaligus
│   └── utils.ts
├── middleware.ts
└── types/
    └── database.ts                TypeScript types semua tabel + Database interface
supabase/migrations/
├── 001_schema.sql                 ✅ Sudah dijalankan — Schema utama
├── 002_rls_policies.sql           ✅ Sudah dijalankan — RLS semua tabel
├── 003_tenant_requests.sql        ❓ Cek — Tabel pendaftaran bengkel baru
├── 004_invoice_tax.sql            ❓ Cek — Kolom PPN/PPh di invoices
├── 005_invoice_discount.sql       ❓ Cek — Kolom discount_amount di invoices
└── 006_invoice_payment.sql        ❓ Cek — Kolom payment_method di invoices
```

---

## 6. Auth Flow Lengkap

### Login Biasa
```
/login → POST Supabase Auth → session cookie → middleware cek role → redirect ke role-home
```

### Invite User (Super Admin → User Baru)
```
1. Super Admin isi form di /super-admin/tenants/[id]
2. Server Action addUserToTenant():
   - adminClient.auth.admin.generateLink({ type: 'invite', ... })
   - metadata: { full_name, role, tenant_id }
   - redirectTo: https://katalara-pos.vercel.app/auth/callback?next=/auth/set-password
   - sendInviteEmail() via Resend REST API (from: noreply@katalara.com)
3. User klik link di email → Supabase redirect ke:
   https://katalara-pos.vercel.app/auth/callback?next=/auth/set-password#access_token=...&refresh_token=...
4. /auth/callback/route.ts:
   - Jika ada ?code= → exchangeCodeForSession (PKCE)
   - Jika ada ?token_hash= → verifyOtp
   - Jika tidak ada keduanya → redirect ke /auth/exchange?next=... (hash fragment)
5. /auth/exchange/page.tsx (Client Component):
   - Parse window.location.hash manual (karena @supabase/ssr tidak auto-proses hash)
   - Ambil access_token + refresh_token dari hash
   - supabase.auth.setSession({ access_token, refresh_token })
   - Redirect ke next (/auth/set-password)
6. /auth/set-password/page.tsx:
   - User set password baru
   - Fetch profile → cek role → redirect ke role dashboard
```

### Kenapa Ada `/auth/exchange`?
`@supabase/ssr` menggunakan PKCE flow secara default dan **tidak otomatis memproses hash fragment** (`#access_token=...`). Invite links Supabase menggunakan implicit flow (hash fragment). Solusi: halaman client-side yang parse hash manual dan panggil `setSession()`.

---

## 7. Database Schema Ringkasan

### Tabel Utama
| Tabel | Keterangan |
|-------|------------|
| `tenants` | Satu row per bengkel. `feature_toggles` JSONB kontrol modul aktif. `status`: active/inactive/suspended |
| `profiles` | 1-to-1 dengan `auth.users`. `tenant_id = NULL` untuk super_admin. Auto-create via trigger `handle_new_user()` |
| `settings` | Konfigurasi per tenant (markup default, dll). Auto-create via trigger |
| `customers` | Data pelanggan per tenant |
| `invoices` | Invoice utama. `status`: draft→in_progress→completed→paid→cancelled |
| `invoice_items` | Item per invoice: service / part_internal / part_external |
| `invoice_mechanics` | Mekanik yang terlibat per invoice (lead/helper) |
| `mechanic_debt_ledger` | Hutang mekanik (bayar part pakai uang sendiri) |
| `ledger` | Kas utama. Owner only — Admin & Mechanic zero access |
| `petty_cash_transactions` | Kas kecil Admin. Terpisah dari ledger utama |
| `tenant_requests` | Pendaftaran bengkel baru dari form publik. Status: pending/approved/rejected. **Membutuhkan migration 003** |

### Trigger Penting
- `handle_new_user()` — otomatis buat row `profiles` saat user baru dibuat di `auth.users`. Membutuhkan `role` dan `tenant_id` di `raw_user_meta_data`.

### Helper Functions (SECURITY DEFINER)
- `get_my_tenant_id()` — tenant_id user login
- `get_my_role()` — role user login
- `is_super_admin()` — boolean

---

## 8. Status Modul per Role

### Super Admin ✅ Fungsional
| Halaman | Status | Catatan |
|---------|--------|---------|
| Dashboard | ✅ Jalan | Summary placeholder |
| Daftar Tenant | ✅ Jalan | CRUD lengkap |
| Detail Tenant | ✅ Jalan | Edit info + user management |
| Buat Tenant Baru | ✅ Jalan | |
| Registrasi Approval | ✅ Jalan | Butuh migration 003 untuk data |
| Invite User | ✅ Jalan | Email + copy link fallback |
| Pengaturan | ⚠️ Placeholder | Belum ada konten |

### Owner ✅ Invoice Fungsional
| Halaman | Status | Catatan |
|---------|--------|---------|
| Dashboard | ⚠️ Placeholder | Belum ada summary data nyata |
| Invoice — List | ✅ Jalan | Filter tab status |
| Invoice — Buat Baru | ✅ Jalan | Pilih/buat customer, tanggal editable, simpan tanpa item |
| Invoice — Detail/Edit | ✅ Jalan | Items (Part Ext/Int dengan H.Jual opsional), mekanik, status transitions |
| Kas & Keuangan | ⚠️ Placeholder | Halaman ada, konten belum |
| Pelanggan | ⚠️ Placeholder | |
| Mekanik & Hutang | ⚠️ Placeholder | |
| Kas Kecil | ⚠️ Placeholder | |
| Pengaturan | ⚠️ Placeholder | |

### Admin ✅ Invoice Fungsional
| Halaman | Status | Catatan |
|---------|--------|---------|
| Dashboard | ⚠️ Placeholder | |
| Invoice — List | ✅ Jalan | Sama dengan Owner |
| Invoice — Buat Baru | ✅ Jalan | Shared via `InvoiceEditor` component |
| Invoice — Detail/Edit | ✅ Jalan | Shared via `InvoiceEditor` component |

### Mechanic ❌ Belum Ada Konten
Layout ada, semua halaman placeholder.

---

## 9. Aturan Coding yang Wajib Diikuti

### React 19 RSC Rule
**JANGAN** pass React component function sebagai prop dari Server Component ke Client Component.
```typescript
// ❌ SALAH — function tidak serializable
icon: LayoutDashboard

// ✅ BENAR — ReactNode serializable
icon: <LayoutDashboard className="h-4 w-4" />
```

### Supabase Client — Pakai yang Tepat
```typescript
// Client Component
import { createClient } from "@/lib/supabase/client";

// Server Component / Server Action
import { createClient } from "@/lib/supabase/server";

// Server Action yang butuh bypass RLS (admin only)
import { createAdminClient } from "@/lib/supabase/admin";

// JANGAN pakai admin client di Client Component
```

### Server Actions
File dengan `"use server"` harus ada di baris **pertama file**, bukan di dalam function body. Ini syarat Next.js 15 saat di-import dari Client Component.

### useActionState di Modal
Jika `useActionState` dipakai dalam komponen modal, **pindahkan hook ke sub-komponen** yang hanya di-mount saat modal terbuka. Ini mencegah state dari aksi sebelumnya tetap tersimpan saat modal dibuka lagi.

Contoh pattern yang sudah diterapkan di `add-user-form.tsx`:
```typescript
// Parent: hanya kelola state open/close
export function AddUserForm({ tenantId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Tambah</button>
      {open && <ModalContent tenantId={tenantId} onClose={() => setOpen(false)} />}
    </>
  );
}

// Sub-komponen: punya useActionState sendiri, reset otomatis saat unmount
function ModalContent({ tenantId, onClose }) {
  const [state, formAction, pending] = useActionState(myAction, {});
  // ...
}
```

### Route Groups
Folder `(auth)`, `(owner)`, dll **tidak menambah prefix ke URL**.
`src/app/(owner)/owner/dashboard/page.tsx` → URL: `/owner/dashboard`

---

## 10. Known Issues & Fixes yang Sudah Diterapkan

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| "Akses Ditolak" saat klik invite link | Middleware redirect user authenticated dari `/auth/set-password` | `AUTH_FLOW_PATHS` exemption di middleware |
| Invite link tidak diproses | `@supabase/ssr` tidak auto-parse hash fragment | `/auth/exchange` page dengan manual `setSession()` |
| Email tidak terkirim (diam-diam) | `RESEND_API_KEY` tidak di-set di Vercel + `.catch(()=>{})` | Return boolean dari `sendInviteEmail()`, tampilkan status di UI |
| Email sender ditolak | `onboarding@resend.dev` hanya bisa kirim ke email terverifikasi | Ganti ke `noreply@katalara.com` (domain sudah verifikasi di Resend) |
| Modal tambah user langsung tampil sukses | `useActionState` di parent component, state persist saat modal dibuka ulang | Pindah `useActionState` ke `ModalContent` sub-component |
| Build error: useSearchParams Suspense | Next.js 15 wajib Suspense untuk `useSearchParams` | Wrap `AuthExchangeInner` dalam `<Suspense>` |
| TypeScript error: Supabase join `profiles` di `invoice_mechanics` | Generated types tidak mengenali relasi via `mechanic_id` | Fetch profiles terpisah, build lookup map secara manual |
| "Simpan Invoice" tetap disabled setelah pilih customer | `disabled` prop masih cek `items.length === 0` | Hapus kondisi `items.length === 0` dari disabled |
| Part Ext tidak bisa ditambah tanpa H.Jual | Validasi `itemSellPrice <= 0` berlaku untuk semua tipe | Validasi H.Jual hanya untuk `itemType === "service"` |
| Inline edit part tidak simpan H.Jual ke DB | `saveEditRow` kirim `unitPrice` (buy), bukan sell price | Tambah parameter `sellPrice` opsional ke `updateInvoiceItem` |

---

## 11. Hal yang Masih Perlu Dilakukan

### Segera (Perlu Dicek)
1. **Jalankan migration 003–006** di Supabase SQL Editor jika belum — semua pakai `IF NOT EXISTS`, aman:
   ```
   supabase/migrations/003_tenant_requests.sql
   supabase/migrations/004_invoice_tax.sql
   supabase/migrations/005_invoice_discount.sql
   supabase/migrations/006_invoice_payment.sql
   ```

### Sprint 1 (Backlog Berikutnya)
2. **Invoice list: search + pagination** — saat ini belum ada filter teks atau paging
3. **Partial payment (migration 007)** — kolom `amount_paid NUMERIC DEFAULT 0` + tabel `invoice_payments`
4. **Modul Kas (`/owner/kas`)** — ledger KPI + tabel transaksi kas utama

### Prioritas Tinggi
5. **Owner Dashboard** — summary data nyata: total invoice, pendapatan bulan ini, invoice aktif
6. **Pelanggan** — CRUD data pelanggan per tenant
7. **Kas & Keuangan** — ledger view untuk owner

### Prioritas Sedang
8. **Admin module** — dashboard kas kecil
9. **Mechanic module** — work order detail, upload struk (Supabase Storage)
10. **Cetak / export invoice PDF**

### Infrastruktur
11. **Supabase Storage bucket `receipts`** — setup manual di Supabase dashboard, untuk upload struk mekanik

---

## 12. Cara Menjalankan Lokal

```bash
# Install dependencies
npm install

# Copy env
cp .env.local.example .env.local
# Isi nilai di .env.local

# Jalankan dev server
npm run dev
# → http://localhost:3000
```

---

## 13. Git Workflow

- Branch aktif: `main`
- Auto-deploy ke Vercel setiap push ke `main`
- Tidak ada staging branch saat ini — push langsung ke production
