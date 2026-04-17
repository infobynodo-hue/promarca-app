import Link from "next/link";
import { Instagram, Facebook, Linkedin, Mail, Phone, MapPin } from "lucide-react";

const socialLinks = [
  {
    icon: Instagram,
    label: "Instagram",
    href: "https://instagram.com/promarca.co",
  },
  {
    icon: Facebook,
    label: "Facebook",
    href: "https://facebook.com/promarca.co",
  },
  {
    icon: Linkedin,
    label: "LinkedIn",
    href: "https://linkedin.com/company/promarca",
  },
  {
    // WhatsApp SVG inline
    icon: null,
    label: "WhatsApp",
    href: "https://wa.me/573025212938",
  },
];

const catalogLinks = [
  { text: "Mugs & Pocillos",    href: "/catalogo/mugs" },
  { text: "Termos & Vasos",     href: "/catalogo/termos" },
  { text: "Gorras",             href: "/catalogo/gorras" },
  { text: "Lapiceros",          href: "/catalogo/lapiceros" },
  { text: "Tulas & Mochilas",   href: "/catalogo/tulas" },
  { text: "USB & Tecnología",   href: "/catalogo/usb" },
  { text: "Ver todo →",         href: "/#catalogo" },
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
  { text: "Quiénes somos",       href: "#" },
  { text: "Clientes",            href: "#" },
  { text: "Casos de éxito",      href: "#" },
  { text: "Trabaja con nosotros",href: "#" },
  { text: "Contáctanos",         href: "/#contacto" },
];

const supportLinks = [
  { text: "¿Cómo hacer un pedido?",   href: "#" },
  { text: "Tiempos de producción",    href: "#" },
  { text: "Guía de arte",             href: "#" },
  { text: "Preguntas frecuentes",     href: "#" },
  { text: "Política de cambios",      href: "#" },
];

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function PublicFooter() {
  return (
    <footer
      className="relative overflow-hidden pt-16 pb-8"
      style={{ background: "#f5f5f7" }}
      id="nosotros"
    >
      {/* ── Glow blobs ── */}
      <div className="pointer-events-none absolute inset-0 select-none">
        <div
          className="absolute -top-24 left-1/4 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "rgba(255,107,26,0.12)" }}
        />
        <div
          className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "rgba(255,107,26,0.10)" }}
        />
      </div>

      {/* ── Legal notice ── */}
      <div
        className="relative mx-auto mb-8 max-w-5xl px-6 py-4 text-center text-xs leading-relaxed"
        style={{ color: "#86868b" }}
      >
        Los precios y disponibilidad están sujetos a cambios sin previo aviso.
        Los pedidos mínimos varían según el producto. Consulta a nuestro equipo
        para condiciones especiales en grandes volúmenes.
      </div>

      {/* ── Glass card ── */}
      <div
        className="relative mx-auto max-w-6xl rounded-2xl px-8 py-10 md:px-12"
        style={{
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          background:
            "radial-gradient(ellipse at 30% 0%, rgba(255,107,26,0.10) 0%, rgba(255,255,255,0.75) 55%, rgba(245,245,247,0.85) 100%)",
          border: "1px solid rgba(255,107,26,0.18)",
          boxShadow:
            "0 4px 32px rgba(255,107,26,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">

          {/* ── Brand column ── */}
          <div className="flex flex-col items-center lg:items-start">
            <Link href="/" className="mb-5 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/promarca-logo.png"
                alt="ProMarca"
                className="h-8 w-auto"
              />
            </Link>

            <p
              className="mb-6 max-w-xs text-center text-sm leading-relaxed lg:text-left"
              style={{ color: "#6e6e73" }}
            >
              Productos promocionales personalizados para empresas y marcas en
              Colombia. Calidad, rapidez y diseño en cada pedido.
            </p>

            {/* Social links */}
            <ul className="flex gap-4">
              {socialLinks.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110"
                    style={{
                      background: "rgba(255,107,26,0.10)",
                      border: "1px solid rgba(255,107,26,0.20)",
                      color: "#FF6B1A",
                    }}
                  >
                    {Icon ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <WhatsAppIcon />
                    )}
                  </a>
                </li>
              ))}
            </ul>

            {/* Contact info */}
            <ul className="mt-6 space-y-2">
              {[
                { icon: Mail,    text: "hola@promarca.co",     href: "mailto:hola@promarca.co" },
                { icon: Phone,   text: "+57 302 521 2938",      href: "https://wa.me/573025212938" },
                { icon: MapPin,  text: "Bogotá, Colombia",      href: "#" },
              ].map(({ icon: Icon, text, href }) => (
                <li key={text}>
                  <a
                    href={href}
                    className="flex items-center gap-2 text-xs transition-colors hover:text-orange-600"
                    style={{ color: "#6e6e73" }}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#FF6B1A" }} />
                    {text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Link columns ── */}
          <div className="grid grid-cols-2 gap-8 lg:col-span-2 sm:grid-cols-4">
            {[
              { title: "Catálogo",  links: catalogLinks },
              { title: "Servicios", links: serviceLinks },
              { title: "Empresa",   links: companyLinks },
              { title: "Soporte",   links: supportLinks },
            ].map(({ title, links }) => (
              <div key={title} className="text-center sm:text-left">
                <p
                  className="mb-4 text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "#FF6B1A" }}
                >
                  {title}
                </p>
                <ul className="space-y-2.5">
                  {links.map(({ text, href }) => (
                    <li key={text}>
                      <Link
                        href={href}
                        className="text-xs transition-colors hover:text-orange-600"
                        style={{ color: "#6e6e73" }}
                      >
                        {text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs sm:flex-row"
          style={{ borderColor: "rgba(255,107,26,0.15)", color: "#86868b" }}
        >
          <p>© 2026 ProMarca. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            {[
              { text: "Política de privacidad", href: "#" },
              { text: "Términos de uso",        href: "#" },
              { text: "Mapa del sitio",         href: "#" },
            ].map(({ text, href }) => (
              <a
                key={text}
                href={href}
                className="transition-colors hover:text-orange-600"
              >
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
