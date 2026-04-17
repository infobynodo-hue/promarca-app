import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CatalogGrid } from "./catalog-grid";

interface Props {
  params: Promise<{ categoria: string }>;
}

export default async function CatalogPage({ params }: Props) {
  const { categoria } = await params;
  const supabase = await createClient();

  // Fetch category
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", categoria)
    .eq("is_active", true)
    .single();

  if (!category) notFound();

  // Fetch subcategories and products in parallel
  const [{ data: subcategories }, { data: products }] = await Promise.all([
    supabase
      .from("subcategories")
      .select("*")
      .eq("category_id", category.id)
      .order("display_order"),
    supabase
      .from("products")
      .select("*, product_colors(*), product_images(id, storage_path, is_primary, display_order)")
      .eq("category_id", category.id)
      .eq("is_active", true)
      .order("reference"),
  ]);

  const subs = subcategories ?? [];
  const prods = products ?? [];

  return (
    <>
      {/* Category hero */}
      <section className="cat-hero">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Inicio</Link>
          <span className="sep">/</span>
          <Link href="/#catalogo">Catálogo</Link>
          <span className="sep">/</span>
          <span>{category.name}</span>
        </nav>
        <p className="cat-hero-eyebrow">Catálogo 2026</p>
        <h1 className="cat-hero-title">{category.name}</h1>
        {category.description && (
          <p className="cat-hero-sub">{category.description}</p>
        )}
        <div className="cat-hero-stats">
          <div className="cat-stat">
            <div className="cat-stat-num">{prods.length}</div>
            <div className="cat-stat-label">Productos</div>
          </div>
          {subs.length > 0 && (
            <div className="cat-stat">
              <div className="cat-stat-num">{subs.length}</div>
              <div className="cat-stat-label">Tipos</div>
            </div>
          )}
          <div className="cat-stat">
            <div className="cat-stat-num">
              {new Set(prods.flatMap((p: any) => p.product_colors.map((c: any) => c.hex_color))).size}
            </div>
            <div className="cat-stat-label">Colores</div>
          </div>
        </div>
      </section>

      {/* Dynamic grid with filtering */}
      <CatalogGrid
        products={prods.map((p: any) => {
          const imgs: any[] = p.product_images ?? [];
          // Sort: primary first, then by display_order
          const sorted = [...imgs].sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.display_order ?? 0) - (b.display_order ?? 0);
          });
          // Build all public URLs for the carousel
          const imageUrls = sorted
            .filter((i) => i.storage_path)
            .map((i) => supabase.storage.from("products").getPublicUrl(i.storage_path).data.publicUrl);
          return {
            id: p.id,
            reference: p.reference,
            name: p.name,
            price: p.price,
            price_label: p.price_label,
            has_variants: p.has_variants ?? false,
            subcategory_id: p.subcategory_id,
            product_colors: p.product_colors ?? [],
            imageUrls,
          };
        })}
        subcategories={subs}
        categoryIcon={category.icon ?? "📦"}
      />

      {/* Personalize CTA */}
      <div className="personalize-cta">
        <h2>¿Te gustó alguno?<br />Personalízalo con tu marca.</h2>
        <p>Escríbenos y recibe una cotización en menos de 24 horas.</p>
        <div className="personalize-cta-btns">
          <a href="mailto:hola@promarca.co" className="btn-cta-orange">Solicitar cotización</a>
          <a href="https://wa.me/573000000000" className="btn-cta-ghost">WhatsApp</a>
        </div>
      </div>

      {/* Delivery info */}
      <div className="delivery-band">
        <div className="delivery-item">
          <span className="delivery-icon">🚚</span>
          <div>
            <strong>Envío a todo el país</strong>
            Despachos desde Bogotá, Medellín y Cali
          </div>
        </div>
        <div className="delivery-item">
          <span className="delivery-icon">⚡</span>
          <div>
            <strong>Producción express</strong>
            Entrega en 5 días hábiles
          </div>
        </div>
        <div className="delivery-item">
          <span className="delivery-icon">🎨</span>
          <div>
            <strong>Arte gratis</strong>
            Incluimos diseño y archivo final
          </div>
        </div>
      </div>
    </>
  );
}
