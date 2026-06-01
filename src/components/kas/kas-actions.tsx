"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Minus,
  ArrowLeftRight,
  Pencil,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addKasEntry,
  createKasTransfer,
  updateKasEntry,
  deleteKasEntry,
} from "@/lib/actions/kas";
import type { AccountType } from "@/types/database";

// ── COA (Chart of Account) ────────────────────────────────────
type CoaEntry = { code: string; name: string };

const COA_MASUK: CoaEntry[] = [
  { code: "401", name: "Pendapatan Jasa" },
  { code: "409", name: "Pendapatan Lain-lain" },
  { code: "103", name: "Piutang Usaha" },
  { code: "301", name: "Modal Awal / Setoran" },
  { code: "105", name: "Mutasi Kas Bank" },
  { code: "108", name: "Pelunasan Kasbon Karyawan" },
  { code: "610", name: "Lainnya" },
];

const COA_KELUAR: CoaEntry[] = [
  { code: "604", name: "Bahan & Sparepart" },
  { code: "602", name: "Gaji Karyawan" },
  { code: "601", name: "Beban Bulanan (Sewa/Listrik/Air)" },
  { code: "603", name: "Konsumsi" },
  { code: "605", name: "Transport" },
  { code: "606", name: "Perlengkapan Bengkel" },
  { code: "607", name: "Pajak" },
  { code: "501", name: "Beban Bunga Bank" },
  { code: "210", name: "Hutang Usaha" },
  { code: "108", name: "Kasbon Karyawan" },
  { code: "302", name: "Prive" },
  { code: "104", name: "Pembelian Stok" },
  { code: "610", name: "Lainnya" },
];

// COA codes that need extra counterparty / due-date fields
const HP_COA_CODES = ["103", "210", "108"];
function coaCodeOf(cat: string) {
  return cat.split(" ")[0]; // "103 - Piutang Usaha" → "103"
}
function isHpCoa(cat: string) {
  return HP_COA_CODES.includes(coaCodeOf(cat));
}
function counterpartyLabel(cat: string) {
  const code = coaCodeOf(cat);
  if (code === "103") return "Nama Customer / Pihak";
  if (code === "210") return "Nama Vendor / Pemasok";
  return "Nama Karyawan";
}
function hasDueDateField(cat: string) {
  const code = coaCodeOf(cat);
  return code === "103" || code === "210";
}
// Build a structured notes string when HP fields are filled
function buildHpNotes(counterparty: string, dueDate: string, userNotes: string) {
  const parts: string[] = [];
  if (counterparty) parts.push(`Pihak: ${counterparty}`);
  if (dueDate) parts.push(`JT: ${dueDate}`);
  const prefix = parts.join(" | ");
  return prefix ? (userNotes ? `${prefix} — ${userNotes}` : prefix) : userNotes;
}

// ── Date helpers ───────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Number formatting (id-ID locale: 1.000.000) ─────────────
function fmtDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}
function parseAmount(display: string): number {
  return parseInt(display.replace(/\./g, ""), 10) || 0;
}

// ── Reusable field components ────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const selectCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

// ── Modal shell ──────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Error banner ─────────────────────────────────────────────
function ErrBanner({ msg }: { msg: string }) {
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
      {msg}
    </p>
  );
}

