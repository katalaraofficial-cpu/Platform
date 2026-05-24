"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  UserPlus,
  X,
  Trash2,
  Printer,
  History,
  ArrowLeft,
} from "lucide-react";
import {
  searchCustomers,
  quickCreateCustomer,
  type CustomerResult,
} from "@/lib/actions/customer";
import {
  createInvoiceWithItems,
  type InvoiceItemDraft,
  type MechanicAssignment,
} from "@/lib/actions/invoice";
import type { ItemType, MechanicRoleInInvoice } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────
interface ItemRow {
  id: string;
  description: string;
  notes: string;
  qty: number;
  unitPrice: number;
  sellPrice: number;
  itemType: ItemType;
}

interface AssignedMechanic {
  id: string;
  name: string;
  role: MechanicRoleInInvoice;
}

interface MechanicOption {
  id: string;
  name: string;
}

export interface NewInvoicePosProps {
  basePath: string;
  mechanics: MechanicOption[];
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number) {
  if (n === 0) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

let _cnt = 0;
function uid() {
  return `item-${++_cnt}`;
}

// ── Quick Add Customer Modal ──────────────────────────────────
function QuickAddCustomerModal({
  onCreated,
  onClose,
}: {
  onCreated: (c: CustomerResult) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState("");
  const [isPending, startT] = useTransition();

  function submit() {
    if (!name.trim()) {
      setErr("Nama wajib diisi");
      return;
    }
    setErr("");
    startT(async () => {
      const res = await quickCreateCustomer(name, phone, address);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      onCreated({ id: res.id, name: res.name, phone: phone || null, vehicle_plate: null });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Tambah Pelanggan Baru</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {err && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {err}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">
              Nama Pelanggan <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Budi Santoso"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">No. HP / WA</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="08123456789"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Alamat</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Jl. Contoh No.1"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={isPending}
              className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Menyimpan..." : "Simpan Pelanggan"}
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mechanic Picker Modal ─────────────────────────────────────
function MechanicPickerModal({
  mechanics,
  assigned,
  onAssign,
  onClose,
}: {
  mechanics: MechanicOption[];
  assigned: AssignedMechanic[];
  onAssign: (m: MechanicOption, role: MechanicRoleInInvoice) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<MechanicRoleInInvoice>("lead");

  const filtered = mechanics.filter(
    (m) =>
      !assigned.find((a) => a.id === m.id) &&
      m.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xs rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Pilih Mekanik</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama mekanik..."
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        {/* Role selector */}
        <div className="mb-3 flex gap-1">
          {(["lead", "helper"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${
                role === r
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {r === "lead" ? "Lead Mekanik" : "Helper"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {mechanics.length === 0
              ? "Belum ada mekanik terdaftar"
              : "Semua mekanik sudah dipilih"}
          </p>
        ) : (
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => onAssign(m, role)}
                className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-blue-50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  {m.name[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-gray-900">{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item Table Row ────────────────────────────────────────────
function ItemTableRow({
  item,
  index,
  onRemove,
  onUpdate,
}: {
  item: ItemRow;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof ItemRow, value: string | number) => void;
}) {
  const jumlah = item.sellPrice * item.qty;

  return (
    <tr className="group border-b border-gray-100 hover:bg-blue-50/30">
      <td className="w-8 px-2 py-2 text-center text-xs text-gray-400">
        {index + 1}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              item.itemType === "service"
                ? "bg-blue-100 text-blue-600"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {item.itemType === "service" ? "Jasa" : "Part"}
          </span>
          <input
            value={item.description}
            onChange={(e) => onUpdate(item.id, "description", e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none"
          />
        </div>
      </td>
      <td className="w-32 px-2 py-2">
        <input
          value={item.notes}
          onChange={(e) => onUpdate(item.id, "notes", e.target.value)}
          placeholder="—"
          className="w-full bg-transparent text-xs text-gray-400 focus:outline-none"
        />
      </td>
      <td className="w-16 px-2 py-2 text-center">
        <input
          type="number"
          value={item.qty}
          min={1}
          onChange={(e) =>
            onUpdate(item.id, "qty", Math.max(1, Number(e.target.value)))
          }
          className="w-12 rounded border border-transparent px-1 py-0.5 text-center text-sm hover:border-gray-200 focus:border-blue-400 focus:outline-none"
        />
      </td>
      <td className="w-28 px-2 py-2 text-right">
        <input
          type="number"
          value={item.unitPrice || ""}
          min={0}
          placeholder="0"
          onChange={(e) => onUpdate(item.id, "unitPrice", Number(e.target.value))}
          className="w-full rounded border border-transparent px-1 py-0.5 text-right text-sm hover:border-gray-200 focus:border-blue-400 focus:outline-none"
        />
      </td>
      <td className="w-28 px-2 py-2 text-right">
        <input
          type="number"
          value={item.sellPrice || ""}
          min={0}
          placeholder="0"
          onChange={(e) => onUpdate(item.id, "sellPrice", Number(e.target.value))}
          className="w-full rounded border border-transparent px-1 py-0.5 text-right text-sm hover:border-gray-200 focus:border-blue-400 focus:outline-none"
        />
      </td>
      <td className="w-28 px-2 py-2 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
        {fmt(jumlah)}
      </td>
      <td className="w-8 px-2 py-2">
        <button
          onClick={() => onRemove(item.id)}
          className="rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── Main POS Component ────────────────────────────────────────
export function NewInvoicePos({ basePath, mechanics }: NewInvoicePosProps) {
  const router = useRouter();

  // Form state
  const [date, setDate] = useState(todayStr());
  const [customer, setCustomer] = useState<CustomerResult | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [assignedMechanics, setAssignedMechanics] = useState<AssignedMechanic[]>([]);
  const [showMechanicPicker, setShowMechanicPicker] = useState(false);
  const [notes, setNotes] = useState("");

  // Item input
  const [itemInput, setItemInput] = useState("");
  const [itemType, setItemType] = useState<ItemType>("service");
  const [itemQty, setItemQty] = useState(1);
  const [itemSellPrice, setItemSellPrice] = useState<number | "">("");
  const [items, setItems] = useState<ItemRow[]>([]);

  // UI
  const [printSize, setPrintSize] = useState("thermal-80");
  const [error, setError] = useState("");
  const [isSearching, startSearch] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const itemInputRef = useRef<HTMLInputElement>(null);
  const custInputRef = useRef<HTMLInputElement>(null);
  const custDropdownRef = useRef<HTMLDivElement>(null);

  // Computed
  const grandTotal = items.reduce((s, i) => s + i.sellPrice * i.qty, 0);

  // Customer search
  const handleCustomerQuery = useCallback(
    (q: string) => {
      setCustomerQuery(q);
      setCustomer(null);
      if (q.length >= 1) {
        startSearch(async () => {
          const results = await searchCustomers(q);
          setCustomerResults(results);
          setShowCustDropdown(true);
        });
      } else {
        setCustomerResults([]);
        setShowCustDropdown(false);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        custDropdownRef.current &&
        !custDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCustDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function selectCustomer(c: CustomerResult) {
    setCustomer(c);
    setCustomerQuery(c.name);
    setShowCustDropdown(false);
    setCustomerResults([]);
    itemInputRef.current?.focus();
  }

  // Item management
  function addItem() {
    const desc = itemInput.trim();
    if (!desc) return;
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        description: desc,
        notes: "",
        qty: itemQty || 1,
        unitPrice: 0,
        sellPrice: Number(itemSellPrice) || 0,
        itemType,
      },
    ]);
    setItemInput("");
    setItemQty(1);
    setItemSellPrice("");
    itemInputRef.current?.focus();
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof ItemRow, value: string | number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  // Mechanic management
  function assignMechanicFn(m: MechanicOption, role: MechanicRoleInInvoice) {
    if (assignedMechanics.find((a) => a.id === m.id)) return;
    setAssignedMechanics((prev) => [...prev, { id: m.id, name: m.name, role }]);
    setShowMechanicPicker(false);
  }

  function removeMechanicFn(id: string) {
    setAssignedMechanics((prev) => prev.filter((m) => m.id !== id));
  }

  // Reset
  function handleReset() {
    setDate(todayStr());
    setCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
    setJobDescription("");
    setAssignedMechanics([]);
    setNotes("");
    setItems([]);
    setItemInput("");
    setItemQty(1);
    setItemSellPrice("");
    setError("");
    custInputRef.current?.focus();
  }

  // Save
  function handleSave() {
    setError("");
    if (!customer) {
      setError("Pilih pelanggan terlebih dahulu");
      return;
    }
    startSaving(async () => {
      const result = await createInvoiceWithItems({
        customerId: customer.id,
        jobDescription,
        mechanics: assignedMechanics.map(
          (m): MechanicAssignment => ({ id: m.id, role: m.role })
        ),
        items: items.map(
          (i): InvoiceItemDraft => ({
            description: i.description,
            notes: i.notes,
            qty: i.qty,
            unitPrice: i.unitPrice,
            sellPrice: i.sellPrice,
            itemType: i.itemType,
          })
        ),
        notes,
        basePath,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`${basePath}/invoices/${result.invoiceId}`);
    });
  }

  // Keyboard shortcuts — run on every render to keep closures fresh
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F3") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "F5") {
        e.preventDefault();
        handleReset();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // ── Style helpers ──
  const labelCls =
    "block text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1";
  const inputCls =
    "w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/30 focus:bg-white/20 focus:outline-none";

  return (
    <>
      {/* ─── Full-bleed POS wrapper ─── */}
      <div className="flex flex-col -m-6 bg-gray-100" style={{ minHeight: "calc(100vh - 0px)" }}>
        {/* ─── Title bar ─── */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-800 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Link
              href={`${basePath}/invoices`}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
            <span className="text-white/20">|</span>
            <span className="font-semibold text-white">New Invoice</span>
          </div>
          <Link
            href={`${basePath}/invoices`}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20 hover:text-white"
          >
            <History className="h-3.5 w-3.5" />
            Riwayat
          </Link>
        </div>

        {/* ─── Field strip ─── */}
        <div className="flex items-stretch divide-x divide-white/10 border-b border-white/10 bg-slate-800">
          {/* TANGGAL */}
          <div className="shrink-0 px-3 py-2">
            <label className={labelCls}>Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} w-32`}
            />
          </div>

          {/* CUSTOMER */}
          <div className="relative flex-1 px-3 py-2" ref={custDropdownRef}>
            <label className={labelCls}>
              Customer <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                ref={custInputRef}
                value={customerQuery}
                onChange={(e) => handleCustomerQuery(e.target.value)}
                onFocus={() =>
                  customerResults.length > 0 && setShowCustDropdown(true)
                }
                placeholder="Nama customer..."
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => setShowQuickAddModal(true)}
                title="Tambah Customer Baru"
                className="flex shrink-0 items-center gap-1 rounded bg-white/10 px-2 py-1.5 text-xs text-white/60 hover:bg-white/20 hover:text-white"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            </div>
            {customer && (
              <p className="mt-0.5 text-[10px] text-emerald-400">
                ✓{" "}
                {[customer.vehicle_plate, customer.phone]
                  .filter(Boolean)
                  .join(" · ") || "Tersimpan"}
              </p>
            )}

            {/* Dropdown */}
            {showCustDropdown && (
              <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[240px] overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5">
                {isSearching ? (
                  <div className="px-3 py-3 text-xs text-gray-400">
                    Mencari...
                  </div>
                ) : customerResults.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-400">
                    Tidak ditemukan
                  </div>
                ) : (
                  customerResults.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-blue-50"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {c.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {[c.phone, c.vehicle_plate]
                            .filter(Boolean)
                            .join(" · ") || "Tidak ada info"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
                <button
                  onMouseDown={() => {
                    setShowCustDropdown(false);
                    setShowQuickAddModal(true);
                  }}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />+ Tambah Customer Baru
                </button>
              </div>
            )}
          </div>

          {/* PEKERJAAN */}
          <div className="flex-1 px-3 py-2">
            <label className={labelCls}>
              Pekerjaan <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Tune Up, Ganti Oli..."
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => setItemType("service")}
                title="Tambah Jasa"
                className="flex shrink-0 items-center gap-1 rounded bg-white/10 px-2 py-1.5 text-xs text-white/60 hover:bg-white/20 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* MEKANIK */}
          <div className="flex-1 px-3 py-2">
            <label className={labelCls}>Mekanik</label>
            <div className="flex flex-wrap items-center gap-1">
              {assignedMechanics.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs text-white"
                >
                  {m.name}
                  <span className="text-white/40">({m.role})</span>
                  <button
                    onClick={() => removeMechanicFn(m.id)}
                    className="text-white/50 hover:text-red-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setShowMechanicPicker(true)}
                className="flex items-center gap-1 rounded bg-white/10 px-2 py-1.5 text-xs text-white/60 hover:bg-white/20 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                {assignedMechanics.length === 0 ? "Nama mekanik" : "Tambah"}
              </button>
            </div>
          </div>

          {/* NO. NOTA */}
          <div className="shrink-0 px-3 py-2">
            <label className={labelCls}>No. Nota</label>
            <input
              readOnly
              placeholder="Auto jika kosong"
              className={`${inputCls} w-36 cursor-default opacity-50`}
            />
          </div>

          {/* CATATAN */}
          <div className="flex-1 px-3 py-2">
            <label className={labelCls}>Catatan</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan..."
              className={inputCls}
            />
          </div>
        </div>

        {/* ─── Item input strip ─── */}
        <div className="border-b border-gray-200 bg-white px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-500">
            ● Tambah Item / Jasa Servis — Ketik Nama, Tekan Enter
          </p>
          <div className="flex items-center gap-2">
            {/* Type toggle */}
            <div className="flex shrink-0 overflow-hidden rounded-md border border-gray-200">
              {(
                [
                  { val: "service", label: "Jasa" },
                  { val: "part_internal", label: "Part" },
                ] as { val: ItemType; label: string }[]
              ).map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setItemType(t.val)}
                  className={`px-2.5 py-1.5 text-xs font-semibold ${
                    itemType === t.val
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Item name */}
            <input
              ref={itemInputRef}
              value={itemInput}
              onChange={(e) => setItemInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="Nama item atau jasa..."
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <span className="shrink-0 text-gray-300">+</span>

            {/* QTY */}
            <input
              type="number"
              value={itemQty}
              min={1}
              onChange={(e) =>
                setItemQty(Math.max(1, Number(e.target.value)))
              }
              className="w-14 shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-center text-sm focus:border-blue-500 focus:outline-none"
            />

            <span className="shrink-0 text-xs font-medium text-gray-500">
              Harga Jual
            </span>

            {/* H.JUAL */}
            <input
              type="number"
              value={itemSellPrice}
              min={0}
              placeholder="0"
              onChange={(e) =>
                setItemSellPrice(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              className="w-28 shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
            />

            {/* ADD */}
            <button
              type="button"
              onClick={addItem}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              ADD
            </button>
          </div>
        </div>

        {/* ─── Main area ─── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Items table */}
          <div className="flex-1 overflow-auto">
            {error && (
              <div className="m-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="w-8 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                    Nama Item / Jasa
                  </th>
                  <th className="w-32 px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                    Ket.
                  </th>
                  <th className="w-16 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="w-28 px-2 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                    H.Beli
                  </th>
                  <th className="w-28 px-2 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                    H.Jual
                  </th>
                  <th className="w-28 px-2 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-20 text-center text-sm text-gray-400"
                    >
                      Ketik nama item/jasa lalu tekan Enter
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <ItemTableRow
                      key={item.id}
                      item={item}
                      index={i}
                      onRemove={removeItem}
                      onUpdate={updateItem}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Right sidebar */}
          <div className="flex w-48 shrink-0 flex-col border-l border-gray-200 bg-white">
            {/* Print size */}
            <div className="border-b border-gray-100 px-3 py-3">
              <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <Printer className="h-3 w-3" />
                Ukuran Print
              </label>
              <select
                value={printSize}
                onChange={(e) => setPrintSize(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
              >
                <option value="thermal-80">Thermal 80mm</option>
                <option value="thermal-58">Thermal 58mm</option>
                <option value="a4">A4</option>
              </select>
            </div>

            {/* Totals + actions */}
            <div className="flex flex-1 flex-col justify-between px-3 py-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                  <span>Grand Total</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  {isSaving ? "Menyimpan..." : "Simpan Invoice"}
                </button>
                <p className="text-center text-[10px] text-gray-400">
                  F3 Simpan · F4 +Cetak
                </p>
                <button
                  onClick={handleReset}
                  className="w-full rounded-md border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  ↺ Reset (F5)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2">
          <span className="text-sm font-medium text-gray-700">
            {items.length} item
          </span>
          <span className="text-xs text-gray-400">
            F1 Penuh Input · F3 Simpan · F4 +Cetak · F5 Reset
          </span>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {showQuickAddModal && (
        <QuickAddCustomerModal
          onCreated={(c) => {
            setCustomer(c);
            setCustomerQuery(c.name);
            setShowQuickAddModal(false);
            itemInputRef.current?.focus();
          }}
          onClose={() => setShowQuickAddModal(false)}
        />
      )}

      {showMechanicPicker && (
        <MechanicPickerModal
          mechanics={mechanics}
          assigned={assignedMechanics}
          onAssign={assignMechanicFn}
          onClose={() => setShowMechanicPicker(false)}
        />
      )}
    </>
  );
}
