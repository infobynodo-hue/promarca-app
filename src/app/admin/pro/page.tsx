"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Sparkles, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
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

const QUICK_ACTIONS = [
  { label: "📋 Brief completo de lanzamiento", prompt: "Genera el brief completo de lanzamiento para este producto: plantilla recomendada, plan de creativos, estructura del funnel y presupuesto sugerido en USD." },
  { label: "🎨 Plan de creativos", prompt: "Dame el plan detallado de creativos para testear este producto: cuántos, qué tipos, qué ángulos, en qué orden y con qué presupuesto en USD por creativo." },
  { label: "📊 Evaluar mi landing", prompt: "Evalúa la landing page de este producto contra el scorecard de 10 puntos y dime qué ajustar antes de publicar." },
  { label: "💰 Estrategia de precio", prompt: "¿Cómo debería presentar el precio de este producto para maximizar conversiones? Dame la estrategia de anclaje y las cuotas recomendadas." },
  { label: "🎯 Ángulos de copy", prompt: "Dame los 3 mejores ángulos de copy para este producto: cuál es el dolor, cuál es el gancho y cómo estructuro el mensaje para audiencia fría en Colombia." },
  { label: "📱 Qué creativo testear primero", prompt: "¿Cuál es el primer creativo que debería producir y lanzar para este producto? Sé muy específico: qué muestra, cómo está filmado/fotografiado, qué dice el texto." },
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Simple markdown-ish formatting
  const formatContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Bold
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Tables (simple detection)
      if (line.startsWith("|")) {
        return <div key={i} className="font-mono text-xs overflow-x-auto" dangerouslySetInnerHTML={{ __html: line }} />;
      }
      // Bullet
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />;
      }
      // Numbered
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, "") }} />;
      }
      // Heading
      if (line.startsWith("## ") || line.startsWith("### ")) {
        return <p key={i} className="font-bold text-zinc-200 mt-2" dangerouslySetInnerHTML={{ __html: line.replace(/^#+\s/, "") }} />;
      }
      if (line === "") return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
          P
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed space-y-1
        ${isUser
          ? "bg-orange-500 text-white rounded-tr-sm"
          : "bg-zinc-800 text-zinc-100 rounded-tl-sm"
        }`}
      >
        {formatContent(message.content)}
      </div>
    </div>
  );
}

export default function ProCoachPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, reference, price, description, category:categories(name), product_images(storage_path, is_primary, display_order)")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const mapped = (data ?? []).map((p: any) => {
          const imgs: any[] = p.product_images ?? [];
          const sorted = [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
          const primary = sorted.find((i) => i.is_primary) ?? sorted[0];
          const primaryImageUrl = primary?.storage_path
            ? supabase.storage.from("products").getPublicUrl(primary.storage_path).data.publicUrl
            : null;
          return {
            id: p.id,
            name: p.name,
            reference: p.reference,
            price: p.price,
            description: p.description ?? "",
            primaryImageUrl,
            category: Array.isArray(p.category) ? p.category[0]?.name : p.category?.name,
          };
        });
        setProducts(mapped);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/pro-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          productContext: selectedProduct ? {
            name: selectedProduct.name,
            reference: selectedProduct.reference,
            price: selectedProduct.price,
            description: selectedProduct.description,
            category: selectedProduct.category,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Error al conectar con Pro"); return; }
      setMessages([...newMessages, { role: "assistant", content: data.message }]);
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }, [messages, selectedProduct, loading]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowProductPicker(false);
    setMessages([]);
  };

  const handleReset = () => {
    setSelectedProduct(null);
    setMessages([]);
    setShowProductPicker(true);
    setProductSearch("");
  };

  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

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
          <p className="text-sm text-zinc-500 mt-0.5 ml-10">Estrategia de ventas basada en datos reales de mercado</p>
        </div>
        {selectedProduct && (
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Cambiar producto
          </Button>
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
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar por nombre o referencia..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-96 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="flex flex-col rounded-xl border-2 border-zinc-200 overflow-hidden text-left hover:border-violet-400 hover:shadow-md transition-all group"
                >
                  <div className="aspect-square w-full bg-zinc-100 overflow-hidden">
                    {p.primaryImageUrl ? (
                      <img src={p.primaryImageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-zinc-300 text-[10px]">Sin foto</div>
                    )}
                  </div>
                  <div className="px-1.5 py-1 bg-white">
                    <p className="font-mono text-[9px] text-violet-500 font-bold truncate">{p.reference}</p>
                    <p className="text-[10px] text-zinc-700 leading-tight line-clamp-2">{p.name}</p>
                  </div>
                </button>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <p className="text-center text-sm text-zinc-400 py-4">No se encontraron productos</p>
            )}
          </div>

          {/* Or ask without product */}
          <div className="text-center">
            <button
              onClick={() => { setShowProductPicker(false); setMessages([{ role: "assistant", content: "¡Hola! Soy Pro, tu Sales Coach. Puedo ayudarte con estrategia de ventas, creativos, estructura de funnels y optimización de landing pages.\n\nNo seleccionaste un producto específico, así que cuéntame: ¿qué producto quieres vender y cuál es tu presupuesto diario en USD?" }]); }}
              className="text-sm text-zinc-400 hover:text-violet-600 underline transition-colors"
            >
              O consulta sin seleccionar producto →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Selected product + quick actions */}
          <div className="flex-shrink-0 space-y-3 pb-3">
            {/* Product card */}
            <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              {selectedProduct.primaryImageUrl && (
                <img src={selectedProduct.primaryImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-800 truncate text-sm">{selectedProduct.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{selectedProduct.reference} · {fmtPrice(selectedProduct.price)}</p>
              </div>
              <button
                onClick={() => setShowProductPicker(!showProductPicker)}
                className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                {showProductPicker ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 flex-wrap">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={loading}
                  className="text-xs rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-50"
                >
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
                <div>
                  <p className="font-semibold text-zinc-700">Pro está listo</p>
                  <p className="text-sm text-zinc-400 mt-1">Usa una acción rápida o escríbeme directamente</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
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

          {/* Input */}
          <div className="flex-shrink-0 pt-3 pb-2">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2 items-end"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Pregúntale algo a Pro..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 max-h-32"
                style={{ fieldSizing: "content" } as any}
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-11 w-11 p-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 flex-shrink-0"
              >
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
