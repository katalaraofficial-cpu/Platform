"use client";

import { useState, useTransition, useRef } from "react";
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
import { createClient } from "@/lib/supabase/client";

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
  tenantId,
}: {
  activeTab: string;
  settings: Settings | null;
  tenantId: string;
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
        {activeTab === "toko" && <TabToko s={settings} tenantId={tenantId} />}
        {activeTab === "platform" && <TabPlatform s={settings} />}
        {activeTab === "nota" && <TabNota s={settings} tenantId={tenantId} />}
        {activeTab === "reward" && <TabReward s={settings} />}
        {activeTab === "reset" && <TabReset />}
      </div>
    </div>
  );
}

// ── Tab 1: Informasi Toko ────────────────────────────────────
function TabToko({ s, tenantId }: { s: Settings | null; tenantId: string }) {
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
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {currentUrl ? (
        <div className="relative inline-flex items-start gap-3">
          <Image
            src={currentUrl}
            alt={label}
            width={120}
            height={80}
            className="rounded-xl border border-gray-200 object-contain bg-gray-50"
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
        <div className="flex h-20 w-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
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
        className="flex w-fit items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 shrink-0 w-36">{rowLabel}</span>
      <span className="text-sm text-gray-800 font-medium">
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
        <SectionBar label="Info Pelanggan" sublabel="diisi otomatis dari faktur" />
      )}
      <SectionBar label="Baris Item" sublabel="diisi otomatis dari faktur" />
      {format !== "thermal" && (
        <SectionBar label="Ringkasan Total" sublabel="diisi otomatis dari faktur" />
      )}

      {/* ── FOOTER SECTION ─────────────────────────── */}
      <SectionBar label={format === "thermal" ? "Footer Struk" : "Bagian Penutup / TTD"} />
      <div className="p-4 flex flex-col gap-4">
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl">
      <h2 className="font-bold text-gray-900 text-lg">Nota &amp; Printer</h2>
      <Field label="Format Nota Aktif">
        <FormatPicker value={format} onChange={setFormat} />
      </Field>
      <FormatFieldPanel
        format={format}
        storeName={s?.store_name ?? ""}
        storeAddress={s?.store_address ?? ""}
        storePhone={s?.store_phone ?? ""}
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
