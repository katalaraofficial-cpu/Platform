"use client";

import { useActionState } from "react";
import { submitRegistration, type RegisterState } from "@/lib/actions/register";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    submitRegistration,
    {}
  );

  if (state.success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Pendaftaran Terkirim!
          </h1>
          <p className="text-slate-400 mb-6">
            Terima kasih telah mendaftar. Tim kami akan meninjau permohonan Anda
            dan mengirimkan email konfirmasi dalam <strong className="text-white">1×24 jam</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke beranda
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm text-white">
              K
            </div>
            <span className="font-semibold text-white">Katalara POS</span>
          </Link>
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sudah punya akun? Login
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Daftar Bengkel Anda</h1>
          <p className="text-slate-400">
            Isi formulir di bawah dan kami akan menghubungi Anda dalam 1×24 jam.
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 sm:p-8">
          <form action={formAction} className="space-y-5">
            {/* Nama Bengkel */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nama Bengkel <span className="text-red-400">*</span>
              </label>
              <input
                name="business_name"
                type="text"
                required
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                           text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500"
                placeholder="Bengkel Maju Jaya"
              />
            </div>

            {/* Nama Pemilik */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nama Pemilik <span className="text-red-400">*</span>
              </label>
              <input
                name="owner_name"
                type="text"
                required
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                           text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500"
                placeholder="Bapak Ahmad"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email Bisnis <span className="text-red-400">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                           text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500"
                placeholder="ahmad@bengkelmajujaya.com"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Akun login dan undangan akan dikirim ke email ini
              </p>
            </div>

            {/* Nomor WA + Kota (grid) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  No. WhatsApp
                </label>
                <input
                  name="phone"
                  type="tel"
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                             text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                             focus:ring-1 focus:ring-blue-500"
                  placeholder="0812xxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Kota / Kabupaten
                </label>
                <input
                  name="city"
                  type="text"
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                             text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                             focus:ring-1 focus:ring-blue-500"
                  placeholder="Surabaya"
                />
              </div>
            </div>

            {/* Pesan */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Pesan / Pertanyaan
              </label>
              <textarea
                name="message"
                rows={3}
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                           text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="Ceritakan sedikit tentang bengkel Anda (opsional)"
              />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white
                         hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Mengirim Pendaftaran..." : "Kirim Pendaftaran →"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Dengan mendaftar, Anda menyetujui syarat penggunaan platform Katalara.
        </p>
      </div>
    </main>
  );
}
