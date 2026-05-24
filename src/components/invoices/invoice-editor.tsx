"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, ArrowLeft } from "lucide-react";
import {
  searchCustomers,
  quickCreateCustomer,
  type CustomerResult,
} from "@/lib/actions/customer";
import {
  createInvoiceWithItems,
  searchItemDescriptions,
  addItemToInvoice,
  addMechanicToInvoice,
  removeMechanic,
  removeInvoiceItem,
  updateInvoiceItem,
  updateInvoiceNotes,
  updateInvoiceTax,
  updateInvoiceDiscount,
  updateInvoiceStatus,
  rollbackInvoiceStatus,
  processPayment,
} from "@/lib/actions/invoice";
import { PrintOptionsModal } from "@/components/invoices/print-options-modal";
import type {
  ItemType,
  MechanicRoleInInvoice,
  InvoiceStatus,
  PaymentSource,
} from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────
interface EditorItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number; // buy price for parts, sell price for services
  sellPrice: number; // per-unit sell price
  itemType: ItemType;
  markupPct: number;
  paymentSource: PaymentSource | null;
}

interface AssignedMechanic {
  assignmentId: string;
  mechanicId: string;
  name: string;
  role: MechanicRoleInInvoice;
}

export interface MechanicOption {
  id: string;
  name: string;
}

export interface EditModeCustomer {
  id: string;
  name: string;
  phone: string | null;
}

export interface InvoiceEditData {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  notes: string | null;
  ppnPct: number;
  pphPct: number;
  discountAmount: number;
  grandTotal: number;
  createdAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
  tenantId: string;
}

export interface InitialDbItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  final_price: number;
  item_type: string;
  markup_pct: number;
  payment_source: string | null;
}

export interface InitialAssignedMechanic {
  assignmentId: string;
  mechanicId: string;
  name: string;
  role: MechanicRoleInInvoice;
}

export type InvoiceEditorProps = {
  basePath: string;
  mechanics: MechanicOption[];
  isOwner?: boolean;
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      invoice: InvoiceEditData;
      customer: EditModeCustomer | null;
      initialItems: InitialDbItem[];
      assignedMechanics: InitialAssignedMechanic[];
    }
);

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
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

function mapDbItem(i: InitialDbItem): EditorItem {
  const qty = Math.max(0.01, Number(i.quantity));
  return {
    id: i.id,
    description: i.description,
    qty,
    unitPrice: Number(i.unit_price),
    sellPrice: Number(i.final_price) / qty,
    itemType: i.item_type as ItemType,
    markupPct: Number(i.markup_pct),
    paymentSource: (i.payment_source as PaymentSource) ?? null,
  };
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-gray-600 text-gray-100",
  in_progress: "bg-blue-700 text-blue-100",
  completed: "bg-amber-700 text-amber-100",
  paid: "bg-green-700 text-green-100",
  cancelled: "bg-red-800 text-red-100",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};

const OWNER_NEXT_STATUS: Record<
  InvoiceStatus,
  { label: string; next: InvoiceStatus; color: string }[]
> = {
  draft: [
    { label: "Mulai Kerjakan", next: "in_progress", color: "bg-blue-600 hover:bg-blue-500 text-white" },
    { label: "Batalkan", next: "cancelled", color: "border border-red-400 text-red-500 hover:bg-red-50" },
  ],
  in_progress: [
    { label: "Tandai Selesai", next: "completed", color: "bg-amber-500 hover:bg-amber-400 text-white" },
    { label: "Batalkan", next: "cancelled", color: "border border-red-400 text-red-500 hover:bg-red-50" },
  ],
  completed: [
    { label: "Batalkan", next: "cancelled", color: "border border-red-400 text-red-500 hover:bg-red-50" },
  ],
  paid: [],
  cancelled: [],
};

const ADMIN_NEXT_STATUS: Record<
  InvoiceStatus,
  { label: string; next: InvoiceStatus; color: string }[]
