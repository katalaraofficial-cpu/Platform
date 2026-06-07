import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Tenant-scoped admin client (Poin 4 technical debt).
 *
 * Bungkus service_role Supabase client supaya semua operasi `.from(table)`
 * otomatis dipaksa scoped ke `tenantId`:
 *   - `.insert(row)` / `.upsert(row)` → inject `tenant_id` ke setiap baris
 *     (throw kalau caller mengirim tenant_id berbeda).
 *   - `.update(...)` / `.delete()` / `.select(...)` → otomatis chain
 *     `.eq("tenant_id", tenantId)`.
 *
 * Ini menghapus risiko lupa filter `tenant_id` saat caller pakai admin client.
 *
 * Escape hatch:
 *   - `.rpc(name, args)` → diteruskan apa adanya (RPC tenant-scoped harus
 *     punya argumen `p_tenant_id` eksplisit + guard di SQL function).
 *   - `.raw` → SupabaseClient mentah untuk operasi cross-tenant yang
 *     memang disengaja (auth admin, storage, dll). Pakai dengan komentar
 *     `// cross-tenant: ...` di call site.
 */

type AnyRecord = Record<string, unknown>;

function rawAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function injectTenantId(
  table: string,
  tenantId: string,
  payload: AnyRecord | AnyRecord[],
): AnyRecord | AnyRecord[] {
  const apply = (row: AnyRecord): AnyRecord => {
    if ("tenant_id" in row && row.tenant_id && row.tenant_id !== tenantId) {
      throw new Error(
        `tenantAdminClient: refusing insert/upsert ke ${table} dengan tenant_id berbeda ` +
          `(expected=${tenantId}, got=${String(row.tenant_id)})`,
      );
    }
    return { ...row, tenant_id: tenantId };
  };
  return Array.isArray(payload) ? payload.map(apply) : apply(payload);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type TenantAdminClient = {
  from: (table: string) => TenantAdminQueryBuilder;
  rpc: SupabaseClient<Database>["rpc"];
  raw: SupabaseClient<Database>;
  tenantId: string;
};

// Method bodies meneruskan ke supabase-js query builder yang tetap chainable
// (mis. `.select().eq().single()`). Return `any` supaya caller bisa rantai
// bebas tanpa fighting generic types raksasa supabase-js — type-safety hasil
// di-restore di call site lewat destructuring `{ data, error }`.
type TenantAdminQueryBuilder = {
  select: (...args: any[]) => any;
  insert: (payload: AnyRecord | AnyRecord[], opts?: any) => any;
  upsert: (payload: AnyRecord | AnyRecord[], opts?: any) => any;
  update: (patch: AnyRecord, opts?: any) => any;
  delete: (opts?: any) => any;
};

export function createTenantAdminClient(tenantId: string): TenantAdminClient {
  if (!tenantId) {
    throw new Error("createTenantAdminClient: tenantId wajib diisi");
  }
  const raw = rawAdminClient();

  const from = (table: string): TenantAdminQueryBuilder => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = raw.from(table as any) as any;
    return {
      select: (...args: any[]) =>
        t.select(...args).eq("tenant_id", tenantId),
      insert: (payload: AnyRecord | AnyRecord[], opts?: any) =>
        t.insert(injectTenantId(table, tenantId, payload), opts),
      upsert: (payload: AnyRecord | AnyRecord[], opts?: any) =>
        t.upsert(injectTenantId(table, tenantId, payload), opts),
      update: (patch: AnyRecord, opts?: any) => {
        const { tenant_id: _drop, ...safePatch } = patch;
        void _drop;
        return t.update(safePatch, opts).eq("tenant_id", tenantId);
      },
      delete: (opts?: any) => t.delete(opts).eq("tenant_id", tenantId),
    };
  };

  return {
    from,
    rpc: raw.rpc.bind(raw),
    raw,
    tenantId,
  };
}
