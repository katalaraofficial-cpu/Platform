-- ============================================================
-- Migration 029: Hutang & Piutang module
-- Tracks receivables (piutang) and payables (hutang) with
-- a two-step flow: record → pay/receive.
-- Each payment links back to a ledger entry for cash tracking.
-- ============================================================

-- ── Main HP ledger ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kas_hp (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hp_type          TEXT NOT NULL CHECK (hp_type IN ('hutang', 'piutang')),
  counterparty     TEXT NOT NULL,          -- vendor / customer name
  description      TEXT,
  amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  paid_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paid_not_exceed_amount CHECK (paid_amount <= amount)
);

-- ── Payment records (each partial/full payment) ──────────────
CREATE TABLE IF NOT EXISTS public.kas_hp_payment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hp_id       UUID NOT NULL REFERENCES public.kas_hp(id) ON DELETE CASCADE,
  ledger_id   UUID REFERENCES public.ledger(id) ON DELETE SET NULL,
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  paid_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.kas_hp         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_hp_payment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage kas_hp"
  ON public.kas_hp FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "owner can manage kas_hp_payment"
  ON public.kas_hp_payment FOR ALL
  USING (
    hp_id IN (
      SELECT id FROM public.kas_hp
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.profiles
        WHERE id = auth.uid() AND role = 'owner'
      )
    )
  );

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kas_hp_tenant_type
  ON public.kas_hp(tenant_id, hp_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kas_hp_payment_hp
  ON public.kas_hp_payment(hp_id);
