"use client";

import { useState, useMemo } from "react";
import { ProductDetailModal } from "@/components/ProductDetailModal";

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
  subcategory_id: string | null;
  product_colors: Color[];
  primaryImageUrl?: string | null;
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

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(price);

export function CatalogGrid({ products, subcategories, categoryIcon }: Props) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("default");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = products;

    if (activeFilter !== "all") {
      list = list.filter((p) => p.subcategory_id === activeFilter);
    }

    if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);

    return list;
  }, [products, activeFilter, sort]);

  return (
    <>
      {/* Filter bar */}
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

      {/* Products grid */}
      <section className="products-section">
        <p className="section-count">{filtered.length} productos</p>
        <div className="products-grid">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="product-card"
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedProductId(p.id)}
            >
              <div className="product-thumb">
                {p.primaryImageUrl ? (
                  <img
                    src={p.primaryImageUrl}
                    alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8px" }}
                  />
                ) : (
                  <div className="product-thumb-placeholder">{categoryIcon}</div>
                )}
              </div>
              <div className="product-info">
                {p.product_colors.length > 0 && (
                  <div className="color-dots">
                    {p.product_colors.slice(0, 5).map((c) => (
                      <span
                        key={c.id}
                        className="color-dot"
                        style={{ background: c.hex_color }}
                        title={c.name}
                      />
                    ))}
                    {p.product_colors.length > 5 && (
                      <span className="color-more">+{p.product_colors.length - 5}</span>
                    )}
                  </div>
                )}
                <p className="product-ref">{p.reference}</p>
                <p className="product-name">{p.name}</p>
                <div className="product-price-block">
                  <span className="price-badge">{p.price_label}</span>
                  <p className="product-price">{formatPrice(p.price)}</p>
                </div>
                <button
                  className="btn-personalizar"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProductId(p.id);
                  }}
                >
                  Ver detalles
                </button>
              </div>
            </article>
          ))}

          {filtered.length === 0 && (
            <p style={{ color: "var(--text-sec)", padding: "48px 0", gridColumn: "1/-1" }}>
              No hay productos en esta subcategoría.
            </p>
          )}
        </div>
      </section>

      {/* Product detail modal */}
      <ProductDetailModal
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        isAdmin={false}
      />
    </>
  );
}
