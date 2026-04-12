-- ═══════════════════════════════════════════════
-- ProMarca — Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL)
-- ═══════════════════════════════════════════════

-- ─── CATEGORIES ───
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SUBCATEGORIES ───
CREATE TABLE subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INT DEFAULT 0,
  UNIQUE(category_id, slug)
);

-- ─── PRODUCTS ───
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price INT NOT NULL,
  price_label TEXT DEFAULT 'Sin marca',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PRODUCT COLORS ───
CREATE TABLE product_colors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hex_color TEXT NOT NULL,
  display_order INT DEFAULT 0
);

-- ─── PRODUCT IMAGES ───
CREATE TABLE product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0
);

-- ─── CLIENTS ───
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  nit TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── QUOTES ───
CREATE TABLE quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  subtotal INT DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  iva_percent NUMERIC(5,2) DEFAULT 19,
  total INT DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── QUOTE ITEMS ───
CREATE TABLE quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_reference TEXT,
  quantity INT NOT NULL,
  unit_price INT NOT NULL,
  marking_type TEXT,
  marking_price INT DEFAULT 0,
  line_total INT NOT NULL,
  notes TEXT,
  display_order INT DEFAULT 0
);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════

-- Public read for catalog data
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read subcategories" ON subcategories FOR SELECT USING (true);
CREATE POLICY "Public read active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Public read colors" ON product_colors FOR SELECT USING (true);
CREATE POLICY "Public read images" ON product_images FOR SELECT USING (true);

-- Admin write for catalog data
CREATE POLICY "Admin write categories" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write subcategories" ON subcategories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write products" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write colors" ON product_colors FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write images" ON product_images FOR ALL USING (auth.role() = 'authenticated');

-- Admin only for clients, quotes
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access clients" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin access quotes" ON quotes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin access quote_items" ON quote_items FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════
-- STORAGE BUCKETS (run in Supabase Dashboard → Storage)
-- ═══════════════════════════════════════════════
-- Create these buckets manually:
-- 1. product-images (public)
-- 2. client-logos (private)
-- 3. quote-pdfs (private)

-- ═══════════════════════════════════════════════
-- SEED: Default categories from current site
-- ═══════════════════════════════════════════════
INSERT INTO categories (name, slug, icon, display_order) VALUES
  ('Mugs & Pocillos', 'mugs', '☕', 1),
  ('Termos & Vasos', 'termos', '🥤', 2),
  ('Gorras', 'gorras', '🧢', 3),
  ('Lapiceros', 'lapiceros', '🖊️', 4),
  ('Tulas & Mochilas', 'tulas', '🎒', 5),
  ('Sombrillas', 'sombrillas', '☂️', 6),
  ('USB & Tecnología', 'usb', '💾', 7),
  ('Textiles', 'textiles', '👕', 8),
  ('Cuadernos', 'cuadernos', '📓', 9),
  ('Kits Corporativos', 'kits', '🎁', 10);
