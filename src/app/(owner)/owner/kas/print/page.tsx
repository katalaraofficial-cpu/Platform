import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import { PrintButton } from "./print-button";
import type { Ledger } from "@/types/database";

// ── COA master (untuk label lengkap di laporan) ──────────────
const COA_MAP: Record<string, string> = {
  "103": "Piutang Usaha",
  "104": "Pembelian Stok / Inventaris Barang",
  "105": "Mutasi Kas dan Bank",
  "210": "Hutang Usaha",
  "301": "Modal Awal",
  "302": "Prive (Pengambilan Pribadi)",
  "401": "Pendapatan Jasa",
  "402": "Pendapatan Penjualan Barang",
  "409": "Income Lain-lain",
  "501": "Beban Bunga Bank",
  "502": "Biaya Admin Bank & QRIS",
  "601": "Beban Bulanan (Sewa, Listrik, Air, Wifi)",
  "602": "Gaji & Insentif Karyawan",
  "603": "Konsumsi & Makan Lembur",
  "604": "Bahan & Sparepart Bengkel (Habis Pakai)",
  "605": "Transportasi & Bensin Teknisi",
  "606": "Perlengkapan Bengkel",
  "607": "Pajak Usaha",
  "608": "Alat Tulis, Cetak Nota & Stiker Promosi",
  "609": "Alat Kerja & Pemeliharaan",
  "610": "Beban Lainnya",
  "611": "Perlengkapan Kebersihan & RT Kantor",
};

