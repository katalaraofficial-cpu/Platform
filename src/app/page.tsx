import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">
            K
          </div>
          <span className="font-semibold text-lg tracking-tight">Katalara POS</span>
        </div>
        <Link
          href="/login"
          className="text-sm px-4 py-1.5 rounded-md border border-slate-600 hover:border-slate-400 transition-colors"
        >
          Login
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <span className="text-xs font-medium tracking-widest text-blue-400 uppercase mb-4">
          Sistem Internal
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Workshop &amp; POS Management
        </h1>
        <p className="text-slate-400 max-w-md text-base mb-10">
          Platform terpusat untuk mengelola bengkel, invoice, kasir, mekanik,
          dan keuangan — dalam satu sistem multi-tenant.
        </p>
        <Link
          href="/login"
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-medium text-sm"
        >
          Masuk ke Sistem
        </Link>
      </section>

      {/* Feature highlights */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-800 border-t border-slate-800">
        {[
          { title: "Multi-Tenant", desc: "Setiap bengkel berjalan di lingkungan terpisah & aman" },
          { title: "RBAC", desc: "Hak akses berbeda untuk Owner, Admin, dan Mekanik" },
          { title: "Real-time", desc: "Invoice, stok, dan kas terupdate secara langsung" },
        ].map((f) => (
          <div key={f.title} className="bg-slate-950 px-8 py-8">
            <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
            <p className="text-slate-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Katalara. Sistem internal — akses hanya untuk pengguna terdaftar.
      </footer>
    </main>
  );
}
