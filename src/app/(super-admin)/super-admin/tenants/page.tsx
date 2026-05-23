import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TenantsPage() {
  const supabase = await createClient();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, is_active, created_at")
    .order("created_at", { ascending: false });

  // Get user counts per tenant
  const { data: profileCounts } = await supabase
    .from("profiles")
    .select("tenant_id")
    .neq("role", "super_admin");

  const countByTenant: Record<string, number> = {};
  for (const p of profileCounts ?? []) {
    if (p.tenant_id) {
      countByTenant[p.tenant_id] = (countByTenant[p.tenant_id] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Tenant</h1>
          <p className="mt-1 text-sm text-gray-500">
            Semua bengkel yang terdaftar di platform
          </p>
        </div>
        <Link
          href="/super-admin/tenants/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Buat Tenant
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {!tenants || tenants.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-lg font-medium">Belum ada tenant</p>
            <p className="mt-1 text-sm">
              Klik &ldquo;Buat Tenant&rdquo; untuk menambah bengkel pertama
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nama Bengkel
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Slug
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Pengguna
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Dibuat
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">
                      {t.name}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-500">
                      {t.slug}
                    </td>
                    <td className="px-5 py-3">
                      {t.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          Non-Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500">
                      {countByTenant[t.id] ?? 0}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm">
                      <Link
                        href={`/super-admin/tenants/${t.id}`}
                        className="font-medium text-blue-600 hover:text-blue-500"
                      >
                        Kelola
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
