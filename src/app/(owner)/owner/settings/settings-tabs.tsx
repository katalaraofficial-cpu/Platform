"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Store,
  Settings2,
  FileText,
  Gift,
  Trash2,
  Save,
  AlertTriangle,
} from "lucide-react";
import type { Settings } from "@/types/database";
import {
  saveStoreInfo,
  savePlatformSettings,
  saveNotaSettings,
  saveRewardSettings,
  resetAllData,
} from "@/lib/actions/settings";
import { toast } from "sonner";

// ── shared helpers ───────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none disabled:bg-gray-50"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none resize-none disabled:bg-gray-50"
    />
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
    >
      <Save className="h-4 w-4" />
      {pending ? "Menyimpan..." : "Simpan"}
    </button>
  );
}

// ── TABS ─────────────────────────────────────────────────────
const TABS = [
  { id: "toko", label: "Informasi Toko", icon: Store },
  { id: "platform", label: "Platform", icon: Settings2 },
  { id: "nota", label: "Nota & Printer", icon: FileText },
  { id: "reward", label: "Reward", icon: Gift },
  { id: "reset", label: "Reset Data", icon: Trash2 },
] as const;

// ── main component ───────────────────────────────────────────
export function SettingsTabs({
  activeTab,
  settings,
}: {
  activeTab: string;
  settings: Settings | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/owner/settings?tab=${id}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === id
                ? id === "reset"
                  ? "bg-red-50 text-red-600 shadow-sm"
                  : "bg-white text-gray-900 shadow-sm"
                : id === "reset"
                  ? "text-red-400 hover:text-red-600"
                  : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {activeTab === "toko" && <TabToko s={settings} />}
        {activeTab === "platform" && <TabPlatform s={settings} />}
        {activeTab === "nota" && <TabNota s={settings} />}
        {activeTab === "reward" && <TabReward s={settings} />}
        {activeTab === "reset" && <TabReset />}
      </div>
    </div>
  );
}