function fmt(n: number) {
  return "Rp\u00a0" + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(dateStr: string) {
  const d = dateStr.length === 10 ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function getCoaCode(category: string) {
  return category.split(" ")[0];
}
function getCoaLabel(category: string) {
  const code = getCoaCode(category);
  const name = COA_MAP[code];
  return name ? `[${code}] ${name}` : category;
}

type SearchParams = Promise<{
  account?: string;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
}>;

export default async function KasPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const sp = await searchParams;
  const accountFilter = sp.account ?? "all";
  const typeFilter = sp.type ?? "all";
  const fromDate = sp.from ?? "";
  const toDate = sp.to ?? "";
  const search = sp.search ?? "";

  const supabase = await createClient();

  // ── Tenant name ──────────────────────────────────────────────
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", ctx.tenantId!)
    .single();
  const tenantName = tenantRow?.name ?? "Bisnis Saya";

  // ── Load ALL transactions (no pagination for print) ──────────
  let q = supabase
    .from("ledger")
    .select("id, account_type, transaction_type, category, amount, notes, transaction_date, created_at")
    .eq("tenant_id", ctx.tenantId!)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(2000);

  if (accountFilter !== "all")
    q = q.eq("account_type", accountFilter as import("@/types/database").AccountType);
  if (typeFilter !== "all")
    q = q.eq("transaction_type", typeFilter as import("@/types/database").LedgerType);
  if (fromDate) q = q.gte("transaction_date", fromDate);
  if (toDate) q = q.lte("transaction_date", toDate);
  if (search) q = q.or(`category.ilike.%${search}%,notes.ilike.%${search}%`);

  const { data: rows } = await q;
  const entries = (rows as Ledger[] | null) ?? [];

  // ── Saldo summary per COA (Buku Besar ringkas) ───────────────
  const coaSummary: Record<string, { debit: number; kredit: number }> = {};
  let totalDebit = 0;
  let totalKredit = 0;

  for (const e of entries) {
    const code = getCoaCode(e.category);
    if (!coaSummary[code]) coaSummary[code] = { debit: 0, kredit: 0 };
    const amt = Number(e.amount);
    if (e.transaction_type === "kas_masuk") {
      coaSummary[code].debit += amt;
      totalDebit += amt;
    } else {
      coaSummary[code].kredit += amt;
      totalKredit += amt;
    }
  }

  // Sort COA entries by code number
  const sortedCoa = Object.entries(coaSummary).sort(([a], [b]) =>
    parseInt(a) - parseInt(b)
  );

  // ── Period label ─────────────────────────────────────────────
  const periodLabel =
    fromDate && toDate
      ? `${fmtDate(fromDate)} – ${fmtDate(toDate)}`
      : fromDate
        ? `Sejak ${fmtDate(fromDate)}`
        : toDate
          ? `Sampai ${fmtDate(toDate)}`
          : "Semua Periode";

  const printedAt = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; }
      `}</style>

      <div className="mx-auto max-w-4xl p-6">

        {/* ── Toolbar (hidden on print) ─────────────────────── */}
        <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <a href="/owner/kas" className="text-sm text-blue-600 hover:underline">
              ← Kembali
            </a>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">{entries.length} transaksi · {periodLabel}</span>
          </div>
          <PrintButton />
        </div>

        {/* ══════════════════════════════════════════════════════
            JURNAL KAS & KEUANGAN
        ══════════════════════════════════════════════════════ */}
        <div className="space-y-8">

          {/* Header Laporan */}
          <div className="border-b-2 border-gray-900 pb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Laporan Keuangan UMKM</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{tenantName}</h1>
            <h2 className="mt-2 text-base font-semibold text-gray-700">Jurnal Kas &amp; Keuangan</h2>
            <p className="mt-1 text-sm text-gray-500">Periode: {periodLabel}</p>
            <p className="mt-0.5 text-xs text-gray-400">Dicetak: {printedAt}</p>
          </div>

          {/* ── Bagian 1: Jurnal Umum ───────────────────────── */}
          <section>
            <h3 className="mb-3 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide text-gray-700">
              I. Jurnal Umum
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-700 bg-gray-100">
                  <th className="py-2 pl-2 text-left font-semibold text-gray-700 w-[90px]">Tanggal</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-700">Akun &amp; Keterangan</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-700 w-[70px]">Akun</th>
                  <th className="py-2 px-2 text-right font-semibold text-gray-700 w-[110px]">Debit (Masuk)</th>
                  <th className="py-2 pl-2 pr-2 text-right font-semibold text-gray-700 w-[110px]">Kredit (Keluar)</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">Tidak ada transaksi</td>
                  </tr>
                ) : (
                  entries.map((e, idx) => {
                    const isMasuk = e.transaction_type === "kas_masuk";
                    const dateStr = (e as Ledger & { transaction_date?: string }).transaction_date ?? e.created_at;
                    return (
                      <tr key={e.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-1.5 pl-2 text-gray-600 align-top">{fmtDate(dateStr)}</td>
                        <td className="py-1.5 px-2 align-top">
                          <p className="font-medium text-gray-800">{getCoaLabel(e.category)}</p>
                          {e.notes && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{e.notes}</p>
                          )}
                        </td>
                        <td className="py-1.5 px-2 align-top">
                          <span className={`inline-flex rounded px-1 py-0.5 text-[10px] font-medium ${
                            e.account_type === "kas_tunai"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {e.account_type === "kas_tunai" ? "Tunai" : "Bank"}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-medium text-emerald-700 align-top">
                          {isMasuk ? fmt(Number(e.amount)) : ""}
                        </td>
                        <td className="py-1.5 pl-2 pr-2 text-right font-medium text-red-600 align-top">
                          {!isMasuk ? fmt(Number(e.amount)) : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-700 bg-gray-100 font-bold">
                  <td colSpan={3} className="py-2 pl-2 text-right text-xs text-gray-700">TOTAL</td>
                  <td className="py-2 px-2 text-right text-xs text-emerald-700">{fmt(totalDebit)}</td>
                  <td className="py-2 pl-2 pr-2 text-right text-xs text-red-600">{fmt(totalKredit)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* ── Bagian 2: Rekapitulasi per COA (Buku Besar) ─── */}
          <section>
            <h3 className="mb-3 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide text-gray-700">
              II. Rekapitulasi per Akun (Buku Besar Ringkas)
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-700 bg-gray-100">
                  <th className="py-2 pl-2 text-left font-semibold text-gray-700 w-[60px]">Kode</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-700">Nama Akun</th>
                  <th className="py-2 px-2 text-right font-semibold text-gray-700 w-[120px]">Debit (Masuk)</th>
                  <th className="py-2 px-2 text-right font-semibold text-gray-700 w-[120px]">Kredit (Keluar)</th>
                  <th className="py-2 pl-2 pr-2 text-right font-semibold text-gray-700 w-[120px]">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {sortedCoa.map(([code, val], idx) => {
                  const saldo = val.debit - val.kredit;
                  return (
                    <tr key={code} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="py-1.5 pl-2 font-mono text-gray-500">[{code}]</td>
                      <td className="py-1.5 px-2 text-gray-800">{COA_MAP[code] ?? code}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-700">
                        {val.debit > 0 ? fmt(val.debit) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-red-600">
                        {val.kredit > 0 ? fmt(val.kredit) : "—"}
                      </td>
                      <td className={`py-1.5 pl-2 pr-2 text-right font-semibold ${saldo >= 0 ? "text-gray-800" : "text-red-600"}`}>
                        {saldo >= 0 ? fmt(saldo) : `(${fmt(Math.abs(saldo))})`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-700 bg-gray-100 font-bold">
                  <td colSpan={2} className="py-2 pl-2 text-right text-xs text-gray-700">TOTAL</td>
                  <td className="py-2 px-2 text-right text-xs text-emerald-700">{fmt(totalDebit)}</td>
                  <td className="py-2 px-2 text-right text-xs text-red-600">{fmt(totalKredit)}</td>
                  <td className={`py-2 pl-2 pr-2 text-right text-xs font-bold ${totalDebit - totalKredit >= 0 ? "text-gray-900" : "text-red-700"}`}>
                    {totalDebit - totalKredit >= 0
                      ? fmt(totalDebit - totalKredit)
                      : `(${fmt(Math.abs(totalDebit - totalKredit))})`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* ── Bagian 3: Ringkasan Posisi Kas ──────────────── */}
          <section>
            <h3 className="mb-3 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide text-gray-700">
              III. Ringkasan Posisi Kas
            </h3>
            <div className="grid grid-cols-3 gap-4 text-xs">
              {[
                {
                  label: "Total Kas Masuk (Debit)",
                  value: fmt(totalDebit),
                  cls: "text-emerald-700",
                },
                {
                  label: "Total Kas Keluar (Kredit)",
                  value: fmt(totalKredit),
                  cls: "text-red-600",
                },
                {
                  label: "Selisih Bersih",
                  value:
                    totalDebit - totalKredit >= 0
                      ? fmt(totalDebit - totalKredit)
                      : `(${fmt(Math.abs(totalDebit - totalKredit))})`,
                  cls: totalDebit - totalKredit >= 0 ? "text-gray-900" : "text-red-700",
                },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-gray-500">{s.label}</p>
                  <p className={`mt-1 text-base font-bold ${s.cls}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Footer Tanda Tangan ──────────────────────────── */}
          <section className="mt-8 grid grid-cols-3 gap-6 text-xs text-gray-600">
            <div className="text-center">
              <p>Dibuat oleh,</p>
              <div className="mt-10 border-t border-gray-400 pt-1">
                <p className="font-medium">Admin / Kasir</p>
              </div>
            </div>
            <div className="text-center">
              <p>Diperiksa oleh,</p>
              <div className="mt-10 border-t border-gray-400 pt-1">
                <p className="font-medium">Pengelola</p>
              </div>
            </div>
            <div className="text-center">
              <p>Disetujui oleh,</p>
              <div className="mt-10 border-t border-gray-400 pt-1">
                <p className="font-medium">Pemilik</p>
              </div>
            </div>
          </section>

          <p className="text-center text-[10px] text-gray-400">
            Dokumen ini dicetak dari sistem POS — {tenantName} · {printedAt}
          </p>
        </div>
      </div>
    </>
  );
}
