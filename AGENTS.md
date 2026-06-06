# AGENTS.md — Katalara POS

> Konteks standar untuk AI coding agent (Devin, Cursor, Copilot, Claude, dll).
> File ini adalah **pintu masuk tunggal** yang menstandarkan konteks agent di repo ini
> mengikuti konvensi terbuka [agents.md](https://agents.md). Baca file ini lebih dulu,
> lalu rujuk dokumen detail di bawah saat dibutuhkan.

Platform manajemen bengkel multi-tenant berbasis **Next.js (App Router) + Supabase**.

- **Live URL:** https://katalara-pos.vercel.app
- **Repo:** https://github.com/katalaraofficial-cpu/Platform
- **Branch aktif:** `main`

## Dokumen Konteks Tertaut

| Dokumen | Isi |
|---|---|
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Peta modul, skema data, dan constraints lengkap |
| [docs/AI_AGENT_FRAMEWORK.md](docs/AI_AGENT_FRAMEWORK.md) | Pakem kerja, guardrail produksi, dan checklist agent |
| [docs/DEVELOPMENT_PROGRESS.md](docs/DEVELOPMENT_PROGRESS.md) | Log progres build & histori commit |
| [docs/MOBILE_PWA_ROLLOUT.md](docs/MOBILE_PWA_ROLLOUT.md) | Rencana mobile / PWA |

## Setup

```bash
npm install
cp .env.local.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                         # http://localhost:3000
```

Variabel environment wajib (lihat `.env.local.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Perintah Penting

| Tujuan | Perintah |
|---|---|
| Dev server | `npm run dev` |
| Build produksi | `npm run build` |
| Start produksi | `npm run start` |
| Lint | `npm run lint` |
| Typecheck (wajib clean sebelum commit) | `npx tsc --noEmit` |

## Peta Area Kode Kritis

- **Routes:** `src/app/(super-admin)`, `src/app/(owner)`, `src/app/(admin)`, `src/app/(mechanic)`, `src/app/(print)`, `src/app/(auth)`
- **Server Actions:** `src/lib/actions/*`
- **Context auth-role-tenant:** `src/lib/get-user-context.ts`
- **Supabase clients:** browser `src/lib/supabase/client.ts`, server `src/lib/supabase/server.ts`, admin/service-role `src/lib/supabase/admin.ts`
- **DB types:** `src/types/database.ts`
- **Migrations:** `supabase/migrations/*.sql`
- **RBAC middleware:** `src/middleware.ts`

## Pakem Wajib (Ringkas)

Aturan penuh + latar insiden ada di [docs/AI_AGENT_FRAMEWORK.md](docs/AI_AGENT_FRAMEWORK.md). Inti yang tidak boleh dilanggar:

1. Jangan ubah alur RBAC di `src/middleware.ts` tanpa kebutuhan jelas.
2. Setiap perubahan schema harus sinkron di **4 titik**: SQL migration → `src/types/database.ts` → server action terkait → UI/form terkait.
3. **Tanggal bisnis vs sistem:** setiap insert ke ledger wajib mengisi `transaction_date` dari sumber tanggal bisnis (`paymentDate`, dst), jangan andalkan default. Laporan/dashboard filter pakai kolom bisnis (`transaction_date`/`invoice_date`), bukan `created_at`.
4. **Nomor invoice:** baca nomor terakhir via `order("invoice_number", { ascending: false })` (jangan `count`), bungkus insert dengan retry yang mengenali Postgres `23505`.
5. **Point mekanik:** konsistenkan `processPayment()` (earn) dan `rollbackInvoiceStatus()` (reverse). Rollback harus net per invoice (idempotent); ringkasan saldo/earned/redeemed harus order-agnostic.
6. **Klaim non-invoice:** `submitMechanicReceipt` boleh `invoiceId: null` tapi wajib `claimCategory`; simpan `receipt_image_url` di `mechanic_debt_ledger`, jangan buat `invoice_items` palsu.
7. **PWA brand icon:** saat ganti logo, naikkan `ICON_VERSION` (`src/app/layout.tsx`) dan `iconVersion` (`src/app/manifest.ts`).
8. **Format WhatsApp:** konsisten antara `print-options-modal.tsx` dan halaman print; format Invoice menyertakan link preview `${origin}/print/invoices/${id}?format=invoice`.
9. Perubahan cache-sensitive wajib `revalidatePath` ke halaman consumer.

## Checklist Sebelum Menutup Tugas

- [ ] Menyentuh ledger? `transaction_date` diisi dari sumber bisnis.
- [ ] Menyentuh nomor invoice? Pakai pola `read last + retry 23505`.
- [ ] Schema berubah? Migration + types + action + UI sinkron (+ backfill default untuk tenant lama).
- [ ] Rollback / sinkron point idempotent + aware orphan reference.
- [ ] PWA / icon? Versi cache busting dinaikkan.
- [ ] WA share konsisten antara modal dan halaman print.
- [ ] `npx tsc --noEmit` clean dan `npm run lint` lolos.
- [ ] README + docs progres + framework diperbarui untuk delta-nya.

## Konvensi Pull Request

- Buat branch fitur dari `main`; jangan push langsung ke `main`.
- Pesan commit ikuti pola repo: `feat: ...`, `fix(scope): ...`, `docs: ...`.
- Pastikan typecheck clean dan lint lolos sebelum membuka PR.
