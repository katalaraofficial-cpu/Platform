"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError("Gagal menyimpan password: " + updateErr.message);
      setLoading(false);
      return;
    }

    // Fetch role to redirect to correct dashboard
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const home: Record<string, string> = {
      super_admin: "/super-admin/dashboard",
      owner: "/owner/dashboard",
      admin: "/admin/dashboard",
      mechanic: "/mechanic/dashboard",
    };

    const role = String((profile as { role?: string } | null)?.role ?? "");
    router.push(home[role] ?? "/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-lg">
            K
          </div>
          <h1 className="text-2xl font-bold text-white">Buat Password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Selamat datang! Buat password untuk melanjutkan.
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password Baru
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                           text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Konfirmasi Password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm
                           text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500"
                placeholder="Ulangi password"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white
                         hover:bg-blue-500 transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? "Menyimpan..." : "Simpan Password & Masuk →"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