> = {
  draft: [
    { label: "Mulai Kerjakan", next: "in_progress", color: "bg-blue-600 hover:bg-blue-500 text-white" },
    { label: "Batalkan", next: "cancelled", color: "border border-red-400 text-red-500 hover:bg-red-50" },
  ],
  in_progress: [
    { label: "Tandai Selesai", next: "completed", color: "bg-amber-500 hover:bg-amber-400 text-white" },
    { label: "Batalkan", next: "cancelled", color: "border border-red-400 text-red-500 hover:bg-red-50" },
  ],
  completed: [
    { label: "Tandai Lunas", next: "paid", color: "bg-green-600 hover:bg-green-500 text-white" },
    { label: "Batalkan", next: "cancelled", color: "border border-red-400 text-red-500 hover:bg-red-50" },
  ],
  paid: [],
  cancelled: [],
};

// ── Quick Add Customer Modal ─────────────────────────────────────────────
function QuickAddCustomerModal({
  initialName,
  onCreated,
  onClose,
}: {
  initialName: string;
  onCreated: (c: { id: string; name: string; phone: string | null }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState("");
  const [isPending, startT] = useTransition();

  function submit() {
    if (!name.trim()) { setErr("Nama wajib diisi"); return; }
    setErr("");
    startT(async () => {
      const res = await quickCreateCustomer(name, phone, address);
      if ("error" in res) { setErr(res.error); return; }
      onCreated({ id: res.id, name: res.name, phone: phone || null });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 font-semibold text-gray-900">Tambah Pelanggan Baru</h3>
        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
        <div className="space-y-3">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Nama pelanggan *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Telepon (opsional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Alamat (opsional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mechanic Picker Modal ────────────────────────────────────────────────
function MechanicPickerModal({
  mechanics,
  assignedIds,
  onAssign,
  onClose,
}: {
  mechanics: MechanicOption[];
  assignedIds: string[];
  onAssign: (mechanicId: string, role: MechanicRoleInInvoice) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [role, setRole] = useState<MechanicRoleInInvoice>("helper");
  const available = mechanics.filter((m) => !assignedIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 font-semibold text-gray-900">Tambah Mekanik</h3>
        {available.length === 0 ? (
          <p className="text-sm text-gray-500">Semua mekanik sudah ditugaskan.</p>
        ) : (
          <div className="space-y-3">
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">-- Pilih Mekanik --</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as MechanicRoleInInvoice)}
            >
              <option value="lead">Lead Mechanic</option>
              <option value="helper">Helper</option>
            </select>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          {available.length > 0 && (
            <button
              type="button"
              disabled={!selectedId}
              onClick={() => {
                if (selectedId) { onAssign(selectedId, role); onClose(); }
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Tambah
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function InvoiceEditor(props: InvoiceEditorProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  // Extract edit-mode data with proper types
  const editInvoice = isEdit ? (props as Extract<InvoiceEditorProps, { mode: "edit" }>).invoice : null;
  const editCustomer = isEdit ? (props as Extract<InvoiceEditorProps, { mode: "edit" }>).customer : null;
  const editInitialItems = isEdit ? (props as Extract<InvoiceEditorProps, { mode: "edit" }>).initialItems : [];
  const editAssignedMechanics = isEdit ? (props as Extract<InvoiceEditorProps, { mode: "edit" }>).assignedMechanics : [];

  // ── Items state ────────────────────────────────────────────────────────
  const [items, setItems] = useState<EditorItem[]>(() =>
    editInitialItems.map(mapDbItem)
  );

  // ── Status state (synced from server after refresh) ─────────────────
  const [displayStatus, setDisplayStatus] = useState<InvoiceStatus | null>(
    editInvoice?.status ?? null
  );
  useEffect(() => {
    if (editInvoice?.status) setDisplayStatus(editInvoice.status);
  }, [editInvoice?.status]);

  // ── Customer state ─────────────────────────────────────────────────
  const [customer, setCustomer] = useState<{ id: string; name: string; phone: string | null } | null>(
    editCustomer
  );
  const [customerSearch, setCustomerSearch] = useState(editCustomer?.name ?? "");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // ── Date state (create mode) ──────────────────────────────────────────
  const [invoiceDate, setInvoiceDate] = useState(todayStr());

  // ── Notes state ───────────────────────────────────────────────────────
  const [notes, setNotes] = useState(editInvoice?.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);

  // ── Mechanics state ───────────────────────────────────────────────────
  const [assignedMechanics, setAssignedMechanics] = useState<AssignedMechanic[]>(
    editAssignedMechanics
  );
  const [showMechanicPicker, setShowMechanicPicker] = useState(false);

  // ── Item input state ──────────────────────────────────────────────────
  const [itemType, setItemType] = useState<ItemType>("service");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemSellPrice, setItemSellPrice] = useState(0);
  const [itemBuyPrice, setItemBuyPrice] = useState(0);
  const [itemPaymentSource, setItemPaymentSource] = useState<PaymentSource>("owner");
  const [suggestions, setSuggestions] = useState<{ description: string; item_type: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addItemError, setAddItemError] = useState("");

  // ── Inline row editing state ──────────────────────────────────────────
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editSellPrice, setEditSellPrice] = useState(0);

  // ── Tax / Discount state ──────────────────────────────────────────────
  const [ppnEnabled, setPpnEnabled] = useState(() => Number(editInvoice?.ppnPct ?? 0) > 0);
  const [ppnPct, setPpnPct] = useState(() => Number(editInvoice?.ppnPct ?? 0) || 11);
  const [pphEnabled, setPphEnabled] = useState(() => Number(editInvoice?.pphPct ?? 0) > 0);
  const [pphPct, setPphPct] = useState(() => Number(editInvoice?.pphPct ?? 0) || 2);
  const [discountInput, setDiscountInput] = useState(() => {
    const d = Number(editInvoice?.discountAmount ?? 0);
    return d > 0 ? String(d) : "";
  });
  const [discountMode, setDiscountMode] = useState<"rp" | "pct">("rp");

  // ── Print size (create mode) ──────────────────────────────────────────
  const [printSize, setPrintSize] = useState<"thermal" | "a5" | "a4">("a4");

  // ── Payment state (edit + completed) ──────────────────────────────────
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(todayStr());

  // ── Transitions ───────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();

  // ── Save state (create) ───────────────────────────────────────────────
  const [saveError, setSaveError] = useState("");

  // ── Computed totals ───────────────────────────────────────────────────
  const preTax = items.reduce((s, i) => s + i.sellPrice * i.qty, 0);
  const ppnAmount = ppnEnabled ? (preTax * ppnPct) / 100 : 0;
  const pphAmount = pphEnabled ? (preTax * pphPct) / 100 : 0;
  const rawDiscount = Math.max(0, Number(discountInput) || 0);
  const computedDiscount = discountMode === "pct" ? (preTax * rawDiscount) / 100 : rawDiscount;
  const grandTotal = preTax + ppnAmount - pphAmount - computedDiscount;

  // ── Derived edit-mode flags ───────────────────────────────────────────
  const canEdit = isEdit ? displayStatus !== "cancelled" : true;
  const statusMap = props.isOwner ? OWNER_NEXT_STATUS : ADMIN_NEXT_STATUS;
  const statusActions = displayStatus ? (statusMap[displayStatus] ?? []) : [];
  const canRollback =
    isEdit &&
    props.isOwner &&
    displayStatus !== null &&
    displayStatus !== "draft" &&
    displayStatus !== "cancelled";

  // ── Customer search ───────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleCustomerSearch(q: string) {
    setCustomerSearch(q);
    setCustomer(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setCustomerResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await searchCustomers(q);
      if (!("error" in res)) setCustomerResults(res);
    }, 300);
  }

  // ── Item autocomplete ─────────────────────────────────────────────────
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleDescInput(v: string) {
    setItemDesc(v);
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    if (v.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestionTimer.current = setTimeout(async () => {
      const res = await searchItemDescriptions(v);
      setSuggestions(res);
      setShowSuggestions(res.length > 0);
    }, 250);
  }

  // ── Add item ──────────────────────────────────────────────────────────
  function handleAddItem() {
    if (!itemDesc.trim()) { setAddItemError("Deskripsi wajib diisi"); return; }
    if (itemSellPrice <= 0) { setAddItemError("Harga jual wajib diisi"); return; }
    setAddItemError("");

    const isPart = itemType !== "service";
    const markupPct = isPart && itemBuyPrice > 0
      ? Math.max(0, ((itemSellPrice - itemBuyPrice) / itemBuyPrice) * 100)
      : 0;

    if (!isEdit) {
      setItems((prev) => [
        ...prev,
        {
          id: uid(),
          description: itemDesc.trim(),
          qty: Math.max(0.01, itemQty),
          unitPrice: isPart ? itemBuyPrice : itemSellPrice,
          sellPrice: itemSellPrice,
          itemType,
          markupPct,
          paymentSource: itemType === "part_external" ? itemPaymentSource : null,
        },
      ]);
      resetItemInputs();
    } else {
      startTransition(async () => {
        const res = await addItemToInvoice({
          invoiceId: editInvoice!.id,
          tenantId: editInvoice!.tenantId,
          basePath: props.basePath,
          itemType,
          description: itemDesc.trim(),
          quantity: Math.max(0.01, itemQty),
          unitPrice: isPart ? itemBuyPrice : itemSellPrice,
          markupPct: isPart ? markupPct : 0,
          paymentSource: itemType === "part_external" ? itemPaymentSource : null,
        });
        if ("error" in res) { setAddItemError(res.error); return; }
        const d = res.item;
        const qty = Math.max(0.01, Number(d.quantity));
        setItems((prev) => [
          ...prev,
          {
            id: d.id,
            description: d.description,
            qty,
            unitPrice: Number(d.unit_price),
            sellPrice: Number(d.final_price) / qty,
            itemType: d.item_type as ItemType,
            markupPct: Number(d.markup_pct),
            paymentSource: null,
          },
        ]);
        resetItemInputs();
      });
    }
  }

  function resetItemInputs() {
    setItemDesc(""); setItemQty(1); setItemSellPrice(0); setItemBuyPrice(0);
    setSuggestions([]); setShowSuggestions(false);
  }

  // ── Remove item ───────────────────────────────────────────────────────
  function handleRemoveItem(itemId: string) {
    if (!isEdit) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      startTransition(async () => {
        await removeInvoiceItem(itemId, editInvoice!.id, props.basePath);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      });
    }
  }

  // ── Inline row editing ────────────────────────────────────────────────
  function startEditRow(item: EditorItem) {
    setEditRowId(item.id);
    setEditDesc(item.description);
    setEditQty(item.qty);
    setEditSellPrice(item.sellPrice);
  }

  function saveEditRow(item: EditorItem) {
    const newDesc = editDesc.trim() || item.description;
    const newQty = Math.max(0.01, editQty);
    const newSell = editSellPrice;

    if (!isEdit) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, description: newDesc, qty: newQty, sellPrice: newSell } : i
        )
      );
      setEditRowId(null);
    } else {
      // For services: unitPrice = sellPrice (since markup=0)
      // For parts: keep existing unitPrice, sell price changes via markup recalc server-side
      const unitPriceForAction = item.itemType === "service" ? newSell : item.unitPrice;
      startTransition(async () => {
        await updateInvoiceItem(item.id, editInvoice!.id, props.basePath, {
          description: newDesc,
          quantity: newQty,
          unitPrice: unitPriceForAction,
        });
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, description: newDesc, qty: newQty, sellPrice: newSell }
              : i
          )
        );
        setEditRowId(null);
      });
    }
  }

  // ── Mechanics ─────────────────────────────────────────────────────────
  function handleAddMechanic(mechanicId: string, role: MechanicRoleInInvoice) {
    const mechanic = props.mechanics.find((m) => m.id === mechanicId);
    if (!mechanic) return;

    if (!isEdit) {
      setAssignedMechanics((prev) => [
        ...prev,
        { assignmentId: uid(), mechanicId, name: mechanic.name, role },
      ]);
    } else {
      startTransition(async () => {
        const res = await addMechanicToInvoice(
          editInvoice!.id, mechanicId, role, props.basePath
        );
        if ("error" in res) return;
        setAssignedMechanics((prev) => [
          ...prev,
          { assignmentId: res.assignmentId, mechanicId, name: mechanic.name, role },
        ]);
      });
    }
  }

  function handleRemoveMechanic(assignmentId: string) {
    if (!isEdit) {
      setAssignedMechanics((prev) => prev.filter((m) => m.assignmentId !== assignmentId));
    } else {
      startTransition(async () => {
        await removeMechanic(assignmentId, editInvoice!.id, props.basePath);
        setAssignedMechanics((prev) => prev.filter((m) => m.assignmentId !== assignmentId));
      });
    }
  }

  // ── Notes save ────────────────────────────────────────────────────────
  function handleSaveNotes() {
    if (!isEdit || !notesDirty) return;
    startTransition(async () => {
      await updateInvoiceNotes(editInvoice!.id, notes, props.basePath);
      setNotesDirty(false);
    });
  }

  // ── Tax save ──────────────────────────────────────────────────────────
  function handleSaveTax() {
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceTax(
        editInvoice!.id,
        ppnEnabled ? ppnPct : 0,
        pphEnabled ? pphPct : 0,
        props.basePath
      );
    });
  }

  // ── Discount save ─────────────────────────────────────────────────────
  function handleSaveDiscount() {
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceDiscount(editInvoice!.id, computedDiscount, props.basePath);
    });
  }

  // ── Status change ─────────────────────────────────────────────────────
  function handleUpdateStatus(next: InvoiceStatus) {
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceStatus(editInvoice!.id, next as Parameters<typeof updateInvoiceStatus>[1], props.basePath);
      router.refresh();
    });
  }

  function handleRollback() {
    if (!isEdit) return;
    if (!confirm("Kembalikan status ke tahap sebelumnya?")) return;
    startTransition(async () => {
      await rollbackInvoiceStatus(editInvoice!.id, props.basePath);
      router.refresh();
    });
  }

  // ── Payment ───────────────────────────────────────────────────────────
  function handleProcessPayment() {
    if (!isEdit) return;
    if (!confirm(`Konfirmasi pembayaran ${fmt(grandTotal)}?`)) return;
    startTransition(async () => {
      await processPayment(editInvoice!.id, payMethod, payDate, props.basePath);
      router.refresh();
    });
  }

  // ── Save invoice (create mode) ────────────────────────────────────────
  function handleSave() {
    if (!customer) { setSaveError("Pelanggan wajib dipilih"); return; }
    setSaveError("");

    startTransition(async () => {
      const res = await createInvoiceWithItems({
        customerId: customer.id,
        jobDescription: "",
        notes,
        basePath: props.basePath,
        mechanics: assignedMechanics.map((m) => ({ id: m.mechanicId, role: m.role })),
        items: items.map((i) => ({
          description: i.description,
          itemType: i.itemType,
          qty: i.qty,
          unitPrice: i.unitPrice,
          sellPrice: i.sellPrice,
          notes: "",
          paymentSource: i.paymentSource ?? undefined,
        })),
      });
      if (res.error) { setSaveError(res.error); return; }
      router.push(`${props.basePath}/invoices/${res.invoiceId}`);
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-gray-50">
      {/* Modals */}
      {showAddCustomer && (
        <QuickAddCustomerModal
          initialName={customerSearch}
          onCreated={(c) => {
            setCustomer(c);
            setCustomerSearch(c.name);
            setCustomerResults([]);
            setShowAddCustomer(false);
          }}
          onClose={() => setShowAddCustomer(false)}
        />
      )}
      {showMechanicPicker && (
        <MechanicPickerModal
          mechanics={props.mechanics}
          assignedIds={assignedMechanics.map((m) => m.mechanicId)}
          onAssign={handleAddMechanic}
          onClose={() => setShowMechanicPicker(false)}
        />
      )}

      {/* ── Title Bar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-700 bg-gray-900 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`${props.basePath}/invoices`}
            className="flex shrink-0 items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Kembali</span>
          </Link>
          <span className="shrink-0 text-gray-600">|</span>
          <h1 className="truncate font-mono text-base font-bold text-white">
            {isEdit ? editInvoice!.invoiceNumber : "Invoice Baru"}
          </h1>
          {isEdit && displayStatus && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[displayStatus]}`}
            >
              {STATUS_LABELS[displayStatus]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isPending && (
            <span className="animate-pulse text-xs text-gray-400">Menyimpan…</span>
          )}
          {isEdit && (
            <PrintOptionsModal
              invoiceId={editInvoice!.id}
              invoiceNumber={editInvoice!.invoiceNumber}
              customerPhone={editCustomer?.phone}
              grandTotal={grandTotal}
            />
          )}
        </div>
      </div>

      {/* ── Field Strip ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-700 bg-gray-800 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Tgl</span>
            {isEdit ? (
              <span className="font-mono text-sm text-white">
                {new Date(editInvoice!.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            ) : (
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>

          <div className="hidden h-4 w-px bg-gray-600 sm:block" />

          {/* Customer */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Customer</span>
            {isEdit ? (
              <span className="text-sm font-medium text-white">
                {editCustomer?.name ?? <span className="italic text-gray-500">–</span>}
                {editCustomer?.phone && (
                  <span className="ml-1.5 text-xs text-gray-400">{editCustomer.phone}</span>
                )}
              </span>
            ) : (
              <div className="relative flex items-center gap-1">
                <input
                  className="w-40 rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Cari pelanggan…"
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                />
                {customer ? (
                  <span className="text-xs text-green-400">✓</span>
                ) : (
                  <button
                    type="button"
                    title="Tambah pelanggan baru"
                    onClick={() => setShowAddCustomer(true)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400"
                  >
                    <Plus size={11} />
                  </button>
                )}
                {customerResults.length > 0 && !customer && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          setCustomer({ id: c.id, name: c.name, phone: c.phone });
                          setCustomerSearch(c.name);
                          setCustomerResults([]);
                        }}
                      >
                        <span className="font-medium text-gray-900">{c.name}</span>
                        {c.phone && <span className="ml-2 text-xs text-gray-500">{c.phone}</span>}
                        {c.vehicle_plate && <span className="ml-2 text-xs text-gray-400">{c.vehicle_plate}</span>}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                      onClick={() => { setCustomerResults([]); setShowAddCustomer(true); }}
                    >
                      + Tambah &ldquo;{customerSearch}&rdquo; sebagai baru
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hidden h-4 w-px bg-gray-600 sm:block" />

          {/* Mechanics */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Mekanik</span>
            <div className="flex flex-wrap items-center gap-1">
              {assignedMechanics.map((m) => (
                <span
                  key={m.assignmentId}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-200"
                >
                  {m.name}
                  <span
                    className={`rounded-full px-1 text-[10px] font-medium ${
                      m.role === "lead" ? "bg-blue-700 text-blue-200" : "bg-gray-600 text-gray-300"
                    }`}
                  >
                    {m.role === "lead" ? "L" : "H"}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMechanic(m.assignmentId)}
                      className="ml-0.5 text-gray-400 hover:text-red-400"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
              {canEdit && props.mechanics.length > assignedMechanics.length && (
                <button
                  type="button"
                  onClick={() => setShowMechanicPicker(true)}
                  className="flex items-center gap-0.5 rounded-full border border-gray-600 px-1.5 py-0.5 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-300"
                >
                  <Plus size={10} /> Tambah
                </button>
              )}
              {assignedMechanics.length === 0 && !canEdit && (
                <span className="text-xs italic text-gray-500">–</span>
              )}
            </div>
          </div>

          <div className="hidden h-4 w-px bg-gray-600 sm:block" />

          {/* Notes / Catatan */}
          <div className="flex min-w-[160px] flex-1 items-center gap-1.5">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Catatan</span>
            <input
              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="Catatan / pekerjaan…"
              value={notes}
              readOnly={!canEdit}
              onChange={(e) => { setNotes(e.target.value); if (isEdit) setNotesDirty(true); }}
              onBlur={() => { if (isEdit && notesDirty) handleSaveNotes(); }}
            />
            {isEdit && notesDirty && (
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isPending}
                className="shrink-0 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                Simpan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Body ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">

        {/* ── Left: Add-item strip + Items table ────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Add Item Strip */}
          {canEdit && (
            <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* Type toggle */}
                <div className="flex shrink-0 overflow-hidden rounded border border-gray-200">
                  {(["service", "part_internal", "part_external"] as const).map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setItemType(t)}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        i > 0 ? "border-l border-gray-200" : ""
                      } ${
                        itemType === t
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {t === "service" ? "Jasa" : t === "part_internal" ? "Part Int." : "Part Ext."}
                    </button>
                  ))}
                </div>

                {/* Description with autocomplete */}
                <div className="relative min-w-[160px] flex-1">
                  <input
                    className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Nama item / jasa…"
                    value={itemDesc}
                    onChange={(e) => handleDescInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  />
                  {showSuggestions && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setItemDesc(s.description);
                            if (s.item_type !== "service") setItemType(s.item_type as ItemType);
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="text-gray-900">{s.description}</span>
                          <span className="ml-2 text-xs text-gray-400">{s.item_type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qty */}
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-gray-500">Qty</span>
                  <input
                    type="number" min="0.01" step="any"
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-14 rounded border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Buy price (parts only) */}
                {itemType !== "service" && (
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-gray-500">H.Beli</span>
                    <input
                      type="number" min="0" step="any"
                      value={itemBuyPrice || ""}
                      onChange={(e) => setItemBuyPrice(Number(e.target.value))}
                      placeholder="0"
                      className="w-24 rounded border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Sell price */}
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-gray-500">H.Jual</span>
                  <input
                    type="number" min="0" step="any"
                    value={itemSellPrice || ""}
                    onChange={(e) => setItemSellPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-28 rounded border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Payment source */}
                {itemType === "part_external" && (
                  <select
                    value={itemPaymentSource}
                    onChange={(e) => setItemPaymentSource(e.target.value as PaymentSource)}
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="owner">Dana Toko</option>
                    <option value="mechanic">Dana Mekanik</option>
                    <option value="petty_cash">Kas Kecil</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={isPending}
                  className="flex shrink-0 items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Plus size={14} /> Tambah
                </button>

                {addItemError && <span className="text-xs text-red-600">{addItemError}</span>}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-gray-400">
                Belum ada item. Tambahkan item di atas.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-900">
                  <tr>
                    <th className="w-8 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">Nama Item / Jasa</th>
                    <th className="w-16 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">Qty</th>
                    <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">H. Jual</th>
                    <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">Jumlah</th>
                    <th className="w-20 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item, idx) =>
                    editRowId === item.id ? (
                      // ── Edit row ─────────────────────────────────────
                      <tr key={item.id} className="bg-blue-50">
                        <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded border border-blue-400 px-2 py-1 text-sm focus:outline-none"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0.01" step="any"
                            className="w-full rounded border border-blue-400 px-1 py-1 text-center text-sm focus:outline-none"
                            value={editQty}
                            onChange={(e) => setEditQty(Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0" step="any"
                            className="w-full rounded border border-blue-400 px-1 py-1 text-right text-sm focus:outline-none"
                            value={editSellPrice}
                            onChange={(e) => setEditSellPrice(Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                          {fmt(editSellPrice * editQty)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEditRow(item)}
                              disabled={isPending}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
                            >✓</button>
                            <button
                              type="button"
                              onClick={() => setEditRowId(null)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                            >✕</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // ── Display row ───────────────────────────────────
                      <tr key={item.id} className="transition-colors hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          <div className="mt-0.5 text-xs text-gray-400">
                            {item.itemType === "service" ? "Jasa" : item.itemType === "part_internal" ? "Part Internal" : "Part External"}
                            {item.markupPct > 0 && (
                              <span className="ml-1.5">
                                · Beli {fmt(item.unitPrice)} (+{item.markupPct.toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700">
                          {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fmt(item.sellPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                          {fmt(item.sellPrice * item.qty)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center gap-2">
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditRow(item)}
                                  className="text-gray-400 hover:text-blue-600"
                                  title="Edit"
                                >✏</button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={isPending}
                                  className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                                  title="Hapus"
                                >🗑</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────────── */}
        <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white">

          {/* Totals */}
          <div className="border-b border-gray-100 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(preTax)}</span>
            </div>

            {/* PPN */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
                <input
                  type="checkbox"
                  checked={ppnEnabled}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setPpnEnabled(e.target.checked);
                    if (isEdit) setTimeout(handleSaveTax, 0);
                  }}
                  className="rounded"
                />
                <span>PPN</span>
                {ppnEnabled && canEdit && (
                  <>
                    <input
                      type="number" min="0" max="100"
                      value={ppnPct}
                      onChange={(e) => setPpnPct(Number(e.target.value))}
                      onBlur={() => { if (isEdit) handleSaveTax(); }}
                      className="w-10 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:outline-none"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </>
                )}
              </label>
              {ppnEnabled && <span className="font-mono text-xs text-gray-600">+{fmt(ppnAmount)}</span>}
            </div>

            {/* PPh */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
                <input
                  type="checkbox"
                  checked={pphEnabled}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setPphEnabled(e.target.checked);
                    if (isEdit) setTimeout(handleSaveTax, 0);
                  }}
                  className="rounded"
                />
                <span>PPh</span>
                {pphEnabled && canEdit && (
                  <>
                    <input
                      type="number" min="0" max="100"
                      value={pphPct}
                      onChange={(e) => setPphPct(Number(e.target.value))}
                      onBlur={() => { if (isEdit) handleSaveTax(); }}
                      className="w-10 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:outline-none"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </>
                )}
              </label>
              {pphEnabled && <span className="font-mono text-xs text-gray-600">-{fmt(pphAmount)}</span>}
            </div>

            {/* Discount */}
            {canEdit ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Diskon</span>
                  <div className="flex overflow-hidden rounded border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setDiscountMode("rp")}
                      className={`px-1.5 py-0.5 text-xs font-medium transition-colors ${discountMode === "rp" ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
                    >Rp</button>
                    <button
                      type="button"
                      onClick={() => setDiscountMode("pct")}
                      className={`px-1.5 py-0.5 text-xs font-medium transition-colors ${discountMode === "pct" ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
                    >%</button>
                  </div>
                  <input
                    type="number" min="0" step="any"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onBlur={() => { if (isEdit) handleSaveDiscount(); }}
                    placeholder="0"
                    className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-0.5 text-right text-xs focus:outline-none"
                  />
                </div>
                {computedDiscount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Potongan</span>
                    <span className="font-mono">-{fmt(computedDiscount)}</span>
                  </div>
                )}
              </div>
            ) : computedDiscount > 0 ? (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>Diskon</span>
                <span className="font-mono">-{fmt(computedDiscount)}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-gray-200 pt-2.5">
              <span className="font-semibold text-gray-900">Grand Total</span>
              <span className="font-mono text-base font-bold text-gray-900">{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Print size (create mode only) */}
          {!isEdit && (
            <div className="border-b border-gray-100 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Format Cetak
              </p>
              <div className="space-y-1.5">
                {([
                  ["thermal", "Struk Thermal (72mm)"],
                  ["a5", "Nota Kontan (A5)"],
                  ["a4", "Invoice Profesional (A4)"],
                ] as const).map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="printSize"
                      checked={printSize === v}
                      onChange={() => setPrintSize(v)}
                      className="text-blue-600"
                    />
                    <span className="text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status actions (edit mode) */}
          {isEdit && displayStatus && (statusActions.length > 0 || canRollback) && (
            <div className="border-b border-gray-100 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Ubah Status
              </p>
              <div className="flex flex-col gap-2">
                {statusActions.map(({ label, next, color }) => (
                  <button
                    key={next}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleUpdateStatus(next)}
                    className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${color}`}
                  >
                    {label}
                  </button>
                ))}
                {canRollback && (
                  <button
                    type="button"
                    onClick={handleRollback}
                    disabled={isPending}
                    className="w-full rounded-md border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                  >
                    ↩ Kembalikan Status
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Payment form (owner + completed) */}
          {isEdit && props.isOwner && displayStatus === "completed" && (
            <div className="border-b border-gray-100 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-600">
                Konfirmasi Pembayaran
              </p>
              <div className="space-y-2">
                <div className="flex gap-1">
                  {([["cash", "Tunai"], ["transfer", "Transfer"], ["other", "Lainnya"]] as const).map(([v, lbl]) => (
                    <label
                      key={v}
                      className={`flex-1 cursor-pointer rounded border px-1 py-1.5 text-center text-xs font-medium transition-colors ${
                        payMethod === v
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payMethod"
                        value={v}
                        checked={payMethod === v}
                        onChange={() => setPayMethod(v)}
                        className="sr-only"
                      />
                      {lbl}
                    </label>
                  ))}
                </div>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleProcessPayment}
                  disabled={isPending}
                  className="w-full rounded-md bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                >
                  {isPending ? "Proses…" : "Tandai Lunas"}
                </button>
              </div>
            </div>
          )}

          {/* Paid info */}
          {isEdit && displayStatus === "paid" && (
            <div className="border-b border-gray-100 p-4">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-700">✓ Lunas</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {editInvoice!.paymentMethod === "cash"
                    ? "Tunai (Cash)"
                    : editInvoice!.paymentMethod === "transfer"
                    ? "Transfer Bank"
                    : editInvoice!.paymentMethod === "other"
                    ? "Lainnya"
                    : "–"}
                  {editInvoice!.paidAt && (
                    <>
                      {" · "}
                      {new Date(editInvoice!.paidAt).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="mt-auto p-4 space-y-2">
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            {!isEdit ? (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending || !customer}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan…" : "Simpan Invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItems([]); setCustomer(null); setCustomerSearch("");
                    setNotes(""); setAssignedMechanics([]); setSaveError("");
                  }}
                  className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Reset
                </button>
              </>
            ) : (
              <Link
                href={`${props.basePath}/invoices`}
                className="block w-full rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                ← Kembali ke Daftar Invoice
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
