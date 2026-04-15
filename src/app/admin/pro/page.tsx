"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Send, Loader2, RotateCcw, ChevronDown, ChevronUp,
  Images, ExternalLink, X, AlertCircle, RefreshCw, Zap,
  History, ArrowRight, Clock, Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  reference: string;
  price: number;
  description?: string;
  primaryImageUrl: string | null;
  category?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProSession {
  id: string;
  product_id: string | null;
  title: string;
  messages: Message[];
  extracted_copy: ExtractedCopy | null;
  created_at: string;
  updated_at: string;
}

interface ExtractedCopy {
  headline: string;
  subheadline: string;
  benefits: { emoji: string; text: string }[];
  fomo_text: string;
  compare_price_suggestion: number;
  template: "hero" | "problema-solucion" | "prueba-social" | "hispano";
  template_reason: string;
  campaign_angle: string;
  session_title: string;
}

const QUICK_ACTIONS = [
  { label: "📋 Brief completo de lanzamiento", prompt: "Genera el brief completo de lanzamiento para este producto: plantilla recomendada, plan de creativos, estructura del funnel y presupuesto sugerido en USD." },
  { label: "🎨 Plan de creativos", prompt: "Dame el plan detallado de creativos para testear este producto: cuántos, qué tipos, qué ángulos, en qué orden y con qué presupuesto en USD por creativo." },
  { label: "📊 Evaluar mi landing", prompt: "Evalúa la landing page de este producto contra el scorecard de 10 puntos y dime qué ajustar antes de publicar." },
  { label: "💰 Estrategia de precio", prompt: "¿Cómo debería presentar el precio de este producto para maximizar conversiones? Dame la estrategia de anclaje y las cuotas recomendadas." },
  { label: "🎯 Ángulos de copy", prompt: "Dame los 3 mejores ángulos de copy para este producto: cuál es el dolor, cuál es el gancho y cómo estructuro el mensaje para audiencia fría en Colombia." },
  { label: "📱 Qué creativo testear primero", prompt: "¿Cuál es el primer creativo que debería producir y lanzar para este producto? Sé muy específico: qué muestra, cómo está filmado/fotografiado, qué dice el texto." },
];

// ─── Creative type detection ──────────────────────────────────────────────────

const CREATIVE_KEYWORDS: Record<string, { label: string; emoji: string }> = {
  ugc: { label: "UGC / Contenido auténtico", emoji: "🤳" },
  lifestyle: { label: "Lifestyle / En contexto", emoji: "🌿" },
  product: { label: "Foto de producto", emoji: "📸" },
  carousel: { label: "Carrusel / Múltiples slides", emoji: "🖼️" },
  video: { label: "Video / Reels", emoji: "🎬" },
  static_ad: { label: "Imagen estática", emoji: "🎨" },
};

const CREATIVE_DETECT_KEYWORDS: Record<string, string[]> = {
  ugc: ["ugc", "user generated", "persona real", "creator", "depoimento", "testimonial video", "alguien que muestre", "video casero", "contenido orgánico"],
  lifestyle: ["lifestyle", "estilo de vida", "contexto real", "foto en uso", "en situación", "en ambiente", "persona usando"],
  product: ["foto de producto", "product shot", "fondo blanco", "fondo neutro", "foto limpia", "flat lay", "fotografía de producto"],
  carousel: ["carrusel", "carousel", "múltiples imágenes", "slides", "antes y después", "antes/después", "swipe"],
  video: ["video 15", "video 30", "video 60", "reels", "tiktok", "video corto", "video ad", "demo en video", "video unboxing"],
  static_ad: ["imagen estática", "static ad", "anuncio estático", "creativo estático", "imagen con texto", "banner"],
};

function detectCreativeTypes(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(CREATIVE_DETECT_KEYWORDS)
    .filter(([, kws]) => kws.some((kw) => lower.includes(kw)))
    .map(([type]) => type);
}

