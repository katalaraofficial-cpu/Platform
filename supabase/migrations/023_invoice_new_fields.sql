-- Migration 023: Tambah field baru untuk invoice dan invoice_items
-- due_date, shipping_cost pada invoices; unit_label pada invoice_items

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit_label TEXT;

-- Update syncTotals-equivalent: grand_total sekarang menyertakan shipping_cost
-- (syncTotals di app-level akan menangani ini secara otomatis setelah deploy)
