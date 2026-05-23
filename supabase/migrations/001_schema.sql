-- ============================================================
-- FILE: 001_schema.sql
-- DESC: Core schema for Multi-Tenant POS & Workshop Management
--       Covers: Extensions, Enums, Tables, Indexes,
--               Helper Functions, and Triggers.
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 2. CUSTOM TYPES (ENUMS)
-- ============================================================

CREATE TYPE public.user_role AS ENUM (
    'super_admin',  -- Platform owner
    'owner',        -- Workshop/tenant owner
    'admin',        -- Cashier / front-desk
    'mechanic'      -- Field technician
);

CREATE TYPE public.invoice_status AS ENUM (
    'draft',        -- Empty invoice just created (Running Invoice opened)
    'in_progress',  -- Work ongoing, items being added
    'completed',    -- Work done, awaiting payment
    'paid',         -- Fully paid
    'cancelled'
);

CREATE TYPE public.item_type AS ENUM (
    'service',          -- Labour / jasa
    'part_internal',    -- Sparepart from internal stock
    'part_external'     -- Sparepart bought outside (receipt upload)
);

-- Who funded an external part purchase
CREATE TYPE public.payment_source AS ENUM (
    'owner',        -- Owner paid supplier directly  -> recorded in main Ledger
    'mechanic',     -- Mechanic used personal money  -> recorded in Mechanic Debt Ledger
    'petty_cash'    -- Admin used petty cash         -> deducted from Petty Cash
);

CREATE TYPE public.mechanic_role_in_invoice AS ENUM (
    'lead',
    'helper'
);

CREATE TYPE public.ledger_type AS ENUM (
    'kas_masuk',    -- Cash in
    'kas_keluar'    -- Cash out
);

CREATE TYPE public.petty_cash_type AS ENUM (
    'top_up',   -- Owner tops up the petty cash fund
    'expense'   -- Admin spends from petty cash
);

CREATE TYPE public.debt_transaction_type AS ENUM (
    'advance',        -- Mechanic advanced money (company now owes mechanic)
    'reimbursement'   -- Company paid mechanic back (debt reduced)
);


-- ============================================================
-- 3. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 3.1  TENANTS  (one row per workshop/business)
-- ------------------------------------------------------------
CREATE TABLE public.tenants (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    slug            TEXT        NOT NULL UNIQUE,    -- used in URL routing
    is_active       BOOLEAN     NOT NULL DEFAULT true,

    -- on/off module visibility flags managed by Super Admin
    feature_toggles JSONB       NOT NULL DEFAULT '{
        "module_ledger":            true,
        "module_petty_cash":        true,
        "module_mechanic_portal":   true,
        "module_customer_history":  true
    }'::jsonb,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.2  PROFILES  (1-to-1 extension of auth.users)
-- ------------------------------------------------------------
-- NOTE: id references auth.users so Supabase Auth owns the credential.
--       tenant_id is NULL only for super_admin.
-- ------------------------------------------------------------
CREATE TABLE public.profiles (
    id          UUID            PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   UUID            REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name   TEXT            NOT NULL,
    role        public.user_role NOT NULL DEFAULT 'admin',
    is_active   BOOLEAN         NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT chk_tenant_required_for_non_superadmin
        CHECK (role = 'super_admin' OR tenant_id IS NOT NULL)
);

-- ------------------------------------------------------------
-- 3.3  SETTINGS  (one row per tenant; auto-created via trigger)
-- ------------------------------------------------------------
CREATE TABLE public.settings (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Default markup applied to external parts when added to invoice
    default_markup_pct  NUMERIC(5,2) NOT NULL DEFAULT 20.00,

    -- Maximum petty cash that can be held / spent per top-up period (IDR)
    petty_cash_limit    INTEGER     NOT NULL DEFAULT 500000,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.4  CUSTOMERS
-- ------------------------------------------------------------
CREATE TABLE public.customers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    phone           TEXT,

    -- Flexible vehicle data: { "plate":"B 1234 XX", "brand":"Toyota",
    --                          "model":"Avanza", "year":2019 }
    vehicle_info    JSONB       NOT NULL DEFAULT '{}',

    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.5  INVOICES  (also serves as Work Order in this MVP)
-- ------------------------------------------------------------
-- Invoice lifecycle:  draft -> in_progress -> completed -> paid
-- An invoice can be opened with just a customer name (Running Invoice).
-- ------------------------------------------------------------
CREATE TABLE public.invoices (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID                    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id     UUID                    REFERENCES public.customers(id) ON DELETE SET NULL,
    invoice_number  TEXT                    NOT NULL,
    status          public.invoice_status   NOT NULL DEFAULT 'draft',
    notes           TEXT,

    -- Denormalized totals kept in sync by the application layer
    subtotal        NUMERIC(15,2)           NOT NULL DEFAULT 0,
    total_markup    NUMERIC(15,2)           NOT NULL DEFAULT 0,
    grand_total     NUMERIC(15,2)           NOT NULL DEFAULT 0,

    -- Lifecycle timestamps
    completed_at    TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,

    created_by      UUID                    NOT NULL REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, invoice_number)
);

