// ============================================================
// Supabase Database Type Definitions
// Generated from schema defined in supabase/migrations/001_schema.sql
// ============================================================

export type UserRole = "super_admin" | "owner" | "admin" | "mechanic";
export type InvoiceStatus = "draft" | "in_progress" | "completed" | "paid" | "cancelled";
export type ItemType = "service" | "part_internal" | "part_external";
export type PaymentSource = "owner" | "mechanic" | "petty_cash";
export type MechanicRoleInInvoice = "lead" | "helper";
export type LedgerType = "kas_masuk" | "kas_keluar";
export type PettyCashType = "top_up" | "expense";
export type DebtTransactionType = "advance" | "reimbursement";

// ── Feature toggles shape (stored as JSONB in tenants) ──────
export interface FeatureToggles {
  module_ledger: boolean;
  module_petty_cash: boolean;
  module_mechanic_portal: boolean;
  module_customer_history: boolean;
}

// ── Vehicle info shape (stored as JSONB in customers) ───────
export interface VehicleInfo {
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
}

// ============================================================
// Table Row Types
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  feature_toggles: FeatureToggles;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  tenant_id: string;
  default_markup_pct: number;
  petty_cash_limit: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  vehicle_info: VehicleInfo;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  notes: string | null;
  subtotal: number;
  total_markup: number;
  grand_total: number;
  completed_at: string | null;
  paid_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  tenant_id: string;
  item_type: ItemType;
  description: string;
  quantity: number;
  unit_price: number;
  markup_pct: number;
  final_price: number;
  payment_source: PaymentSource | null;
  receipt_image_url: string | null;
  submitted_by: string | null;
  created_at: string;
}

export interface InvoiceMechanic {
  id: string;
  invoice_id: string;
  mechanic_id: string;
  tenant_id: string;
  mechanic_role: MechanicRoleInInvoice;
  assigned_at: string;
}

export interface MechanicDebtLedger {
  id: string;
  tenant_id: string;
  mechanic_id: string;
  invoice_item_id: string | null;
  transaction_type: DebtTransactionType;
  amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface Ledger {
  id: string;
  tenant_id: string;
  transaction_type: LedgerType;
  category: string;
  amount: number;
  reference_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface PettyCashTransaction {
  id: string;
  tenant_id: string;
  transaction_type: PettyCashType;
  amount: number;
  description: string;
  invoice_item_id: string | null;
  created_by: string;
  created_at: string;
}

// ============================================================
// Supabase Database schema type (for createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Tenant, "id" | "created_at">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      settings: {
        Row: Settings;
        Insert: Omit<Settings, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Settings, "id" | "created_at">>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Customer, "id" | "created_at">>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Invoice, "id" | "created_at">>;
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Omit<InvoiceItem, "id" | "created_at">;
        Update: Partial<Omit<InvoiceItem, "id" | "created_at">>;
      };
      invoice_mechanics: {
        Row: InvoiceMechanic;
        Insert: Omit<InvoiceMechanic, "id" | "assigned_at">;
        Update: Partial<Omit<InvoiceMechanic, "id">>;
      };
      mechanic_debt_ledger: {
        Row: MechanicDebtLedger;
        Insert: Omit<MechanicDebtLedger, "id" | "created_at">;
        Update: never;
      };
      ledger: {
        Row: Ledger;
        Insert: Omit<Ledger, "id" | "created_at">;
        Update: never;
      };
      petty_cash_transactions: {
        Row: PettyCashTransaction;
        Insert: Omit<PettyCashTransaction, "id" | "created_at">;
        Update: never;
      };
    };
    Views: {
      v_mechanic_debt_summary: {
        Row: {
          tenant_id: string;
          mechanic_id: string;
          total_advanced: number;
          total_reimbursed: number;
          outstanding_balance: number;
        };
      };
      v_petty_cash_balance: {
        Row: {
          tenant_id: string;
          total_top_up: number;
          total_expense: number;
          current_balance: number;
        };
      };
      v_ledger_balance: {
        Row: {
          tenant_id: string;
          total_masuk: number;
          total_keluar: number;
          saldo: number;
        };
      };
    };
    Functions: {
      get_my_tenant_id: { Returns: string | null };
      get_my_role: { Returns: UserRole | null };
      is_super_admin: { Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      invoice_status: InvoiceStatus;
      item_type: ItemType;
      payment_source: PaymentSource;
      mechanic_role_in_invoice: MechanicRoleInInvoice;
      ledger_type: LedgerType;
      petty_cash_type: PettyCashType;
      debt_transaction_type: DebtTransactionType;
    };
  };
}
