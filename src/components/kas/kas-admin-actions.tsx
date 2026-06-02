"use client";

import { useState, useTransition } from "react";
import { Plus, Minus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addKasKeluar } from "@/lib/actions/kas-admin";
import type { AccountType } from "@/types/database";

// ── COA Pengeluaran — UMKM Jasa & Dagang ─────────────────────
const COA_KELUAR = [
  // Beban Produksi & Operasional
  { code: "604", name: "Bahan & Sparepart Bengkel (Habis Pakai)" },
  { code: "602", name: "Gaji & Insentif Karyawan" },
  { code: "601", name: "Beban Bulanan (Sewa, Listrik, Air, Wifi)" },
  { code: "603", name: "Konsumsi & Makan Lembur" },
  { code: "605", name: "Transportasi & Bensin Teknisi" },
  { code: "606", name: "Perlengkapan Bengkel" },
  { code: "609", name: "Alat Kerja & Pemeliharaan" },
  { code: "611", name: "Perlengkapan Kebersihan & RT Kantor" },
  { code: "608", name: "Alat Tulis, Cetak Nota & Stiker Promosi" },
  { code: "607", name: "Pajak Usaha" },
  // Beban Keuangan
  { code: "501", name: "Beban Bunga Bank" },
  { code: "502", name: "Biaya Admin Bank & QRIS" },
  // Kewajiban & Modal
  { code: "210", name: "Hutang Usaha" },
  { code: "302", name: "Prive (Pengambilan Pribadi)" },
  // Pembelian Stok
  { code: "104", name: "Pembelian Stok / Inventaris Barang" },
  // Lainnya
  { code: "610", name: "Beban Lainnya" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}
function parseAmount(display: string): number {
  return parseInt(display.replace(/\./g, ""), 10) || 0;
}

// [103] Piutang (masuk) dan [210] Hutang (keluar) memerlukan nama pihak
const HP_COA_CODES = ["210"];
function coaCodeOf(cat: string) { return cat.split(" ")[0]; }
function isHpCoa(cat: string) { return HP_COA_CODES.includes(coaCodeOf(cat)); }
function counterpartyLabel(_cat: string) {
  return "Nama Vendor / Pemasok";
}

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function ErrBanner({ msg }: { msg: string }) {
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{msg}</p>;
}

// ── Modal shell ──────────────────────────────────────────────
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">Tambah Pengeluaran</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}

// ── Form ─────────────────────────────────────────────────────
function PengeluaranForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCoa, setSelectedCoa] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) { setErr("Jumlah harus lebih dari 0"); return; }

    const counterparty = (fd.get("counterparty") as string) || "";
    const userNotes = (fd.get("notes") as string) || "";
    const notes = counterparty
      ? `Pihak: ${counterparty}${userNotes ? ` — ${userNotes}` : ""}`
      : userNotes || undefined;

    startTransition(async () => {
      const res = await addKasKeluar({
        account_type: fd.get("account_type") as AccountType,
        category: fd.get("category") as string,
        amount: amtVal,
        notes,
        transaction_date: (fd.get("transaction_date") as string) || undefined,
      });
      if ("error" in res) { setErr(res.error); }
      else { toast.success("Pengeluaran berhasil disimpan"); onClose(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <ErrBanner msg={err} />}
      <Field label="Tanggal">
        <input name="transaction_date" type="date" className={inputCls} defaultValue={todayIso()} required />
      </Field>
      <Field label="Akun">
        <select name="account_type" className={selectCls} required>
          <option value="kas_tunai">Kas Tunai</option>
          <option value="bank">Bank</option>
        </select>
      </Field>
      <Field label="Kategori (COA)">
        <select name="category" className={selectCls} required onChange={(e) => setSelectedCoa(e.target.value)}>
          <option value="">-- Pilih kategori --</option>
          {COA_KELUAR.map((c) => (
            <option key={`${c.code}-${c.name}`} value={`${c.code} - ${c.name}`}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </Field>
      {isHpCoa(selectedCoa) && (
        <Field label={counterpartyLabel(selectedCoa)}>
          <input name="counterparty" className={inputCls} placeholder="Masukkan nama..." required />
        </Field>
      )}
      <Field label="Jumlah">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">Rp</span>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(fmtDisplay(e.target.value))}
            required
          />
        </div>
      </Field>
      <Field label="Keterangan (opsional)">
        <input name="notes" className={inputCls} placeholder="Catatan tambahan" />
      </Field>
      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan Pengeluaran
      </button>
    </form>
  );
}

// ── Exported component ────────────────────────────────────────
export function KasAdminActions({ fab = false }: { fab?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {fab ? (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg text-white hover:bg-red-700 active:scale-95 transition-all"
          title="Tambah Pengeluaran"
        >
          <Minus className="h-6 w-6" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
        >
          <Minus className="h-4 w-4" />
          Tambah Pengeluaran
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <PengeluaranForm onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
