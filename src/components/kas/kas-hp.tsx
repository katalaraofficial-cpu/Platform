"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { addKasHp, recordKasHpPayment, deleteKasHp } from "@/lib/actions/kas-hp";
import type { KasHpRow } from "@/lib/actions/kas-hp";
import type { AccountType } from "@/types/database";

// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function parseAmount(display: string): number {
  return parseInt(display.replace(/\./g, ""), 10) || 0;
}
function fmtDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

// ── Status helpers ────────────────────────────────────────────
function getStatus(row: KasHpRow): "lunas" | "sebagian" | "belum" {
  if (row.paid_amount >= row.amount) return "lunas";
  if (row.paid_amount > 0) return "sebagian";
  return "belum";
}
function isOverdue(row: KasHpRow): boolean {
  if (!row.due_date) return false;
  return new Date(row.due_date) < new Date() && getStatus(row) !== "lunas";
}

// ── Field + Modal shell (shared with kas-actions) ─────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Add HP Modal ──────────────────────────────────────────────
function AddHpModal({ hp_type, onClose }: { hp_type: "hutang" | "piutang"; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");

  const label = hp_type === "hutang" ? "Hutang" : "Piutang";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) { setErr("Jumlah harus lebih dari 0"); return; }
    startTransition(async () => {
      const res = await addKasHp({
        hp_type,
        counterparty: fd.get("counterparty") as string,
        description: (fd.get("description") as string) || undefined,
        amount: amtVal,
        transaction_date: (fd.get("transaction_date") as string) || undefined,
        due_date: (fd.get("due_date") as string) || undefined,
      });
      if ("error" in res) { setErr(res.error); }
      else { toast.success(`${label} berhasil dicatat`); onClose(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <Field label="Tanggal">
        <input name="transaction_date" type="date" className={inputCls} defaultValue={todayIso()} required />
      </Field>
      <Field label={hp_type === "hutang" ? "Nama Vendor / Pemasok" : "Nama Customer / Pihak"}>
        <input name="counterparty" className={inputCls} placeholder={hp_type === "hutang" ? "e.g. CV Maju Jaya" : "e.g. Bapak Sari"} required />
      </Field>
      <Field label="Keterangan">
        <input name="description" className={inputCls} placeholder={hp_type === "hutang" ? "e.g. Beli sparepart kompresor" : "e.g. Servis AC gedung"} />
      </Field>
      <Field label="Jumlah">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">Rp</span>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            type="text" inputMode="numeric" placeholder="0" value={amount}
            onChange={(e) => setAmount(fmtDisplay(e.target.value))} required
          />
        </div>
      </Field>
      <Field label="Jatuh Tempo (opsional)">
        <input name="due_date" type="date" className={inputCls} />
      </Field>
      <button
        type="submit" disabled={isPending}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${hp_type === "hutang" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Catat {label}
      </button>
    </form>
  );
}

// ── Pay/Receive Modal ─────────────────────────────────────────
function PayModal({ row, onClose }: { row: KasHpRow; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");

  const remaining = row.amount - row.paid_amount;
  const label = row.hp_type === "hutang" ? "Bayar Hutang" : "Terima Piutang";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const amtVal = parseAmount(amount);
    if (!amtVal || amtVal <= 0) { setErr("Jumlah harus lebih dari 0"); return; }
    startTransition(async () => {
      const res = await recordKasHpPayment({
        hp_id: row.id,
        hp_type: row.hp_type,
        counterparty: row.counterparty,
        pay_amount: amtVal,
        account_type: fd.get("account_type") as AccountType,
        paid_at: (fd.get("paid_at") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      });
      if ("error" in res) { setErr(res.error); }
      else { toast.success(`${label} berhasil dicatat`); onClose(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      {/* Summary */}
      <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
        <p className="font-semibold text-gray-800">{row.counterparty}</p>
        <p className="text-gray-500">{row.description}</p>
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-gray-500">Total {row.hp_type === "hutang" ? "hutang" : "piutang"}</span>
          <span className="font-semibold">{fmt(row.amount)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Sudah dibayar</span>
          <span className="text-emerald-600">{fmt(row.paid_amount)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs font-bold">
          <span>Sisa</span>
          <span className="text-red-600">{fmt(remaining)}</span>
        </div>
      </div>
      <Field label="Tanggal Bayar">
        <input name="paid_at" type="date" className={inputCls} defaultValue={todayIso()} required />
      </Field>
      <Field label="Bayar via Akun">
        <select name="account_type" className={selectCls} required>
          <option value="kas_tunai">Kas Tunai</option>
          <option value="bank">Bank</option>
        </select>
      </Field>
      <Field label={`Jumlah ${row.hp_type === "hutang" ? "Bayar" : "Diterima"} (maks. ${fmt(remaining)})`}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">Rp</span>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            type="text" inputMode="numeric" placeholder={remaining.toLocaleString("id-ID")}
            value={amount} onChange={(e) => setAmount(fmtDisplay(e.target.value))} required
          />
        </div>
      </Field>
      <Field label="Keterangan (opsional)">
        <input name="notes" className={inputCls} placeholder="Catatan pembayaran" />
      </Field>
      <button
        type="submit" disabled={isPending}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${row.hp_type === "hutang" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </form>
  );
}

// ── HP Row Card ───────────────────────────────────────────────
function HpCard({ row }: { row: KasHpRow }) {
  const [showPay, setShowPay] = useState(false);
  const [isPending, startTransition] = useTransition();
  const status = getStatus(row);
  const overdue = isOverdue(row);
  const remaining = row.amount - row.paid_amount;

  const statusConfig = {
    lunas: { label: "Lunas", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    sebagian: { label: "Sebagian", cls: "bg-yellow-100 text-yellow-700", icon: Clock },
    belum: { label: overdue ? "Jatuh Tempo!" : "Belum Bayar", cls: overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600", icon: overdue ? AlertCircle : Clock },
  }[status];

  const StatusIcon = statusConfig.icon;

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteKasHp(row.id);
      if ("error" in res) toast.error(res.error);
      else toast.success("Data berhasil dihapus");
    });
  }

  return (
    <>
      <div className={`rounded-xl border bg-white p-4 ${overdue ? "border-red-200" : "border-gray-100"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-800">{row.counterparty}</p>
            {row.description && <p className="truncate text-xs text-gray-500">{row.description}</p>}
            <p className="mt-1 text-xs text-gray-400">
              {fmtDate(row.transaction_date)}
              {row.due_date && ` · Tempo: ${fmtDate(row.due_date)}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.cls}`}>
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {status !== "belum" && (
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, (row.paid_amount / row.amount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-800">{fmt(row.amount)}</p>
            {status !== "lunas" && (
              <p className="text-xs text-red-500">Sisa: {fmt(remaining)}</p>
            )}
          </div>
          <div className="flex gap-2">
            {status !== "lunas" && (
              <button
                onClick={() => setShowPay(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${row.hp_type === "hutang" ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-500 hover:bg-blue-600"}`}
              >
                {row.hp_type === "hutang" ? "Bayar" : "Terima"}
              </button>
            )}
            {status === "belum" && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal open={showPay} onClose={() => setShowPay(false)} title={row.hp_type === "hutang" ? "Bayar Hutang" : "Terima Piutang"}>
        <PayModal row={row} onClose={() => setShowPay(false)} />
      </Modal>
    </>
  );
}

// ── Section Component (exported) ─────────────────────────────
export function KasHpSection({
  hutang,
  piutang,
}: {
  hutang: KasHpRow[];
  piutang: KasHpRow[];
}) {
  const [activeTab, setActiveTab] = useState<"hutang" | "piutang">("hutang");
  const [addModal, setAddModal] = useState<"hutang" | "piutang" | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const rows = activeTab === "hutang" ? hutang : piutang;
  const pending = rows.filter((r) => getStatus(r) !== "lunas");
  const settled = rows.filter((r) => getStatus(r) === "lunas");

  const totalHutang = hutang.filter((r) => getStatus(r) !== "lunas").reduce((s, r) => s + (r.amount - r.paid_amount), 0);
  const totalPiutang = piutang.filter((r) => getStatus(r) !== "lunas").reduce((s, r) => s + (r.amount - r.paid_amount), 0);

  return (
    <>
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">Hutang &amp; Piutang</h2>
            <p className="text-xs text-gray-500">Kelola kewajiban dan tagihan Anda</p>
          </div>
          <button onClick={() => setCollapsed((v) => !v)} className="text-gray-400 hover:text-gray-600">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
              <div className="px-5 py-3">
                <p className="text-xs text-gray-500">Total Hutang Aktif</p>
                <p className="text-lg font-bold text-orange-600">{fmt(totalHutang)}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs text-gray-500">Total Piutang Aktif</p>
                <p className="text-lg font-bold text-blue-600">{fmt(totalPiutang)}</p>
              </div>
            </div>

            {/* Tabs + Add button */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                {(["hutang", "piutang"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${activeTab === t ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
                  >
                    {t === "hutang" ? "Hutang" : "Piutang"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAddModal(activeTab)}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-colors ${activeTab === "hutang" ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-500 hover:bg-blue-600"}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Catat {activeTab === "hutang" ? "Hutang" : "Piutang"}
              </button>
            </div>

            {/* List */}
            <div className="px-4 pb-4">
              {pending.length === 0 && settled.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  Belum ada {activeTab} — tekan tombol Catat untuk menambah
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {pending.map((r) => <HpCard key={r.id} row={r} />)}
                  {settled.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                        {settled.length} item sudah lunas
                      </summary>
                      <div className="mt-2 flex flex-col gap-3 opacity-60">
                        {settled.map((r) => <HpCard key={r.id} row={r} />)}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal open={addModal !== null} onClose={() => setAddModal(null)} title={addModal === "hutang" ? "Catat Hutang Baru" : "Catat Piutang Baru"}>
        {addModal && <AddHpModal hp_type={addModal} onClose={() => setAddModal(null)} />}
      </Modal>
    </>
  );
}
