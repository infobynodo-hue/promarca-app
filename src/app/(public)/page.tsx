import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { HeroCarousel } from "./components/hero-carousel";
import { LaserVideo } from "./components/laser-video";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { KitCarousel, type KitOffer } from "@/components/public/KitCarousel";

const clients = [
  { src: "/img/clientes/ecoimagen.png", alt: "Ecoimagen Salud" },
  { src: "/img/clientes/viviendas.png", alt: "Viviendas y Valores" },
  { src: "/img/clientes/colpatria.png", alt: "Colpatria" },
  { src: "/img/clientes/cens.png", alt: "CENS" },
  { src: "/img/clientes/sura.png", alt: "Sura" },
  { src: "/img/clientes/american-airlines.png", alt: "American Airlines" },
  { src: "/img/clientes/oracle.png", alt: "Oracle" },
  { src: "/img/clientes/aseo-urbano.png", alt: "Aseo Urbano" },
  { src: "/img/clientes/jetblue.png", alt: "JetBlue" },
  { src: "/img/clientes/elvecino.png", alt: "El Vecino" },
  { src: "/img/clientes/del-corazon.png", alt: "Servicios del Corazón" },
];

const testimonials = [
  { initials: "MF", name: "María Fernanda Reyes", handle: "Gerente de Marketing · Grupo Bancario", body: "Los termos personalizados fueron el mejor regalo corporativo que hemos dado. La calidad superó todas nuestras expectativas.", date: "Marzo 2025" },
  { initials: "CA", name: "Carlos Arbeláez", handle: "Director Comercial · Constructora Bolívar", body: "Pedimos 300 gorras bordadas para un evento y llegaron perfectas, a tiempo y con un acabado increíble. Ya somos clientes fijos.", date: "Enero 2025" },
  { initials: "LG", name: "Laura Gómez", handle: "Coordinadora de RRHH · Sura", body: "Los kits de bienvenida elevaron nuestra imagen como empleador. Nuestros nuevos colaboradores quedan encantados con cada detalle.", date: "Febrero 2025" },
  { initials: "JM", name: "Julián Moreno", handle: "CEO · Agencia Creativa DM", body: "Rápidos, creativos y con muy buen precio. Pedimos tulas y lapiceros para una campaña y el resultado fue 10/10.", date: "Abril 2025" },
  { initials: "VP", name: "Valentina Pineda", handle: "Brand Manager · American Airlines CO", body: "1.000 memorias USB para un congreso internacional. ProMarca lo manejó todo con total profesionalismo y puntualidad.", date: "Diciembre 2024" },
  { initials: "RO", name: "Ricardo Ospina", handle: "Gerente General · Oracle Colombia", body: "Los cuadernos y sombrillas quedaron con un acabado premium que representa muy bien nuestra marca. Excelente experiencia.", date: "Noviembre 2024" },
];

