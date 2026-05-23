import { createClient } from "@/lib/supabase/server";
import { Shield, Database, Users } from "lucide-react";

export default async function PlatformSettingsPage() {
  const supabase = await createClient();

  const [
    { count: tenantCount },
    { count: userCount },
    { count: invoiceCount },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .neq("role", "super_admin"),
    supabase.from("invoices").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Pengaturan Platform
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Informasi sistem dan statistik platform
        </p>
      </div>

      {/* Platform info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Informasi Platform</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <dt className="text-gray-500">Nama Platform</dt>
            <dd className="font-medium text-gray-900">Katalara POS</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <dt className="text-gray-500">Versi</dt>
            <dd className="font-mono text-gray-900">1.0.0</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <dt className="text-gray-500">Framework</dt>
            <dd className="text-gray-900">Next.js 15 (App Router)</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Database</dt>
            <dd className="text-gray-900">Supabase (PostgreSQL)</dd>
          </div>
        </dl>
      </div>

      {/* Database stats */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Statistik Database</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <Database className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{tenantCount ?? 0}</p>
              <p className="text-xs text-gray-500">Tenant</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{userCount ?? 0}</p>
              <p className="text-xs text-gray-500">Pengguna</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <Shield className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{invoiceCount ?? 0}</p>
              <p className="text-xs text-gray-500">Total Invoice</p>
            </div>
          </div>
        </div>
      </div>

      {/* RLS note */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-800">
          Keamanan Data (RLS)
        </h3>
        <p className="mt-1 text-sm text-blue-700">
          Semua data tenant diisolasi menggunakan Row Level Security (RLS)
          PostgreSQL. Setiap tenant hanya dapat mengakses data miliknya sendiri.
          Super Admin memiliki akses penuh melalui kebijakan khusus.
        </p>
      </div>
    </div>
  );
}
