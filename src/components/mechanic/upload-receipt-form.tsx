"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitMechanicReceipt } from "@/lib/actions/invoice";
import { Camera, X, Upload } from "lucide-react";

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
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const data = new FormData(e.currentTarget);
    const invoiceId = data.get("invoice_id") as string;
    const description = (data.get("description") as string).trim();
    const amountRaw = data.get("amount") as string;
    const amount = Math.round(parseFloat(amountRaw.replace(/[^0-9]/g, "")));

    if (!invoiceId) return setUploadError("Pilih invoice terlebih dahulu");
    if (!description) return setUploadError("Deskripsi wajib diisi");
    if (!amount || amount <= 0) return setUploadError("Nominal harus lebih dari 0");
    if (!file) return setUploadError("Foto struk wajib diunggah");

    startTransition(async () => {
      // 1. Upload to Supabase Storage
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

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("receipt")
        .getPublicUrl(path);
      const receiptImageUrl = urlData.publicUrl;

      // 3. Call server action
      const result = await submitMechanicReceipt({
        invoiceId,
        description,
        amount,
        receiptImageUrl,
      });

      if (result.error) {
        // Try to delete the already-uploaded file to avoid orphans
        await supabase.storage.from("receipt").remove([path]);
        setUploadError(result.error);
        return;
      }

      // Success
      setSuccess(true);
      clearFile();
      formRef.current?.reset();
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Success banner */}
      {success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✓ Struk berhasil dikirim dan dicatat sebagai piutang.
        </div>
      )}

      {/* Error banner */}
      {uploadError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {uploadError}
        </div>
      )}

      {/* Invoice selector */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Invoice Terkait <span className="text-red-500">*</span>
        </label>
        {assignedInvoices.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
            Tidak ada invoice aktif yang ditugaskan kepada Anda.
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

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Deskripsi Part / Barang <span className="text-red-500">*</span>
        </label>
        <input
          name="description"
          type="text"
          required
          placeholder="contoh: Oli mesin Shell 1L"
          className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nominal Pembelian (Rp) <span className="text-red-500">*</span>
        </label>
        <input
          name="amount"
          type="number"
          required
          min="1"
          step="1000"
          placeholder="0"
          className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Nominal ini akan dicatat sebagai piutang kepada bengkel.
        </p>
      </div>

      {/* Photo upload */}
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-gray-400 transition-colors active:bg-gray-100"
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm">Ketuk untuk foto / pilih dari galeri</span>
            <span className="text-xs">JPEG, PNG, WebP · maks 3 MB</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || assignedInvoices.length === 0}
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
