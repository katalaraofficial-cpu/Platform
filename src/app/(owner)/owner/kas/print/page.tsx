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
        /* ── Screen: halaman preview ────────────────────────── */
        :root {
          --paper: #ffffff;
          --ink: #111827;
          --muted: #6b7280;
          --border: #e5e7eb;
          --accent-green: #065f46;
          --accent-red: #991b1b;
        }

        * { box-sizing: border-box; }

        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background: #f3f4f6;
          color: var(--ink);
          margin: 0;
        }

        /* ── Print: A4, sembunyikan UI chrome ───────────────── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 20mm 15mm;
          }

          html, body {
            background: white !important;
            font-size: 9.5pt;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print { display: none !important; }
          .print-paper { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }

          table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }

          /* Force background colors on table rows */
          .row-even { background-color: #f9fafb !important; }
          .row-odd  { background-color: #ffffff !important; }
          .thead-row { background-color: #1f2937 !important; color: #ffffff !important; }
          .tfoot-row { background-color: #f3f4f6 !important; }

          .text-emerald-700 { color: #065f46 !important; }
          .text-red-600 { color: #991b1b !important; }
          .text-red-700 { color: #b91c1c !important; }
          .badge-tunai { background-color: #d1fae5 !important; color: #065f46 !important; }
          .badge-bank  { background-color: #dbeafe !important; color: #1d4ed8 !important; }

          section { page-break-inside: avoid; }
          .section-new-page { page-break-before: always; }
        }
      `}</style>

      {/* ── Toolbar: sticky, hanya tampil di layar ────────────── */}
      <div className="no-print sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Kiri: Kembali + info */}
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/owner/kas"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Kembali
            </a>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold text-gray-800">{tenantName}</p>
              <p className="text-xs text-gray-400">{entries.length} transaksi · {periodLabel}</p>
            </div>
          </div>

          {/* Kanan: Print button */}
          <PrintButton />
        </div>

        {/* Mobile: info baris kedua */}
        <div className="border-t border-gray-100 px-4 pb-2 pt-1 sm:hidden">
          <p className="text-xs text-gray-500 truncate">{entries.length} transaksi · {periodLabel}</p>
        </div>
      </div>

      {/* ── Konten laporan ────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 print:p-0 print:max-w-full">
        <div className="print-paper rounded-2xl bg-white p-6 shadow-md sm:p-10 print:shadow-none print:rounded-none print:p-0">

          {/* ══ HEADER LAPORAN ══════════════════════════════ */}
          <header className="mb-8 border-b-2 border-gray-900 pb-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Laporan Keuangan UMKM
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {tenantName}
            </h1>
            <div className="mt-1 inline-block rounded-full border border-gray-300 px-4 py-0.5">
              <p className="text-sm font-semibold text-gray-700">Jurnal Kas &amp; Keuangan</p>
            </div>
            <p className="mt-2 text-sm text-gray-500">Periode: <span className="font-semibold text-gray-700">{periodLabel}</span></p>
            <p className="mt-0.5 text-xs text-gray-400">Dicetak: {printedAt}</p>
          </header>

          {/* ══ RINGKASAN POSISI KAS (di atas jurnal) ═══════ */}
          <section className="mb-8">
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: "Total Kas Masuk", value: fmt(totalDebit), color: "border-l-emerald-500 text-emerald-700" },
                { label: "Total Kas Keluar", value: fmt(totalKredit), color: "border-l-red-500 text-red-600" },
                {
                  label: "Selisih Bersih",
                  value: totalDebit - totalKredit >= 0
                    ? fmt(totalDebit - totalKredit)
                    : `(${fmt(Math.abs(totalDebit - totalKredit))})`,
                  color: totalDebit - totalKredit >= 0
                    ? "border-l-gray-700 text-gray-800"
                    : "border-l-red-600 text-red-700",
                },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border border-gray-100 border-l-4 bg-gray-50 p-3 ${s.color}`}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{s.label}</p>
                  <p className={`mt-1 text-base font-bold ${s.color.split(" ")[1]}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ══ I. JURNAL UMUM ══════════════════════════════ */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">I. Jurnal Umum</h3>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="thead-row bg-gray-800 text-white">
                    <th className="py-2.5 pl-3 text-left font-semibold w-[90px]">Tanggal</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Akun &amp; Keterangan</th>
                    <th className="py-2.5 px-3 text-center font-semibold w-[60px]">Akun</th>
                    <th className="py-2.5 px-3 text-right font-semibold w-[110px]">Debit (Masuk)</th>
                    <th className="py-2.5 px-3 pr-3 text-right font-semibold w-[110px]">Kredit (Keluar)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">Tidak ada transaksi pada periode ini</td>
                    </tr>
                  ) : (
                    entries.map((e, idx) => {
                      const isMasuk = e.transaction_type === "kas_masuk";
                      const dateStr = (e as Ledger & { transaction_date?: string }).transaction_date ?? e.created_at;
                      return (
                        <tr key={e.id} className={idx % 2 === 0 ? "row-even bg-white" : "row-odd bg-gray-50"}>
                          <td className="py-2 pl-3 text-gray-500 align-top whitespace-nowrap">{fmtDate(dateStr)}</td>
                          <td className="py-2 px-3 align-top">
                            <p className="font-semibold text-gray-800">{getCoaLabel(e.category)}</p>
                            {e.notes && (
                              <p className="mt-0.5 text-[10px] leading-relaxed text-gray-400">{e.notes}</p>
                            )}
                          </td>
                          <td className="py-2 px-3 align-top text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              e.account_type === "kas_tunai"
                                ? "badge-tunai bg-emerald-100 text-emerald-700"
                                : "badge-bank bg-blue-100 text-blue-700"
                            }`}>
                              {e.account_type === "kas_tunai" ? "Tunai" : "Bank"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium tabular-nums align-top text-emerald-700">
                            {isMasuk ? fmt(Number(e.amount)) : ""}
                          </td>
                          <td className="py-2 px-3 pr-3 text-right font-medium tabular-nums align-top text-red-600">
                            {!isMasuk ? fmt(Number(e.amount)) : ""}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="tfoot-row border-t-2 border-gray-700 bg-gray-100">
                    <td colSpan={3} className="py-2.5 pl-3 text-right text-xs font-bold text-gray-700">TOTAL</td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold tabular-nums text-emerald-700">{fmt(totalDebit)}</td>
                    <td className="py-2.5 px-3 pr-3 text-right text-xs font-bold tabular-nums text-red-600">{fmt(totalKredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ══ II. REKAPITULASI PER AKUN ═══════════════════ */}
          <section className="mb-8 section-new-page">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">II. Rekapitulasi per Akun (Buku Besar Ringkas)</h3>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="thead-row bg-gray-800 text-white">
                    <th className="py-2.5 pl-3 text-left font-semibold w-[55px]">Kode</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Nama Akun</th>
                    <th className="py-2.5 px-3 text-right font-semibold w-[120px]">Debit (Masuk)</th>
                    <th className="py-2.5 px-3 text-right font-semibold w-[120px]">Kredit (Keluar)</th>
                    <th className="py-2.5 px-3 pr-3 text-right font-semibold w-[120px]">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCoa.map(([code, val], idx) => {
                    const saldo = val.debit - val.kredit;
                    return (
                      <tr key={code} className={idx % 2 === 0 ? "row-even bg-white" : "row-odd bg-gray-50"}>
                        <td className="py-2 pl-3 font-mono font-semibold text-gray-400">{code}</td>
                        <td className="py-2 px-3 font-medium text-gray-800">{COA_MAP[code] ?? code}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-700">
                          {val.debit > 0 ? fmt(val.debit) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-600">
                          {val.kredit > 0 ? fmt(val.kredit) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`py-2 px-3 pr-3 text-right font-semibold tabular-nums ${saldo >= 0 ? "text-gray-800" : "text-red-600"}`}>
                          {saldo >= 0 ? fmt(saldo) : `(${fmt(Math.abs(saldo))})`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfoot-row border-t-2 border-gray-700 bg-gray-100">
                    <td colSpan={2} className="py-2.5 pl-3 text-right text-xs font-bold text-gray-700">TOTAL</td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold tabular-nums text-emerald-700">{fmt(totalDebit)}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold tabular-nums text-red-600">{fmt(totalKredit)}</td>
                    <td className={`py-2.5 px-3 pr-3 text-right text-xs font-bold tabular-nums ${totalDebit - totalKredit >= 0 ? "text-gray-900" : "text-red-700"}`}>
                      {totalDebit - totalKredit >= 0
                        ? fmt(totalDebit - totalKredit)
                        : `(${fmt(Math.abs(totalDebit - totalKredit))})`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ══ III. TANDA TANGAN ═══════════════════════════ */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <div className="grid grid-cols-3 gap-6 text-xs text-gray-600">
              {["Dibuat oleh", "Diperiksa oleh", "Disetujui oleh"].map((label, i) => (
                <div key={i} className="text-center">
                  <p className="text-gray-500">{label},</p>
                  <div className="mt-12 border-t border-gray-400 pt-1.5">
                    <p className="font-semibold text-gray-700">
                      {i === 0 ? "Admin / Kasir" : i === 1 ? "Pengelola" : "Pemilik"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ══ FOOTER DOK ══════════════════════════════════ */}
          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="text-[10px] text-gray-300">
              {tenantName} · Jurnal Kas &amp; Keuangan · {periodLabel} · Dicetak {printedAt}
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
