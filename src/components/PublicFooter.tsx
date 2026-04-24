import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com/promarca.co" },
  { label: "Facebook",  href: "https://facebook.com/promarca.co" },
  { label: "LinkedIn",  href: "https://linkedin.com/company/promarca" },
  { label: "WhatsApp",  href: "https://wa.me/573025212938" },
];

const SocialIcons: Record<string, React.FC<{ style?: React.CSSProperties }>> = {
  Instagram: ({ style }) => (
    <svg style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  Facebook: ({ style }) => (
    <svg style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  LinkedIn: ({ style }) => (
    <svg style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  WhatsApp: ({ style }) => (
    <svg style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
};

const catalogLinks = [
  { text: "Mugs & Pocillos",  href: "/catalogo/mugs" },
  { text: "Termos & Vasos",   href: "/catalogo/termos" },
  { text: "Gorras",           href: "/catalogo/gorras" },
  { text: "Lapiceros",        href: "/catalogo/lapiceros" },
  { text: "Tulas & Mochilas", href: "/catalogo/tulas" },
  { text: "USB & Tecnología", href: "/catalogo/usb" },
  { text: "Ver todo →",       href: "/#catalogo" },
];

const serviceLinks = [
  { text: "Kits corporativos",    href: "/catalogo/kits" },
  { text: "Producción express",   href: "#" },
  { text: "Diseño & Arte final",  href: "#" },
  { text: "Muestras físicas",     href: "#" },
  { text: "Envíos nacionales",    href: "#" },
  { text: "Pedidos al por mayor", href: "#" },
];

const companyLinks = [
  { text: "Quiénes somos",        href: "#" },
  { text: "Clientes",             href: "#" },
  { text: "Casos de éxito",       href: "#" },
  { text: "Trabaja con nosotros", href: "#" },
  { text: "Contáctanos",          href: "/#contacto" },
];

const supportLinks = [
  { text: "¿Cómo hacer un pedido?", href: "#" },
  { text: "Tiempos de producción",  href: "#" },
  { text: "Guía de arte",           href: "#" },
  { text: "Preguntas frecuentes",   href: "#" },
  { text: "Política de cambios",    href: "#" },
];

const linkCols = [
  { title: "Catálogo",  links: catalogLinks },
  { title: "Servicios", links: serviceLinks },
  { title: "Empresa",   links: companyLinks },
  { title: "Soporte",   links: supportLinks },
];

export function PublicFooter() {
  return (
    <footer
      id="nosotros"
      style={{
        background: "#f5f5f7",
        position: "relative",
        overflow: "hidden",
        padding: "56px 20px 0",
        boxSizing: "border-box",
      }}
    >
      {/* ── Glow blobs ── */}
      <div style={{ pointerEvents: "none", position: "absolute", inset: 0 }}>
        <div style={{
          position: "absolute", top: "-80px", left: "25%",
          width: "280px", height: "280px", borderRadius: "50%",
          background: "rgba(255,107,26,0.10)", filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, right: "25%",
          width: "320px", height: "320px", borderRadius: "50%",
          background: "rgba(255,107,26,0.08)", filter: "blur(60px)",
        }} />
      </div>

      {/* ── Legal notice ── */}
      <p style={{
        position: "relative",
        textAlign: "center",
        fontSize: "12px",
        color: "#86868b",
        lineHeight: 1.6,
        maxWidth: "760px",
        margin: "0 auto 32px",
      }}>
        Los precios y disponibilidad están sujetos a cambios sin previo aviso.
        Los pedidos mínimos varían según el producto. Consulta a nuestro equipo
        para condiciones especiales en grandes volúmenes.
      </p>

      {/* ── Glass card ── */}
      <div style={{
        position: "relative",
        maxWidth: "1100px",
        margin: "0 auto",
        borderRadius: "20px",
        padding: "40px 48px",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        background: "radial-gradient(ellipse at 30% 0%, rgba(255,107,26,0.10) 0%, rgba(255,255,255,0.80) 50%, rgba(245,245,247,0.90) 100%)",
        border: "1px solid rgba(255,107,26,0.18)",
        boxShadow: "0 4px 32px rgba(255,107,26,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
        boxSizing: "border-box",
      }}>

        {/* ── Main grid: brand col + 4 link cols ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: "48px",
          alignItems: "start",
        }}>

          {/* ── Brand column ── */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Link href="/" style={{ display: "inline-flex", marginBottom: "18px", textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/promarca-logo.png" alt="ProMarca" style={{ height: "28px", width: "auto" }} />
            </Link>

            <p style={{ fontSize: "13px", color: "#6e6e73", lineHeight: 1.6, marginBottom: "20px", maxWidth: "200px" }}>
              Productos promocionales personalizados para empresas y marcas en Colombia.
              Calidad, rapidez y diseño en cada pedido.
            </p>

            {/* Social icons */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {socialLinks.map(({ label, href }) => {
                const Icon = SocialIcons[label];
                return (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      background: "rgba(255,107,26,0.10)",
                      border: "1px solid rgba(255,107,26,0.20)",
                      color: "#FF6B1A",
                      textDecoration: "none",
                      flexShrink: 0,
                      transition: "transform 0.15s",
                    }}
                  >
                    {Icon && <Icon style={{ width: "15px", height: "15px" }} />}
                  </a>
                );
              })}
            </div>

            {/* Contact info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { Icon: Mail,   text: "promarcapop@gmail.com",   href: "mailto:promarcapop@gmail.com" },
                { Icon: Phone,  text: "+57 302 521 2938",    href: "https://wa.me/573025212938" },
                { Icon: MapPin, text: "Bogotá, Colombia",    href: "#" },
              ].map(({ Icon, text, href }) => (
                <a
                  key={text}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "12px",
                    color: "#6e6e73",
                    textDecoration: "none",
                  }}
                >
                  <Icon style={{ width: "13px", height: "13px", color: "#FF6B1A", flexShrink: 0 }} />
                  {text}
                </a>
              ))}
            </div>
          </div>

          {/* ── 4 link columns ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "24px",
          }}>
            {linkCols.map(({ title, links }) => (
              <div key={title}>
                <p style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#FF6B1A",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: "14px",
                }}>
                  {title}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                  {links.map(({ text, href }) => (
                    <Link
                      key={text}
                      href={href}
                      style={{ fontSize: "12.5px", color: "#6e6e73", textDecoration: "none" }}
                    >
                      {text}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div style={{
          marginTop: "36px",
          paddingTop: "20px",
          borderTop: "1px solid rgba(255,107,26,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          fontSize: "12px",
          color: "#86868b",
        }}>
          <p style={{ margin: 0 }}>© 2026 ProMarca. Todos los derechos reservados.</p>
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { text: "Política de privacidad", href: "#" },
              { text: "Términos de uso",        href: "#" },
              { text: "Mapa del sitio",         href: "#" },
            ].map(({ text, href }) => (
              <a key={text} href={href} style={{ color: "#86868b", textDecoration: "none" }}>
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom padding ── */}
      <div style={{ height: "32px" }} />
    </footer>
  );
}
