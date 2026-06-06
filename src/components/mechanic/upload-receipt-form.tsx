"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitMechanicReceipt } from "@/lib/actions/invoice";
import { Camera, ImagePlus, X, Upload } from "lucide-react";

interface AssignedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
}

interface Props {
  mechanic_id: string;
  tenant_id: string;
  assignedInvoices: AssignedInvoice[];
}

type Mode = "invoice" | "claim";
type ClaimCategory = "bensin" | "kesehatan" | "lainnya";

export function UploadReceiptForm({
  mechanic_id,
  tenant_id,
  assignedInvoices,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [mode, setMode] = useState<Mode>(
    assignedInvoices.length > 0 ? "invoice" : "claim"
  );
  const [claimCategory, setClaimCategory] = useState<ClaimCategory>("bensin");
  const formRef = useRef<HTMLFormElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setAmountDisplay(""); return; }
    setAmountDisplay(Number(raw).toLocaleString("id-ID"));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 3 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setUploadError("Hanya JPEG, PNG, atau WebP yang diizinkan");
      return;
    }
    setUploadError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const data = new FormData(e.currentTarget);
    const invoiceId = mode === "invoice" ? (data.get("invoice_id") as string) : "";
    const description = ((data.get("description") as string) ?? "").trim();
    const amountRaw = (data.get("amount") as string) ?? "";
    const amount = Math.round(parseFloat(amountRaw.replace(/[^0-9]/g, "")));

    if (mode === "invoice" && !invoiceId) {
      return setUploadError("Pilih invoice terlebih dahulu");
    }
    if (!description) return setUploadError("Deskripsi wajib diisi");
    if (!amount || amount <= 0) return setUploadError("Nominal harus lebih dari 0");
    if (!file) return setUploadError("Foto struk wajib diunggah");

    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${tenant_id}/${mechanic_id}/${Date.now()}-receipt.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("receipt")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (storageError) {
        setUploadError(`Gagal upload foto: ${storageError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("receipt")
        .getPublicUrl(path);
      const receiptImageUrl = urlData.publicUrl;

      const result = await submitMechanicReceipt({
        invoiceId: mode === "invoice" ? invoiceId : null,
        description,
        amount,
        receiptImageUrl,
        claimCategory: mode === "claim" ? claimCategory : null,
      });

      if (result.error) {
        await supabase.storage.from("receipt").remove([path]);
        setUploadError(result.error);
        return;
      }

      setSuccess(true);
      clearFile();
      setAmountDisplay("");
      formRef.current?.reset();
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  const noActiveInvoice = assignedInvoices.length === 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✓ Struk berhasil dikirim dan dicatat sebagai piutang.
        </div>
      )}

      {uploadError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {uploadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setMode("invoice")}
          disabled={noActiveInvoice}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            mode === "invoice"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500"
          } ${noActiveInvoice ? "cursor-not-allowed opacity-60" : ""}`}
        >
          Untuk Invoice
        </button>
        <button
          type="button"
          onClick={() => setMode("claim")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            mode === "claim"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Klaim (Non-invoice)
        </button>
      </div>

      {mode === "invoice" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Invoice Terkait <span className="text-red-500">*</span>
          </label>
          {noActiveInvoice ? (
            <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
              Tidak ada invoice aktif. Gunakan tab <span className="font-semibold">Klaim</span> untuk pengajuan non-invoice.
            </p>
          ) : (
            <select
              name="invoice_id"
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Pilih Invoice —</option>
              {assignedInvoices.map((inv) => (
                <option key={inv.invoiceId} value={inv.invoiceId}>
                  {inv.invoiceNumber} · {inv.customerName}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Kategori Klaim <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "bensin", label: "Bensin" },
              { value: "kesehatan", label: "Kesehatan" },
              { value: "lainnya", label: "Lainnya" },
            ] as { value: ClaimCategory; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setClaimCategory(opt.value)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  claimCategory === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-600"
                    : "border-gray-300 bg-white text-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Klaim ini akan diteruskan ke owner sebagai piutang Anda.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {mode === "invoice" ? "Deskripsi Part / Barang" : "Keterangan Klaim"}{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          name="description"
          type="text"
          required
          placeholder={
            mode === "invoice"
              ? "contoh: Oli mesin Shell 1L"
              : "contoh: Pertalite 5L perjalanan ke Cilacap"
          }
          className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nominal (Rp) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
            Rp
          </span>
          <input
            name="amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9.]*"
            required
            value={amountDisplay}
            onChange={handleAmountChange}
            placeholder="0"
            className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Nominal akan dicatat sebagai piutang kepada bengkel.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Foto Struk <span className="text-red-500">*</span>
        </label>

        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview struk"
              className="h-48 w-full rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={clearFile}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-6 text-gray-500 transition-colors active:bg-gray-100"
            >
              <Camera className="h-7 w-7" />
              <span className="text-xs font-semibold">Foto Langsung</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-6 text-gray-500 transition-colors active:bg-gray-100"
            >
              <ImagePlus className="h-7 w-7" />
              <span className="text-xs font-semibold">Pilih dari Galeri</span>
            </button>
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">JPEG, PNG, WebP · maks 3 MB</p>

        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition-colors active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isPending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Mengunggah...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Kirim Struk
          </>
        )}
      </button>
    </form>
  );
}
