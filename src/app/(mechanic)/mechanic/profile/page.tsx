import { getUserContext } from "@/lib/get-user-context";
import { UserCircle2, Building2, ShieldCheck } from "lucide-react";

export default async function MechanicProfilePage() {
  const ctx = await getUserContext();

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <UserCircle2 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Profil Saya</h1>
          <p className="text-xs text-gray-400">Informasi akun mekanik</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Nama</p>
            <p className="font-medium text-gray-800">{ctx.fullName ?? "-"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Building2 className="h-3.5 w-3.5" />
                Tenant
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-800">{ctx.tenantName ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Role
              </div>
              <p className="mt-1 text-sm font-semibold capitalize text-gray-800">{ctx.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
