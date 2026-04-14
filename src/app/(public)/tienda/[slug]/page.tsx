import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

function darkenHex(hex: string, amount = 30): string {
  const h = hex.replace("#", "");
  const num = parseInt(h, 16);
  let r = (num >> 16) - amount;
  let g = ((num >> 8) & 0xff) - amount;
  let b = (num & 0xff) - amount;
  r = Math.max(0, r);
  g = Math.max(0, g);
  b = Math.max(0, b);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default async function TiendaSlugPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";

  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("b2c_campaigns")
    .select(
      `
      *,
      product:products(
        id, name, reference, price,
        product_images(id, storage_path, alt_text, is_primary, display_order)
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (!campaign) notFound();
  if (campaign.status !== "published" && !isPreview) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Página no disponible
          </h1>
          <p style={{ color: "#71717a" }}>Esta campaña aún no ha sido publicada.</p>
        </div>
      </div>
    );
  }

  const product = campaign.product as
    | {
        id: string;
        name: string;
        reference: string;
        price: number;
        product_images?: {
          id: string;
          storage_path: string;
          alt_text: string | null;
          is_primary: boolean;
          display_order: number;
        }[];
      }
    | null
    | undefined;

  const primaryColor: string = campaign.primary_color ?? "#FF6B2C";
  const darkerColor = darkenHex(primaryColor, 40);

  // Build product image URLs
  const images: { url: string; alt: string }[] = [];
  if (product?.product_images?.length) {
    const sorted = [...product.product_images].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.display_order - b.display_order;
    });
    for (const img of sorted) {
      const { data } = supabase.storage
        .from("products")
        .getPublicUrl(img.storage_path);
      images.push({ url: data.publicUrl, alt: img.alt_text ?? product.name });
    }
  }

  const realPrice =
    campaign.price_override != null ? campaign.price_override : product?.price ?? 0;
  const comparePrice: number | null = campaign.compare_price ?? null;

  const benefits: { emoji: string; text: string }[] = Array.isArray(campaign.benefits)
    ? campaign.benefits
    : [];

  const whatsappUrl = campaign.whatsapp_number
    ? `https://wa.me/${campaign.whatsapp_number}?text=${encodeURIComponent(
        `Hola, vi el producto ${campaign.headline ?? product?.name ?? ""} y me interesa`
      )}`
    : null;

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #0a0a0a; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; }
    .page { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #0a0a0a; }

    /* Preview banner */
    .preview-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: ${primaryColor}; color: #fff; text-align: center;
      padding: 10px 16px; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: 12px;
    }
    .preview-banner a { color: #fff; text-decoration: underline; }

    /* Brand header */
    .brand-header {
      padding: 24px 20px 0;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .brand-logo { max-height: 40px; width: auto; object-fit: contain; }
    .brand-name { font-size: 1.1rem; font-weight: 700; color: #fff; }
    .brand-line { width: 60px; height: 2px; background: ${primaryColor}; border-radius: 2px; }

    /* Image gallery */
    .gallery { padding: 20px 0 0; position: relative; }
    .gallery-scroll {
      display: flex; gap: 12px; overflow-x: auto; padding: 0 20px 12px;
      scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .gallery-scroll::-webkit-scrollbar { display: none; }
    .gallery-img-wrap {
      flex: 0 0 calc(100% - 40px); scroll-snap-align: start;
      background: #fff; border-radius: 16px;
      overflow: hidden; aspect-ratio: 1;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .gallery-img-wrap img {
      width: 100%; height: 100%; object-fit: contain; display: block;
    }
    .gallery-placeholder {
      flex: 0 0 calc(100% - 40px);
      background: #1a1a1a; border-radius: 16px;
      aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
    }
    .gallery-placeholder span { font-size: 3rem; opacity: 0.3; }
    .gallery-dots {
      display: flex; justify-content: center; gap: 6px; padding: 8px 0 0;
    }
    .gallery-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
    }
    .gallery-dot.active { background: ${primaryColor}; width: 18px; border-radius: 3px; }

    /* Headline */
    .headline-block {
      padding: 24px 20px 16px;
      text-align: center;
    }
    .headline-text {
      font-size: 1.4rem; font-weight: 800; color: #fff;
      line-height: 1.3; letter-spacing: -0.02em;
    }
    .subheadline-text {
      margin-top: 8px; font-size: 0.95rem; color: #a1a1aa; line-height: 1.5;
    }

    /* Price block */
    .price-block {
      padding: 0 20px 20px; text-align: center;
    }
    .price-compare {
      font-size: 1rem; color: #71717a; text-decoration: line-through;
      margin-bottom: 4px;
    }
    .price-main {
      font-size: 2.4rem; font-weight: 900; color: #fff; line-height: 1;
    }
    .price-note {
      margin-top: 6px; font-size: 0.8rem; color: #52525b;
    }

    /* Primary CTA */
    .cta-primary {
      margin: 0 20px 20px;
      display: block; width: calc(100% - 40px);
      height: 56px; border-radius: 14px; border: none; cursor: pointer;
      background: linear-gradient(135deg, ${primaryColor}, ${darkerColor});
      color: #fff; font-size: 1.05rem; font-weight: 800; letter-spacing: 0.04em;
      text-decoration: none; text-align: center; line-height: 56px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 24px rgba(255,107,44,0.4);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .cta-primary:active { transform: scale(0.98); }
    .cta-primary.disabled {
      background: #3f3f46; color: #71717a; cursor: not-allowed;
      box-shadow: none;
    }

    /* Benefits */
    .benefits-card {
      margin: 0 20px 20px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px; padding: 20px;
    }
    .benefits-title {
      font-size: 0.8rem; font-weight: 700; color: #71717a;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;
    }
    .benefit-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 0;
    }
    .benefit-item + .benefit-item {
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    .benefit-emoji { font-size: 1.3rem; flex-shrink: 0; }
    .benefit-text { font-size: 0.9rem; color: #e4e4e7; line-height: 1.4; }

    /* FOMO bar */
    .fomo-bar {
      margin: 0 20px 20px;
      background: rgba(255,107,44,0.12);
      border: 1px solid rgba(255,107,44,0.3);
      border-radius: 12px; padding: 12px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    .fomo-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: ${primaryColor}; flex-shrink: 0;
      animation: pulse 1.5s ease-in-out infinite;
    }
    .fomo-text { font-size: 0.85rem; color: #e4e4e7; font-weight: 500; }

    /* WhatsApp CTA */
    .cta-whatsapp {
      margin: 0 20px 28px;
      display: block; width: calc(100% - 40px);
      height: 48px; border-radius: 12px; border: 1px solid rgba(37,211,102,0.3);
      cursor: pointer;
      background: rgba(37,211,102,0.08);
      color: #25D366; font-size: 0.95rem; font-weight: 700;
      text-decoration: none; text-align: center; line-height: 48px;
      box-shadow: 0 0 20px rgba(37,211,102,0.1);
      transition: background 0.15s, box-shadow 0.15s;
      backdrop-filter: blur(12px);
    }
    .cta-whatsapp:active { background: rgba(37,211,102,0.15); }

    /* Footer */
    .lp-footer {
      padding: 24px 20px;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    .lp-footer p { font-size: 0.75rem; color: #3f3f46; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {isPreview && (
        <div className="preview-banner">
          <span>VISTA PREVIA — Esta página no está publicada aún</span>
          <a href={`/admin/campanas/${campaign.id}/editar`}>← Volver a editar</a>
        </div>
      )}

      <div className="page" style={{ paddingTop: isPreview ? "42px" : "0" }}>
        {/* 1. Brand header */}
        <div className="brand-header">
          {campaign.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.brand_logo_url}
              alt={campaign.brand_name ?? ""}
              className="brand-logo"
            />
          ) : (
            <div className="brand-name">{campaign.brand_name}</div>
          )}
          <div className="brand-line" />
        </div>

        {/* 2. Product image gallery */}
        <div className="gallery">
          <div className="gallery-scroll" id="gallery-scroll">
            {images.length > 0 ? (
              images.map((img, i) => (
                <div className="gallery-img-wrap" key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt} loading={i === 0 ? "eager" : "lazy"} />
                </div>
              ))
            ) : (
              <div className="gallery-placeholder">
                <span>📦</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-dots">
              {images.map((_, i) => (
                <div key={i} className={`gallery-dot${i === 0 ? " active" : ""}`} />
              ))}
            </div>
          )}
        </div>

        {/* 3. Headline block */}
        <div className="headline-block">
          <h1 className="headline-text">{campaign.headline}</h1>
          {campaign.subheadline && (
            <p className="subheadline-text">{campaign.subheadline}</p>
          )}
        </div>

        {/* 4. Price block */}
        <div className="price-block">
          {comparePrice != null && (
            <div className="price-compare">{fmt(comparePrice)}</div>
          )}
          <div className="price-main">{fmt(realPrice)}</div>
          <div className="price-note">Precio por unidad · Envío incluido</div>
        </div>

        {/* 5. Primary CTA */}
        {campaign.shopify_url ? (
          <a
            href={campaign.shopify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-primary"
          >
            🛒 COMPRAR AHORA
          </a>
        ) : (
          <span className="cta-primary disabled">Próximamente</span>
        )}

        {/* 6. Benefits */}
        {benefits.length > 0 && (
          <div className="benefits-card">
            <div className="benefits-title">Por qué elegirlo</div>
            {benefits.map((b, i) => (
              <div className="benefit-item" key={i}>
                <span className="benefit-emoji">{b.emoji}</span>
                <span className="benefit-text">{b.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* 7. FOMO bar */}
        {campaign.fomo_text && (
          <div className="fomo-bar">
            <div className="fomo-dot" />
            <div className="fomo-text">{campaign.fomo_text}</div>
          </div>
        )}

        {/* 8. WhatsApp CTA */}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-whatsapp"
          >
            💬 Consultar por WhatsApp
          </a>
        )}

        {/* Footer */}
        <div className="lp-footer">
          <p>© {new Date().getFullYear()} {campaign.brand_name ?? "ProMarca"} · Todos los derechos reservados</p>
        </div>
      </div>

      {/* Gallery dots scroll sync script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              var scroll = document.getElementById('gallery-scroll');
              if(!scroll) return;
              var dots = document.querySelectorAll('.gallery-dot');
              if(dots.length < 2) return;
              scroll.addEventListener('scroll', function(){
                var idx = Math.round(scroll.scrollLeft / scroll.offsetWidth);
                dots.forEach(function(d, i){
                  d.classList.toggle('active', i===idx);
                });
              }, {passive:true});
            })();
          `,
        }}
      />
    </>
  );
}
