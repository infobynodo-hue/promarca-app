"use client";

import { useState, useMemo } from "react";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { PublicProductCard } from "@/components/PublicProductCard";

interface Color {
  id: string;
  name: string;
  hex_color: string;
}

interface Product {
  id: string;
  reference: string;
  name: string;
  price: number;
  price_label: string;
  has_variants: boolean;
  subcategory_id: string | null;
  product_colors: Color[];
  imageUrls: string[]; // all images, primary first
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  products: Product[];
  subcategories: Subcategory[];
  categoryIcon: string;
}

export function CatalogGrid({ products, subcategories }: Props) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("default");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (activeFilter !== "all") list = list.filter((p) => p.subcategory_id === activeFilter);
    if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, activeFilter, sort]);

  return (
    <>
      {/* ── Filter bar ── */}
      <div className="filter-bar" id="filtros">
        <button
          className={`filter-btn${activeFilter === "all" ? " active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          Todos
        </button>
        {subcategories.map((s) => (
          <button
            key={s.id}
            className={`filter-btn${activeFilter === s.id ? " active" : ""}`}
            onClick={() => setActiveFilter(s.id)}
          >
            {s.name}
          </button>
        ))}
        {subcategories.length > 0 && <div className="filter-sep" />}
        <select
          className="filter-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="default">Ordenar por</option>
          <option value="asc">Menor precio</option>
          <option value="desc">Mayor precio</option>
        </select>
      </div>

      {/* ── Products grid ── */}
      <section className="products-section">
        <p className="section-count">{filtered.length} productos</p>

        <div className="products-grid-new">
          {filtered.map((p) => (
            <PublicProductCard
              key={p.id}
              id={p.id}
              reference={p.reference}
              name={p.name}
              price={p.price}
              price_label={p.price_label}
              has_variants={p.has_variants}
              product_colors={p.product_colors}
              images={p.imageUrls}
              onClick={() => setSelectedProductId(p.id)}
            />
          ))}

          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-zinc-400">
              No hay productos en esta subcategoría.
            </p>
          )}
        </div>
      </section>

      {/* ── Modal ── */}
      <ProductDetailModal
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        isAdmin={false}
      />
    </>
  );
}
