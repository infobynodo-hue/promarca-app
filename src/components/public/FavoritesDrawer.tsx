"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Trash2, ShoppingBag } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function FavoritesDrawer() {
  const { favorites, count, removeFavorite, isDrawerOpen, closeDrawer } =
    useFavorites();

  // Close on Escape
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDrawerOpen, closeDrawer]);

  // Lock body scroll when open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isDrawerOpen]);

  // Build WhatsApp message with all favorites
  const buildWhatsAppUrl = () => {
    const list = favorites
      .map((f) => `• ${f.name} (${f.reference})`)
      .join("%0A");
    const text = `Hola! Me interesan estos productos de ProMarca:%0A${list}%0A%0A¿Podrían darme más información?`;
    return `https://wa.me/573025212938?text=${text}`;
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 400,
            }}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 38 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              maxWidth: 400,
              background: "#ffffff",
              boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
              zIndex: 401,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px 18px",
                borderBottom: "1px solid #f4f4f5",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Heart
                  style={{ width: 20, height: 20, color: "#FF6B1A", fill: "#FF6B1A" }}
                />
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "#18181b",
                    margin: 0,
                  }}
                >
                  Mis favoritos
                </h2>
                {count > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 22,
                      height: 22,
                      borderRadius: 9999,
                      background: "rgba(255,107,26,0.12)",
                      border: "1px solid rgba(255,107,26,0.25)",
                      color: "#c84e00",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "0 6px",
                    }}
                  >
                    {count}
                  </span>
                )}
              </div>
              <button
                onClick={closeDrawer}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  cursor: "pointer",
                  color: "#71717a",
                  flexShrink: 0,
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* ── Product list ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {favorites.length === 0 ? (
                /* Empty state */
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: 16,
                    paddingBottom: 60,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: "rgba(255,107,26,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Heart
                      style={{ width: 32, height: 32, color: "#FF6B1A" }}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#18181b",
                        marginBottom: 6,
                      }}
                    >
                      Aún no tienes favoritos
                    </p>
                    <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.5 }}>
                      Dale al corazón en cualquier producto y lo encontrarás aquí.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {favorites.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 14,
                        background: "#fafafa",
                        border: "1px solid #f0f0f0",
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 10,
                          overflow: "hidden",
                          flexShrink: 0,
                          background: "#f4f4f5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <ShoppingBag
                            style={{ width: 24, height: 24, color: "#d4d4d8" }}
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: "monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#a1a1aa",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            marginBottom: 2,
                          }}
                        >
                          {item.reference}
                        </p>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#18181b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginBottom: 3,
                          }}
                        >
                          {item.name}
                        </p>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#FF6B1A",
                          }}
                        >
                          {item.has_variants
                            ? `Desde ${formatPrice(item.price)}`
                            : formatPrice(item.price)}
                        </p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeFavorite(item.id)}
                        title="Quitar de favoritos"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#d4d4d8",
                          flexShrink: 0,
                          transition: "color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(239,68,68,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "#d4d4d8";
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                        }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer CTA ── */}
            {favorites.length > 0 && (
              <div
                style={{
                  padding: "16px 20px 24px",
                  borderTop: "1px solid #f4f4f5",
                  flexShrink: 0,
                }}
              >
                <a
                  href={buildWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    width: "100%",
                    borderRadius: 9999,
                    padding: "14px 24px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#ffffff",
                    textDecoration: "none",
                    background: "rgba(255,107,26,0.82)",
                    backdropFilter: "blur(14px) saturate(200%)",
                    WebkitBackdropFilter: "blur(14px) saturate(200%)",
                    border: "1px solid rgba(255,150,70,0.65)",
                    boxShadow:
                      "0 4px 20px rgba(255,107,26,0.35), inset 0 1px 0 rgba(255,255,255,0.30)",
                    textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    transition: "opacity 0.15s",
                  }}
                >
                  <WhatsAppIcon />
                  Consultar {count} producto{count !== 1 ? "s" : ""} por WhatsApp
                </a>
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color: "#a1a1aa",
                    marginTop: 10,
                  }}
                >
                  Te enviaremos la lista completa al asesor
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
