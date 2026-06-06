# AI Agent Framework - Katalara POS

Last updated: 6 Juni 2026 (commit `4a1036f`)

## Tujuan Dokumen

Kerangka operasional untuk AI agent yang melanjutkan pengembangan platform tanpa mengulang bug lama atau merusak baseline produksi.

## 1) Startup Checklist Agent Baru

1. Baca [docs/AGENT_CONTEXT.md](AGENT_CONTEXT.md) — konteks agent standar (Aturan · State · Path Anchors · Next Actions).
2. Baca [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) untuk peta modul dan constraints.
3. Baca [docs/DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) untuk histori commit terbaru.
4. Jalankan typecheck cepat: `npx tsc --noEmit` (wajib clean sebelum commit).
5. Cek migrasi terbaru (sampai `038_settings_wa_template.sql`) sudah dijalankan di environment target.
6. Saat selesai coding, update README + docs progres + framework sebelum commit akhir.
7. Sebelum menutup sesi, perbarui [docs/AGENT_CONTEXT.md](AGENT_CONTEXT.md) (seksi State + Next Actions) tiap sesi.

## 2) Peta Area Kode Kritis

- Routes: `src/app/(super-admin)`, `src/app/(owner)`, `src/app/(admin)`, `src/app/(mechanic)`, `src/app/(print)`
- Server Actions: `src/lib/actions/*`
- Context auth-role-tenant: `src/lib/get-user-context.ts`
- Supabase clients:
  - browser: `src/lib/supabase/client.ts`
  - server: `src/lib/supabase/server.ts`
  - admin/service role: `src/lib/supabase/admin.ts`
- DB types: `src/types/database.ts`
- Migrations: `supabase/migrations/*.sql`

## 3) Aturan Kerja Wajib (Pakem)

1. Jangan ubah alur RBAC pada `src/middleware.ts` tanpa kebutuhan jelas.
2. Setiap perubahan schema wajib sinkron pada 4 titik:
   - SQL migration
   - `src/types/database.ts`
   - server action terkait
   - UI/form terkait
3. Untuk fitur invoice/print, jangan hardcode format; hormati `nota_active_format`.
4. Untuk perubahan poin mekanik, konsistenkan dua jalur:
   - `processPayment()` (earn)
   - `rollbackInvoiceStatus()` (reverse/adjust)
5. Rollback point harus menghitung net transaksi per invoice (`earn + adjust`) agar idempotent.
6. Ringkasan point (`saldo`, `total earned`, `total redeemed`) harus order-agnostic terhadap histori transaksi.
7. Untuk owner users delete, gunakan guard tenant + role (owner tidak boleh hapus diri sendiri/owner lain).
8. **Tanggal bisnis vs tanggal sistem:** setiap insert ke tabel ledger dengan kolom `transaction_date DATE NOT NULL DEFAULT CURRENT_DATE` WAJIB mengisi `transaction_date` dari sumber tanggal bisnis (`paymentDate`, tanggal pengeluaran kas, dst). Jangan mengandalkan default. Hal yang sama berlaku untuk laporan dashboard: filter pakai kolom bisnis (`transaction_date` / `invoice_date`), bukan `created_at`.
9. **Generator nomor invoice:** baca nomor terakhir dengan `order("invoice_number", { ascending: false })`, jangan hitung `count`. Bungkus insert dengan loop retry yang mengenali Postgres `23505` pada `invoices_tenant_id_invoice_number_key`.
10. **Klaim non-invoice mekanik:** `submitMechanicReceipt` boleh menerima `invoiceId: null` tetapi wajib mendapat `claimCategory` (`bensin` / `kesehatan` / `lainnya`). Simpan `receipt_image_url` langsung di `mechanic_debt_ledger`. Jangan paksa membuat `invoice_items` palsu untuk klaim non-invoice.
11. **PWA brand icon:** gunakan `Logo.jpg` Katalara via `src/app/_brand-logo.ts` + `src/app/icon.tsx`. Saat update logo, naikkan `ICON_VERSION` di `src/app/layout.tsx` dan `iconVersion` di `src/app/manifest.ts` agar launcher cache di-bust.
12. **Format pesan WhatsApp:** gunakan blok ringkas `AKI KUAT → No → Tgl → Cust → Total → Status`. Untuk format Invoice tambahkan link preview `${origin}/print/invoices/${id}?format=invoice`. Konsisten antara modal `print-options-modal.tsx` dan halaman print.
13. **Sinkron point owner (`syncEngineerPoints`):** rebuild expected dari current `invoice_mechanics` + reward settings, lalu netralkan transaksi orphan (reference_id ke invoice yang sudah dihapus) dengan `adjust = -currentNet`.

