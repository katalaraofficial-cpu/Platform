import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TenantDetailForms } from "@/components/super-admin/tenant-detail-forms";
import { AddUserForm } from "@/components/super-admin/add-user-form";
import { TenantUserTable } from "@/components/super-admin/tenant-user-table";
import type { FeatureToggles } from "@/types/database";
import { ArrowLeft } from "lucide-react";

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
        .select("id, full_name, role, phone, is_active, created_at")
        .eq("tenant_id", id)
        .order("role"),
    ]);

  if (!tenantData) notFound();
  const tenant = tenantData!;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/super-admin/tenants"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white
                   px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900
                   transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Kelola Tenant
      </Link>

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
        <TenantUserTable
          users={(users ?? []).map((u) => ({ ...u, phone: (u.phone as string | null) ?? "" }))}
          tenantId={tenant.id}
        />
      </div>
    </div>
  );
}
