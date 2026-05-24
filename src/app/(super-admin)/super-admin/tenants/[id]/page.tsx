import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TenantDetailForms } from "@/components/super-admin/tenant-detail-forms";
import { AddUserForm } from "@/components/super-admin/add-user-form";
import type { FeatureToggles } from "@/types/database";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  mechanic: "Mekanik",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: tenantData }, { data: settings }, { data: users }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("*")
        .eq("id", id)
        .single(),
      supabase
        .from("settings")
        .select("default_markup_pct, petty_cash_limit")
        .eq("tenant_id", id)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, role, is_active, created_at")
        .eq("tenant_id", id)
        .order("role"),
    ]);

  if (!tenantData) notFound();
  const tenant = tenantData!;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/super-admin/tenants"
          className="hover:text-gray-700"
        >
          Kelola Tenant
        </Link>
        <span>/</span>
        <span className="text-gray-900">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="mt-1 font-mono text-sm text-gray-500">{tenant.slug}</p>
          <p className="mt-1 text-xs text-gray-400">
            Dibuat: {formatDate(tenant.created_at)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            tenant.is_active
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-600"
          }`}
        >
          {tenant.is_active ? "Aktif" : "Non-Aktif"}
        </span>
      </div>

      {/* Forms (client component for interactivity) */}
      <TenantDetailForms
        tenantId={tenant.id}
        isActive={tenant.is_active}
        toggles={tenant.feature_toggles as FeatureToggles}
        settings={settings ?? null}
      />

      {/* Users */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            Pengguna ({users?.length ?? 0})
          </h2>
          <AddUserForm tenantId={tenant.id} />
        </div>
        {!users || users.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Belum ada pengguna di tenant ini
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nama
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Bergabung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">
                      {u.full_name}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </td>
                    <td className="px-5 py-3">
                      {u.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Non-Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {formatDate(u.created_at)}
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
