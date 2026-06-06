# AGENT_CONTEXT — Katalara POS

> **★ Mulai di sini.** Konteks standar untuk AI coding agent (Devin, Cursor, Copilot, Claude, dll).
> Format standar **4 seksi**: **Aturan · State · Path Anchors · Next Actions**.
> Aktualisasi progres antar-sesi distandarkan di file ini — perbarui seksi **State** dan
> **Next Actions** setiap selesai sesi. Dokumen detail tetap di `docs/` dan ditaut di bawah.

Platform manajemen bengkel multi-tenant berbasis **Next.js (App Router) + Supabase**.

- **Live URL:** https://katalara-pos.vercel.app
- **Repo:** https://github.com/katalaraofficial-cpu/Platform
- **Branch aktif:** `main`

Dokumen detail tertaut:

| Dokumen | Isi |
|---|---|
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Peta modul, skema data, dan constraints lengkap |
| [AI_AGENT_FRAMEWORK.md](AI_AGENT_FRAMEWORK.md) | Pakem kerja, guardrail produksi, dan checklist agent |
| [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) | Log progres build & histori commit |
| [MOBILE_PWA_ROLLOUT.md](MOBILE_PWA_ROLLOUT.md) | Rencana mobile / PWA |

---

## 1) Aturan

Pakem wajib yang tidak boleh dilanggar (aturan penuh + latar insiden di [AI_AGENT_FRAMEWORK.md](AI_AGENT_FRAMEWORK.md)):

1. Jangan ubah alur RBAC di `src/middleware.ts` tanpa kebutuhan jelas.
2. Setiap perubahan schema harus sinkron di **4 titik**: SQL migration → `src/types/database.ts` → server action terkait → UI/form terkait. Field baru di Settings wajib disertai migration backfill default agar tenant lama tidak kehilangan fitur.
3. **Tanggal bisnis vs sistem:** setiap insert ke ledger wajib mengisi `transaction_date` dari sumber tanggal bisnis (`paymentDate`, tanggal pengeluaran kas, dst), jangan andalkan default `CURRENT_DATE`. Laporan/dashboard filter pakai kolom bisnis (`transaction_date` / `invoice_date`), bukan `created_at`.
4. **Nomor invoice:** baca nomor terakhir via `order("invoice_number", { ascending: false })` (jangan `count`), bungkus insert dengan loop retry yang mengenali Postgres `23505` pada `invoices_tenant_id_invoice_number_key`.
5. **Point mekanik:** konsistenkan `processPayment()` (earn) dan `rollbackInvoiceStatus()` (reverse/adjust). Rollback harus net per invoice (idempotent); ringkasan saldo/earned/redeemed harus order-agnostic.
6. **Klaim non-invoice:** `submitMechanicReceipt` boleh `invoiceId: null` tapi wajib `claimCategory` (`bensin` / `kesehatan` / `lainnya`); simpan `receipt_image_url` langsung di `mechanic_debt_ledger`, jangan buat `invoice_items` palsu.
7. **PWA brand icon:** saat ganti logo, naikkan `ICON_VERSION` (`src/app/layout.tsx`) dan `iconVersion` (`src/app/manifest.ts`) untuk bust cache launcher.
8. **Format WhatsApp:** konsisten antara `src/components/invoices/print-options-modal.tsx` dan halaman print; format Invoice menyertakan link preview `${origin}/print/invoices/${id}?format=invoice`.
9. Perubahan cache-sensitive wajib `revalidatePath` ke halaman consumer (owner/mechanic).
10. Owner users delete: gunakan guard tenant + role (owner tidak boleh hapus diri sendiri/owner lain).

**Setup & perintah:**

```bash
npm install
cp .env.local.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                         # http://localhost:3000
```

| Tujuan | Perintah |
|---|---|
| Dev server | `npm run dev` |
| Build produksi | `npm run build` |
| Lint | `npm run lint` |
| Typecheck (wajib clean sebelum commit) | `npx tsc --noEmit` |

---

## 2) State

Snapshot kondisi terkini (perbarui tiap sesi).