// ── Submit button ─────────────────────────────────────────────
function SubmitBtn({
  pending,
  label,
  color = "primary",
}: {
  pending: boolean;
  label: string;
  color?: "primary" | "red" | "green";
}) {
  const colors = {
    primary: "bg-primary hover:bg-primary/90",
    red: "bg-red-600 hover:bg-red-700",
    green: "bg-green-600 hover:bg-green-700",
  };
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${colors[color]}`}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

// ── Amount Input ─────────────────────────────────────────────
function AmountInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
        Rp
      </span>
      <input
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(fmtDisplay(e.target.value))}
        required
      />
    </div>
  );
}

// ============================================================
// MODAL: Tambah Pemasukan
// ============================================================
function TambahModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCoa, setSelectedCoa] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) {
      setErr("Jumlah harus lebih dari 0");
      return;
    }
    const counterparty = (fd.get("counterparty") as string) || "";
    const dueDate = (fd.get("due_date") as string) || "";
    const userNotes = (fd.get("notes") as string) || "";
    const notes = buildHpNotes(counterparty, dueDate, userNotes) || undefined;
    startTransition(async () => {
      const res = await addKasEntry({
        transaction_type: "kas_masuk",
        account_type: fd.get("account_type") as AccountType,
        category: fd.get("category") as string,
        amount: amtVal,
        notes,
        transaction_date: (fd.get("transaction_date") as string) || undefined,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Pemasukan berhasil disimpan");
        onClose();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <ErrBanner msg={err} />}
      <Field label="Tanggal">
        <input
          name="transaction_date"
          type="date"
          className={inputCls}
          defaultValue={todayIso()}
          required
        />
      </Field>
      <Field label="Akun">
        <select name="account_type" className={selectCls} required>
          <option value="kas_tunai">Kas Tunai</option>
          <option value="bank">Bank</option>
        </select>
      </Field>
      <Field label="Kategori (COA)">
        <select
          name="category"
          className={selectCls}
          required
          onChange={(e) => setSelectedCoa(e.target.value)}
        >
          <option value="">-- Pilih kategori --</option>
          {COA_MASUK.map((c) => (
            <option key={c.code} value={`${c.code} - ${c.name}`}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </Field>
      {/* Conditional HP fields */}
      {isHpCoa(selectedCoa) && (
        <Field label={counterpartyLabel(selectedCoa)}>
          <input
            name="counterparty"
            className={inputCls}
            placeholder="Masukkan nama..."
            required
          />
        </Field>
      )}
      {hasDueDateField(selectedCoa) && (
        <Field label="Jatuh Tempo (opsional)">
          <input name="due_date" type="date" className={inputCls} />
        </Field>
      )}
      <Field label="Jumlah">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Keterangan (opsional)">
        <input name="notes" className={inputCls} placeholder="Catatan tambahan" />
      </Field>
      <SubmitBtn pending={isPending} label="Simpan Pemasukan" color="green" />
    </form>
  );
}

// ============================================================
// MODAL: Tambah Pengeluaran
// ============================================================
function KurangModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCoa, setSelectedCoa] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) {
      setErr("Jumlah harus lebih dari 0");
      return;
    }
    const counterparty = (fd.get("counterparty") as string) || "";
    const dueDate = (fd.get("due_date") as string) || "";
    const userNotes = (fd.get("notes") as string) || "";
    const notes = buildHpNotes(counterparty, dueDate, userNotes) || undefined;
    startTransition(async () => {
      const res = await addKasEntry({
        transaction_type: "kas_keluar",
        account_type: fd.get("account_type") as AccountType,
        category: fd.get("category") as string,
        amount: amtVal,
        notes,
        transaction_date: (fd.get("transaction_date") as string) || undefined,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Pengeluaran berhasil disimpan");
        onClose();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <ErrBanner msg={err} />}
      <Field label="Tanggal">
        <input
          name="transaction_date"
          type="date"
          className={inputCls}
          defaultValue={todayIso()}
          required
        />
      </Field>
      <Field label="Akun">
        <select name="account_type" className={selectCls} required>
          <option value="kas_tunai">Kas Tunai</option>
          <option value="bank">Bank</option>
        </select>
      </Field>
      <Field label="Kategori (COA)">
        <select
          name="category"
          className={selectCls}
          required
          onChange={(e) => setSelectedCoa(e.target.value)}
        >
          <option value="">-- Pilih kategori --</option>
          {COA_KELUAR.map((c) => (
            <option key={`${c.code}-${c.name}`} value={`${c.code} - ${c.name}`}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </Field>
      {/* Conditional HP fields */}
      {isHpCoa(selectedCoa) && (
        <Field label={counterpartyLabel(selectedCoa)}>
          <input
            name="counterparty"
            className={inputCls}
            placeholder="Masukkan nama..."
            required
          />
        </Field>
      )}
      {hasDueDateField(selectedCoa) && (
        <Field label="Jatuh Tempo (opsional)">
          <input name="due_date" type="date" className={inputCls} />
        </Field>
      )}
      <Field label="Jumlah">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Keterangan (opsional)">
        <input name="notes" className={inputCls} placeholder="Catatan tambahan" />
      </Field>
      <SubmitBtn pending={isPending} label="Simpan Pengeluaran" color="red" />
    </form>
  );
}

// ============================================================
// MODAL: Transfer Antar Akun
// ============================================================
function TransferModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<AccountType>("kas_tunai");

  const toLabel = from === "kas_tunai" ? "Bank" : "Kas Tunai";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) {
      setErr("Jumlah harus lebih dari 0");
      return;
    }
    startTransition(async () => {
      const res = await createKasTransfer({
        from_account: from,
        amount: amtVal,
        notes: (fd.get("notes") as string) || undefined,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Transfer berhasil diproses");
        onClose();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <ErrBanner msg={err} />}
      {/* From → To visual */}
      <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400">Dari</p>
          <select
            className="mt-0.5 w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none"
            value={from}
            onChange={(e) => setFrom(e.target.value as AccountType)}
          >
            <option value="kas_tunai">Kas Tunai</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <ArrowLeftRight className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="flex-1 text-right">
          <p className="text-xs text-gray-400">Ke</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-800">{toLabel}</p>
        </div>
      </div>
      <Field label="Tanggal">
        <input
          name="transaction_date"
          type="date"
          className={inputCls}
          defaultValue={todayIso()}
          required
        />
      </Field>
      <Field label="Jumlah">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Keterangan (opsional)">
        <input name="notes" className={inputCls} placeholder="Catatan transfer" />
      </Field>
      <SubmitBtn pending={isPending} label="Proses Transfer" />
    </form>
  );
}

// ============================================================
// MODAL: Edit Entry
// ============================================================
type EditTarget = {
  id: string;
  category: string;
  amount: number;
  notes: string | null;
  transaction_date: string | null;
};

function EditModal({
  entry,
  onClose,
}: {
  entry: EditTarget;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState(
    entry.amount.toLocaleString("id-ID")
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) {
      setErr("Jumlah harus lebih dari 0");
      return;
    }
    startTransition(async () => {
      const res = await updateKasEntry(entry.id, {
        category: fd.get("category") as string,
        amount: amtVal,
        notes: (fd.get("notes") as string) || undefined,
        transaction_date: (fd.get("transaction_date") as string) || undefined,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Transaksi berhasil diperbarui");
        onClose();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <ErrBanner msg={err} />}
      <Field label="Tanggal Transaksi">
        <input
          name="transaction_date"
          type="date"
          className={inputCls}
          defaultValue={entry.transaction_date ?? todayIso()}
          required
        />
      </Field>
      <Field label="Kategori (COA)">
        <input
          name="category"
          className={inputCls}
          defaultValue={entry.category}
          required
        />
      </Field>
      <Field label="Jumlah">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Keterangan">
        <input
          name="notes"
          className={inputCls}
          defaultValue={entry.notes ?? ""}
          placeholder="Catatan tambahan"
        />
      </Field>
      <SubmitBtn pending={isPending} label="Simpan Perubahan" />
    </form>
  );
}

// ============================================================
// QUICK ACTIONS BAR (top of page)
// ============================================================
export function KasQuickActions() {
  const [modal, setModal] = useState<"tambah" | "kurang" | "transfer" | null>(
    null
  );

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setModal("tambah")}
          className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Pemasukan
        </button>
        <button
          onClick={() => setModal("kurang")}
          className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
        >
          <Minus className="h-4 w-4" />
          Pengeluaran
        </button>
        <button
          onClick={() => setModal("transfer")}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Transfer
        </button>
      </div>

      <Modal
        open={modal === "tambah"}
        onClose={() => setModal(null)}
        title="Tambah Pemasukan"
      >
        <TambahModal onClose={() => setModal(null)} />
      </Modal>
      <Modal
        open={modal === "kurang"}
        onClose={() => setModal(null)}
        title="Tambah Pengeluaran"
      >
        <KurangModal onClose={() => setModal(null)} />
      </Modal>
      <Modal
        open={modal === "transfer"}
        onClose={() => setModal(null)}
        title="Transfer Antar Akun"
      >
        <TransferModal onClose={() => setModal(null)} />
      </Modal>
    </>
  );
}

// ============================================================
// ROW ACTIONS (edit + delete per row)
// ============================================================
type RowEntry = {
  id: string;
  category: string;
  amount: number;
  notes: string | null;
  transfer_ref: string | null;
  transaction_date: string | null;
};

export function KasRowActions({ entry }: { entry: RowEntry }) {
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const isTransfer = !!entry.transfer_ref;

  function handleDelete() {
    setErr("");
    startTransition(async () => {
      const res = await deleteKasEntry(entry.id);
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Transaksi berhasil dihapus");
        setModal(null);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {!isTransfer && (
          <button
            onClick={() => setModal("edit")}
            title="Edit"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => setModal("delete")}
          title="Hapus"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Edit Modal */}
      <Modal
        open={modal === "edit"}
        onClose={() => setModal(null)}
        title="Edit Transaksi"
      >
        <EditModal
          entry={entry}
          onClose={() => setModal(null)}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="Hapus Transaksi"
      >
        <div className="flex flex-col gap-4">
          {err && <ErrBanner msg={err} />}
          <p className="text-sm text-gray-600">
            {isTransfer
              ? "Transaksi ini merupakan bagian dari transfer. Menghapus akan menghapus kedua entri transfer."
              : "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan tidak dapat dibatalkan."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setModal(null)}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
