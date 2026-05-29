# Katalara POS — Project Context untuk AI Agent

> **Baca file ini dulu sebelum mulai coding.** Ini adalah briefing lengkap tentang platform, keputusan teknis yang sudah dibuat, status setiap modul, dan hal-hal yang tidak boleh diubah tanpa alasan kuat.
>
> **Last updated:** 29 Mei 2026 — sync setelah commit `1fd746d`

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

## Update Cepat (Mei 2026)

- Build log terbaru: lihat `docs/DEVELOPMENT_PROGRESS.md`
- Kerangka operasional agent: lihat `docs/AI_AGENT_FRAMEWORK.md`
- Rencana mobile + PWA rollout: lihat `docs/MOBILE_PWA_ROLLOUT.md`

### Mobile UX — Update Terbaru (27 Mei 2026)
- Owner mobile bottom nav (`src/components/layout/owner-mobile-nav.tsx`):
  - 5-slot bar: Menu (drawer) | Dashboard | FAB Invoice | Kas | Pengaturan
  - FAB: `rounded-full` di tengah, link ke `/owner/invoices/new`
  - Drawer: slide-up sheet, semua nav items, tombol logout
- Invoice list owner + admin: card view di mobile, tabel di desktop (`md:hidden` / `hidden md:block`)
- Invoice editor (`src/components/invoices/invoice-editor.tsx`) — mobile refactor penuh:
  - Field strip header: grid 1-kolom di mobile, semua input full-width
  - Toggle Jasa/Barang: `flex-1` supaya rata tengah
  - Form tambah item: grid 2-kolom di mobile (full-width inputs)
  - Daftar item: card list di mobile (bukan tabel), tabel tetap di desktop
  - Panel totals: collapsible rincian biaya (PPN/PPh/Diskon/Kirim) di mobile
  - Sticky save bar: fixed bar di atas bottom nav, tampilkan Grand Total + Reset + Simpan
  - Left panel: `overflow-y-auto` di mobile supaya form Barang (lebih banyak field) bisa di-scroll

### Update HR Point Claim (28 Mei 2026)
- Fase 2 klaim point sudah terpasang:
  - Mechanic submit klaim via tab Point (`pending`)
  - Owner review klaim dari halaman Engineer (`approve` / `reject`)
  - Approval memotong saldo point, membuat transaksi `employee_point_transactions` (redeem), dan mencatat `ledger` `kas_keluar`
- Migration baru: `026_point_redemption_requests.sql`

### Update Stabilitas Point & Complaint (29 Mei 2026)
- Rollback invoice sekarang mengembalikan point mekanik berbasis net transaksi per invoice (`earn` + `adjust`), sehingga point card sinkron setelah status diturunkan.
- Sinkron point owner kini invoice-aware: histori invoice yang tidak lagi `paid` akan dibatalkan saat sinkronisasi, lalu saldo dibangun ulang secara konsisten.
- Ringkasan point mechanic/owner memakai kalkulasi yang stabil terhadap urutan transaksi (menghindari mismatch saldo 0 vs total earned masih tinggi).
- Complaint badge di owner invoice list sudah complaint-aware (`Komplain` untuk completed dengan complaint aktif).
- Migration complaint assignment: `027_invoice_mechanics_complaint.sql`.

### Update User Management Owner (29 Mei 2026)
- Owner kini dapat menghapus akun admin/engineer dari tenant sendiri melalui menu owner users.
- Guard tambahan:
  - owner tidak dapat menghapus akun owner lain lewat menu ini,
  - owner tidak dapat menghapus akun dirinya sendiri,
  - aksi dibatasi tenant sendiri.

### Update PWA Mobile Install (29 Mei 2026)
- PWA install support aktif di production build:
  - manifest (`/manifest.webmanifest`),
  - icon routes (`/icon-192`, `/icon-512`, `/icon-512-maskable`, `/apple-icon`),
  - service worker (`/sw.js`) via `next-pwa`.
- Aplikasi kini dapat di-*Add to Home Screen* pada Android/iOS (bergantung browser support).

