import "./public.css";
import { Inter } from "next/font/google";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { FavoritesDrawer } from "@/components/public/FavoritesDrawer";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ProMarca — Productos Promocionales",
  description: "Productos promocionales personalizados para tu empresa.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <FavoritesProvider>
      <div className={`pm-site ${inter.className}`}>
        {/* ── Navigation ── */}
        <PublicNav />

        {/* ── Page content ── */}
        {children}

        {/* ── Footer ── */}
        <PublicFooter />

        {/* ── Favorites slide-out drawer ── */}
        <FavoritesDrawer />
      </div>
    </FavoritesProvider>
  );
}
