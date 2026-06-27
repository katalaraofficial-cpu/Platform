-- Migration 049: Lebarkan kolom markup_pct invoice_items
-- Masalah: NUMERIC(5,2) hanya menampung maksimal 999.99%, sehingga barang dengan
-- harga jual jauh di atas harga beli (markup > 1000%) gagal disimpan
-- dengan error "numeric field overflow". markup_pct bersifat informatif;
-- nilai uang sebenarnya disimpan eksplisit di final_price.

ALTER TABLE public.invoice_items
  ALTER COLUMN markup_pct TYPE NUMERIC(10,2);

COMMENT ON COLUMN public.invoice_items.markup_pct IS
  'Persentase markup item (informatif). NUMERIC(10,2) agar menampung markup besar.';
