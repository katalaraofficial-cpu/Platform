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
export type AccountType = "kas_tunai" | "bank";
export type PettyCashType = "top_up" | "expense";
export type DebtTransactionType = "advance" | "reimbursement";

// ── Feature toggles shape (stored as JSONB in tenants) ──────
export interface FeatureToggles {
  module_ledger: boolean;
  module_petty_cash: boolean;
  module_mechanic_portal: boolean;
  module_customer_history: boolean;
  module_engineer: boolean;
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
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  tenant_id: string;
  // Platform
  default_markup_pct: number;
  petty_cash_limit: number;
  qty_decimal: boolean;
  price_tier_labels: { HET: string; HG1: string; HG2: string; HG3: string };
  // Store info
  store_name: string | null;
  store_address: string | null;
  store_phone: string | null;
  store_email: string | null;
  store_logo_url: string | null;
  // Nota & Printer
  nota_title: string | null;
  nota_title_size: number;
  nota_subtitle: string | null;
  nota_customer_layout: "stacked" | "split";
  nota_signature_layout: "double" | "single";
  nota_jabatan: string | null;
  nota_show_watermark: boolean;
  nota_header: string | null;
  nota_footer: string | null;
  nota_signature_url: string | null;
  nota_stamp_url: string | null;
  nota_active_format: "A4" | "A5" | "thermal";
  // Reward
  reward_employee_enabled: boolean;
  reward_spend_per_point: number;
  reward_point_value: number;
  reward_min_redeem: number;
  reward_point_validity_days: number;
  reward_lead_multiplier: number;
  reward_helper_multiplier: number;
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
  ppn_pct: number;
  ppn_amount: number;
  pph_pct: number;
  pph_amount: number;
  discount_amount: number;
  grand_total: number;
  invoice_date: string;
  due_date: string | null;
  shipping_cost: number;
  completed_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
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
  unit_label: string | null;
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
  is_complaint: boolean;
  complaint_at: string | null;
  complaint_resolved_at: string | null;
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
  is_paid: boolean;
  created_by: string;
  created_at: string;
}