### Update Navigasi & Modul Owner/Mechanic (29 Mei 2026)
- Menu owner `Pelanggan` sudah memiliki halaman dasar aktif di `/owner/customers` (KPI + pie lokasi + tabel pelanggan).
- Dashboard mechanic disiapkan dengan 4 tab: Log Aktivitas, Kehadiran, Insentif, Payroll (attendance/payroll masih scaffold, belum sinkron data).

### Update Settings & Print (sebelumnya)
- field di tab Nota & Printer (judul nota, jabatan, toggle watermark)
- output print mengikuti `nota_active_format` dan settings yang disimpan
- penyesuaian template A4/A5/thermal + watermark LUNAS
- Migration terkait: `023`, `024`, `025`

### Update Stabilisasi & Performa (sebelumnya)
- perbaikan save pajak (toggle PPh/PPN)
- sinkronisasi state form Nota & Printer
- fallback metadata nota bila kolom modern belum sinkron
- query payload owner dipangkas
- query KPI + tabel kas diparalelkan
- prefetch route owner dari sidebar dan mobile bottom nav
- fix TypeScript narrowing pada sidebar (Vercel build)

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
├── 003_tenant_requests.sql        ✅ Sudah dijalankan — Tabel pendaftaran bengkel baru
├── 004_invoice_tax.sql            ✅ Sudah dijalankan — Kolom PPN/PPh di invoices
├── 005_invoice_discount.sql       ✅ Sudah dijalankan — Kolom discount_amount di invoices
├── 006_invoice_payment.sql        ✅ Sudah dijalankan — Kolom payment_method di invoices
├── 007_mechanic_status_update.sql ✅ Sudah dijalankan — RLS policy mekanik update invoice status
├── 008_mechanic_debt_is_paid.sql  ✅ Sudah dijalankan — Kolom is_paid di mechanic_debt_ledger
├── 009_fix_mechanic_rls.sql       ✅ Sudah dijalankan — Fix RLS mekanik baca invoice
├── 010_fix_invoice_mechanic_policy.sql ✅ Sudah dijalankan — Fix RLS invoice_mechanics
├── 011_mechanic_item_permissions.sql ⚠️ Belum dijalankan — Izin mekanik tambah item
├── 012_storage_receipt_bucket.sql ⚠️ Belum dijalankan — Storage bucket struk mekanik
├── 013_mechanic_debt_insert.sql   ⚠️ Belum dijalankan — RLS insert mechanic_debt_ledger
├── 014_ledger_account_type.sql    ⚠️ Belum dijalankan — Kolom account_type di ledger
└── 015_admin_reimburse_policy.sql ⚠️ Belum dijalankan — RLS admin reimburse mechanic debt
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

### Owner ✅ Sebagian Besar Fungsional
| Halaman | Status | Catatan |
|---------|--------|---------|
| Dashboard | ✅ Jalan | KPI: Omzet bulan ini, Outstanding, Piutang Mekanik; donut chart Jasa/Barang; bar chart 6 bulan |
| Invoice — List | ✅ Jalan | Filter tab status + row actions (detail, cetak, rollback, hapus) |
| Invoice — Buat Baru | ✅ Jalan | Pilih/buat customer, tanggal editable, simpan tanpa item |
| Invoice — Detail/Edit | ✅ Jalan | Items, mekanik, status transitions, PPN/PPh, diskon, payment |
| Invoice — Print | ✅ Jalan | Modal pilih ukuran (Thermal/A5/A4), QR + cetak |
| Mekanik & Hutang | ✅ Jalan | Daftar mekanik, riwayat hutang, FIFO paid status, reimburse, hapus+undo |
| Kas & Keuangan | ⚠️ Placeholder | Halaman ada, konten belum |
| Pelanggan | ✅ Jalan (versi dasar) | Halaman `/owner/customers`: KPI omzet terbanyak, pie lokasi, tabel pelanggan |
| Kas Kecil | ⚠️ Placeholder | |
| Pengaturan | ✅ Jalan | Termasuk sinkron ulang point engineer berbasis histori invoice-aware |

