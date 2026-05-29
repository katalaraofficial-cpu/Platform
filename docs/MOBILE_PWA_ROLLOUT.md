# Mobile & PWA Rollout Plan

Dokumen ini jadi checklist implementasi mobile-first untuk role owner, admin, engineer, lalu dilanjutkan PWA bertahap.

Last updated: 29 Mei 2026 (commit `1fd746d`)

## 1) Prioritas Mobile (Role-Based)

### Owner (prioritas tertinggi)
- [x] Daftar invoice: mobile card list + desktop table
- [x] Bottom nav mobile: FAB invoice, drawer, 4 slot tetap
- [x] New/edit invoice: single-column mobile, form item responsive, sticky save bar, card item list
- [ ] Dashboard: rapikan kartu KPI agar aman di 360px
- [ ] Kas: mobile card list untuk transaksi (hindari horizontal scroll)
- [x] Settings: tata letak form inti sudah mobile-safe (masih perlu polishing visual minor)

### Admin
- [x] Daftar invoice: mobile card list + desktop table
- [x] New/edit invoice: shared InvoiceEditor (mobile sudah responsive)
- [ ] Bottom nav mobile: belum ada, masih sidebar lama
- [ ] Dashboard: ringkas tabel invoice terkini menjadi list di mobile
- [ ] Reimburse: validasi komponen tabel riwayat di mobile

### Engineer
- [x] Sudah support mobile (sesuai catatan terakhir)
- [x] Audit ulang flow utama point: saldo, klaim, status, riwayat
- [ ] Audit ulang flow non-point untuk konsistensi spacing dan action

## 2) Standar UX Mobile
- Minimal target lebar: 360px
- Header aksi utama harus terlihat tanpa scroll horizontal
- Tabel berubah menjadi card/list di mobile
- Filter sekunder bisa ditaruh di collapsible area/drawer
- Tombol aksi primer min-height 40px

## 3) KPI Kualitas Mobile
- Tidak ada horizontal scroll pada halaman operasional utama
- Semua flow kritikal selesai <= 3 langkah
- Error submit mobile tidak lebih tinggi dari desktop
- Waktu interaksi utama (open page -> action) stabil

## 4) Tahap PWA

### Tahap 1: Installable
- [x] Tambah web app manifest
- [x] Tambah icon set (192/512 + maskable + apple icon)
- [x] Atur display standalone + theme color

### Tahap 2: Basic Caching
- [x] Cache static assets dan app shell (next-pwa)
- [x] Konfigurasi tetap konservatif untuk data dinamis tenant

### Tahap 3: Offline Fallback
- [ ] Sediakan halaman fallback saat offline
- [ ] Beri notifikasi pengguna jika data real-time tidak tersedia

### Tahap 4: Push Notification
- [ ] Kelola subscription endpoint
- [ ] Event prioritas: approval, invoice due, error operasional
- [ ] Cleanup subscription invalid secara berkala

## 5) Catatan Free Tier (Vercel + Supabase)
- Pantau growth request, bandwidth, dan storage sebelum aktifkan fitur push masif
- Simpan threshold limit dalam konfigurasi, bukan hardcoded
- Jika beban naik, prioritaskan optimasi query dan payload sebelum upgrade plan
