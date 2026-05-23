"use client";

import { useActionState } from "react";
import { updateFeatureToggles, updateTenantSettings, toggleTenantActive, type ActionState } from "@/lib/actions/tenant";

interface FeatureToggles {
  module_ledger: boolean;
  module_petty_cash: boolean;
  module_mechanic_portal: boolean;
  module_customer_history: boolean;
}

interface Props {
  tenantId: string;
  isActive: boolean;
  toggles: FeatureToggles;
  settings: { default_markup_pct: number; petty_cash_limit: number } | null;
}

const TOGGLE_LABELS: Record<keyof FeatureToggles, string> = {
  module_ledger: "Kas & Keuangan (Ledger)",
  module_petty_cash: "Kas Kecil",
  module_mechanic_portal: "Portal Mekanik & Hutang",
  module_customer_history: "Riwayat Pelanggan",
};

export function TenantDetailForms({ tenantId, isActive, toggles, settings }: Props) {
  const [toggleState, toggleAction, togglePending] = useActionState<ActionState, FormData>(
    updateFeatureToggles,
    {}
  );
  const [settingsState, settingsAction, settingsPending] = useActionState<ActionState, FormData>(
    updateTenantSettings,
    {}
  );

  return (
    <div className="space-y-6">
      {/* Active toggle */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Status Tenant</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isActive
                ? "Tenant aktif — pengguna dapat login"
                : "Tenant non-aktif — pengguna tidak dapat login"}
            </p>
          </div>
          <form action={toggleTenantActive.bind(null, tenantId, !isActive)}>
            <button
              type="submit"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border border-red-300 text-red-600 hover:bg-red-50"
                  : "bg-green-600 text-white hover:bg-green-500"
              }`}
            >
              {isActive ? "Non-Aktifkan" : "Aktifkan"}
            </button>
          </form>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Modul Aktif</h2>
        {toggleState.error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {toggleState.error}
          </p>
        )}
        <form action={toggleAction} className="space-y-3">
          <input type="hidden" name="tenant_id" value={tenantId} />
          {(Object.keys(TOGGLE_LABELS) as (keyof FeatureToggles)[]).map((key) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name={key}
                defaultChecked={toggles[key]}
                className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
              />
              <span className="text-sm text-gray-700">{TOGGLE_LABELS[key]}</span>
            </label>
          ))}
          <div className="pt-2">
            <button
              type="submit"
              disabled={togglePending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-gray-400"
            >
              {togglePending ? "Menyimpan..." : "Simpan Modul"}
            </button>
          </div>
        </form>
      </div>

      {/* Settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Pengaturan Bengkel</h2>
        {settingsState.error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {settingsState.error}
          </p>
        )}
        <form action={settingsAction} className="space-y-4">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Default Markup Part (%)
              </label>
              <input
                type="number"
                name="default_markup_pct"
                defaultValue={settings?.default_markup_pct ?? 20}
                min="0"
                max="1000"
                step="0.5"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Batas Kas Kecil (Rp)
              </label>
              <input
                type="number"
                name="petty_cash_limit"
                defaultValue={settings?.petty_cash_limit ?? 500000}
                min="0"
                step="50000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={settingsPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-gray-400"
          >
            {settingsPending ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </form>
      </div>
    </div>
  );
}
