-- ============================================================
-- ProMarca Migration: cover_image + promo_cards
-- Pegar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Imagen de portada en categorías
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 2. Tabla de tarjetas destacadas (homepage promo grid)
CREATE TABLE IF NOT EXISTS promo_cards (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  eyebrow       text NOT NULL DEFAULT '',
  title         text NOT NULL DEFAULT '',
  subtitle      text,
  catalog_slug  text,
  image_url     text,
  display_order integer NOT NULL DEFAULT 1,
  is_active     boolean NOT NULL DEFAULT true,
  is_dark       boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE promo_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='promo_cards' AND policyname='Public read promo_cards'
  ) THEN
    CREATE POLICY "Public read promo_cards" ON promo_cards FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='promo_cards' AND policyname='Auth write promo_cards'
  ) THEN
    CREATE POLICY "Auth write promo_cards" ON promo_cards FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. Seed inicial con las 4 tarjetas actuales
INSERT INTO promo_cards (eyebrow, title, subtitle, catalog_slug, image_url, display_order, is_dark)
SELECT * FROM (VALUES
  ('Más vendido',        'Termos Premium',          'Acero inoxidable con doble pared. Tu logo grabado a láser para que nunca se borre.',                  'termos',    '/img/promo/termos.png',    1, false),
  ('Nueva colección',    'Gorras 2026',              'Bordado premium en 3D o transfer. Más de 12 colores disponibles con ajuste universal.',                'gorras',    '/img/promo/gorras.png',    2, true),
  ('Esencial de oficina','Lapiceros con logotipo',   'Desde 100 unidades. Impresión serigráfica de alta resolución en 4 colores.',                         'lapiceros', '/img/promo/lapiceros.png', 3, true),
  ('Tendencia 2026',     'Tulas & Mochilas',         'Canvas reciclado y tela premium. Sublimación total o bordado en panel frontal.',                      'tulas',     '/img/promo/tulas.png',     4, false)
) AS v(eyebrow, title, subtitle, catalog_slug, image_url, display_order, is_dark)
WHERE NOT EXISTS (SELECT 1 FROM promo_cards LIMIT 1);
