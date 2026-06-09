"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, Crosshair, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { WorkLocation } from "@/types/database";
import {
  saveWorkLocation,
  deleteWorkLocation,
  toggleWorkLocationActive,
} from "@/lib/actions/attendance";

type FormState = {
  id?: string;
  name: string;
  latitude: string;
  longitude: string;
  radiusM: string;
  allowFieldWork: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  latitude: "",
  longitude: "",
  radiusM: "100",
  allowFieldWork: false,
  isActive: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none";

export function WorkLocationManager({ locations }: { locations: WorkLocation[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [geoPending, setGeoPending] = useState(false);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(loc: WorkLocation) {
    setForm({
      id: loc.id,
      name: loc.name,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radiusM: String(loc.radius_m),
      allowFieldWork: loc.allow_field_work,
      isActive: loc.is_active,
    });
    setShowForm(true);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung geolokasi");
      return;
    }
    setGeoPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }));
        setGeoPending(false);
        toast.success("Koordinat lokasi terisi");
      },
      (err) => {
        setGeoPending(false);
        toast.error("Gagal mengambil lokasi: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveWorkLocation({
        id: form.id,
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radiusM: parseInt(form.radiusM) || 0,
        allowFieldWork: form.allowFieldWork,
        isActive: form.isActive,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success);
      setShowForm(false);
      setForm(EMPTY_FORM);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteWorkLocation(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  function handleToggle(loc: WorkLocation) {
    startTransition(async () => {
      const res = await toggleWorkLocationActive(loc.id, !loc.is_active);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          Lokasi Terdaftar ({locations.length})
        </p>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Lokasi
          </button>
        )}
      </div>

      {/* Daftar lokasi */}
      {locations.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-700">Belum ada lokasi kerja</p>
          <p className="mt-1 text-xs text-gray-500">
            Tambahkan minimal satu lokasi untuk mengaktifkan kehadiran engineer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`flex flex-col gap-2 rounded-2xl border p-4 ${
                loc.is_active ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50/70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
                    <p className="truncate font-semibold text-gray-900">{loc.name}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(loc)}
                    disabled={pending}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(loc.id)}
                    disabled={pending}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                  Radius {loc.radius_m} m
                </span>
                {loc.allow_field_work && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Mode Proyek
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleToggle(loc)}
                  disabled={pending}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    loc.is_active
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {loc.is_active ? "Aktif" : "Nonaktif"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form tambah / edit */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              {form.id ? "Edit Lokasi Kerja" : "Tambah Lokasi Kerja"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Field label="Nama Lokasi">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Kantor Pusat / Proyek Jl. Merdeka"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Latitude">
              <input
                className={inputCls}
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="-6.2000000"
                inputMode="decimal"
              />
            </Field>
            <Field label="Longitude">
              <input
                className={inputCls}
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="106.8166600"
                inputMode="decimal"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoPending}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <Crosshair className="h-4 w-4" />
            {geoPending ? "Mengambil lokasi..." : "Pakai lokasi saya"}
          </button>

          <Field label="Radius Jangkauan (meter)">
            <input
              className={inputCls}
              type="number"
              min={1}
              step={10}
              value={form.radiusM}
              onChange={(e) => setForm({ ...form, radiusM: e.target.value })}
              placeholder="100"
            />
            <p className="text-xs text-gray-400">
              Toleransi jarak dari titik koordinat agar absen dianggap valid.
            </p>
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm((f) => ({ ...f, allowFieldWork: !f.allowFieldWork }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.allowFieldWork ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.allowFieldWork ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
            <span className="text-sm text-gray-700">
              Lokasi proyek (absen di lapangan, tak harus di kantor)
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
