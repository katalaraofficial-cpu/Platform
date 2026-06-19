"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { StickyNote, X, Plus, Eye, Trash2, Pencil, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  addInvoiceTrackingNote,
  updateInvoiceTrackingNote,
  getInvoiceTrackingNotes,
  deleteInvoiceTrackingNote,
  getTrackingNotePresets,
  type TrackingNote,
} from "@/lib/actions/invoice";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  initialCount: number;
  basePath: string;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MAX_IMAGES = 2;

// Kompres gambar di sisi klien (maks lebar 1280px, JPEG q0.7) untuk hemat storage.
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxW = 1280;
    const scale = Math.min(1, maxW / bitmap.width);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.7);
    });
  } catch {
    return file;
  }
}

export function InvoiceNotesCell({ invoiceId, invoiceNumber, initialCount, basePath }: Props) {
  const [count, setCount] = useState(initialCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [notes, setNotes] = useState<TrackingNote[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDate, setNoteDate] = useState(todayIso());
  const [noteText, setNoteText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [presets, setPresets] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick() {
      setMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  // Close modals on Esc
  useEffect(() => {
    if (!showCreate && !showPreview) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowCreate(false);
        setShowPreview(false);
      }
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [showCreate, showPreview]);

  async function loadNotes() {
    setLoading(true);
    try {
      const list = await getInvoiceTrackingNotes(invoiceId);
      setNotes(list);
      setCount(list.length);
    } finally {
      setLoading(false);
    }
  }

  async function loadPresets() {
    try {
      setPresets(await getTrackingNotePresets());
    } catch {
      setPresets([]);
    }
  }

  function resetForm() {
    setEditingId(null);
    setNoteDate(todayIso());
    setNoteText("");
    setImages([]);
    setError(null);
  }

  function openCreate() {
    setMenuOpen(false);
    resetForm();
    void loadPresets();
    setShowCreate(true);
  }

  function openEdit(n: TrackingNote) {
    setEditingId(n.id);
    setNoteDate(n.date);
    setNoteText(n.text);
    setImages(Array.isArray(n.images) ? n.images : []);
    setError(null);
    void loadPresets();
    setShowPreview(false);
    setShowCreate(true);
  }

  function openPreview() {
    setMenuOpen(false);
    setShowPreview(true);
    void loadNotes();
  }

  function applyPreset(label: string) {
    setNoteText((prev) => {
      const t = prev.trim();
      if (!t) return label;
      if (t.toLowerCase().startsWith(label.toLowerCase())) return prev;
      return `${label} — ${t}`;
    });
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) {
      toast.error(`Maksimal ${MAX_IMAGES} gambar`);
      return;
    }
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const added: string[] = [];
    try {
      for (const file of files.slice(0, slots)) {
        if (!file.type.startsWith("image/")) continue;
        const blob = await compressImage(file);
        const path = `tracking-notes/${invoiceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("receipt")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) {
          setError("Gagal upload gambar: " + upErr.message);
          continue;
        }
        const { data: urlData } = supabase.storage.from("receipt").getPublicUrl(path);
        added.push(urlData.publicUrl);
      }
      if (added.length) setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateInvoiceTrackingNote(invoiceId, editingId, noteDate, noteText, basePath, images)
        : await addInvoiceTrackingNote(invoiceId, noteDate, noteText, basePath, images);
      if (res.error) {
        setError(res.error);
        return;
      }
      const wasEditing = !!editingId;
      setShowCreate(false);
      resetForm();
      if (wasEditing) {
        void loadNotes();
        setShowPreview(true);
      } else {
        setCount((c) => c + 1);
      }
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const res = await deleteInvoiceTrackingNote(invoiceId, noteId, basePath);
      if (res.error) return;
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== noteId);
        setCount(next.length);
        return next;
      });
    });
  }

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            count > 0
              ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          }`}
          title="Catatan tracking"
          aria-label="Catatan tracking"
        >
          <StickyNote className="h-3.5 w-3.5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
              {count}
            </span>
          )}
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={openCreate}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5 text-gray-400" />
              Buat Catatan
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <Eye className="h-3.5 w-3.5 text-gray-400" />
              Preview Catatan
              {count > 0 && (
                <span className="ml-auto rounded-full bg-blue-100 px-1.5 text-[10px] font-medium text-blue-700">
                  {count}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Create Modal ───────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="relative w-full max-w-md rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Buat Catatan Tracking</h3>
              <p className="mt-0.5 text-xs text-gray-500">Invoice {invoiceNumber}</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tanggal</label>
                <input
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Catatan</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  placeholder="Mis. Barang sudah diambil pelanggan, pembayaran ditunda 3 hari…"
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending || !noteText.trim()}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ──────────────────────────────────────── */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Catatan Tracking</h3>
              <p className="mt-0.5 text-xs text-gray-500">Invoice {invoiceNumber}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <p className="text-center text-xs text-gray-400">Memuat…</p>
              ) : notes.length === 0 ? (
                <div className="py-8 text-center">
                  <StickyNote className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-xs text-gray-400">Belum ada catatan tracking</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPreview(false);
                      setTimeout(openCreate, 50);
                    }}
                    className="mt-3 inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3" />
                    Buat catatan pertama
                  </button>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-[11px] font-medium text-blue-700">
                            {fmtDate(n.date)}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{n.text}</p>
                          {Array.isArray(n.images) && n.images.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {n.images.map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block h-16 w-16 overflow-hidden rounded-md border border-gray-200"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="Foto catatan" className="h-full w-full object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] text-gray-400">
                            Dibuat {new Date(n.created_at).toLocaleString("id-ID")}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(n)}
                            disabled={pending}
                            className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"
                            title="Edit catatan"
                            aria-label="Edit catatan"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(n.id)}
                            disabled={pending}
                            className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                            title="Hapus catatan"
                            aria-label="Hapus catatan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setTimeout(openCreate, 50);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3 w-3" />
                Tambah Catatan
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
