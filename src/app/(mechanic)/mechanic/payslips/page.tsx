import { FileText } from "lucide-react";

export default async function MechanicPayslipsPage() {
  const slips: Array<{ id: string; created_at: string; notes: string; amount: number }> = [];

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
          <FileText className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Slip Gaji</h1>
          <p className="text-xs text-gray-400">Daftar dokumen pembayaran dari perusahaan</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Daftar Slip</span>
        </div>

        {slips.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            Belum ada slip gaji tersedia.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Keterangan</th>
                <th className="px-4 py-2 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slips.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(row.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{row.notes || "Gaji / Insentif"}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">
                    Rp {Number(row.amount ?? 0).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