const kits: KitOffer[] = [
  {
    id: "kit-onboarding",
    imageSrc: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&auto=format&fit=crop",
    imageAlt: "Kit de bienvenida corporativo",
    tag: "Más solicitado",
    title: "Kit de Onboarding",
    description: "Termo + libreta + lapicero + tula. Ideal para recibir nuevos colaboradores con el branding de tu empresa.",
    includes: "Termo · Libreta · Lapicero · Tula",
    href: "#contacto",
  },
  {
    id: "kit-eventos",
    imageSrc: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop",
    imageAlt: "Kit para eventos corporativos",
    tag: "Eventos",
    title: "Kit para Eventos",
    description: "Gorra + camiseta + tula con tu logo. Perfecto para conferencias, lanzamientos y ferias empresariales.",
    includes: "Gorra · Camiseta · Tula",
    href: "#contacto",
  },
  {
    id: "kit-premium",
    imageSrc: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop",
    imageAlt: "Kit ejecutivo premium",
    tag: "Premium",
    title: "Kit Ejecutivo",
    description: "Maletín + termo acero + libreta cuero + set de lapiceros. Para clientes VIP y directivos.",
    includes: "Maletín · Termo · Set escritorio",
    href: "#contacto",
  },
  {
    id: "kit-temporada",
    imageSrc: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600&auto=format&fit=crop",
    imageAlt: "Kit de fin de año",
    tag: "Temporada",
    title: "Kit Fin de Año",
    description: "Caja premium con termo, dulces corporativos, libreta y tarjeta de marca. El detalle perfecto de diciembre.",
    includes: "Caja · Termo · Libreta · Dulces",
    href: "#contacto",
  },
  {
    id: "kit-bienestar",
    imageSrc: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop",
    imageAlt: "Kit de bienestar corporativo",
    tag: "Bienestar",
    title: "Kit Wellness",
    description: "Botella deportiva + toalla microfibra + snacks saludables + cuaderno. Para promover el bienestar en tu equipo.",
    includes: "Botella · Toalla · Cuaderno",
    href: "#contacto",
  },
  {
    id: "kit-home-office",
    imageSrc: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&auto=format&fit=crop",
    imageAlt: "Kit home office corporativo",
    tag: "Home Office",
    title: "Kit Home Office",
    description: "Mouse pad + porta lapiceros + libreta + termo. Para equipar a tus colaboradores remotos con identidad de marca.",
    includes: "Mouse pad · Porta utensilios · Termo",
    href: "#contacto",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  const cats = categories ?? [];

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero dark" id="inicio">
        <p className="hero-eyebrow">Merchandising</p>
        <h1 className="hero-title">Tu marca.<br />En cada detalle.</h1>
        <p className="hero-sub">Productos promocionales que generan recordación duradera. Personalizados para tu empresa.</p>
        <div className="hero-ctas">
          <a href="#catalogo" className="btn btn-primary btn-glass">Ver catálogos</a>
          <a href="#personalizacion" className="btn btn-secondary btn-glass" style={{ color: "#86868b", borderBottom: "1px solid #86868b" }}>Cómo personalizar</a>
        </div>
        <HeroCarousel />
      </section>

      {/* ── CLIENTS MARQUEE ── */}
      <section className="clients-section">
        <p className="section-label" style={{ marginBottom: "28px" }}>Nuestros clientes</p>
        <div className="clients-track-wrap">
          <div className="clients-fade clients-fade--left" />
          <div className="clients-fade clients-fade--right" />
          <div className="clients-track">
            <div className="clients-list">
              {clients.map((c) => (
                <div key={c.alt} className="client-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src} alt={c.alt} />
                </div>
              ))}
            </div>
            <div className="clients-list" aria-hidden="true">
              {clients.map((c) => (
                <div key={c.alt + "-2"} className="client-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src} alt="" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY GRID ── */}
      <section id="catalogo">
        <div className="category-section">
          <div className="section-header">
            <p className="section-label">Catálogo completo</p>
            <h2 className="section-title">Explora todo lo que<br />puedes personalizar</h2>
            <p className="section-sub">Desde pequeños detalles hasta grandes campañas, tenemos el producto perfecto para tu marca.</p>
          </div>
          <div className="cat-grid">
            {cats.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalogo/${cat.slug}`}
                className="cat-card shine"
                style={{ backgroundImage: `url('/img/categorias/${cat.slug}.webp')` }}
              >
                <LiquidButton
                  variant="orange"
                  style={{
                    marginBottom: "8px",
                    alignSelf: "flex-start",
                    position: "relative",
                    zIndex: 2,
                    padding: "6px 14px",
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat.name}
                </LiquidButton>
                <LiquidButton
                  variant="glass"
                  style={{
                    alignSelf: "flex-start",
                    position: "relative",
                    zIndex: 2,
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Ver todos →
                </LiquidButton>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div className="stats-band">
        <div className="stats-inner">
          <div>
            <div className="stat-num">+500</div>
            <div className="stat-label">Productos disponibles para personalizar</div>
          </div>
          <div>
            <div className="stat-num">+200</div>
            <div className="stat-label">Marcas que confían en ProMarca</div>
          </div>
          <div>
            <div className="stat-num">8 años</div>
            <div className="stat-label">Experiencia en mercadeo promocional</div>
          </div>
        </div>
      </div>

      {/* ── PROMO GRID ── */}
      <div className="promo-grid" id="destacados">
        <div className="promo-card">
          <div className="promo-content">
            <p className="promo-eyebrow">Más vendido</p>
            <h2 className="promo-title">Termos<br />Premium</h2>
            <p className="promo-sub">Acero inoxidable con doble pared. Tu logo grabado a láser para que nunca se borre.</p>
            <div className="promo-links">
              <Link href="/catalogo/termos">Ver catálogo</Link>
              <a href="#contacto">Cotizar</a>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/promo/termos.png" alt="Termos Premium" className="promo-visual-img" />
        </div>
        <div className="promo-card dark-card">
          <div className="promo-content">
            <p className="promo-eyebrow">Nueva colección</p>
            <h2 className="promo-title">Gorras<br />2026</h2>
            <p className="promo-sub">Bordado premium en 3D o transfer. Más de 12 colores disponibles con ajuste universal.</p>
            <div className="promo-links">
              <Link href="/catalogo/gorras">Ver catálogo</Link>
              <a href="#contacto">Cotizar</a>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/promo/gorras.png" alt="Gorras 2026" className="promo-visual-img" />
        </div>
        <div className="promo-card dark-card">
          <div className="promo-content">
            <p className="promo-eyebrow">Esencial de oficina</p>
            <h2 className="promo-title">Lapiceros<br />con logotipo</h2>
            <p className="promo-sub">Desde 100 unidades. Impresión serigráfica de alta resolución en 4 colores.</p>
            <div className="promo-links">
              <Link href="/catalogo/lapiceros">Ver catálogo</Link>
              <a href="#contacto">Cotizar</a>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/promo/lapiceros.png" alt="Lapiceros con logotipo" className="promo-visual-img" />
        </div>
        <div className="promo-card">
          <div className="promo-content">
            <p className="promo-eyebrow">Tendencia 2026</p>
            <h2 className="promo-title">Tulas &<br />Mochilas</h2>
            <p className="promo-sub">Canvas reciclado y tela premium. Sublimación total o bordado en panel frontal.</p>
            <div className="promo-links">
              <Link href="/catalogo/tulas">Ver catálogo</Link>
              <a href="#contacto">Cotizar</a>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/promo/tulas.png" alt="Tulas y Mochilas" className="promo-visual-img" />
        </div>
      </div>

      {/* ── FEATURE — Personalización ── */}
      <section className="feature-section" id="personalizacion">
        <div className="feature-inner">
          <div className="feature-text">
            <p className="label">Personalización</p>
            <h2>Tu logo en cada superficie.</h2>
            <p>Usamos las mejores técnicas del mercado: serigrafía, sublimación, bordado 3D, grabado láser y transfer digital. Cada producto pasa por un control de calidad riguroso antes de llegar a tus manos.</p>
            <a href="#contacto" className="btn btn-primary">Solicitar muestra</a>
          </div>
          {/* Video láser — autoplay, loop, sin pausa al click/hover */}
          <LaserVideo />
        </div>
      </section>

      <section style={{ background: "#fff", padding: "80px 0" }}>
        <div className="feature-inner reverse" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
          <div className="feature-text">
            <p className="label">Tiempos de entrega</p>
            <h2>Rápido cuando más lo necesitas.</h2>
            <p>Entendemos que las campañas tienen fechas. Por eso ofrecemos producción express en menos de 5 días hábiles para pedidos urgentes. Envíos a todo el territorio con rastreo en tiempo real.</p>
            <a href="#contacto" className="btn btn-primary">Ver plazos de entrega</a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/envios-caja.jpg"
            alt="Caja ProMarca lista para envío"
            style={{
              flex: 1,
              minWidth: 0,
              width: "100%",
              maxWidth: "520px",
              borderRadius: "20px",
              objectFit: "cover",
            }}
          />
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="testimonial-section">
        <p className="section-label">Lo que dicen nuestros clientes</p>
        <h2>Marcas que confían en nosotros</h2>
        <p className="section-sub">Más de 500 empresas han personalizado sus productos con ProMarca. Esto es lo que dicen.</p>
        <div className="t-marquee-wrap">
          <div className="t-marquee-track">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className="t-card">
                <div className="t-card-header">
                  <div className="t-avatar-placeholder">{t.initials}</div>
                  <div>
                    <div className="t-name">{t.name}</div>
                    <div className="t-handle">{t.handle}</div>
                  </div>
                </div>
                <div className="t-stars">★★★★★</div>
                <p className="t-body">&ldquo;{t.body}&rdquo;</p>
                <div className="t-date">{t.date}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KITS HERO ── */}
      <section className="hero gray" style={{ minHeight: "auto", paddingBottom: "60px" }} id="kits">
        <p className="hero-eyebrow">Solución integral</p>
        <h1 className="hero-title" style={{ fontSize: "clamp(36px,6vw,66px)" }}>Kits corporativos listos para regalar.</h1>
        <p className="hero-sub">Armamos tu kit a medida: seleccionamos los productos, los personalizamos y los empacamos con tu branding. Perfecto para onboarding, eventos y temporadas.</p>
        <div className="hero-ctas">
          <a href="#contacto" className="btn btn-primary">Cotizar kit personalizado</a>
        </div>
        <div style={{ width: "100%", maxWidth: "1100px", margin: "40px auto 0", padding: "0 24px" }}>
          <KitCarousel kits={kits} />
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <div className="cta-band" id="contacto">
        <h2>¿Listo para llevar<br />tu marca más lejos?</h2>
        <p>Recibe tu cotización personalizada en menos de 24 horas.</p>
        <a href="mailto:promarcapop@gmail.com" className="btn-white btn-glass shine">Solicitar cotización</a>
        <a href="https://wa.me/573000000000" className="btn-outline-white btn-glass shine">Escríbenos por WhatsApp</a>
      </div>
    </>
  );
}
