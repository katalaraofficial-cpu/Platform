import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Building2, Users, CheckCircle, XCircle, Inbox } from "lucide-react";

export default async function SuperAdminDashboard() {
  const supabase = await createClient();

  const [
    { count: totalTenants },
    { count: activeTenants },
    { count: totalUsers },
    { count: pendingRegistrations },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }),
    supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .neq("role", "super_admin"),
    supabase
      .from("tenant_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const stats = [
    {
      label: "Total Tenant",
      value: totalTenants ?? 0,
      icon: <Building2 className="h-5 w-5 text-slate-400" />,
      href: "/super-admin/tenants",
    },
    {
      label: "Tenant Aktif",
      value: activeTenants ?? 0,
      icon: <CheckCircle className="h-5 w-5 text-green-400" />,
      href: "/super-admin/tenants",
    },
    {
      label: "Tenant Non-Aktif",
      value: (totalTenants ?? 0) - (activeTenants ?? 0),
      icon: <XCircle className="h-5 w-5 text-red-400" />,
      href: "/super-admin/tenants",
    },
    {
      label: "Total Pengguna",
      value: totalUsers ?? 0,
      icon: <Users className="h-5 w-5 text-blue-400" />,
      href: "/super-admin/tenants",
    },
    {
      label: "Pendaftaran Baru",
      value: pendingRegistrations ?? 0,
      icon: <Inbox className="h-5 w-5 text-yellow-400" />,
      href: "/super-admin/registrations",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Super Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manajemen tenant dan platform.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Aksi Cepat</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/super-admin/tenants/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Buat Tenant Baru
          </Link>
          <Link
            href="/super-admin/tenants"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Kelola Tenant
          </Link>
        </div>
      </div>
    </div>
  );
}
