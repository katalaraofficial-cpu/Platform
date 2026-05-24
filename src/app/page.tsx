import Link from "next/link";
import {
  FileText,
  Wrench,
  Users,
  BarChart3,
  ShieldCheck,
  Wallet,
  CheckCircle2,
} from "lucide-react";

const FEATURES = [
  {
    icon: <FileText className="h-6 w-6 text-blue-400" />,
    title: "Manajemen Invoice",
    desc: "Buat, edit, dan lacak invoice servis dari draft hingga lunas dalam hitungan detik.",
  },
  {
    icon: <Wrench className="h-6 w-6 text-orange-400" />,
    title: "Portal Mekanik",
    desc: "Mekanik melihat tugas mereka sendiri, upload foto bukti, dan update progres real-time.",
  },
  {
    icon: <Users className="h-6 w-6 text-green-400" />,
    title: "Multi-Role Access",
    desc: "Owner, Admin/Kasir, dan Mekanik punya dashboard & akses yang sesuai perannya.",
  },
  {
    icon: <Wallet className="h-6 w-6 text-yellow-400" />,
    title: "Kasbon & Petty Cash",
    desc: "Kelola kas kecil bengkel dengan batas limit, catatan pengeluaran, dan top-up.",
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-purple-400" />,
    title: "Laporan & Statistik",
    desc: "Pantau omzet hari ini, bulan ini, dan riwayat transaksi dari satu layar.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6 text-slate-400" />,
    title: "Multi-Tenant Aman",
    desc: "Setiap bengkel punya lingkungan data terpisah — privasi dan keamanan terjamin.",
  },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Daftar Online", desc: "Isi formulir singkat dengan info bengkel Anda. Gratis, tanpa kartu kredit." },
  { step: "2", title: "Tinjauan 24 Jam", desc: "Tim kami memverifikasi dan menyiapkan akun bengkel Anda dalam 1×24 jam." },
  { step: "3", title: "Langsung Pakai", desc: "Terima email undangan, set password, dan sistem siap digunakan hari itu juga." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">
            K
          </div>
          <span className="font-semibold text-lg tracking-tight">Katalara POS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm px-4 py-1.5 rounded-md border border-slate-600 hover:border-slate-400 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="text-sm px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
          >
            Daftar Sekarang
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        <span className="text-xs font-medium tracking-widest text-blue-400 uppercase mb-5 border border-blue-800 rounded-full px-3 py-1">
          Platform Manajemen Bengkel
        </span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5 max-w-3xl">
          Kelola Bengkel Anda{" "}
          <span className="text-blue-400">Lebih Efisien</span>
        </h1>
        <p className="text-slate-400 max-w-xl text-base mb-10">
          Katalara POS adalah platform all-in-one untuk bengkel otomotif —
          invoice, mekanik, kasbon, dan laporan dalam satu sistem yang mudah digunakan.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-semibold text-sm w-full sm:w-auto text-center"
          >
            Daftar Gratis Sekarang →
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-lg border border-slate-600 hover:border-slate-400 transition-colors text-sm w-full sm:w-auto text-center"
          >
            Masuk ke Sistem
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 w-full">
        <h2 className="text-center text-2xl font-bold mb-2">Fitur Lengkap untuk Bengkel Modern</h2>
        <p className="text-center text-slate-400 text-sm mb-10">
          Semua yang Anda butuhkan, sudah ada di dalam satu platform.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-colors"
            >
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-t border-slate-800 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-2xl font-bold mb-2">Mulai dalam 3 Langkah</h2>
          <p className="text-center text-slate-400 text-sm mb-10">Tidak perlu install software. Cukup browser.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-400 font-bold text-lg">
                  {s.step}
                </div>
                <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="border-t border-slate-800 bg-blue-600/10 py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h2 className="text-2xl font-bold mb-3">Siap Mulai?</h2>
          <p className="text-slate-400 text-sm mb-8">
            Daftarkan bengkel Anda sekarang dan tim kami akan menyiapkan akun dalam 1×24 jam.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-semibold text-sm"
          >
            Daftar Sekarang — Gratis
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-6 border-t border-slate-800 text-center text-xs text-slate-600">
        <p>&copy; {new Date().getFullYear()} Katalara. All rights reserved.</p>
        <p className="mt-1">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-slate-400 hover:text-white underline">
            Login di sini
          </Link>
        </p>
      </footer>
    </main>
  );
}