export interface Ledger {
  id: string;
  tenant_id: string;
  transaction_type: LedgerType;
  account_type: AccountType;
  category: string;
  amount: number;
  reference_id: string | null;
  transfer_ref: string | null;
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

export type PointTransactionType = "earn" | "redeem" | "expire" | "adjust";
export type PointRedemptionStatus = "pending" | "approved" | "rejected";

export interface EmployeePoints {
  id: string;
  tenant_id: string;
  profile_id: string;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
  updated_at: string;
}

export interface EmployeePointTransaction {
  id: string;
  tenant_id: string;
  profile_id: string;
  transaction_type: PointTransactionType;
  points: number;
  reference_id: string | null;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PointRedemptionRequest {
  id: string;
  tenant_id: string;
  profile_id: string;
  requested_by: string;
  points: number;
  point_value: number;
  payout_amount: number;
  notes: string | null;
  status: PointRedemptionStatus;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  point_transaction_id: string | null;
  ledger_id: string | null;
  created_at: string;
}

export interface TenantRequest {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ============================================================
// Supabase Database schema type (for createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant & Record<string, unknown>;
        Insert: Omit<Tenant, "id" | "created_at" | "updated_at" | "feature_toggles"> & Partial<Pick<Tenant, "feature_toggles">>;
        Update: Partial<Omit<Tenant, "id" | "created_at">>;
        Relationships: never[];
      };
      profiles: {
        Row: Profile & Record<string, unknown>;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: never[];
      };
      settings: {
        Row: Settings & Record<string, unknown>;
        Insert: Pick<Settings, "tenant_id"> & Partial<Omit<Settings, "id" | "tenant_id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<Settings, "id" | "created_at">>;
        Relationships: never[];
      };
      customers: {
        Row: Customer & Record<string, unknown>;
        Insert: Omit<Customer, "id" | "created_at" | "updated_at" | "notes"> & Partial<Pick<Customer, "notes">>;
        Update: Partial<Omit<Customer, "id" | "created_at">>;
        Relationships: never[];
      };
      invoices: {
        Row: Invoice & Record<string, unknown>;
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at" | "subtotal" | "total_markup" | "ppn_pct" | "ppn_amount" | "pph_pct" | "pph_amount" | "discount_amount" | "grand_total" | "completed_at" | "paid_at" | "payment_method" | "due_date" | "shipping_cost"> & Partial<Pick<Invoice, "subtotal" | "total_markup" | "ppn_pct" | "ppn_amount" | "pph_pct" | "pph_amount" | "discount_amount" | "grand_total" | "completed_at" | "paid_at" | "payment_method" | "invoice_date" | "due_date" | "shipping_cost">>;
        Update: Partial<Omit<Invoice, "id" | "created_at">>;
        Relationships: never[];
      };
      invoice_items: {
        Row: InvoiceItem & Record<string, unknown>;
        Insert: Omit<InvoiceItem, "id" | "created_at" | "receipt_image_url" | "submitted_by" | "unit_label"> & Partial<Pick<InvoiceItem, "receipt_image_url" | "submitted_by" | "unit_label">>;
        Update: Partial<Omit<InvoiceItem, "id" | "created_at">>;
        Relationships: never[];
      };
      invoice_mechanics: {
        Row: InvoiceMechanic & Record<string, unknown>;
        Insert: Omit<InvoiceMechanic, "id" | "assigned_at" | "is_complaint" | "complaint_at" | "complaint_resolved_at"> &
          Partial<Pick<InvoiceMechanic, "is_complaint" | "complaint_at" | "complaint_resolved_at">>;
        Update: Partial<Omit<InvoiceMechanic, "id">>;
        Relationships: never[];
      };
      mechanic_debt_ledger: {
        Row: MechanicDebtLedger & Record<string, unknown>;
        Insert: Omit<MechanicDebtLedger, "id" | "created_at">;
        Update: Partial<Omit<MechanicDebtLedger, "id" | "created_at">>;
        Relationships: never[];
      };
      ledger: {
        Row: Ledger & Record<string, unknown>;
        Insert: Omit<Ledger, "id" | "created_at">;
        Update: never;
        Relationships: never[];
      };
      petty_cash_transactions: {
        Row: PettyCashTransaction & Record<string, unknown>;
        Insert: Omit<PettyCashTransaction, "id" | "created_at">;
        Update: never;
        Relationships: never[];
      };
      employee_points: {
        Row: EmployeePoints & Record<string, unknown>;
        Insert: Omit<EmployeePoints, "id" | "updated_at"> & Partial<Pick<EmployeePoints, "points_balance" | "total_earned" | "total_redeemed">>;
        Update: Partial<Omit<EmployeePoints, "id">>;
        Relationships: never[];
      };
      employee_point_transactions: {
        Row: EmployeePointTransaction & Record<string, unknown>;
        Insert: Omit<EmployeePointTransaction, "id" | "created_at" | "reference_id" | "notes" | "expires_at"> & Partial<Pick<EmployeePointTransaction, "reference_id" | "notes" | "expires_at">>;
        Update: never;
        Relationships: never[];
      };
      point_redemption_requests: {
        Row: PointRedemptionRequest & Record<string, unknown>;
        Insert: Omit<PointRedemptionRequest, "id" | "created_at" | "status" | "reviewed_by" | "review_note" | "reviewed_at" | "point_transaction_id" | "ledger_id"> &
          Partial<Pick<PointRedemptionRequest, "status" | "reviewed_by" | "review_note" | "reviewed_at" | "point_transaction_id" | "ledger_id">>;
        Update: Partial<Omit<PointRedemptionRequest, "id" | "created_at">>;
        Relationships: never[];
      };
      tenant_requests: {
        Row: TenantRequest & Record<string, unknown>;
        Insert: Omit<TenantRequest, "id" | "created_at" | "reviewed_by" | "reviewed_at" | "rejection_note"> &
          Partial<Pick<TenantRequest, "reviewed_by" | "reviewed_at" | "rejection_note">>;
        Update: Partial<Omit<TenantRequest, "id" | "created_at">>;
        Relationships: never[];
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
        } & Record<string, unknown>;
        Relationships: never[];
      };
      v_petty_cash_balance: {
        Row: {
          tenant_id: string;
          total_top_up: number;
          total_expense: number;
          current_balance: number;
        } & Record<string, unknown>;
        Relationships: never[];
      };
      v_ledger_balance: {
        Row: {
          tenant_id: string;
          total_masuk: number;
          total_keluar: number;
          saldo: number;
        } & Record<string, unknown>;
        Relationships: never[];
      };
    };
    Functions: {
      get_my_tenant_id: { Args: Record<string, never>; Returns: string | null };
      get_my_role: { Args: Record<string, never>; Returns: UserRole | null };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
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