- **Migrasi terakhir:** `supabase/migrations/038_settings_wa_template.sql`.
- **Fitur stabil di `main`:** katalog item implicit + autofill harga/satuan + reklasifikasi bulk; autocomplete invoice editor dengan warning mismatch tipe; dashboard donut komposisi hitung baris; WA share pakai nama bisnis tenant + template kustom `{customer}/{invoice_no}/{total}/{status}/{items}`; halaman print publik `/print/invoices/[id]` dengan OG metadata bersih; workflow invoice end-to-end (draft → in_progress → completed → paid/cancelled); program point mekanik + redeem + rollback idempotent; modul Kas & Keuangan (COA UMKM, jurnal PDF, filter `transaction_date`); modul Invoice DP/PPN/PPh per tenant; kasbon karyawan (COA `108`); mekanik upload struk (invoice / klaim non-invoice); PWA install (manifest, icon, service worker).
- **Dashboard owner** berbasis ledger (`Pendapatan Hari Ini` & `Bulan Ini`) memakai `transaction_date`.
- **Insiden tercatat (6 Juni 2026):** `transaction_date` lupa diisi saat bayar invoice; duplicate key nomor invoice saat invoice dihapus lalu dibuat ulang; ikon homescreen "V" karena cache launcher. Ketiganya sudah ada pakem pencegahan (lihat seksi Aturan #3, #4, #7).

---

## 3) Path Anchors

Peta area kode kritis (semua path diverifikasi ada di repo):

- **Routes:** `src/app/(super-admin)`, `src/app/(owner)`, `src/app/(admin)`, `src/app/(mechanic)`, `src/app/(print)`, `src/app/(auth)`
- **Server Actions:** `src/lib/actions/*` (mis. `invoice.ts`, `employee-points.ts`, `kas.ts`, `settings.ts`, `mechanic-item.ts`)
- **Context auth-role-tenant:** `src/lib/get-user-context.ts`
- **RBAC middleware:** `src/middleware.ts`
- **Supabase clients:** browser `src/lib/supabase/client.ts`, server `src/lib/supabase/server.ts`, admin/service-role `src/lib/supabase/admin.ts`
- **DB types:** `src/types/database.ts`
- **Migrations:** `supabase/migrations/*.sql`
- **WA template util:** `src/lib/wa-template.ts`
- **PWA / brand:** `src/app/_brand-logo.ts`, `src/app/icon.tsx`, `src/app/manifest.ts`, `src/app/layout.tsx`
- **Print:** `src/app/(print)/print/invoices/[id]/page.tsx`, modal `src/components/invoices/print-options-modal.tsx`

---

## 4) Next Actions

Fokus fase berikutnya (perbarui tiap sesi):

1. Integrasi data riil tab `Kehadiran` (GPS attendance pakai placeholder Lokasi Kerja) dan `Payroll` mekanik.
2. Tambahkan parity modul pelanggan untuk role admin (`/admin/customers`).
3. Approval flow klaim non-invoice di owner (saat ini langsung tercatat sebagai `advance`).
4. Audit log untuk action sensitif: rollback invoice, sinkron point, delete user, klaim non-invoice.
5. Perbaikan akumulasi helper point untuk nominal kecil (hindari loss karena `floor`).
6. Pertimbangkan trigger DB / sequence per tenant untuk garansi atomik nomor invoice di trafik konkuren tinggi.

**Checklist sebelum menutup tugas:**

- [ ] Menyentuh ledger? `transaction_date` diisi dari sumber bisnis.
- [ ] Menyentuh nomor invoice? Pakai pola `read last + retry 23505`.
- [ ] Schema berubah? Migration + types + action + UI sinkron (+ backfill default).
- [ ] Rollback / sinkron point idempotent + aware orphan reference.
- [ ] PWA / icon? Versi cache busting dinaikkan.
- [ ] WA share konsisten antara modal dan halaman print.
- [ ] `npx tsc --noEmit` clean dan `npm run lint` lolos.
- [ ] README + docs progres + framework diperbarui untuk delta-nya.
- [ ] **Perbarui `docs/AGENT_CONTEXT.md` (State + Next Actions) untuk sesi ini.**