// ── Tab 1: Informasi Toko ────────────────────────────────────
function TabToko({ s }: { s: Settings | null }) {
  const [name, setName] = useState(s?.store_name ?? "");
  const [address, setAddress] = useState(s?.store_address ?? "");
  const [phone, setPhone] = useState(s?.store_phone ?? "");
  const [email, setEmail] = useState(s?.store_email ?? "");
  const [logoUrl, setLogoUrl] = useState(s?.store_logo_url ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveStoreInfo({ storeName: name, storeAddress: address, storePhone: phone, storeEmail: email, storeLogoUrl: logoUrl });
      if (res.error) toast.error(res.error); else toast.success(res.success);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      <h2 className="font-bold text-gray-900 text-lg">Informasi Toko</h2>
      <Field label="Nama Toko">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bengkel Jaya Abadi" />
      </Field>
      <Field label="Alamat">
        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Merdeka No. 1, Jakarta" />
      </Field>
      <Field label="Nomor Telepon">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812-3456-7890" />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bengkel@contoh.com" />
      </Field>
      <Field label="URL Logo (link gambar)">
        <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
      </Field>
      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

// ── Tab 2: Platform ──────────────────────────────────────────
function TabPlatform({ s }: { s: Settings | null }) {
  const [markupPct, setMarkupPct] = useState(String(s?.default_markup_pct ?? 20));
  const [pettyCash, setPettyCash] = useState(String(s?.petty_cash_limit ?? 500000));
  const [qtyDecimal, setQtyDecimal] = useState(s?.qty_decimal ?? false);
  const defaultLabels = s?.price_tier_labels ?? { HET: "HET", HG1: "HG1", HG2: "HG2", HG3: "HG3" };
  const [tierLabels, setTierLabels] = useState(defaultLabels);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePlatformSettings({
        defaultMarkupPct: parseFloat(markupPct) || 20,
        pettyCashLimit: parseInt(pettyCash) || 500000,
        qtyDecimal,
        priceTierLabels: tierLabels,
      });
      if (res.error) toast.error(res.error); else toast.success(res.success);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      <h2 className="font-bold text-gray-900 text-lg">Pengaturan Platform</h2>
      <Field label="Default Markup Sparepart Eksternal (%)">
        <Input type="number" min={0} max={100} step={0.1} value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} />
      </Field>
      <Field label="Limit Kas Kecil (Rp)">
        <Input type="number" min={0} step={1000} value={pettyCash} onChange={(e) => setPettyCash(e.target.value)} />
      </Field>
      <Field label="Kuantitas Desimal">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setQtyDecimal(!qtyDecimal)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${qtyDecimal ? "bg-violet-600" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${qtyDecimal ? "translate-x-6" : "translate-x-1"}`} />
          </div>
          <span className="text-sm text-gray-700">{qtyDecimal ? "Aktif (misal 1.5 liter)" : "Nonaktif (bilangan bulat)"}</span>
        </label>
      </Field>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Label Tier Harga</p>
        <div className="grid grid-cols-2 gap-3">
          {(["HET", "HG1", "HG2", "HG3"] as const).map((key) => (
            <Field key={key} label={`Tier ${key}`}>
              <Input
                value={tierLabels[key]}
                onChange={(e) => setTierLabels({ ...tierLabels, [key]: e.target.value })}
                placeholder={key}
              />
            </Field>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

// ── Tab 3: Nota & Printer ────────────────────────────────────
function TabNota({ s }: { s: Settings | null }) {
  const [header, setHeader] = useState(s?.nota_header ?? "");
  const [footer, setFooter] = useState(s?.nota_footer ?? "");
  const [signUrl, setSignUrl] = useState(s?.nota_signature_url ?? "");
  const [stampUrl, setStampUrl] = useState(s?.nota_stamp_url ?? "");
  const [format, setFormat] = useState<"A4" | "A5" | "thermal">(s?.nota_active_format ?? "A4");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveNotaSettings({ notaHeader: header, notaFooter: footer, notaSignatureUrl: signUrl, notaStampUrl: stampUrl, notaActiveFormat: format });
      if (res.error) toast.error(res.error); else toast.success(res.success);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      <h2 className="font-bold text-gray-900 text-lg">Nota &amp; Printer</h2>
      <Field label="Format Nota Aktif">
        <div className="flex gap-2">
          {(["A4", "A5", "thermal"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${format === f ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              {f === "thermal" ? "Thermal 58/80mm" : f}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Header Nota">
        <Textarea value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Terima kasih atas kepercayaan Anda..." />
      </Field>
      <Field label="Footer Nota">
        <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Garansi 3 bulan untuk pekerjaan." />
      </Field>
      <Field label="URL Gambar Tanda Tangan">
        <Input value={signUrl} onChange={(e) => setSignUrl(e.target.value)} placeholder="https://..." />
      </Field>
      <Field label="URL Gambar Stempel / Cap">
        <Input value={stampUrl} onChange={(e) => setStampUrl(e.target.value)} placeholder="https://..." />
      </Field>
      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

// ── Tab 4: Reward ────────────────────────────────────────────
function TabReward({ s }: { s: Settings | null }) {
  const [enabled, setEnabled] = useState(s?.reward_employee_enabled ?? false);
  const [spendPer, setSpendPer] = useState(String(s?.reward_spend_per_point ?? 100000));
  const [ptValue, setPtValue] = useState(String(s?.reward_point_value ?? 1000));
  const [minRedeem, setMinRedeem] = useState(String(s?.reward_min_redeem ?? 10));
  const [validity, setValidity] = useState(String(s?.reward_point_validity_days ?? 365));
  const [leadMult, setLeadMult] = useState(String(s?.reward_lead_multiplier ?? 1));
  const [helperMult, setHelperMult] = useState(String(s?.reward_helper_multiplier ?? 0.5));
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveRewardSettings({
        enabled,
        spendPerPoint: parseFloat(spendPer) || 100000,
        pointValue: parseFloat(ptValue) || 1000,
        minRedeem: parseInt(minRedeem) || 10,
        validityDays: parseInt(validity) || 365,
        leadMultiplier: parseFloat(leadMult) || 1,
        helperMultiplier: parseFloat(helperMult) || 0.5,
      });
      if (res.error) toast.error(res.error); else toast.success(res.success);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      <h2 className="font-bold text-gray-900 text-lg">Program Reward Mekanik</h2>
      <Field label="Status Program">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-amber-500" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
          </div>
          <span className="text-sm text-gray-700">{enabled ? "Program reward aktif" : "Program reward nonaktif"}</span>
        </label>
      </Field>
      <div className={`flex flex-col gap-5 transition-opacity ${enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        <Field label="Belanja per Point (Rp)">
          <Input type="number" min={1000} step={1000} value={spendPer} onChange={(e) => setSpendPer(e.target.value)} />
          <p className="text-xs text-gray-400">Contoh: 100.000 → setiap Rp 100.000 nilai invoice = 1 point dasar</p>
        </Field>
        <Field label="Nilai per Point (Rp)">
          <Input type="number" min={100} step={100} value={ptValue} onChange={(e) => setPtValue(e.target.value)} />
          <p className="text-xs text-gray-400">Contoh: 1.000 → 1 point = Rp 1.000 saat ditukar</p>
        </Field>
        <Field label="Minimal Redeem (point)">
          <Input type="number" min={1} value={minRedeem} onChange={(e) => setMinRedeem(e.target.value)} />
        </Field>
        <Field label="Masa Berlaku Point (hari)">
          <Input type="number" min={1} value={validity} onChange={(e) => setValidity(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Multiplier Lead">
            <Input type="number" min={0} step={0.1} value={leadMult} onChange={(e) => setLeadMult(e.target.value)} />
          </Field>
          <Field label="Multiplier Helper">
            <Input type="number" min={0} step={0.1} value={helperMult} onChange={(e) => setHelperMult(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

// ── Tab 5: Reset Data ─────────────────────────────────────────
function TabReset() {
  const [phrase, setPhrase] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = phrase === "HAPUS SEMUA";

  function handleReset() {
    if (!confirmed) return;
    startTransition(async () => {
      const res = await resetAllData(phrase);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        setPhrase("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-lg">Reset Semua Data</h2>
          <p className="text-sm text-red-500 font-medium">Tindakan ini tidak dapat dibatalkan</p>
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-700 mb-2">Data yang akan dihapus permanen:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
          <li>Semua invoice &amp; item invoice</li>
          <li>Semua data pelanggan</li>
          <li>Semua catatan kas (ledger)</li>
          <li>Riwayat reimburse &amp; kasbon mekanik</li>
          <li>Semua saldo &amp; riwayat point mekanik</li>
        </ul>
        <p className="mt-3 text-sm text-red-700">
          <strong>Tidak dihapus:</strong> akun pengguna, profil, dan pengaturan toko.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Ketik <span className="font-bold text-red-600">HAPUS SEMUA</span> untuk konfirmasi
        </label>
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="HAPUS SEMUA"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
        />
      </div>

      <button
        onClick={handleReset}
        disabled={!confirmed || pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Menghapus..." : "Hapus Semua Data Sekarang"}
      </button>
    </div>
  );
}