function buildAdQuery(creativeType: string, productName?: string, category?: string): string {
  const productTerms: Record<string, string> = {
    "Bolígrafos": "bolígrafos personalizados empresa", "Gorras": "gorras personalizadas bordado logo",
    "Termos": "termos personalizados regalo empresarial", "USB": "USB personalizado corporativo",
    "Maletines": "maletines ejecutivos personalizados", "Textiles": "camisetas personalizadas empresas",
    "Paraguas": "paraguas personalizados corporativo", "Mugs": "mugs tazas personalizados logo empresa",
    "Cuadernos": "cuadernos libretas personalizados",
  };
  const categoryQuery = category ? (productTerms[category] ?? `${category} personalizado`) : null;
  const productQuery = productName ? productName.split(" ").slice(0, 3).join(" ") : null;
  return productQuery ?? categoryQuery ?? "producto promocional personalizado empresa";
}

interface AdResult {
  id: string; page_name: string; body?: string; title?: string;
  snapshot_url: string; start_date?: string;
  impressions?: { lower_bound: string; upper_bound: string }; platforms?: string[];
}
interface AdSearchState {
  status: "idle" | "loading" | "success" | "not_configured" | "token_expired" | "error";
  ads: AdResult[]; query: string; countries: string[]; error?: string;
}

// ─── Ad Library Panel ─────────────────────────────────────────────────────────