-- ------------------------------------------------------------
-- 3.6  INVOICE ITEMS  (line items: services, parts)
-- ------------------------------------------------------------
-- final_price = (unit_price * quantity) * (1 + markup_pct / 100)
-- For services markup_pct = 0.
-- ------------------------------------------------------------
CREATE TABLE public.invoice_items (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID                    NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    tenant_id           UUID                    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    item_type           public.item_type        NOT NULL DEFAULT 'service',
    description         TEXT                    NOT NULL,
    quantity            NUMERIC(10,2)           NOT NULL DEFAULT 1,
    unit_price          NUMERIC(15,2)           NOT NULL DEFAULT 0,

    -- Applied only for part_external; copied from settings at time of creation
    markup_pct          NUMERIC(5,2)            NOT NULL DEFAULT 0,

    -- Stored result: (unit_price * quantity) * (1 + markup_pct/100)
    final_price         NUMERIC(15,2)           NOT NULL DEFAULT 0,

    -- For external parts: who funded the purchase
    payment_source      public.payment_source,

    -- Uploaded receipt image (Supabase Storage path)
    receipt_image_url   TEXT,

    -- Profile who submitted this item (mechanic for external parts)
    submitted_by        UUID                    REFERENCES public.profiles(id),

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.7  INVOICE MECHANICS  (junction: many mechanics per invoice)
-- ------------------------------------------------------------
CREATE TABLE public.invoice_mechanics (
    id              UUID                                PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID                                NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    mechanic_id     UUID                                NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id       UUID                                NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mechanic_role   public.mechanic_role_in_invoice     NOT NULL DEFAULT 'lead',
    assigned_at     TIMESTAMPTZ                         NOT NULL DEFAULT now(),

    -- A mechanic can only be assigned once per invoice
    UNIQUE (invoice_id, mechanic_id)
);

-- ------------------------------------------------------------
-- 3.8  MECHANIC DEBT LEDGER  (accumulated reimbursement tracking)
-- ------------------------------------------------------------
-- Every time a mechanic pays out-of-pocket for parts, an 'advance'
-- row is inserted (amount = positive).
-- When the owner reimburses, a 'reimbursement' row is inserted.
-- Outstanding balance = SUM(advance) - SUM(reimbursement) per mechanic.
-- ------------------------------------------------------------
CREATE TABLE public.mechanic_debt_ledger (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mechanic_id         UUID                        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Which invoice item triggered this debt (nullable for lump-sum reimbursements)
    invoice_item_id     UUID                        REFERENCES public.invoice_items(id) ON DELETE SET NULL,

    transaction_type    public.debt_transaction_type NOT NULL,
    amount              NUMERIC(15,2)               NOT NULL CHECK (amount > 0),
    notes               TEXT,

    created_by          UUID                        NOT NULL REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ                 NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.9  LEDGER  (Main Kas — OWNER ONLY, Admin has zero access)
-- ------------------------------------------------------------
CREATE TABLE public.ledger (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    transaction_type    public.ledger_type      NOT NULL,

    -- Human-readable category e.g. 'Pembayaran Invoice', 'Beli Sparepart Supplier'
    category            TEXT                    NOT NULL,

    amount              NUMERIC(15,2)           NOT NULL CHECK (amount > 0),

    -- Generic reference to source document (invoice_id, etc.)
    reference_id        UUID,

    notes               TEXT,
    created_by          UUID                    NOT NULL REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3.10 PETTY CASH TRANSACTIONS  (Admin's segregated cash fund)
-- ------------------------------------------------------------
-- Completely isolated from the main Ledger.
-- Owner tops up; Admin spends (expense only, capped by settings.petty_cash_limit).
-- ------------------------------------------------------------
CREATE TABLE public.petty_cash_transactions (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    transaction_type    public.petty_cash_type  NOT NULL,
    amount              NUMERIC(15,2)           NOT NULL CHECK (amount > 0),
    description         TEXT                    NOT NULL,

    -- Link to the invoice item this expense covered (optional)
    invoice_item_id     UUID                    REFERENCES public.invoice_items(id) ON DELETE SET NULL,

    created_by          UUID                    NOT NULL REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX idx_profiles_tenant_id           ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_role                ON public.profiles(role);

CREATE INDEX idx_customers_tenant_id          ON public.customers(tenant_id);

CREATE INDEX idx_invoices_tenant_id           ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_status              ON public.invoices(status);
CREATE INDEX idx_invoices_customer_id         ON public.invoices(customer_id);
CREATE INDEX idx_invoices_tenant_status       ON public.invoices(tenant_id, status);

CREATE INDEX idx_invoice_items_invoice_id     ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_tenant_id      ON public.invoice_items(tenant_id);
CREATE INDEX idx_invoice_items_submitted_by   ON public.invoice_items(submitted_by);

CREATE INDEX idx_inv_mechanics_invoice_id     ON public.invoice_mechanics(invoice_id);
CREATE INDEX idx_inv_mechanics_mechanic_id    ON public.invoice_mechanics(mechanic_id);
CREATE INDEX idx_inv_mechanics_tenant_id      ON public.invoice_mechanics(tenant_id);

CREATE INDEX idx_debt_ledger_tenant_mechanic  ON public.mechanic_debt_ledger(tenant_id, mechanic_id);
CREATE INDEX idx_debt_ledger_invoice_item     ON public.mechanic_debt_ledger(invoice_item_id);

CREATE INDEX idx_ledger_tenant_id             ON public.ledger(tenant_id);
CREATE INDEX idx_ledger_created_at            ON public.ledger(tenant_id, created_at DESC);

CREATE INDEX idx_petty_cash_tenant_id         ON public.petty_cash_transactions(tenant_id);


-- ============================================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS safely)
--    These are called inside RLS policies to avoid recursion.
-- ============================================================

-- Returns the tenant_id of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Convenience boolean check
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$;


-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- ─── 6.1  updated_at auto-maintenance ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_settings_updated
    BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_customers_updated
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_invoices_updated
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ─── 6.2  Auto-create profile when a new auth user is created ─
-- The application must pass `full_name`, `role`, and `tenant_id`
-- inside raw_user_meta_data when calling supabase.auth.signUp().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, tenant_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'admin'),
        (NEW.raw_user_meta_data->>'tenant_id')::uuid   -- NULL is valid for super_admin
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 6.3  Auto-create settings row when a tenant is created ───
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.settings (tenant_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_tenant_created
    AFTER INSERT ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant();


-- ============================================================
-- 7. VIEWS  (read-only, convenience aggregates)
-- ============================================================

-- ─── 7.1  Mechanic outstanding debt per tenant ───────────────
CREATE OR REPLACE VIEW public.v_mechanic_debt_summary AS
SELECT
    tenant_id,
    mechanic_id,
    SUM(CASE WHEN transaction_type = 'advance'        THEN amount ELSE 0    END) AS total_advanced,
    SUM(CASE WHEN transaction_type = 'reimbursement'  THEN amount ELSE 0    END) AS total_reimbursed,
    SUM(CASE WHEN transaction_type = 'advance'        THEN amount ELSE -amount END) AS outstanding_balance
FROM public.mechanic_debt_ledger
GROUP BY tenant_id, mechanic_id;

-- ─── 7.2  Petty cash current balance per tenant ──────────────
CREATE OR REPLACE VIEW public.v_petty_cash_balance AS
SELECT
    tenant_id,
    SUM(CASE WHEN transaction_type = 'top_up'   THEN amount ELSE 0      END) AS total_top_up,
    SUM(CASE WHEN transaction_type = 'expense'  THEN amount ELSE 0      END) AS total_expense,
    SUM(CASE WHEN transaction_type = 'top_up'   THEN amount ELSE -amount END) AS current_balance
FROM public.petty_cash_transactions
GROUP BY tenant_id;

-- ─── 7.3  Main ledger running balance per tenant ─────────────
CREATE OR REPLACE VIEW public.v_ledger_balance AS
SELECT
    tenant_id,
    SUM(CASE WHEN transaction_type = 'kas_masuk'  THEN amount ELSE 0      END) AS total_masuk,
    SUM(CASE WHEN transaction_type = 'kas_keluar' THEN amount ELSE 0      END) AS total_keluar,
    SUM(CASE WHEN transaction_type = 'kas_masuk'  THEN amount ELSE -amount END) AS saldo
FROM public.ledger
GROUP BY tenant_id;
