"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Store,
  Settings2,
  FileText,
  Gift,
  Trash2,
  Save,
  AlertTriangle,
  Upload,
  X,
  Receipt,
  MapPin,
} from "lucide-react";
import type { FeatureToggles, Settings } from "@/types/database";
import {
  saveStoreInfo,
  savePlatformSettings,
  saveInvoiceFeatures,
  saveNotaSettings,
  saveRewardSettings,
  syncEngineerPoints,
  resetAllData,
} from "@/lib/actions/settings";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-template";
import { useRouter } from "next/navigation";

const NOTA_CONFIG_MARKER = "__KATALARA_NOTA_CONFIG__";

function extractNotaConfig(value: string | null | undefined) {
  if (!value) return { visibleText: "", config: null as Record<string, unknown> | null };
  const markerIndex = value.indexOf(NOTA_CONFIG_MARKER);
  if (markerIndex === -1) return { visibleText: value, config: null as Record<string, unknown> | null };
  const visibleText = value.slice(0, markerIndex).trimEnd();
  const rawConfig = value.slice(markerIndex + NOTA_CONFIG_MARKER.length).trim();
  const normalizedConfig = rawConfig.startsWith("{") ? rawConfig : rawConfig.replace(/^_+/, "");
  try {
    return { visibleText, config: JSON.parse(normalizedConfig) as Record<string, unknown> };
  } catch {
    return { visibleText, config: null as Record<string, unknown> | null };
  }
}

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
  { id: "modul-invoice", label: "Modul Invoice", icon: Receipt },
  { id: "lokasi", label: "Lokasi Kerja", icon: MapPin },
  { id: "nota", label: "Nota & Printer", icon: FileText },
  { id: "reward", label: "Reward", icon: Gift },
  { id: "reset", label: "Reset Data", icon: Trash2 },
] as const;

// ── main component ───────────────────────────────────────────
export function SettingsTabs({
  activeTab,
  settings,
  tenantId,
  featureToggles,
}: {
  activeTab: string;
  settings: Settings | null;
  tenantId: string;
  featureToggles: FeatureToggles | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
      <div className="flex w-full flex-wrap gap-1 rounded-xl bg-gray-100 p-1 sm:w-fit">
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
        {activeTab === "toko" && <TabToko s={settings} tenantId={tenantId} />}
        {activeTab === "platform" && <TabPlatform s={settings} />}
        {activeTab === "modul-invoice" && <TabModulInvoice featureToggles={featureToggles} />}
        {activeTab === "lokasi" && <TabLokasiKerja />}
        {activeTab === "nota" && <TabNota s={settings} tenantId={tenantId} />}
        {activeTab === "reward" && <TabReward s={settings} />}
        {activeTab === "reset" && <TabReset />}
      </div>
    </div>
  );
}

