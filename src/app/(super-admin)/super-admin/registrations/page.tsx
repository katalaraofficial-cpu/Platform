import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RegistrationActions } from "@/components/super-admin/registration-actions";
import type { TenantRequest } from "@/types/database";
import { Inbox } from "lucide-react";

const STATUS_LABEL: Record<TenantRequest["status"], string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const STATUS_CLASS: Record<TenantRequest["status"], string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RegistrationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") redirect("/login");

  const { data: requests } = await supabase
    .from("tenant_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const processed = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pendaftaran Bengkel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tinjau dan proses permintaan pendaftaran bengkel baru
        </p>
      </div>

      {/* Pending */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-yellow-500" />
          Menunggu Persetujuan
          {pending.length > 0 && (
            <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 font-medium">
              {pending.length}
            </span>
          )}
        </h2>

        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Tidak ada permintaan yang menunggu.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Bengkel</th>
                  <th className="px-4 py-3 text-left">Pemilik</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Kota</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pending.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{req.business_name}</td>
                    <td className="px-4 py-3 text-gray-600">{req.owner_name}</td>
                    <td className="px-4 py-3 text-gray-600">{req.email}</td>
                    <td className="px-4 py-3 text-gray-500">{req.city ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RegistrationActions
                        requestId={req.id}
                        businessName={req.business_name}
                        ownerEmail={req.email}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Processed */}
      {processed.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Riwayat
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Bengkel</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {processed.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{req.business_name}</td>
                    <td className="px-4 py-3 text-gray-600">{req.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_CLASS[req.status as TenantRequest["status"]]
                        }`}
                      >
                        {STATUS_LABEL[req.status as TenantRequest["status"]]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {req.reviewed_at ? formatDate(req.reviewed_at) : formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {req.rejection_note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
