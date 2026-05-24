import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import { AddUserForm } from "@/components/super-admin/add-user-form";
import { TenantUserTable } from "@/components/super-admin/tenant-user-table";

export default async function OwnerUsersPage() {
  const ctx = await getUserContext();
  if (!ctx.tenantId) notFound();

  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .eq("tenant_id", ctx.tenantId)
    .neq("role", "super_admin")
    .order("created_at", { ascending: true });

  const userRows = (users ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name ?? "(tanpa nama)",
    role: u.role,
    is_active: u.is_active ?? true,
    created_at: u.created_at,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Pengguna</h1>
          <p className="mt-1 text-sm text-gray-500">
            Undang dan kelola pengguna di bengkel ini
          </p>
        </div>
        <AddUserForm tenantId={ctx.tenantId} />
      </div>

      {/* User table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">
            Total pengguna:{" "}
            <span className="font-semibold text-gray-900">{userRows.length}</span>
          </p>
        </div>
        <TenantUserTable users={userRows} tenantId={ctx.tenantId} />
      </div>
    </div>
  );
}