function AdLibraryPanel({ creativeTypes, productName, category }: { creativeTypes: string[]; productName?: string; category?: string }) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(creativeTypes[0] ?? "");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["CO"]);
  const [adState, setAdState] = useState<AdSearchState>({ status: "idle", ads: [], query: "", countries: ["CO"] });
  const [lightboxAd, setLightboxAd] = useState<AdResult | null>(null);

  const countries = [
    { code: "CO", flag: "🇨🇴", label: "Colombia" }, { code: "MX", flag: "🇲🇽", label: "México" },
    { code: "BR", flag: "🇧🇷", label: "Brasil" }, { code: "US", flag: "🇺🇸", label: "US" },
  ];

  const fetchAds = useCallback(async (type: string, countryCodes: string[]) => {
    const query = buildAdQuery(type, productName, category);
    setAdState({ status: "loading", ads: [], query, countries: countryCodes });
    try {
      const res = await fetch("/api/ad-library/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, countries: countryCodes, limit: 6 }),
      });
      const data = await res.json();
      if (!data.configured) { setAdState({ status: "not_configured", ads: [], query, countries: countryCodes }); return; }
      if (data.token_expired) { setAdState({ status: "token_expired", ads: [], query, countries: countryCodes }); return; }
      if (!res.ok || data.error) { setAdState({ status: "error", ads: [], query, countries: countryCodes, error: data.error }); return; }
      setAdState({ status: "success", ads: data.ads ?? [], query, countries: countryCodes });
    } catch (err) {
      setAdState({ status: "error", ads: [], query, countries: countryCodes, error: err instanceof Error ? err.message : "Error de red" });
    }
  }, [productName, category]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && adState.status === "idle") fetchAds(selectedType, selectedCountries);
  };

  if (creativeTypes.length === 0) return null;

  const metaLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${selectedCountries[0] ?? "CO"}&q=${encodeURIComponent(buildAdQuery(selectedType, productName, category))}&search_type=keyword_unordered`;

  return (
    <div className="mt-2 max-w-[85%] ml-11">
      <button onClick={handleOpen} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
        <Images className="h-3.5 w-3.5" />
        {open ? "Ocultar anuncios reales" : "Ver anuncios reales (Meta Ad Library)"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-normal">LIVE</span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {creativeTypes.map((type) => {
              const info = CREATIVE_KEYWORDS[type];
              if (!info) return null;
              return (
                <button key={type} onClick={() => { setSelectedType(type); fetchAds(type, selectedCountries); }}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${selectedType === type ? "bg-violet-600 text-white border-violet-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-violet-300"}`}>
                  <span>{info.emoji}</span><span>{info.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-medium">Mercado:</span>
            {countries.map((c) => (
              <button key={c.code} onClick={() => { const next = selectedCountries.includes(c.code) ? selectedCountries.filter((x) => x !== c.code) : [...selectedCountries, c.code]; if (next.length === 0) return; setSelectedCountries(next); fetchAds(selectedType, next); }}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${selectedCountries.includes(c.code) ? "bg-zinc-800 text-white border-zinc-800" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"}`}>
                {c.flag} {c.label}
              </button>
            ))}
          </div>
          {adState.status === "loading" && <div className="flex items-center gap-2 py-4 justify-center"><Loader2 className="h-4 w-4 animate-spin text-violet-500" /><span className="text-sm text-zinc-500">Buscando en Meta Ad Library...</span></div>}
          {adState.status === "not_configured" && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div><p className="text-sm font-semibold text-orange-800">Conecta Meta Ad Library</p><p className="text-xs text-orange-700 mt-0.5">Agrega <code className="bg-orange-100 px-1 rounded">META_AD_LIBRARY_TOKEN</code> en tu <code className="bg-orange-100 px-1 rounded">.env.local</code></p></div>
              </div>
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors"><ExternalLink className="h-3 w-3" />Graph API Explorer →</a>
            </div>
          )}
          {adState.status === "token_expired" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /><p className="text-xs text-red-700 flex-1">Token expirado. Renueva en Graph API Explorer.</p>
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 underline">Renovar →</a>
            </div>
          )}
          {adState.status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" /><p className="text-xs text-red-700 flex-1">{adState.error}</p>
              <button onClick={() => fetchAds(selectedType, selectedCountries)} className="text-xs text-red-600 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Reintentar</button>
            </div>
          )}
          {adState.status === "success" && (
            <>
              {adState.ads.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No se encontraron anuncios. Prueba otro mercado.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {adState.ads.map((ad) => (
                    <button key={ad.id} onClick={() => setLightboxAd(ad)} className="group relative rounded-xl border border-zinc-200 bg-white overflow-hidden text-left hover:border-violet-400 hover:shadow-md transition-all">
                      <div className="relative w-full bg-zinc-100" style={{ paddingBottom: "125%" }}>
                        <iframe src={ad.snapshot_url} className="absolute inset-0 w-full h-full border-0 pointer-events-none scale-[0.6] origin-top-left" style={{ width: "167%", height: "167%" }} loading="lazy" sandbox="allow-same-origin allow-scripts" title={`Ad by ${ad.page_name}`} />
                        <div className="absolute inset-0 bg-transparent group-hover:bg-violet-500/5 transition-colors" />
                        <span className="absolute top-1.5 left-1.5 text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">LIVE</span>
                      </div>
                      <div className="p-2 space-y-0.5">
                        <p className="text-[10px] font-semibold text-zinc-700 truncate">{ad.page_name}</p>
                        {ad.body && <p className="text-[10px] text-zinc-500 line-clamp-2 leading-snug">{ad.body}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-zinc-400">{adState.ads.length} anuncio{adState.ads.length !== 1 ? "s" : ""}</p>
                <a href={metaLibraryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium"><ExternalLink className="h-3 w-3" />Ver más en Meta Ad Library</a>
              </div>
            </>
          )}
        </div>
      )}
      {lightboxAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setLightboxAd(null)}>
          <div className="relative bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightboxAd(null)} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60"><X className="h-4 w-4" /></button>
            <div className="w-full bg-zinc-100" style={{ height: 420 }}>
              <iframe src={lightboxAd.snapshot_url} className="w-full h-full border-0" sandbox="allow-same-origin allow-scripts" title={`Ad — ${lightboxAd.page_name}`} />
            </div>
            <div className="p-4 space-y-2">
              <p className="font-semibold text-zinc-800 text-sm">{lightboxAd.page_name}</p>
              {lightboxAd.body && <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{lightboxAd.body}</p>}
              <a href={lightboxAd.snapshot_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium w-fit"><ExternalLink className="h-3 w-3" />Ver en Facebook</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

// Parse a block of markdown table lines into header + rows
function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string) =>
    line.split("|").slice(1, -1).map((c) => c.trim());

  const isSeparator = (line: string) => /^[\|\s\-:]+$/.test(line);
  const boldify = (s: string) =>
    s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  const nonSep = lines.filter((l) => !isSeparator(l));
  if (nonSep.length === 0) return null;

  const [headerLine, ...bodyLines] = nonSep;
  const headers = parseRow(headerLine);
  const rows = bodyLines.map(parseRow);

  return (
    <div className="overflow-x-auto rounded-lg my-2 -mx-1">
      <table className="w-full text-xs border-collapse min-w-full">
        <thead>
          <tr className="border-b border-zinc-600">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left py-2 px-3 text-violet-300 font-semibold whitespace-nowrap bg-zinc-900/50"
                dangerouslySetInnerHTML={{ __html: boldify(h) }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-b border-zinc-700/40 ${ri % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="py-2 px-3 text-zinc-200 align-top leading-snug"
                  dangerouslySetInnerHTML={{ __html: boldify(cell) }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  const boldify = (s: string) => s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Build node list, grouping consecutive | lines into tables
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Collect table block
      if (line.trim().startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        nodes.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
        continue;
      }

      // Heading
      if (line.startsWith("## ") || line.startsWith("### ")) {
        nodes.push(
          <p key={i} className="font-bold text-zinc-200 mt-3 mb-1"
            dangerouslySetInnerHTML={{ __html: boldify(line.replace(/^#+\s/, "")) }} />
        );
      }
      // Bullet
      else if (line.startsWith("- ") || line.startsWith("• ")) {
        nodes.push(
          <li key={i} className="ml-4 list-disc"
            dangerouslySetInnerHTML={{ __html: boldify(line.slice(2)) }} />
        );
      }
      // Numbered list
      else if (/^\d+\.\s/.test(line)) {
        nodes.push(
          <li key={i} className="ml-4 list-decimal"
            dangerouslySetInnerHTML={{ __html: boldify(line.replace(/^\d+\.\s/, "")) }} />
        );
      }
      // Empty line
      else if (line.trim() === "") {
        nodes.push(<div key={i} className="h-1" />);
      }
      // Normal paragraph
      else {
        nodes.push(
          <p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />
        );
      }

      i++;
    }
    return nodes;
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">P</div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed space-y-0.5 ${isUser ? "bg-orange-500 text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-100 rounded-tl-sm"}`}>
        {renderContent(message.content)}
      </div>
    </div>
  );
}

// ─── Session History Panel ────────────────────────────────────────────────────

function SessionHistoryPanel({
  sessions, currentSessionId, onLoad, onDelete,
}: {
  sessions: ProSession[];
  currentSessionId: string | null;
  onLoad: (s: ProSession) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) return null;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-1">
      {sessions.map((s) => (
        <div key={s.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 group transition-colors ${s.id === currentSessionId ? "bg-violet-100 border border-violet-200" : "bg-zinc-50 border border-zinc-100 hover:border-violet-200 hover:bg-violet-50"}`}>
          <button className="flex-1 text-left min-w-0" onClick={() => onLoad(s)}>
            <p className="text-xs font-medium text-zinc-800 truncate">{s.title}</p>
            <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />{fmt(s.updated_at)}
              {s.messages.length > 0 && <span>· {s.messages.length} mensajes</span>}
            </p>
          </button>
          {s.extracted_copy && (
            <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">copy ✓</span>
          )}
          <button onClick={() => onDelete(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50">
            <Trash2 className="h-3 w-3 text-red-400" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProCoachPage() {
  const router = useRouter();
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ProSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load products
  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, reference, price, description, category:categories(name), product_images(storage_path, is_primary, display_order)")
      .eq("is_active", true).order("name")
      .then(({ data }) => {
        const mapped = (data ?? []).map((p: any) => {
          const imgs: any[] = p.product_images ?? [];
          const sorted = [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
          const primary = sorted.find((i) => i.is_primary) ?? sorted[0];
          const primaryImageUrl = primary?.storage_path
            ? supabase.storage.from("products").getPublicUrl(primary.storage_path).data.publicUrl : null;
          return { id: p.id, name: p.name, reference: p.reference, price: p.price, description: p.description ?? "", primaryImageUrl, category: Array.isArray(p.category) ? p.category[0]?.name : p.category?.name };
        });
        setProducts(mapped);
      });
  }, []);

  // Load sessions for selected product
  useEffect(() => {
    if (!selectedProduct) { setSessions([]); return; }
    supabase.from("pro_sessions").select("*").eq("product_id", selectedProduct.id).order("updated_at", { ascending: false }).limit(10)
      .then(({ data }) => setSessions((data ?? []) as ProSession[]));
  }, [selectedProduct]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-save session after each exchange
  const saveSession = useCallback(async (msgs: Message[], sessionId: string | null, product: Product | null, title?: string) => {
    if (msgs.length === 0 || !product) return;
    const sessionTitle = title ?? (msgs[1]?.content?.slice(0, 50) ?? "Sesión sin título");
    if (sessionId) {
      await supabase.from("pro_sessions").update({ messages: msgs, title: sessionTitle, updated_at: new Date().toISOString() }).eq("id", sessionId);
    } else {
      const { data } = await supabase.from("pro_sessions").insert({ product_id: product.id, title: sessionTitle, messages: msgs }).select("id").single();
      if (data) setCurrentSessionId(data.id);
      return data?.id;
    }
  }, [supabase]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/pro-coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          productContext: selectedProduct ? { name: selectedProduct.name, reference: selectedProduct.reference, price: selectedProduct.price, description: selectedProduct.description, category: selectedProduct.category } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Error al conectar con Pro"); return; }
      const finalMessages: Message[] = [...newMessages, { role: "assistant", content: data.message }];
      setMessages(finalMessages);
      // Debounced save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        const newId = await saveSession(finalMessages, currentSessionId, selectedProduct);
        if (newId) {
          // Refresh session list
          supabase.from("pro_sessions").select("*").eq("product_id", selectedProduct!.id).order("updated_at", { ascending: false }).limit(10)
            .then(({ data: s }) => setSessions((s ?? []) as ProSession[]));
        }
      }, 1500);
    } catch { toast.error("Error de red"); }
    finally { setLoading(false); }
  }, [messages, selectedProduct, loading, currentSessionId, saveSession, supabase]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleReset = () => {
    setSelectedProduct(null);
    setMessages([]);
    setCurrentSessionId(null);
    setSessions([]);
    setProductSearch("");
    setShowHistory(false);
  };

  const handleLoadSession = (s: ProSession) => {
    setMessages(s.messages);
    setCurrentSessionId(s.id);
    setShowHistory(false);
  };

  const handleDeleteSession = async (id: string) => {
    await supabase.from("pro_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) { setMessages([]); setCurrentSessionId(null); }
  };

  const handleNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
  };

  // Extract structured copy and send to Ventas B2C
  const handleCreateCampaign = async () => {
    if (!selectedProduct || messages.length === 0) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/ai/extract-copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          productContext: { name: selectedProduct.name, reference: selectedProduct.reference, price: selectedProduct.price, description: selectedProduct.description, category: selectedProduct.category },
        }),
      });
      if (!res.ok) { toast.error("Error al extraer copy"); return; }
      const extracted: ExtractedCopy = await res.json();

      // Save extracted copy to session
      if (currentSessionId) {
        await supabase.from("pro_sessions").update({ extracted_copy: extracted, title: extracted.session_title }).eq("id", currentSessionId);
        setCurrentSessionId(currentSessionId);
        setSessions((prev) => prev.map((s) => s.id === currentSessionId ? { ...s, extracted_copy: extracted, title: extracted.session_title } : s));
      }

      // Store in localStorage for campaign form to pick up
      const prefill = {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        pro_session_id: currentSessionId,
        ...extracted,
        timestamp: Date.now(),
      };
      localStorage.setItem("pro_prefill", JSON.stringify(prefill));

      toast.success("✅ Copy extraído — abriendo Ventas B2C");
      router.push(`/admin/campanas/nueva?product_id=${selectedProduct.id}&from_pro=1`);
    } catch { toast.error("Error de red al extraer copy"); }
    finally { setExtracting(false); }
  };

  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  const fmtPrice = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-4 px-1 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">P</div>
            <h1 className="text-xl font-bold tracking-tight">Pro</h1>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Sales Coach</span>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5 ml-10">Estrategia de ventas · El historial se guarda automáticamente</p>
        </div>
        {selectedProduct && (
          <div className="flex items-center gap-2">
            {hasMessages && (
              <Button size="sm" variant="outline" onClick={() => setShowHistory(!showHistory)} className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historial
                {sessions.length > 0 && <span className="text-[10px] bg-violet-100 text-violet-700 px-1 rounded-full">{sessions.length}</span>}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" /> Cambiar producto
            </Button>
          </div>
        )}
      </div>

      {/* Product picker */}
      {!selectedProduct ? (
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 space-y-4">
            <div>
              <p className="font-semibold text-zinc-800">¿Para qué producto necesitas estrategia?</p>
              <p className="text-sm text-zinc-500 mt-0.5">Selecciona un producto del catálogo para que Pro genere recomendaciones específicas.</p>
            </div>
            <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar por nombre o referencia..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200" />
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-96 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => handleSelectProduct(p)} className="flex flex-col rounded-xl border-2 border-zinc-200 overflow-hidden text-left hover:border-violet-400 hover:shadow-md transition-all group">
                  <div className="aspect-square w-full bg-zinc-100 overflow-hidden">
                    {p.primaryImageUrl ? <img src={p.primaryImageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" /> : <div className="h-full w-full flex items-center justify-center text-zinc-300 text-[10px]">Sin foto</div>}
                  </div>
                  <div className="px-1.5 py-1 bg-white">
                    <p className="font-mono text-[9px] text-violet-500 font-bold truncate">{p.reference}</p>
                    <p className="text-[10px] text-zinc-700 leading-tight line-clamp-2">{p.name}</p>
                  </div>
                </button>
              ))}
            </div>
            {filteredProducts.length === 0 && <p className="text-center text-sm text-zinc-400 py-4">No se encontraron productos</p>}
          </div>
          <div className="text-center">
            <button onClick={() => { setSelectedProduct({ id: "", name: "", reference: "", price: 0, primaryImageUrl: null }); setMessages([{ role: "assistant", content: "¡Hola! Soy Pro, tu Sales Coach. ¿En qué te puedo ayudar hoy?" }]); }} className="text-sm text-zinc-400 hover:text-violet-600 underline transition-colors">
              O consulta sin seleccionar producto →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* History panel */}
          {showHistory && (
            <div className="flex-shrink-0 rounded-xl border border-violet-200 bg-white p-4 space-y-3 mb-2 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5"><History className="h-4 w-4 text-violet-500" />Historial de sesiones</p>
                <button onClick={handleNewSession} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1">+ Nueva sesión</button>
              </div>
              <SessionHistoryPanel sessions={sessions} currentSessionId={currentSessionId} onLoad={handleLoadSession} onDelete={handleDeleteSession} />
            </div>
          )}

          {/* Selected product bar */}
          <div className="flex-shrink-0 space-y-3 pb-3">
            <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              {selectedProduct.primaryImageUrl && <img src={selectedProduct.primaryImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-800 truncate text-sm">{selectedProduct.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{selectedProduct.reference}{selectedProduct.price > 0 ? ` · ${fmtPrice(selectedProduct.price)}` : ""}</p>
              </div>
              {currentSessionId && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Guardado ✓</span>}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 flex-wrap">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} onClick={() => sendMessage(action.prompt)} disabled={loading}
                  className="text-xs rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-50">
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">P</div>
                <div><p className="font-semibold text-zinc-700">Pro está listo</p><p className="text-sm text-zinc-400 mt-1">Usa una acción rápida o escríbeme directamente</p></div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-full">
                  <Zap className="h-3 w-3 text-violet-400" />Cada sesión se guarda automáticamente
                </div>
              </div>
            )}
            {messages.map((msg, i) => {
              const creativeTypes = msg.role === "assistant" ? detectCreativeTypes(msg.content) : [];
              return (
                <div key={i} className="space-y-1">
                  <MessageBubble message={msg} />
                  {msg.role === "assistant" && creativeTypes.length > 0 && (
                    <AdLibraryPanel creativeTypes={creativeTypes} productName={selectedProduct?.name} category={selectedProduct?.category} />
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">P</div>
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  <span className="text-sm text-zinc-400">Analizando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── "Crear campaña" CTA — aparece cuando hay mensajes ── */}
          {hasMessages && (
            <div className="flex-shrink-0 py-2 border-t border-zinc-100">
              <button
                onClick={handleCreateCampaign}
                disabled={extracting || loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm py-3 transition-all disabled:opacity-60 shadow-sm"
              >
                {extracting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Extrayendo copy con IA...</>
                ) : (
                  <><ArrowRight className="h-4 w-4" /> Crear campaña con esta estrategia → Ventas B2C</>
                )}
              </button>
              <p className="text-[10px] text-zinc-400 text-center mt-1.5">Pro extraerá el copy, el template y los beneficios y los pre-llenará en el formulario</p>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 pt-2 pb-2">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2 items-end">
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Pregúntale algo a Pro..." rows={1}
                className="flex-1 resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 max-h-32"
                style={{ fieldSizing: "content" } as any}
              />
              <Button type="submit" disabled={loading || !input.trim()} className="h-11 w-11 p-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 flex-shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="text-[10px] text-zinc-400 text-center mt-1.5">Pro usa IA — verifica las recomendaciones con tus propios datos</p>
          </div>
        </>
      )}
    </div>
  );
}
