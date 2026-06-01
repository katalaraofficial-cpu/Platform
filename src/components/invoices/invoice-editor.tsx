"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, ArrowLeft, Eye, Users } from "lucide-react";
import {
  searchCustomers,
  quickCreateCustomer,
  updateCustomerFromInvoice,
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
  updateInvoiceDueDate,
  updateInvoiceShipping,
  updateInvoiceDate,
  setInvoiceComplaintStatus,
} from "@/lib/actions/invoice";
import { PrintOptionsModal } from "@/components/invoices/print-options-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  unitLabel: string;
}

interface AssignedMechanic {
  assignmentId: string;
  mechanicId: string;
  name: string;
  role: MechanicRoleInInvoice;
  hasComplaint: boolean;
}

export interface MechanicOption {
  id: string;
  name: string;
}

export interface EditModeCustomer {
  id: string;
  name: string;
  phone: string | null;
  address?: string | null;
}

export interface InvoiceEditData {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate?: string | null;
  notes: string | null;
  ppnPct: number;
  pphPct: number;
  discountAmount: number;
  grandTotal: number;
  createdAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
  tenantId: string;
  dueDate?: string | null;
  shippingCost?: number;
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
  unit_label?: string;
}

export interface InitialAssignedMechanic {
  assignmentId: string;
  mechanicId: string;
  name: string;
  role: MechanicRoleInInvoice;
  hasComplaint?: boolean;
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
    unitLabel: i.unit_label ?? "",
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
  onCreated: (c: { id: string; name: string; phone: string | null; address: string | null }) => void;
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
      onCreated({ id: res.id, name: res.name, phone: phone || null, address: address || null });
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
  maxReached,
  onAssign,
  onClose,
}: {
  mechanics: MechanicOption[];
  assignedIds: string[];
  maxReached: boolean;
  onAssign: (mechanicId: string, role: MechanicRoleInInvoice) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [role, setRole] = useState<MechanicRoleInInvoice>("helper");
  const available = mechanics.filter((m) => !assignedIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 font-semibold text-gray-900">Tambah Engineer</h3>
        {maxReached ? (
          <p className="text-sm text-amber-600">Maksimal 10 engineer per invoice.</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-gray-500">Semua engineer sudah ditugaskan.</p>
        ) : (
          <div className="space-y-3">
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">-- Pilih Engineer --</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as MechanicRoleInInvoice)}
            >
              <option value="lead">Lead Engineer</option>
              <option value="helper">Helper</option>
            </select>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          {!maxReached && available.length > 0 && (
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

function CustomerPreviewModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: { id: string; name: string; phone: string | null; address: string | null };
  onClose: () => void;
  onSaved: (payload: { name: string; phone: string | null; address: string | null }) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim()) {
      setError("Nama pelanggan wajib diisi");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await updateCustomerFromInvoice(customer.id, {
        name,
        phone,
        address,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      setIsEditing(false);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Data Pelanggan</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Nama</p>
            {isEditing ? (
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ) : (
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{customer.name}</p>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">No. Telepon</p>
            {isEditing ? (
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxx"
              />
            ) : (
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{customer.phone || "-"}</p>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Alamat</p>
            {isEditing ? (
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat pelanggan"
              />
            ) : (
              <p className="min-h-16 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{customer.address || "-"}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Kembali
          </button>
          {isEditing ? (
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Ubah Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EngineerMembersModal({
  engineers,
  canEdit,
  onRemove,
  onClose,
}: {
  engineers: AssignedMechanic[];
  canEdit: boolean;
  onRemove: (assignmentId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Personil Engineer</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        {engineers.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada engineer ditugaskan.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {engineers.map((engineer, idx) => (
              <div
                key={engineer.assignmentId}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{idx + 1}. {engineer.name}</p>
                  <p className="text-xs text-gray-500">
                    {engineer.role === "lead" ? "Teknisi (Lead Engineer)" : "Helper"}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(engineer.assignmentId)}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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
  const [customer, setCustomer] = useState<{ id: string; name: string; phone: string | null; address: string | null } | null>(
    editCustomer ? { ...editCustomer, address: editCustomer.address ?? null } : null
  );
  const [customerSearch, setCustomerSearch] = useState(editCustomer?.name ?? "");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCustomerPreview, setShowCustomerPreview] = useState(false);

  // ── Date state ────────────────────────────────────────────────────────
  const [invoiceDate, setInvoiceDate] = useState(
    isEdit ? (editInvoice?.invoiceDate?.split("T")[0] ?? todayStr()) : todayStr()
  );
  useEffect(() => {
    if (isEdit) {
      setInvoiceDate(editInvoice?.invoiceDate?.split("T")[0] ?? todayStr());
    }
  }, [isEdit, editInvoice?.invoiceDate]);

  // ── Notes state ───────────────────────────────────────────────────────
  const [notes, setNotes] = useState(editInvoice?.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);

  // ── Mechanics state ───────────────────────────────────────────────────
  const [assignedMechanics, setAssignedMechanics] = useState<AssignedMechanic[]>(
    editAssignedMechanics.map((m) => ({ ...m, hasComplaint: Boolean(m.hasComplaint) }))
  );
  const hasComplaint = assignedMechanics.some((m) => m.hasComplaint);
  const [showMechanicPicker, setShowMechanicPicker] = useState(false);
  const [showEngineerMembers, setShowEngineerMembers] = useState(false);

  // ── Item input state ──────────────────────────────────────────────────
  const [itemType, setItemType] = useState<ItemType>("service");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemUnitLabel, setItemUnitLabel] = useState("");
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
  const [editUnitLabel, setEditUnitLabel] = useState("");
  const [editSellPrice, setEditSellPrice] = useState(0);
  const [editBuyPrice, setEditBuyPrice] = useState(0); // for part rows

  // ── Margin profit state ───────────────────────────────────────────────
  const [marginEnabled, setMarginEnabled] = useState(false);
  const [marginPct, setMarginPct] = useState(20);

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

  // ── Due date + shipping state ─────────────────────────────────────────
  const [dueDate, setDueDate] = useState(() => editInvoice?.dueDate ?? "");
  const [shippingCost, setShippingCost] = useState(() => Number(editInvoice?.shippingCost ?? 0));
  const [shippingInput, setShippingInput] = useState(() => {
    const s = Number(editInvoice?.shippingCost ?? 0);
    return s > 0 ? String(s) : "";
  });

  // ── Print size (create mode) ──────────────────────────────────────────
  const [printSize, setPrintSize] = useState<"thermal" | "a5" | "a4">("a4");
  const [showCostDetailsMobile, setShowCostDetailsMobile] = useState(false);

  // ── Payment state (edit + completed) ──────────────────────────────────
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(todayStr());

  // ── Transitions ───────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();

  // ── Confirm dialog state ──────────────────────────────────────────────
  const [pendingConfirm, setPendingConfirm] = useState<"rollback" | "payment" | null>(null);

  // ── Save state (create) ───────────────────────────────────────────────
  const [saveError, setSaveError] = useState("");

  const leadEngineer = assignedMechanics.find((m) => m.role === "lead") ?? assignedMechanics[0] ?? null;
  const otherEngineerCount = leadEngineer ? assignedMechanics.length - 1 : 0;
  const maxEngineerReached = assignedMechanics.length >= 10;
  const isCreateDirty =
    !isEdit &&
    (Boolean(customer) ||
      customerSearch.trim().length > 0 ||
      items.length > 0 ||
      assignedMechanics.length > 0 ||
      dueDate.length > 0 ||
      shippingCost > 0 ||
      invoiceDate !== todayStr());

  // ── Computed totals ───────────────────────────────────────────────────
  const preTax = items.reduce((s, i) => s + i.sellPrice * i.qty, 0);
  const ppnAmount = ppnEnabled ? (preTax * ppnPct) / 100 : 0;
  const pphAmount = pphEnabled ? (preTax * pphPct) / 100 : 0;
  const rawDiscount = Math.max(0, Number(discountInput) || 0);
  const computedDiscount = discountMode === "pct" ? (preTax * rawDiscount) / 100 : rawDiscount;
  const grandTotal = preTax + ppnAmount - pphAmount - computedDiscount + shippingCost;

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
  const showComplaintStatus = isEdit && displayStatus === "completed" && hasComplaint;

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

  // ── Auto-compute H.Jual from H.Beli + margin ─────────────────────────
  useEffect(() => {
    if (marginEnabled && itemType !== "service" && itemBuyPrice > 0) {
      setItemSellPrice(Math.round(itemBuyPrice * (1 + marginPct / 100)));
    }
  }, [itemBuyPrice, marginPct, marginEnabled, itemType]);

  // ── Add item ──────────────────────────────────────────────────────────
  function handleAddItem() {
    if (!itemDesc.trim()) { setAddItemError("Deskripsi wajib diisi"); return; }
    // Services must have H.Jual; parts can be 0 (price TBD)
    if (itemType === "service" && itemSellPrice <= 0) { setAddItemError("Harga jual wajib diisi untuk jasa"); return; }
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
          unitLabel: itemUnitLabel.trim(),
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
          unitLabel: itemUnitLabel.trim() || undefined,
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
            unitLabel: (d as Record<string, unknown>)["unit_label"] as string ?? "",
          },
        ]);
        resetItemInputs();
      });
    }
  }

  function resetItemInputs() {
    setItemDesc(""); setItemQty(1); setItemSellPrice(0); setItemBuyPrice(0); setItemUnitLabel("");
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
    setEditUnitLabel(item.unitLabel);
    setEditSellPrice(item.sellPrice);
    setEditBuyPrice(item.unitPrice);
  }

  function saveEditRow(item: EditorItem) {
    const newDesc = editDesc.trim() || item.description;
    const newQty = Math.max(0.01, editQty);
    const newSell = editSellPrice;
    const newBuy = editBuyPrice;
    const newUnitLabel = editUnitLabel.trim();

    if (!isEdit) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, description: newDesc, qty: newQty, sellPrice: newSell, unitPrice: newBuy, unitLabel: newUnitLabel }
            : i
        )
      );
      setEditRowId(null);
    } else {
      startTransition(async () => {
        if (item.itemType === "service") {
          await updateInvoiceItem(item.id, editInvoice!.id, props.basePath, {
            description: newDesc,
            quantity: newQty,
            unitPrice: newSell, // for services unit_price = sell_price
            unitLabel: newUnitLabel,
          });
        } else {
          await updateInvoiceItem(item.id, editInvoice!.id, props.basePath, {
            description: newDesc,
            quantity: newQty,
            unitPrice: newBuy,  // H.Beli
            sellPrice: newSell > 0 ? newSell : undefined, // H.Jual override
            unitLabel: newUnitLabel,
          });
        }
        const newMarkupPct = newBuy > 0 && newSell > 0
          ? Math.max(0, ((newSell - newBuy) / newBuy) * 100)
          : item.markupPct;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, description: newDesc, qty: newQty, sellPrice: newSell, unitPrice: newBuy, markupPct: newMarkupPct, unitLabel: newUnitLabel }
              : i
          )
        );
        setEditRowId(null);
      });
    }
  }

  // ── Mechanics ─────────────────────────────────────────────────────────
  function handleAddMechanic(mechanicId: string, role: MechanicRoleInInvoice) {
    if (assignedMechanics.length >= 10) return;
    if (assignedMechanics.some((m) => m.mechanicId === mechanicId)) return;
    const mechanic = props.mechanics.find((m) => m.id === mechanicId);
    if (!mechanic) return;

    if (!isEdit) {
      setAssignedMechanics((prev) => [
        ...prev,
        { assignmentId: uid(), mechanicId, name: mechanic.name, role, hasComplaint: false },
      ]);
    } else {
      startTransition(async () => {
        const res = await addMechanicToInvoice(
          editInvoice!.id, mechanicId, role, props.basePath
        );
        if ("error" in res) return;
        setAssignedMechanics((prev) => [
          ...prev,
          { assignmentId: res.assignmentId, mechanicId, name: mechanic.name, role, hasComplaint: false },
        ]);
      });
    }
  }

  function resetCreateDraft() {
    setItems([]);
    setCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setAssignedMechanics([]);
    setDueDate("");
    setShippingCost(0);
    setShippingInput("");
    setInvoiceDate(todayStr());
    setItemDesc("");
    setItemQty(1);
    setItemUnitLabel("");
    setItemSellPrice(0);
    setItemBuyPrice(0);
    setSuggestions([]);
    setShowSuggestions(false);
    setSaveError("");
    setShowCustomerPreview(false);
    setShowEngineerMembers(false);
  }

  function handleStartNewInvoice() {
    if (isEdit) return;
    if (isCreateDirty) {
      const proceed = window.confirm("Draft saat ini akan direset. Lanjut buat invoice baru?");
      if (!proceed) return;
    }
    resetCreateDraft();
  }

  function handleToggleComplaint() {
    if (!isEdit || displayStatus !== "completed") return;
    const next = !hasComplaint;
    startTransition(async () => {
      const res = await setInvoiceComplaintStatus(editInvoice!.id, next, props.basePath);
      if (res.error) return;
      setAssignedMechanics((prev) => prev.map((m) => ({ ...m, hasComplaint: next })));
    });
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
  function handleSaveTax(nextPpnEnabled = ppnEnabled, nextPpnPct = ppnPct, nextPphEnabled = pphEnabled, nextPphPct = pphPct) {
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceTax(
        editInvoice!.id,
        nextPpnEnabled ? nextPpnPct : 0,
        nextPphEnabled ? nextPphPct : 0,
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
    setPendingConfirm("rollback");
  }

  // ── Payment ───────────────────────────────────────────────────────────
  function handleProcessPayment() {
    if (!isEdit) return;
    setPendingConfirm("payment");
  }

  function executeConfirmedAction() {
    const action = pendingConfirm;
    setPendingConfirm(null);
    if (action === "rollback") {
      startTransition(async () => {
        await rollbackInvoiceStatus(editInvoice!.id, props.basePath);
        router.refresh();
      });
    } else if (action === "payment") {
      startTransition(async () => {
        await processPayment(editInvoice!.id, payMethod, payDate, props.basePath);
        router.refresh();
      });
    }
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
        dueDate: dueDate || undefined,
        invoiceDate: invoiceDate || undefined,
        shippingCost: shippingCost > 0 ? shippingCost : undefined,
        mechanics: assignedMechanics.map((m) => ({ id: m.mechanicId, role: m.role })),
        items: items.map((i) => ({
          description: i.description,
          itemType: i.itemType,
          qty: i.qty,
          unitPrice: i.unitPrice,
          sellPrice: i.sellPrice,
          notes: "",
          unitLabel: i.unitLabel || undefined,
          paymentSource: i.paymentSource ?? undefined,
        })),
      });
      if (res.error) { setSaveError(res.error); return; }
      router.push(`${props.basePath}/invoices/${res.invoiceId}`);
    });
  }

  // ── Due date save ─────────────────────────────────────────────────────
  function handleSaveInvoiceDate(val: string) {
    setInvoiceDate(val);
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceDate(editInvoice!.id, val || null, props.basePath);
    });
  }

  // ── Due date save ─────────────────────────────────────────────────────
  function handleSaveDueDate(val: string) {
    setDueDate(val);
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceDueDate(editInvoice!.id, val || null, props.basePath);
    });
  }

  // ── Shipping cost save ────────────────────────────────────────────────
  function handleSaveShipping() {
    const val = Math.max(0, Number(shippingInput) || 0);
    setShippingCost(val);
    if (!isEdit) return;
    startTransition(async () => {
      await updateInvoiceShipping(editInvoice!.id, val, props.basePath);
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-gray-50">
      {/* Confirm dialogs */}
      <ConfirmDialog
        open={pendingConfirm === "rollback"}
        title="Kembalikan Status"
        message="Kembalikan status invoice ke tahap sebelumnya?"
        confirmLabel="Ya, Kembalikan"
        onConfirm={executeConfirmedAction}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={pendingConfirm === "payment"}
        title="Konfirmasi Pembayaran"
        message={`Proses pelunasan sebesar ${fmt(grandTotal)}?`}
        confirmLabel="Ya, Proses"
        onConfirm={executeConfirmedAction}
        onCancel={() => setPendingConfirm(null)}
      />
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
      {showCustomerPreview && customer && (
        <CustomerPreviewModal
          customer={customer}
          onSaved={(payload) => {
            setCustomer((prev) =>
              prev
                ? {
                    ...prev,
                    name: payload.name,
                    phone: payload.phone,
                    address: payload.address,
                  }
                : prev
            );
            setCustomerSearch(payload.name);
          }}
          onClose={() => setShowCustomerPreview(false)}
        />
      )}
      {showMechanicPicker && (
        <MechanicPickerModal
          mechanics={props.mechanics}
          assignedIds={assignedMechanics.map((m) => m.mechanicId)}
          maxReached={maxEngineerReached}
          onAssign={handleAddMechanic}
          onClose={() => setShowMechanicPicker(false)}
        />
      )}
      {showEngineerMembers && (
        <EngineerMembersModal
          engineers={assignedMechanics}
          canEdit={canEdit}
          onRemove={handleRemoveMechanic}
          onClose={() => setShowEngineerMembers(false)}
        />
      )}

      {/* ── Title Bar ──────────────────────────────────────────────────── */}
      <div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-gray-700 bg-gray-900 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link
            href={`${props.basePath}/invoices`}
            className="flex shrink-0 items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Kembali</span>
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-white">
              {isEdit ? "Invoice" : "Invoice Baru"}
            </h1>
            {isEdit && (
              <p className="truncate text-[11px] text-gray-400">{editInvoice!.invoiceNumber}</p>
            )}
          </div>
          {isEdit && displayStatus && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                showComplaintStatus ? "bg-red-700 text-red-100" : STATUS_COLORS[displayStatus]
              }`}
            >
              {showComplaintStatus ? "Komplain" : STATUS_LABELS[displayStatus]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {!isEdit && (
            <button
              type="button"
              onClick={handleStartNewInvoice}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-400/40 bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/25"
            >
              <Plus size={12} />
              Buat Baru
            </button>
          )}
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
      <div className="shrink-0 border-b border-gray-700 bg-gray-800 px-3 py-3 sm:px-4">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-12">
          <div className="space-y-1.5 rounded-md border border-gray-700 bg-gray-800/60 p-2.5 xl:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tanggal</p>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              onBlur={(e) => {
                if (isEdit) handleSaveInvoiceDate(e.target.value);
              }}
              className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 rounded-md border border-gray-700 bg-gray-800/60 p-2.5 xl:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Jatuh Tempo</p>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleSaveDueDate(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 rounded-md border border-gray-700 bg-gray-800/60 p-2.5 xl:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Customer</p>
            {isEdit ? (
              <div className="flex min-w-0 items-center gap-2 rounded border border-gray-600 bg-gray-700 px-3 py-2">
                <span className="truncate text-sm font-medium text-white">
                  {editCustomer?.name ?? <span className="italic text-gray-500">–</span>}
                  {editCustomer?.phone && (
                    <span className="ml-1.5 text-xs text-gray-400">{editCustomer.phone}</span>
                  )}
                </span>
                {customer && (
                  <button
                    type="button"
                    onClick={() => setShowCustomerPreview(true)}
                    className="inline-flex items-center justify-center rounded border border-gray-500 p-1 text-gray-300 hover:border-blue-500 hover:text-blue-300"
                    title="Preview data pelanggan"
                  >
                    <Eye size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative flex min-w-0 items-center gap-2">
                <input
                  className="w-full min-w-0 rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Cari pelanggan..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                />
                {customer ? (
                  <>
                    <span className="text-xs text-green-400">✓</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomerPreview(true)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300"
                      title="Preview data pelanggan"
                    >
                      <Eye size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    title="Tambah pelanggan baru"
                    onClick={() => setShowAddCustomer(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400"
                  >
                    <Plus size={14} />
                  </button>
                )}
                {customerResults.length > 0 && !customer && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg sm:w-64">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          setCustomer({ id: c.id, name: c.name, phone: c.phone, address: c.address });
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
                      onClick={() => {
                        setCustomerResults([]);
                        setShowAddCustomer(true);
                      }}
                    >
                      + Tambah &ldquo;{customerSearch}&rdquo; sebagai baru
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded-md border border-gray-700 bg-gray-800/60 p-2.5 xl:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Engineer</p>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded border border-gray-600 bg-gray-700 px-2.5 py-2">
              {leadEngineer ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-700/30 px-2 py-0.5 text-xs text-blue-100">
                  Lead: {leadEngineer.name}
                </span>
              ) : (
                <span className="text-xs italic text-gray-400">Belum dipilih</span>
              )}
              {otherEngineerCount > 0 && (
                <span className="rounded-full bg-gray-600 px-2 py-0.5 text-xs text-gray-200">
                  +{otherEngineerCount} personil
                </span>
              )}
              {assignedMechanics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEngineerMembers(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-500 px-2 py-0.5 text-xs text-gray-200 hover:border-blue-400 hover:text-blue-200"
                >
                  <Users size={11} /> Lihat Engineer
                </button>
              )}
              {canEdit && props.mechanics.length > assignedMechanics.length && !maxEngineerReached && (
                <button
                  type="button"
                  onClick={() => setShowMechanicPicker(true)}
                  className="flex items-center gap-0.5 rounded-full border border-gray-500 px-1.5 py-0.5 text-xs text-gray-200 hover:border-gray-300 hover:text-white"
                >
                  <Plus size={10} /> Tambah
                </button>
              )}
              {maxEngineerReached && canEdit && (
                <span className="text-[10px] font-medium text-amber-400">Maks 10</span>
              )}
            </div>
          </div>

          {isEdit && (
            <div className="space-y-1.5 rounded-md border border-gray-700 bg-gray-800/60 p-2.5 xl:col-span-12">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Catatan</p>
              <input
                className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                placeholder="Catatan / pekerjaan..."
                value={notes}
                readOnly={!canEdit}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (isEdit) setNotesDirty(true);
                }}
                onBlur={() => {
                  if (isEdit && notesDirty) handleSaveNotes();
                }}
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
          )}
        </div>
      </div>

      {/* ── Main Body ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">

        {/* ── Left: Add-item strip + Items table ────────────────────────── */}
        <div className="flex min-w-0 flex-col overflow-visible md:flex-1 md:overflow-hidden">

          {/* Add Item Strip */}
          {canEdit && (
            <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-3 md:px-4 md:py-2.5">
              <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                  Tambah Item / Jasa Servis <span className="font-medium text-slate-400">&mdash; Ketik Nama, Tekan Enter</span>
                </p>

                <div className="mb-3 flex overflow-hidden rounded-lg border border-gray-200">
                  {(["service", "part_internal"] as const).map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setItemType(t)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors md:flex-none md:px-3 md:py-2 md:text-xs ${
                        i > 0 ? "border-l border-gray-200" : ""
                      } ${
                        itemType === t
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {t === "service" ? "Jasa" : "Barang"}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:hidden">
                  <div className="relative grid grid-cols-[1fr_52px] gap-2">
                    <input
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Nama item atau jasa..."
                      value={itemDesc}
                      onChange={(e) => handleDescInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={isPending}
                      className="flex items-center justify-center rounded border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
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

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-gray-500">Qty</p>
                      <input
                        type="number" min="0.01" step="any"
                        value={itemQty}
                        onChange={(e) => setItemQty(Number(e.target.value))}
                        className="w-full rounded border border-gray-300 px-2 py-2 text-center text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-gray-500">Satuan</p>
                      <input
                        type="text"
                        value={itemUnitLabel}
                        onChange={(e) => setItemUnitLabel(e.target.value)}
                        placeholder="pcs"
                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-gray-500">Harga Jual</p>
                      <input
                        type="number" min="0" step="any"
                        value={itemSellPrice || ""}
                        onChange={(e) => {
                          setItemSellPrice(Number(e.target.value));
                          if (marginEnabled) setMarginEnabled(false);
                        }}
                        placeholder="0"
                        className={`w-full rounded border px-2 py-2 text-right text-sm focus:outline-none ${
                          itemType !== "service" && itemSellPrice === 0
                            ? "border-amber-300 bg-amber-50 placeholder-amber-400 focus:border-amber-500"
                            : "border-gray-300 focus:border-blue-500"
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={isPending}
                    className="flex items-center justify-center gap-1 rounded bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                <div className="hidden gap-2 md:grid md:grid-cols-[minmax(0,1fr)_90px_110px_120px_120px_auto] md:items-end">
                  <div className="relative min-w-0">
                    <p className="mb-1 text-[11px] font-medium text-gray-500">Nama Item / Jasa</p>
                    <input
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Nama item / jasa..."
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

                  <div>
                    <p className="mb-1 text-[11px] font-medium text-gray-500">Qty</p>
                    <input
                      type="number" min="0.01" step="any"
                      value={itemQty}
                      onChange={(e) => setItemQty(Number(e.target.value))}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-center text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-medium text-gray-500">Satuan</p>
                    <input
                      type="text"
                      value={itemUnitLabel}
                      onChange={(e) => setItemUnitLabel(e.target.value)}
                      placeholder="pcs, unit..."
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-medium text-gray-500">H.Beli</p>
                    <input
                      type="number" min="0" step="any"
                      value={itemType !== "service" ? itemBuyPrice || "" : ""}
                      onChange={(e) => setItemBuyPrice(Number(e.target.value))}
                      placeholder={itemType === "service" ? "-" : "0"}
                      disabled={itemType === "service"}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-right text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-medium text-gray-500">H.Jual</p>
                    <input
                      type="number" min="0" step="any"
                      value={itemSellPrice || ""}
                      onChange={(e) => {
                        setItemSellPrice(Number(e.target.value));
                        if (marginEnabled) setMarginEnabled(false);
                      }}
                      placeholder={itemType === "service" ? "wajib" : "opsional"}
                      className={`w-full rounded border px-2 py-2 text-right text-sm focus:outline-none ${
                        itemType !== "service" && itemSellPrice === 0
                          ? "border-amber-300 bg-amber-50 placeholder-amber-400 focus:border-amber-500"
                          : "border-gray-300 focus:border-blue-500"
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={isPending}
                    className="flex items-center justify-center gap-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Plus size={14} /> Tambah
                  </button>
                </div>

                {addItemError && <span className="col-span-2 text-xs text-red-600">{addItemError}</span>}
              </div>
            </div>
          )}

          {!isEdit && (
          <div className="border-b border-gray-100 bg-white px-3 pb-3 md:hidden">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span className="font-mono">{fmt(preTax)}</span>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowCostDetailsMobile((prev) => !prev)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600"
                >
                  {showCostDetailsMobile ? "Sembunyikan rincian biaya" : "Tampilkan rincian biaya"}
                </button>
              </div>

              {showCostDetailsMobile && (
                <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
                      <input
                        type="checkbox"
                        checked={ppnEnabled}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const nextEnabled = e.target.checked;
                          setPpnEnabled(nextEnabled);
                          if (isEdit) handleSaveTax(nextEnabled, ppnPct, pphEnabled, pphPct);
                        }}
                        className="rounded"
                      />
                      <span>PPN</span>
                    </label>
                    {ppnEnabled && <span className="font-mono text-xs text-gray-600">+{fmt(ppnAmount)}</span>}
                  </div>

                  {ppnEnabled && canEdit && (
                    <input
                      type="number" min="0" max="100"
                      value={ppnPct}
                      onChange={(e) => setPpnPct(Number(e.target.value))}
                      onBlur={() => { if (isEdit) handleSaveTax(); }}
                      className="w-full rounded border border-gray-200 px-2 py-2 text-center text-xs focus:outline-none"
                    />
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
                      <input
                        type="checkbox"
                        checked={pphEnabled}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const nextEnabled = e.target.checked;
                          setPphEnabled(nextEnabled);
                          if (isEdit) handleSaveTax(ppnEnabled, ppnPct, nextEnabled, pphPct);
                        }}
                        className="rounded"
                      />
                      <span>PPh</span>
                    </label>
                    {pphEnabled && <span className="font-mono text-xs text-gray-600">-{fmt(pphAmount)}</span>}
                  </div>

                  {pphEnabled && canEdit && (
                    <input
                      type="number" min="0" max="100"
                      value={pphPct}
                      onChange={(e) => setPphPct(Number(e.target.value))}
                      onBlur={() => { if (isEdit) handleSaveTax(); }}
                      className="w-full rounded border border-gray-200 px-2 py-2 text-center text-xs focus:outline-none"
                    />
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Potongan / Bonus</span>
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
                    </div>
                    <input
                      type="number" min="0" step="any"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onBlur={() => { if (isEdit) handleSaveDiscount(); }}
                      placeholder="0"
                      className="w-full rounded border border-gray-200 px-2 py-2 text-right text-xs focus:outline-none"
                    />
                    {computedDiscount > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Potongan</span>
                        <span className="font-mono">-{fmt(computedDiscount)}</span>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs text-gray-500">Biaya Kirim</span>
                      <input
                        type="number" min="0" step="any"
                        value={shippingInput}
                        onChange={(e) => setShippingInput(e.target.value)}
                        onBlur={handleSaveShipping}
                        placeholder="0"
                        className="w-28 rounded border border-gray-200 px-2 py-1.5 text-right text-xs focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                <span className="font-semibold text-gray-900">Grand Total</span>
                <span className="font-mono text-base font-bold text-gray-900">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
          )}

          {/* Items Table */}
          <div className={`overflow-visible ${!isEdit ? "pb-40" : "pb-0"} md:flex-1 md:overflow-y-auto md:pb-0`}>
            {items.length === 0 ? (
              <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-gray-400">
                Belum ada item. Tambahkan item di atas.
              </div>
            ) : (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {items.map((item, idx) =>
                    editRowId === item.id ? (
                      <div key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            className="w-full rounded border border-blue-400 px-2 py-1.5 text-sm focus:outline-none"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              className="w-full rounded border border-blue-300 px-2 py-1.5 text-xs focus:outline-none"
                              value={editUnitLabel}
                              onChange={(e) => setEditUnitLabel(e.target.value)}
                              placeholder="Satuan"
                            />
                            <input
                              type="number" min="0.01" step="any"
                              className="w-full rounded border border-blue-400 px-2 py-1.5 text-right text-sm focus:outline-none"
                              value={editQty}
                              onChange={(e) => setEditQty(Number(e.target.value))}
                            />
                          </div>
                          {item.itemType !== "service" && (
                            <input
                              type="number" min="0" step="any"
                              className="w-full rounded border border-blue-300 px-2 py-1.5 text-right text-xs focus:outline-none"
                              value={editBuyPrice || ""}
                              onChange={(e) => setEditBuyPrice(Number(e.target.value))}
                              placeholder="H.Beli"
                            />
                          )}
                          <input
                            type="number" min="0" step="any"
                            className="w-full rounded border border-blue-400 px-2 py-1.5 text-right text-sm focus:outline-none"
                            value={editSellPrice || ""}
                            onChange={(e) => setEditSellPrice(Number(e.target.value))}
                            placeholder="H.Jual"
                          />
                          <div className="text-right font-mono text-xs text-gray-600">
                            {fmt(editSellPrice * editQty)}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEditRow(item)}
                              disabled={isPending}
                              className="flex-1 rounded bg-green-600 px-2 py-2 text-xs text-white hover:bg-green-500 disabled:opacity-50"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditRowId(null)}
                              className="flex-1 rounded border border-gray-300 px-2 py-2 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">#{idx + 1}</p>
                            <p className="truncate text-sm font-semibold text-gray-900">{item.description}</p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {item.itemType === "service" ? "Jasa" : item.itemType === "part_internal" ? "Barang" : "Part Ext."}
                            </p>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditRow(item)}
                                className="text-xs text-blue-600"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={isPending}
                                className="text-xs text-red-600 disabled:opacity-40"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
                          <span>Qty: {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)}</span>
                          <span className="text-right">Satuan: {item.unitLabel || "-"}</span>
                          <span>Harga: {item.sellPrice === 0 && item.itemType !== "service" ? "Belum diisi" : fmt(item.sellPrice)}</span>
                          <span className="text-right font-mono font-semibold text-gray-900">
                            {item.sellPrice === 0 && item.itemType !== "service" ? "-" : fmt(item.sellPrice * item.qty)}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              <table className="hidden w-full text-sm md:table">
                <thead className="sticky top-0 z-10 bg-gray-900">
                  <tr>
                    <th className="w-8 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">Nama Item / Jasa</th>
                    <th className="w-20 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">Satuan</th>
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
                          {item.itemType !== "service" && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-[10px] text-gray-400">H.Beli</span>
                              <input
                                type="number" min="0" step="any"
                                className="w-24 rounded border border-blue-300 px-1 py-0.5 text-right text-xs focus:outline-none"
                                value={editBuyPrice || ""}
                                onChange={(e) => setEditBuyPrice(Number(e.target.value))}
                                placeholder="0"
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded border border-blue-300 px-1 py-1 text-center text-xs focus:outline-none"
                            value={editUnitLabel}
                            onChange={(e) => setEditUnitLabel(e.target.value)}
                            placeholder="pcs"
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
                            value={editSellPrice || ""}
                            onChange={(e) => setEditSellPrice(Number(e.target.value))}
                            placeholder="0"
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
                            {item.itemType === "service" ? "Jasa" : item.itemType === "part_internal" ? "Barang" : "Part Ext."}
                            {item.markupPct > 0 && (
                              <span className="ml-1.5">
                                · Beli {fmt(item.unitPrice)} (+{item.markupPct.toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                          {item.unitLabel || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700">
                          {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {item.sellPrice === 0 && item.itemType !== "service" ? (
                            <button
                              type="button"
                              onClick={() => startEditRow(item)}
                              className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
                              title="Klik untuk set harga jual"
                            >
                              ✏ Set Harga
                            </button>
                          ) : (
                            fmt(item.sellPrice)
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                          {item.sellPrice === 0 && item.itemType !== "service"
                            ? <span className="text-xs text-amber-500">–</span>
                            : fmt(item.sellPrice * item.qty)
                          }
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
              </>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────────── */}
        <div className={`flex w-full shrink-0 flex-col border-t border-gray-200 bg-white ${!isEdit ? "pb-40 md:pb-0" : "pb-32 md:pb-0"} md:w-64 md:border-l md:border-t-0 md:overflow-y-auto`}>

          {/* Totals */}
          <div className="hidden space-y-2.5 border-b border-gray-100 p-4 md:block">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(preTax)}</span>
            </div>

            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setShowCostDetailsMobile((prev) => !prev)}
                className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600"
              >
                {showCostDetailsMobile ? "Sembunyikan rincian biaya" : "Tampilkan rincian biaya"}
              </button>
            </div>

            <div className={`${showCostDetailsMobile ? "space-y-2.5" : "hidden"} md:block md:space-y-2.5`}>

            {/* PPN */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
                <input
                  type="checkbox"
                  checked={ppnEnabled}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const nextEnabled = e.target.checked;
                    setPpnEnabled(nextEnabled);
                    if (isEdit) handleSaveTax(nextEnabled, ppnPct, pphEnabled, pphPct);
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
                    const nextEnabled = e.target.checked;
                    setPphEnabled(nextEnabled);
                    if (isEdit) handleSaveTax(ppnEnabled, ppnPct, nextEnabled, pphPct);
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

            {/* Shipping cost */}
            {canEdit ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-gray-500">Biaya Kirim</span>
                <input
                  type="number" min="0" step="any"
                  value={shippingInput}
                  onChange={(e) => setShippingInput(e.target.value)}
                  onBlur={handleSaveShipping}
                  placeholder="0"
                  className="w-28 rounded border border-gray-200 px-2 py-0.5 text-right text-xs focus:outline-none"
                />
              </div>
            ) : shippingCost > 0 ? (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Biaya Kirim</span>
                <span className="font-mono">+{fmt(shippingCost)}</span>
              </div>
            ) : null}

            </div>

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
                {displayStatus === "completed" && (
                  <button
                    type="button"
                    disabled={isPending || assignedMechanics.length === 0}
                    onClick={handleToggleComplaint}
                    className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      hasComplaint
                        ? "border border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                        : "border border-red-400 text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {hasComplaint ? "Selesai Komplain" : "Komplain"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Payment form (owner + admin, when completed) */}
          {isEdit && displayStatus === "completed" && (
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

          {/* Bottom CTA (desktop create only) */}
          {!isEdit && (
            <div className="mt-auto hidden space-y-2 p-4 md:block">
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
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
                  resetCreateDraft();
                }}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {!isEdit && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-3 md:hidden">
          <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Grand Total</span>
              <span className="font-mono text-sm font-bold text-gray-900">{fmt(grandTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  resetCreateDraft();
                }}
                className="rounded-lg border border-gray-200 py-2 text-sm text-gray-600"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !customer}
                className="rounded-lg bg-blue-600 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEdit && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-3 md:hidden">
          <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Grand Total</span>
              <span className="font-mono text-sm font-bold text-gray-900">{fmt(grandTotal)}</span>
            </div>
            {displayStatus === "completed" ? (
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isPending}
                className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Proses..." : "Tandai Lunas"}
              </button>
            ) : displayStatus === "paid" ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-xs font-semibold text-green-700">
                Invoice sudah lunas
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs text-gray-600">
                Lanjutkan proses dari menu status invoice
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
