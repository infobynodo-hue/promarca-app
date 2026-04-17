import "./public.css";
import { Inter } from "next/font/google";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ProMarca — Productos Promocionales",
  description: "Productos promocionales personalizados para tu empresa.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pm-site ${inter.className}`}>
      {/* ── Navigation ── */}
      <PublicNav />

      {/* ── Page content ── */}
      {children}

      {/* ── Footer ── */}
      <PublicFooter />
    </div>
  );
}