## 4) Guardrail Produksi (Berdasarkan Insiden Sebelumnya)

- Hindari query settings dengan daftar kolom kaku jika production schema berpotensi drift.
- Undangan user owner jangan memakai action yang khusus super-admin.
- Badge status invoice list harus complaint-aware, tidak hanya `inv.status` mentah.
- Perubahan cache-sensitive wajib `revalidatePath` ke halaman consumer (owner/mechanic).
- Wording riwayat transaksi point harus bahasa bisnis yang jelas untuk user operasional, hindari teks teknis internal.
- **Insiden 6 Juni 2026:** pembayaran invoice mendarat di tanggal hari ini karena lupa isi `transaction_date`. Pakem 8 di atas dibuat untuk mencegah regresi ini.
- **Insiden 6 Juni 2026:** error `duplicate key invoices_tenant_id_invoice_number_key` saat invoice lama dihapus lalu dibuat ulang. Pakem 9 (read-last-then-retry) wajib dipakai di semua jalur create invoice.
- **Insiden 6 Juni 2026:** ikon homescreen menampilkan inisial "V" karena cache launcher Android memegang ikon lama. Pakem 11 (versioned icon URL) menyelesaikan ini; agen harus selalu menaikkan versi saat mengganti logo.

## 5) Baseline Performa yang Harus Dipertahankan

- Prefetch route owner dari navigasi yang aman SSR.
- Query independen diparalelkan bila memungkinkan.
- Payload `select` dipangkas ke kolom yang benar-benar dipakai.

## 6) Build Log Ringkas Terbaru

- `4a1036f`: pembayaran invoice mengisi `ledger.transaction_date` dari `paymentDate`
- `87aac87`: nomor invoice anti-duplicate + WA template per format + refresh icon homescreen
- `50e247a`: mekanik klaim non-invoice + upload galeri + ikon brand Katalara
- `d2841a3`: dashboard `Invoice Terbaru` pakai `invoice_date` + sinkron point bersihkan transaksi orphan
- `76628c2`: dashboard kas bulan ini & pendapatan hari ini pakai `transaction_date`
- `7ac00ba`: sinkron point berdasarkan assignment terkini + perbaikan engineer panel toggle
- `7a44ef1`: kasbon karyawan COA + saldo/cicilan + private sidebar toggle
- `cd7b090`: tab Modul Invoice (DP/PPN/PPh) + placeholder Lokasi Kerja
- `bc4e399`: invoice tanggal selesai eksplisit + kolom lama kerja
- `1fd746d`: stabilkan total point engineer + profesionalisasi teks riwayat rollback
- `35173a0`: aktivasi PWA install support

## 7) Fokus Fase Berikutnya

1. Integrasi data riil tab `Kehadiran` (GPS attendance pakai placeholder Lokasi Kerja) dan `Payroll` mekanik.
2. Tambahkan parity modul pelanggan untuk role admin (`/admin/customers`).
3. Approval flow klaim non-invoice di owner (saat ini langsung tercatat sebagai `advance`).
4. Audit log untuk action sensitif: rollback invoice, sinkron point, delete user, klaim non-invoice.
5. Perbaikan akumulasi helper point untuk nominal kecil (hindari loss karena `floor`).
6. Pertimbangkan trigger DB / sequence per tenant untuk garansi atomik nomor invoice di trafik konkuren tinggi.

## 8) Pakem Singkat untuk Agent Berikutnya

Gunakan checklist ini sebelum menutup tugas:

- [ ] Fitur menyentuh ledger? Sudah isi `transaction_date` dari sumber bisnis?
- [ ] Fitur menyentuh nomor invoice? Sudah pakai pola `read last + retry 23505`?
- [ ] Schema berubah? Migration + types + action + UI sudah sinkron?
- [ ] Field baru di Settings? Sudah ada migration backfill default agar tenant lama tidak kehilangan fitur?
- [ ] Rollback / sinkron point? Sudah idempotent + aware terhadap orphan reference?
- [ ] PWA / icon? Sudah naikkan versi cache busting?
- [ ] WA share? Sudah konsisten antara `print-options-modal.tsx` dan halaman print?
- [ ] `npx tsc --noEmit` clean dan minimal smoke test manual sudah dilakukan?
- [ ] README + docs progres + framework sudah diperbarui untuk delta-nya?
