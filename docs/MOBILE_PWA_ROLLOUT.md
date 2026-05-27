# Mobile & PWA Rollout Plan

Dokumen ini jadi checklist implementasi mobile-first untuk role owner, admin, engineer, lalu dilanjutkan PWA bertahap.

## 1) Prioritas Mobile (Role-Based)

### Owner (prioritas tertinggi)
- [x] Daftar invoice: mobile card list + desktop table
- [ ] Dashboard: rapikan kartu KPI agar aman di 360px
- [ ] Kas: mobile card list untuk transaksi (hindari horizontal scroll)
- [ ] Settings: tata letak form jadi single-column di mobile
- [ ] Detail invoice/new invoice: evaluasi section panjang + sticky action

### Admin
- [x] Daftar invoice: mobile card list + desktop table
- [ ] Dashboard: ringkas tabel invoice terkini menjadi list di mobile
- [ ] Reimburse: validasi komponen tabel riwayat di mobile
- [ ] New/edit invoice: validasi flow input item di mobile

### Engineer
- [x] Sudah support mobile (sesuai catatan terakhir)
- [ ] Audit ulang 5 flow utama untuk konsistensi spacing dan action

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
- [ ] Tambah web app manifest
- [ ] Tambah icon set (192/512)
- [ ] Atur display standalone + theme color

### Tahap 2: Basic Caching
- [ ] Cache static assets dan app shell
- [ ] Jangan cache agresif data tenant dinamis

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