### Admin ✅ Invoice + Dashboard Fungsional
| Halaman | Status | Catatan |
|---------|--------|---------|
| Dashboard | ✅ Jalan | KPI: Pemasukan Hari Ini, Perlu Dilunasi, Sedang Dikerjakan, Invoice Bulan Ini |
| Invoice — List | ✅ Jalan | Sama dengan Owner, row actions lengkap |
| Invoice — Buat Baru | ✅ Jalan | Shared via `InvoiceEditor` component |
| Invoice — Detail/Edit | ✅ Jalan | Shared via `InvoiceEditor`, termasuk konfirmasi pembayaran custom |
| Engineer (Mekanik) | ✅ Jalan | Daftar mekanik yang ditugaskan ke invoice |

### Mechanic ✅ Sebagian Besar Fungsional
| Halaman | Status | Catatan |
|---------|--------|---------|
| Dashboard | ✅ Jalan | Daftar work order aktif + history + point tab (claim, status, history) |
| Work Order Detail | ✅ Jalan | Tombol Mulai / Selesai Dikerjakan, update status via admin client |
| Hutang Saya | ✅ Jalan | Daftar hutang, FIFO paid status, upload struk |
| Upload Struk | ✅ Jalan | Upload ke Supabase Storage bucket `receipts` |

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
| Badge "Belum Dibayar" mekanik selalu salah | `is_paid` tidak pernah di-update saat reimburse | Hitung FIFO dari `v_mechanic_debt_summary.total_reimbursed` |
| Delete hutang hilang setelah refresh | `setTimeout` 5 detik — component unmount saat refresh, timer dibatal | Immediate delete di server, "Undo" re-insert via `restoreDebtEntries` |
| Dashboard Piutang Mekanik tidak akurat | Sum `is_paid = false` — flag tidak pernah di-set | Gunakan `v_mechanic_debt_summary.outstanding_balance` |
| Donut chart Jasa/Barang tidak tampil breakdown | Hanya fetch `item_type`, tidak fetch nama item | Fetch `description` juga, group by nama saat filter jasa/barang |
| Mekanik "Selesai Dikerjakan" tidak update status | RLS silently block UPDATE `invoices` untuk role mechanic | Gunakan admin client (service role) dengan manual security check |
| Router cache setelah mark complete | `router.push()` serve cached page | Ganti ke `window.location.href` untuk hard navigation |
| Native browser `confirm()` dialog | Pakai `window.confirm()` langsung | Ganti dengan komponen `ConfirmDialog` custom di semua 5 lokasi |

---

## 11. Hal yang Masih Perlu Dilakukan

### Segera — Jalankan Migrasi Pending di Supabase SQL Editor
Migrasi 011–015 **belum dijalankan**. Jalankan secara berurutan:
```
supabase/migrations/011_mechanic_item_permissions.sql
supabase/migrations/012_storage_receipt_bucket.sql
supabase/migrations/013_mechanic_debt_insert.sql
supabase/migrations/014_ledger_account_type.sql
supabase/migrations/015_admin_reimburse_policy.sql
```

### Prioritas Tinggi
1. **Modul Kas Owner (`/owner/kas`)** — ledger transaksi kas utama: KPI pemasukan/pengeluaran, tabel transaksi, tambah manual
2. **Pelanggan** — CRUD data pelanggan per tenant (`/owner/customers`, `/admin/customers`)
3. **Invoice list: search + pagination** — saat ini hanya filter tab status, belum ada teks search atau paging

### Prioritas Sedang
4. **Admin: Kas Kecil (`/admin/petty-cash`)** — petty cash ledger khusus kasir
5. **Owner: Pengaturan** — markup default, nama bengkel, logo, dll
6. **Cetak invoice** — sudah ada modal print, perlu polishing layout thermal/A5/A4
7. **Notifikasi / alert** — invoice overdue, hutang mekanik tinggi

### Prioritas Rendah
8. **Owner: Laporan** — export PDF/Excel, ringkasan bulanan
9. **Super Admin: Dashboard** — summary platform (total tenant aktif, revenue, dll)

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