// ── Tab 1: Informasi Toko ────────────────────────────────────
function TabToko({ s, tenantId }: { s: Settings | null; tenantId: string }) {
  const router = useRouter();
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
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
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
      <ImageUploadField
        label="Logo Toko"
        currentUrl={logoUrl}
        onUploaded={setLogoUrl}
        tenantId={tenantId}
        fileKey="logo"
      />
      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

// ── Tab 2: Platform ──────────────────────────────────────────
function TabPlatform({ s }: { s: Settings | null }) {
  const router = useRouter();
  const [markupPct, setMarkupPct] = useState(String(s?.default_markup_pct ?? 20));
  const [pettyCash, setPettyCash] = useState(String(s?.petty_cash_limit ?? 500000));
  const [qtyDecimal, setQtyDecimal] = useState(s?.qty_decimal ?? false);
  const [featureCatalogEnabled, setFeatureCatalogEnabled] = useState(
    s?.feature_catalog_enabled ?? false,
  );
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
        featureCatalogEnabled,
        priceTierLabels: tierLabels,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
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
      <Field label="Modul Katalog Item">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setFeatureCatalogEnabled(!featureCatalogEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${featureCatalogEnabled ? "bg-violet-600" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${featureCatalogEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </div>
          <span className="text-sm text-gray-700">
            {featureCatalogEnabled ? "Aktif (menu Katalog Item ditampilkan)" : "Nonaktif (menu Katalog Item disembunyikan)"}
          </span>
        </label>
      </Field>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Label Tier Harga</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

// ── Tab 2b: Modul Invoice (DP / PPN / PPh) ──────────────────
function TabModulInvoice({ featureToggles }: { featureToggles: FeatureToggles | null }) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <div>
        <h2 className="font-bold text-gray-900 text-lg">Modul Invoice</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Aktifkan modul opsional pada editor invoice. Modul yang non-aktif tidak akan tampil saat membuat invoice baru.
          Invoice lama yang sudah memiliki nilai DP / PPN / PPh tetap menyimpan datanya sebagai jejak historis.
        </p>
      </div>

      <ModuleToggleRow
        moduleKey="module_invoice_dp"
        title="DP / Uang Muka"
        description="Memungkinkan pelanggan membayar sebagian dari total tagihan terlebih dahulu sebelum invoice lunas. Bila non-aktif, kolom DP tidak tampil di editor invoice."
        enabled={featureToggles?.module_invoice_dp === true}
      />
      <ModuleToggleRow
        moduleKey="module_invoice_ppn"
        title="PPN (Pajak Pertambahan Nilai)"
        description="Tambahkan PPN ke perhitungan invoice. PPN dihitung dari subtotal setelah diskon. Bila non-aktif, kolom PPN tidak tampil di editor invoice baru."
        enabled={featureToggles?.module_invoice_ppn !== false}
      />
      <ModuleToggleRow
        moduleKey="module_invoice_pph"
        title="PPh (Pajak Penghasilan)"
        description="Potongan PPh atas tagihan jasa. Dihitung dari subtotal setelah diskon. Bila non-aktif, kolom PPh tidak tampil di editor invoice baru."
        enabled={featureToggles?.module_invoice_pph !== false}
      />
    </div>
  );
}

function ModuleToggleRow({
  moduleKey,
  title,
  description,
  enabled: initial,
}: {
  moduleKey: "module_invoice_dp" | "module_invoice_ppn" | "module_invoice_pph";
  title: string;
  description: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    const prev = enabled;
    setEnabled(next);
    startTransition(async () => {
      const payload: {
        moduleInvoiceDp?: boolean;
        moduleInvoicePpn?: boolean;
        moduleInvoicePph?: boolean;
      } = {};
      if (moduleKey === "module_invoice_dp") payload.moduleInvoiceDp = next;
      if (moduleKey === "module_invoice_ppn") payload.moduleInvoicePpn = next;
      if (moduleKey === "module_invoice_pph") payload.moduleInvoicePph = next;
      const res = await saveInvoiceFeatures(payload);
      if (res.error) {
        setEnabled(prev);
        toast.error(res.error);
      } else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  return (
    <label className="flex items-start justify-between gap-4 rounded-xl bg-white border border-gray-200 p-4 cursor-pointer hover:border-violet-200 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => handleToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-violet-600" : "bg-gray-300"} ${pending ? "opacity-60" : ""}`}
        aria-pressed={enabled}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );
}

// ── Tab 2c: Lokasi Kerja (placeholder — fitur menyusul) ─────
function TabLokasiKerja() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <div>
        <h2 className="font-bold text-gray-900 text-lg">Lokasi Kerja</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Pengaturan titik koordinat lokasi kerja untuk validasi kehadiran karyawan via GPS.
          Saat absensi, lokasi karyawan akan dicocokkan dengan radius dari titik yang didaftarkan di sini.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
        <MapPin className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-700">Fitur belum aktif</p>
        <p className="mt-1 text-xs text-gray-500">
          Modul absensi GPS akan segera tersedia.
          <br />
          Konfigurasi titik lokasi & radius geofence dapat diatur di sini setelah modul diluncurkan.
        </p>
      </div>
    </div>
  );
}

// ── Image upload field ───────────────────────────────────────
function ImageUploadField({
  label,
  currentUrl,
  onUploaded,
  tenantId,
  fileKey,
}: {
  label: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
  tenantId: string;
  fileKey: string; // e.g. "signature" | "stamp"
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2 MB");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${tenantId}/${fileKey}.${ext}`;
      // upsert = true overwrites existing file
      const { error } = await supabase.storage
        .from("settings-assets")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) { toast.error("Upload gagal: " + error.message); return; }
      const { data: urlData } = supabase.storage
        .from("settings-assets")
        .getPublicUrl(path);
      onUploaded(urlData.publicUrl);
      toast.success(`${label} berhasil diupload`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {currentUrl ? (
          <div className="relative inline-flex w-full max-w-full items-start gap-3">
          <Image
            src={currentUrl}
            alt={label}
            width={120}
            height={80}
              className="h-auto max-w-[120px] rounded-xl border border-gray-200 object-contain bg-gray-50"
          />
          <button
            type="button"
            onClick={() => onUploaded("")}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex h-20 w-full max-w-[12rem] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
          Belum ada gambar
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex w-full max-w-fit items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading ? "Mengupload..." : currentUrl ? "Ganti Gambar" : "Upload Gambar"}
      </button>
    </div>
  );
}

// ── Format visual previews ──────────────────────────────────
function MiniA4() {
  return (
    <div style={{ width: 72, height: 100, border: "1.5px solid #d1d5db", borderRadius: 4, background: "#fff", overflow: "hidden", padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 2, borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ width: 22, height: 4, background: "#1e3a5f", borderRadius: 1 }} />
          <div style={{ width: 16, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
          <div style={{ width: 12, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <div style={{ width: 18, height: 4, background: "#2563eb", borderRadius: 1 }} />
          <div style={{ width: 14, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
          <div style={{ width: 16, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
        </div>
      </div>
      <div style={{ height: 2, background: "linear-gradient(to right, #2563eb, #93c5fd)", borderRadius: 1 }} />
      <div style={{ display: "flex", gap: 2 }}>
        <div style={{ flex: 1, height: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 2 }} />
        <div style={{ flex: 1, height: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 2 }} />
      </div>
      <div style={{ height: 4, background: "#1e3a5f", borderRadius: 1 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 3, background: i % 2 === 0 ? "#fff" : "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 1 }} />
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 28, height: 5, background: "#1e3a5f", borderRadius: 1 }} />
      </div>
      <div style={{ marginTop: "auto", display: "flex", gap: 3, borderTop: "1px solid #e2e8f0", paddingTop: 2 }}>
        <div style={{ flex: 1, height: 8, borderTop: "1px solid #94a3b8" }} />
        <div style={{ flex: 1, height: 8, borderTop: "1px solid #94a3b8" }} />
      </div>
    </div>
  );
}

function MiniA5() {
  return (
    <div style={{ width: 68, height: 94, border: "1.5px solid #d1d5db", borderRadius: 4, background: "#fff", overflow: "hidden", padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 2, borderBottom: "2px solid #000" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ width: 22, height: 5, background: "#111", borderRadius: 1 }} />
          <div style={{ width: 14, height: 2, background: "#94a3b8", borderRadius: 1 }} />
          <div style={{ width: 12, height: 2, background: "#94a3b8", borderRadius: 1 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <div style={{ width: 16, height: 4, background: "#374151", borderRadius: 1 }} />
          <div style={{ width: 14, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <div style={{ width: 22, height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ width: 18, height: 2, background: "#e2e8f0", borderRadius: 1 }} />
      </div>
      <div style={{ height: 4, background: "#f0f0f0", border: "1px solid #999", borderRadius: 1 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 3, background: "#fff", border: "1px solid #eee", borderRadius: 1 }} />
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 30, height: 4, borderTop: "2px solid #000" }} />
      </div>
      <div style={{ marginTop: "auto", display: "flex", gap: 3, borderTop: "1px solid #e2e8f0", paddingTop: 2 }}>
        <div style={{ flex: 1, height: 8, borderTop: "1px solid #374151" }} />
        <div style={{ flex: 1, height: 8, borderTop: "1px solid #374151" }} />
      </div>
    </div>
  );
}

function MiniThermal() {
  return (
    <div style={{ width: 44, height: 94, border: "1.5px solid #d1d5db", borderRadius: 4, background: "#fff", overflow: "hidden", padding: "4px 3px", display: "flex", flexDirection: "column", gap: 2, fontFamily: "monospace" }}>
      <div style={{ textAlign: "center", paddingBottom: 2, borderBottom: "1px dashed #888", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <div style={{ width: 30, height: 4, background: "#111", borderRadius: 1 }} />
        <div style={{ width: 22, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
        <div style={{ width: 18, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ width: 26, height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ width: 20, height: 2, background: "#e2e8f0", borderRadius: 1 }} />
      </div>
      <div style={{ borderTop: "1px dashed #888", borderBottom: "1px dashed #888", padding: "2px 0", display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ width: "100%", height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ width: "80%", height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ width: "100%", height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ width: "70%", height: 2, background: "#e2e8f0", borderRadius: 1 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ width: 14, height: 2, background: "#374151", borderRadius: 1 }} />
        <div style={{ width: 14, height: 4, background: "#111", borderRadius: 1 }} />
      </div>
      <div style={{ marginTop: "auto", textAlign: "center", borderTop: "1px dashed #888", paddingTop: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <div style={{ width: 30, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
        <div style={{ width: 22, height: 2, background: "#cbd5e1", borderRadius: 1 }} />
      </div>
    </div>
  );
}

const FORMAT_INFO = {
  A4: { label: "A4", desc: "Invoice Profesional", preview: <MiniA4 /> },
  A5: { label: "A5", desc: "Nota Kontan", preview: <MiniA5 /> },
  thermal: { label: "Thermal 58/80mm", desc: "Struk Kasir", preview: <MiniThermal /> },
} as const;

function FormatPicker({
  value,
  onChange,
}: {
  value: "A4" | "A5" | "thermal";
  onChange: (f: "A4" | "A5" | "thermal") => void;
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      {(["A4", "A5", "thermal"] as const).map((f) => {
        const info = FORMAT_INFO[f];
        const active = value === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 pt-3 pb-2 transition-colors ${
              active
                ? "border-violet-500 bg-violet-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className={`transition-opacity ${active ? "opacity-100" : "opacity-60"}`}>
              {info.preview}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className={`text-xs font-bold ${active ? "text-violet-700" : "text-gray-600"}`}>
                {info.label}
              </span>
              <span className={`text-[10px] ${active ? "text-violet-500" : "text-gray-400"}`}>
                {info.desc}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Format field panel (sections matching the receipt layout) ────────
function SectionBar({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border-y border-gray-100 px-4 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      {sublabel && (
        <>
          <div className="flex-1 border-t border-dashed border-gray-200" />
          <span className="text-[10px] text-gray-400 italic">{sublabel}</span>
        </>
      )}
    </div>
  );
}

function InfoRef({ rowLabel, value }: { rowLabel: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <span className="text-xs text-gray-400 shrink-0 sm:w-36">{rowLabel}</span>
      <span className="text-sm text-gray-800 font-medium break-words">
        {value || <span className="text-gray-300 italic text-xs">belum diisi</span>}
      </span>
    </div>
  );
}

function FormatFieldPanel({
  format,
  storeName,
  storeAddress,
  storePhone,
  storeEmail,
  notaTitle,
  setNotaTitle,
  notaTitleSize,
  setNotaTitleSize,
  notaSubtitle,
  setNotaSubtitle,
  notaCustomerLayout,
  setNotaCustomerLayout,
  notaSignatureLayout,
  setNotaSignatureLayout,
  notaJabatan,
  setNotaJabatan,
  showWatermark,
  setShowWatermark,
  header,
  setHeader,
  footer,
  setFooter,
  signUrl,
  setSignUrl,
  stampUrl,
  setStampUrl,
  tenantId,
}: {
  format: "A4" | "A5" | "thermal";
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  notaTitle: string;
  setNotaTitle: (v: string) => void;
  notaTitleSize: number;
  setNotaTitleSize: (v: number) => void;
  notaSubtitle: string;
  setNotaSubtitle: (v: string) => void;
  notaCustomerLayout: "stacked" | "split";
  setNotaCustomerLayout: (v: "stacked" | "split") => void;
  notaSignatureLayout: "double" | "single";
  setNotaSignatureLayout: (v: "double" | "single") => void;
  notaJabatan: string;
  setNotaJabatan: (v: string) => void;
  showWatermark: boolean;
  setShowWatermark: (v: boolean) => void;
  header: string;
  setHeader: (v: string) => void;
  footer: string;
  setFooter: (v: string) => void;
  signUrl: string;
  setSignUrl: (v: string) => void;
  stampUrl: string;
  setStampUrl: (v: string) => void;
  tenantId: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">

      {/* ── HEADER SECTION ─────────────────────────── */}
      <SectionBar label={format === "thermal" ? "Header Struk" : format === "A5" ? "Header Nota" : "Header Invoice"} />
      <div className="p-4 flex flex-col gap-3">
        {format !== "thermal" && (
          <>
            <Field label="Judul Nota / Invoice">
              <Input
                value={notaTitle}
                onChange={(e) => setNotaTitle(e.target.value)}
                placeholder={format === "A5" ? "NOTA KONTAN" : "INVOICE"}
              />
            </Field>
            <Field label="Ukuran Judul (px)">
              <Input
                type="number"
                min={16}
                max={42}
                step={1}
                value={String(notaTitleSize)}
                onChange={(e) => setNotaTitleSize(Math.max(16, Math.min(42, Number(e.target.value) || 28)))}
              />
            </Field>
            <Field label="Subjudul / Jenis Nota">
              <Input
                value={notaSubtitle}
                onChange={(e) => setNotaSubtitle(e.target.value)}
                placeholder={format === "A5" ? "Opsional (kosongkan jika tidak dipakai)" : ""}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Susunan Data Pelanggan">
                <select
                  value={notaCustomerLayout}
                  onChange={(e) => setNotaCustomerLayout(e.target.value as "stacked" | "split")}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                >
                  <option value="stacked">Bertumpuk / Vertikal</option>
                  <option value="split">Bersebelahan / 2 Kolom</option>
                </select>
              </Field>
              <Field label="Susunan Tanda Tangan">
                <select
                  value={notaSignatureLayout}
                  onChange={(e) => setNotaSignatureLayout(e.target.value as "double" | "single")}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                >
                  <option value="double">Owner + Penerima</option>
                  <option value="single">Owner saja</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Label Nomor Dokumen">
                <Input value="Nomor" disabled />
              </Field>
              <Field label="Label Tanggal">
                <Input value="Tanggal" disabled />
              </Field>
            </div>
          </>
        )}
        {format === "thermal" ? (
          <>
            <InfoRef rowLabel="Baris 1 — Nama Toko" value={storeName} />
            <InfoRef rowLabel="Baris 2 — Alamat" value={storeAddress} />
            <InfoRef rowLabel="Baris 3 — Telepon" value={storePhone} />
          </>
        ) : (
          <>
            <InfoRef rowLabel="Nama Toko" value={storeName} />
            <InfoRef rowLabel="Alamat" value={storeAddress} />
            <InfoRef rowLabel="Telepon" value={storePhone} />
            <InfoRef rowLabel="Email" value={storeEmail} />
          </>
        )}
        <Link
          href="/owner/settings?tab=toko"
          className="text-[11px] text-violet-500 hover:underline w-fit"
        >
          → Edit di Tab Informasi Toko
        </Link>
        {format === "thermal" && (
          <Field label={`Baris ${storeName && storeAddress && storePhone ? 4 : "Lanjutan"} — Teks Pembuka (opsional)`}>
            <Textarea
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="Tagihan ini resmi dari bengkel kami..."
            />
          </Field>
        )}
      </div>

      {/* ── AUTO SECTIONS ──────────────────────────── */}
      {(format === "A4" || format === "A5") && (
        <SectionBar label="Info Pelanggan" sublabel="nama, hp, kendaraan dari faktur" />
      )}
      {format === "A4" && (
        <SectionBar label="Kolom Header Tabel" sublabel="struktur sesuai template invoice" />
      )}
      <SectionBar label="Baris Item" sublabel="deskripsi, qty, satuan, harga dari faktur" />
      {format !== "thermal" && (
        <SectionBar label="Ringkasan Total" sublabel="diisi otomatis dari faktur" />
      )}

      {/* ── FOOTER SECTION ─────────────────────────── */}
      <SectionBar label={format === "thermal" ? "Footer Struk" : "Bagian Penutup / TTD"} />
      <div className="p-4 flex flex-col gap-4">
        {format !== "thermal" && (
          <>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2">
              <span className="text-sm font-medium text-gray-700">Aktifkan Watermark LUNAS</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showWatermark}
                onChange={(e) => setShowWatermark(e.target.checked)}
              />
            </label>
            <Field label="Jabatan (Nama Terang)">
              <Input
                value={notaJabatan}
                onChange={(e) => setNotaJabatan(e.target.value)}
                placeholder="Direktur / Manager / Owner"
              />
            </Field>
          </>
        )}
        {format === "thermal" ? (
          <Field label="Teks Penutup (opsional)">
            <Textarea
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Simpan struk ini sebagai bukti pembayaran."
            />
          </Field>
        ) : (
          <>
            <ImageUploadField
              label="Gambar Tanda Tangan"
              currentUrl={signUrl}
              onUploaded={setSignUrl}
              tenantId={tenantId}
              fileKey="signature"
            />
            <ImageUploadField
              label="Gambar Stempel / Cap"
              currentUrl={stampUrl}
              onUploaded={setStampUrl}
              tenantId={tenantId}
              fileKey="stamp"
            />
            <Field label="Catatan Penutup (opsional)">
              <Textarea
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Garansi 3 bulan untuk pekerjaan servis."
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Nota & Printer ────────────────────────────────────
function TabNota({ s, tenantId }: { s: Settings | null; tenantId: string }) {
  const router = useRouter();
  const legacyNotaHeader = extractNotaConfig(s?.nota_header);
  const legacyConfig = legacyNotaHeader.config ?? {};
  const hasLegacyNotaConfig = Boolean(legacyNotaHeader.config);
  const resolvedNotaTitle = hasLegacyNotaConfig
    ? ((legacyConfig.nota_title as string | null | undefined) ?? s?.nota_title ?? "")
    : ((s?.nota_title ?? legacyConfig.nota_title as string | null | undefined) ?? "");
  const resolvedNotaTitleSize = hasLegacyNotaConfig
    ? Number((legacyConfig.nota_title_size as number | undefined) ?? s?.nota_title_size ?? 28)
    : Number((s?.nota_title_size ?? legacyConfig.nota_title_size as number | undefined) ?? 28);
  const [notaTitle, setNotaTitle] = useState(resolvedNotaTitle);
  const initialTitleSize = resolvedNotaTitleSize;
  const [notaTitleSize, setNotaTitleSize] = useState<number>(Number.isFinite(initialTitleSize) ? initialTitleSize : 28);
  const resolvedNotaSubtitle = hasLegacyNotaConfig
    ? ((legacyConfig.nota_subtitle as string | null | undefined) ?? s?.nota_subtitle ?? "")
    : ((s?.nota_subtitle ?? legacyConfig.nota_subtitle as string | null | undefined) ?? "");
  const resolvedNotaCustomerLayout = hasLegacyNotaConfig
    ? ((legacyConfig.nota_customer_layout as "stacked" | "split" | undefined) ?? s?.nota_customer_layout ?? "stacked")
    : ((s?.nota_customer_layout ?? legacyConfig.nota_customer_layout as "stacked" | "split" | undefined) ?? "stacked");
  const resolvedNotaSignatureLayout = hasLegacyNotaConfig
    ? ((legacyConfig.nota_signature_layout as "double" | "single" | undefined) ?? s?.nota_signature_layout ?? "double")
    : ((s?.nota_signature_layout ?? legacyConfig.nota_signature_layout as "double" | "single" | undefined) ?? "double");
  const resolvedNotaJabatan = hasLegacyNotaConfig
    ? ((legacyConfig.nota_jabatan as string | undefined) ?? s?.nota_jabatan ?? "")
    : ((s?.nota_jabatan ?? legacyConfig.nota_jabatan as string | undefined) ?? "");
  const resolvedShowWatermark = hasLegacyNotaConfig
    ? ((legacyConfig.nota_show_watermark as boolean | undefined) ?? s?.nota_show_watermark ?? true)
    : ((s?.nota_show_watermark ?? legacyConfig.nota_show_watermark as boolean | undefined) ?? true);
  const [notaSubtitle, setNotaSubtitle] = useState(resolvedNotaSubtitle);
  const [notaCustomerLayout, setNotaCustomerLayout] = useState<"stacked" | "split">(resolvedNotaCustomerLayout);
  const [notaSignatureLayout, setNotaSignatureLayout] = useState<"double" | "single">(resolvedNotaSignatureLayout);
  const [notaJabatan, setNotaJabatan] = useState(resolvedNotaJabatan);
  const [showWatermark, setShowWatermark] = useState(resolvedShowWatermark);
  const [header, setHeader] = useState(legacyNotaHeader.visibleText);
  const [footer, setFooter] = useState(s?.nota_footer ?? "");
  const [signUrl, setSignUrl] = useState(s?.nota_signature_url ?? "");
  const [stampUrl, setStampUrl] = useState(s?.nota_stamp_url ?? "");
  const [format, setFormat] = useState<"A4" | "A5" | "thermal">(s?.nota_active_format ?? "A4");
  const [waTemplate, setWaTemplate] = useState<string>(s?.wa_message_template ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refreshedLegacyNotaHeader = extractNotaConfig(s?.nota_header);
    const refreshedLegacyConfig = refreshedLegacyNotaHeader.config ?? {};
    const refreshedHasLegacyConfig = Boolean(refreshedLegacyNotaHeader.config);
    const refreshedTitle = refreshedHasLegacyConfig
      ? ((refreshedLegacyConfig.nota_title as string | null | undefined) ?? s?.nota_title ?? "")
      : ((s?.nota_title ?? refreshedLegacyConfig.nota_title as string | null | undefined) ?? "");
    const refreshedTitleSize = refreshedHasLegacyConfig
      ? Number((refreshedLegacyConfig.nota_title_size as number | undefined) ?? s?.nota_title_size ?? 28)
      : Number((s?.nota_title_size ?? refreshedLegacyConfig.nota_title_size as number | undefined) ?? 28);

    setNotaTitle(refreshedTitle);
    setNotaTitleSize(Number.isFinite(refreshedTitleSize) ? refreshedTitleSize : 28);
    setNotaSubtitle(refreshedHasLegacyConfig
      ? ((refreshedLegacyConfig.nota_subtitle as string | null | undefined) ?? s?.nota_subtitle ?? "")
      : ((s?.nota_subtitle ?? refreshedLegacyConfig.nota_subtitle as string | null | undefined) ?? ""));
    setNotaCustomerLayout(refreshedHasLegacyConfig
      ? ((refreshedLegacyConfig.nota_customer_layout as "stacked" | "split" | undefined) ?? s?.nota_customer_layout ?? "stacked")
      : ((s?.nota_customer_layout ?? refreshedLegacyConfig.nota_customer_layout as "stacked" | "split" | undefined) ?? "stacked"));
    setNotaSignatureLayout(refreshedHasLegacyConfig
      ? ((refreshedLegacyConfig.nota_signature_layout as "double" | "single" | undefined) ?? s?.nota_signature_layout ?? "double")
      : ((s?.nota_signature_layout ?? refreshedLegacyConfig.nota_signature_layout as "double" | "single" | undefined) ?? "double"));
    setNotaJabatan(refreshedHasLegacyConfig
      ? ((refreshedLegacyConfig.nota_jabatan as string | undefined) ?? s?.nota_jabatan ?? "")
      : ((s?.nota_jabatan ?? refreshedLegacyConfig.nota_jabatan as string | undefined) ?? ""));
    setShowWatermark(refreshedHasLegacyConfig
      ? ((refreshedLegacyConfig.nota_show_watermark as boolean | undefined) ?? s?.nota_show_watermark ?? true)
      : ((s?.nota_show_watermark ?? refreshedLegacyConfig.nota_show_watermark as boolean | undefined) ?? true));
    setHeader(refreshedLegacyNotaHeader.visibleText);
    setFooter(s?.nota_footer ?? "");
    setSignUrl(s?.nota_signature_url ?? "");
    setStampUrl(s?.nota_stamp_url ?? "");
    setFormat((s?.nota_active_format ?? "A4") as "A4" | "A5" | "thermal");
    setWaTemplate(s?.wa_message_template ?? "");
  }, [s]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveNotaSettings({
        notaTitle,
        notaTitleSize,
        notaSubtitle,
        notaCustomerLayout,
        notaSignatureLayout,
        notaJabatan,
        notaShowWatermark: showWatermark,
        notaHeader: header,
        notaFooter: footer,
        notaSignatureUrl: signUrl,
        notaStampUrl: stampUrl,
        notaActiveFormat: format,
        waMessageTemplate: waTemplate,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-5">
      <h2 className="font-bold text-gray-900 text-lg">Nota &amp; Printer</h2>
      <Field label="Format Nota Aktif">
        <FormatPicker value={format} onChange={setFormat} />
      </Field>
      <FormatFieldPanel
        format={format}
        storeName={s?.store_name ?? ""}
        storeAddress={s?.store_address ?? ""}
        storePhone={s?.store_phone ?? ""}
        storeEmail={s?.store_email ?? ""}
        notaTitle={notaTitle}
        setNotaTitle={setNotaTitle}
        notaTitleSize={notaTitleSize}
        setNotaTitleSize={setNotaTitleSize}
        notaSubtitle={notaSubtitle}
        setNotaSubtitle={setNotaSubtitle}
        notaCustomerLayout={notaCustomerLayout}
        setNotaCustomerLayout={setNotaCustomerLayout}
        notaSignatureLayout={notaSignatureLayout}
        setNotaSignatureLayout={setNotaSignatureLayout}
        notaJabatan={notaJabatan}
        setNotaJabatan={setNotaJabatan}
        showWatermark={showWatermark}
        setShowWatermark={setShowWatermark}
        header={header}
        setHeader={setHeader}
        footer={footer}
        setFooter={setFooter}
        signUrl={signUrl}
        setSignUrl={setSignUrl}
        stampUrl={stampUrl}
        setStampUrl={setStampUrl}
        tenantId={tenantId}
      />
      <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800">Pesan WhatsApp Share Invoice</p>
          <button
            type="button"
            onClick={() => setWaTemplate(DEFAULT_WA_TEMPLATE)}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Pakai template default
          </button>
        </div>
        <p className="text-xs text-gray-600">
          Template pesan yang dipakai saat tombol kirim WhatsApp ditekan dari halaman invoice/preview.
          Gunakan placeholder berikut (akan diganti otomatis):
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-gray-700 sm:grid-cols-4">
          <span>{"{bisnis}"}</span>
          <span>{"{format}"}</span>
          <span>{"{no}"}</span>
          <span>{"{tgl}"}</span>
          <span>{"{pelanggan}"}</span>
          <span>{"{items}"}</span>
          <span>{"{total}"}</span>
          <span>{"{status}"}</span>
          <span>{"{link}"}</span>
        </div>
        <textarea
          value={waTemplate}
          onChange={(e) => setWaTemplate(e.target.value)}
          rows={10}
          placeholder={DEFAULT_WA_TEMPLATE}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
        />
        <p className="text-[11px] text-gray-500">
          Kosongkan untuk memakai template default. Status invoice akan otomatis ditulis dalam Bahasa Indonesia
          (mis. <span className="font-semibold">Selesai - Lunas</span> atau <span className="font-semibold">Selesai - Belum Bayar</span>),
          dan link preview bisa dibuka pelanggan tanpa perlu login untuk cek status realtime.
        </p>
      </div>
      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

// ── Tab 4: Reward ────────────────────────────────────────────
function TabReward({ s }: { s: Settings | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(s?.reward_employee_enabled ?? false);
  const [spendPer, setSpendPer] = useState(String(s?.reward_spend_per_point ?? 100000));
  const [ptValue, setPtValue] = useState(String(s?.reward_point_value ?? 1000));
  const [minRedeem, setMinRedeem] = useState(String(s?.reward_min_redeem ?? 10));
  const [validity, setValidity] = useState(String(s?.reward_point_validity_days ?? 365));
  const [leadMult, setLeadMult] = useState(String(s?.reward_lead_multiplier ?? 1));
  const [helperMult, setHelperMult] = useState(String(s?.reward_helper_multiplier ?? 0.5));
  const [pending, startTransition] = useTransition();
  const [syncPending, startSyncTransition] = useTransition();

  useEffect(() => {
    setEnabled(s?.reward_employee_enabled ?? false);
    setSpendPer(String(s?.reward_spend_per_point ?? 100000));
    setPtValue(String(s?.reward_point_value ?? 1000));
    setMinRedeem(String(s?.reward_min_redeem ?? 10));
    setValidity(String(s?.reward_point_validity_days ?? 365));
    setLeadMult(String(s?.reward_lead_multiplier ?? 1));
    setHelperMult(String(s?.reward_helper_multiplier ?? 0.5));
  }, [s]);

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
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  function handleSyncPoints() {
    startSyncTransition(async () => {
      const res = await syncEngineerPoints();
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-5">
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">Sinkron Ulang Point Engineer</p>
        <p className="mt-1 text-xs text-amber-700">
          Gunakan ini jika ada point lama yang masih terakumulasi setelah invoice di-rollback. Sistem akan hitung ulang saldo dari histori transaksi point.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSyncPoints}
            disabled={syncPending}
            className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {syncPending ? "Menyinkronkan..." : "Sinkron Ulang Point"}
          </button>
        </div>
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
