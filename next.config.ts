import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  async redirects() {
    return [
      { source: "/admin", destination: "/admin/dashboard", permanent: false },
      // Old static site URLs → new dynamic routes
      { source: "/termos.html", destination: "/catalogo/termos", permanent: true },
      { source: "/mugs.html", destination: "/catalogo/mugs", permanent: true },
      { source: "/gorras.html", destination: "/catalogo/gorras", permanent: true },
      { source: "/lapiceros.html", destination: "/catalogo/lapiceros", permanent: true },
      { source: "/tulas.html", destination: "/catalogo/tulas", permanent: true },
      { source: "/sombrillas.html", destination: "/catalogo/sombrillas", permanent: true },
      { source: "/usb.html", destination: "/catalogo/usb", permanent: true },
      { source: "/textiles.html", destination: "/catalogo/textiles", permanent: true },
      { source: "/cuadernos.html", destination: "/catalogo/cuadernos", permanent: true },
      { source: "/kits.html", destination: "/catalogo/kits", permanent: true },
    ];
  },
};

export default nextConfig;
