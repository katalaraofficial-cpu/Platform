import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TenantListTable } from "@/components/super-admin/tenant-list-table";

const PAGE_SIZE = 10;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: tenants, count: totalCount } = await supabase
    .from("tenants")
    .select("id, name, slug, is_active, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const tenantIds = (tenants ?? []).map((t) => t.id);

  // Get user counts for current page tenant rows
  const { data: profileCounts } = tenantIds.length
    ? await supabase
        .from("profiles")
        .select("tenant_id")
        .in("tenant_id", tenantIds)
        .neq("role", "super_admin")
    : { data: [] as { tenant_id: string | null }[] };

  const countByTenant: Record<string, number> = {};
  for (const p of profileCounts ?? []) {
    if (p.tenant_id) {
      countByTenant[p.tenant_id] = (countByTenant[p.tenant_id] ?? 0) + 1;
    }
  }

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      {!tenants || tenants.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-400 shadow-sm">
          <p className="text-lg font-medium">Belum ada tenant</p>
          <p className="mt-1 text-sm">
            Klik &ldquo;Buat Tenant&rdquo; untuk menambah bengkel pertama
          </p>
        </div>
      ) : (
        <TenantListTable
          tenants={tenants}
          countByTenant={countByTenant}
          page={page}
          totalPages={totalPages}
          totalCount={total}
        />
      )}
    </div>
  );
}
