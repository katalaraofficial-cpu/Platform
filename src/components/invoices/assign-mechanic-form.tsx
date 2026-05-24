"use client";

import { useActionState } from "react";
import { assignMechanic } from "@/lib/actions/invoice";
import type { ActionState } from "@/lib/actions/invoice";

interface Mechanic {
  id: string;
  full_name: string | null;
}

interface Props {
  invoiceId: string;
  tenantId: string;
  basePath: string;
  mechanics: Mechanic[];
  assignedIds: string[];
}

export function AssignMechanicForm({
  invoiceId,
  tenantId,
  basePath,
  mechanics,
  assignedIds,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    assignMechanic,
    {}
  );

  const available = mechanics.filter((m) => !assignedIds.includes(m.id));

  if (available.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        {mechanics.length === 0
          ? "Belum ada mekanik di tenant ini."
          : "Semua mekanik sudah ditugaskan."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="base_path" value={basePath} />

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Mekanik
        </label>
        <select
          name="mechanic_id"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">-- Pilih --</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? m.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Peran
        </label>
        <select
          name="mechanic_role"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="lead">Lead (Utama)</option>
          <option value="helper">Helper (Pembantu)</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium
                   text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? "Menugaskan…" : "+ Tugaskan"}
      </button>

      {state.error && (
        <p className="w-full text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
