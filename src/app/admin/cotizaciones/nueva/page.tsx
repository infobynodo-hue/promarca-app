"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Client, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Search,
  UserPlus,
  LayoutTemplate,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";

interface LineItem {
  product_id: string | null;
  product_name: string;
  product_reference: string;
  quantity: number;
  unit_price: number;
  marking_type: string;
  marking_price: number;
  notes: string;
}

const MARKING_TYPES = [
  "Sin marcado",
  "1 tinta",
  "2 tintas",
  "3 tintas",
  "Full color",
  "Sublimación",
  "Bordado",
  "Láser",
  "Transfer",
];

export default function NuevaCotizacionPage() {
  const supabase = createClient();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  // Quote state
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [ivaPercent] = useState(19);
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState(15);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [inlineSearch, setInlineSearch] = useState("");
  const [showInlineDropdown, setShowInlineDropdown] = useState(false);

  // New client dialog
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    nit: "",
  });

  useEffect(() => {
    const load = async () => {
      const [c, p] = await Promise.all([
        supabase.from("clients").select("*").order("company"),
        supabase.from("products").select("*").order("name"),
      ]);
      setClients(c.data ?? []);
      setProducts(p.data ?? []);
    };
    load();
  }, []);

  // Calculations
  const subtotal = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price + item.quantity * item.marking_price,
    0
  );
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const baseAfterDiscount = subtotal - discountAmount;
  const ivaAmount = Math.round(baseAfterDiscount * (ivaPercent / 100));
  const total = baseAfterDiscount + ivaAmount;

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(n);

  // Add product to quote
  const addProduct = (product: Product) => {
    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        product_reference: product.reference,
        quantity: 100,
        unit_price: product.price,
        marking_type: "Sin marcado",
        marking_price: 0,
        notes: "",
      },
    ]);
    setShowProductDialog(false);
    setProductSearch("");
  };

  const addManualItem = () => {
    setItems([
      ...items,
      {
        product_id: null,
        product_name: "",
        product_reference: "",
        quantity: 1,
        unit_price: 0,
        marking_type: "Sin marcado",
        marking_price: 0,
        notes: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Create new client
  const handleCreateClient = async () => {
    if (!newClient.name) {
      toast.error("El nombre es requerido");
      return;
    }
    const { data, error } = await supabase
      .from("clients")
      .insert(newClient)
      .select("id")
      .single();
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    setClientId(data.id);
    setClients([...clients, { ...newClient, id: data.id } as Client]);
    setShowClientDialog(false);
    setNewClient({ name: "", company: "", email: "", phone: "", nit: "" });
    toast.success("Cliente creado");
  };

  // Save quote
  const handleSave = async () => {
    if (!clientId) {
      toast.error("Selecciona un cliente antes de continuar");
      return;
    }
    if (items.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }
    const emptyName = items.find((item) => !item.product_name.trim());
    if (emptyName) {
      toast.error("Todos los productos deben tener un nombre");
      return;
    }

    setSaving(true);

    const num = String(Date.now()).slice(-4);
    const quoteNumber = `COT-${new Date().getFullYear()}-${num}`;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const { data: quote, error } = await supabase
      .from("quotes")
      .insert({
        quote_number: quoteNumber,
        client_id: clientId || null,
        status: "draft",
        subtotal,
        discount_percent: discountPercent,
        iva_percent: ivaPercent,
        total,
        notes: notes || null,
        valid_until: validUntil.toISOString().split("T")[0],
      })
      .select("id")
      .single();

    if (error || !quote) {
      toast.error("Error al crear: " + (error?.message ?? ""));
      setSaving(false);
      return;
    }

    // Insert line items
    await supabase.from("quote_items").insert(
      items.map((item, i) => ({
        quote_id: quote.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_reference: item.product_reference,
        quantity: item.quantity,
        unit_price: item.unit_price,
        marking_type: item.marking_type,
        marking_price: item.marking_price,
        line_total:
          item.quantity * item.unit_price + item.quantity * item.marking_price,
        notes: item.notes || null,
        display_order: i,
      }))
    );

    toast.success(`Cotización ${quoteNumber} creada`);
    setSaving(false);
    router.push("/admin/cotizaciones");
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.reference.toLowerCase().includes(productSearch.toLowerCase())
  );

  const inlineFiltered = inlineSearch.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(inlineSearch.toLowerCase()) ||
          p.reference.toLowerCase().includes(inlineSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/cotizaciones">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nueva cotización</h1>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-3">
                <CardTitle>Productos</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProductDialog(true)}
                  >
                    <Search className="mr-1 h-3 w-3" /> Del catálogo
                  </Button>
                  <Button variant="outline" size="sm" onClick={addManualItem}>
                    <Plus className="mr-1 h-3 w-3" /> Manual
                  </Button>
                </div>
              </div>
              {/* Inline product search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <Input
                  value={inlineSearch}
                  onChange={(e) => {
                    setInlineSearch(e.target.value);
                    setShowInlineDropdown(true);
                  }}
                  onFocus={() => setShowInlineDropdown(true)}
                  onBlur={() => setTimeout(() => setShowInlineDropdown(false), 150)}
                  placeholder="Buscar por nombre o referencia y agregar…"
                  className="pl-9"
                />
                {showInlineDropdown && inlineFiltered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
                    {inlineFiltered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          addProduct(p);
                          setInlineSearch("");
                          setShowInlineDropdown(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                      >
                        <div>
                          <span className="font-mono text-[10px] font-bold text-zinc-400 mr-2 uppercase">{p.reference}</span>
                          <span className="font-medium text-zinc-800">{p.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-zinc-500 shrink-0 ml-3">
                          {formatPrice(p.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showInlineDropdown && inlineSearch.trim() && inlineFiltered.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg px-3 py-3 text-sm text-zinc-400">
                    Sin resultados · <button type="button" className="text-orange-500 hover:underline" onMouseDown={addManualItem}>agregar manualmente</button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 && (
                <p className="py-8 text-center text-zinc-400">
                  Busca un producto arriba o agrégalo manualmente
                </p>
              )}

              <div className="space-y-4">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Producto</Label>
                          <Input
                            value={item.product_name}
                            onChange={(e) =>
                              updateItem(i, "product_name", e.target.value)
                            }
                            placeholder="Nombre del producto"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Referencia</Label>
                          <Input
                            value={item.product_reference}
                            onChange={(e) =>
                              updateItem(i, "product_reference", e.target.value)
                            }
                            placeholder="MU-321"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <Label className="text-xs">Cantidad</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(i, "quantity", parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Precio unit.</Label>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(
                              i,
                              "unit_price",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo marcado</Label>
                        <Select
                          value={item.marking_type}
                          onValueChange={(v) => updateItem(i, "marking_type", v ?? "")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MARKING_TYPES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Costo marcado</Label>
                        <Input
                          type="number"
                          value={item.marking_price}
                          onChange={(e) =>
                            updateItem(
                              i,
                              "marking_price",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="text-right text-sm font-medium text-zinc-600">
                      Subtotal:{" "}
                      {formatPrice(
                        item.quantity * item.unit_price +
                          item.quantity * item.marking_price
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales, condiciones de pago, tiempos de entrega..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cliente</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClientDialog(true)}
              >
                <UserPlus className="mr-1 h-3 w-3" /> Nuevo
              </Button>
            </CardHeader>
            <CardContent>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company ?? c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Descuento</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={discountPercent}
                    onChange={(e) =>
                      setDiscountPercent(parseFloat(e.target.value) || 0)
                    }
                    className="w-16 text-right text-xs"
                  />
                  <span className="text-xs">%</span>
                  <span className="text-red-500">
                    -{formatPrice(discountAmount)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">IVA ({ivaPercent}%)</span>
                <span>{formatPrice(ivaAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              <div className="pt-2">
                <Label className="text-xs">Vigencia (días)</Label>
                <Input
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(parseInt(e.target.value) || 15)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Validation hints */}
          {!clientId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Selecciona un cliente para poder guardar
            </p>
          )}
          {items.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Agrega al menos un producto
            </p>
          )}

          <Button onClick={handleSave} className="w-full" disabled={saving || !clientId || items.length === 0}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Crear cotización"}
          </Button>

          <Link href="/admin/cotizaciones/plantilla" target="_blank">
            <Button variant="ghost" className="w-full text-zinc-500" size="sm">
              <LayoutTemplate className="mr-2 h-4 w-4" />
              Ver plantilla actual
            </Button>
          </Link>
        </div>
      </div>

      {/* Product search dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar producto del catálogo</DialogTitle>
          </DialogHeader>
          <Input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Buscar por nombre o referencia..."
            autoFocus
          />
          <div className="mt-2 max-h-[50vh] overflow-y-auto space-y-1">
            {filteredProducts.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-zinc-50"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-zinc-500">
                    {p.reference}
                  </span>
                  <p className="text-sm font-medium">{p.name}</p>
                </div>
                <span className="text-sm font-medium text-zinc-600">
                  {formatPrice(p.price)}
                </span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="py-4 text-center text-zinc-400">
                No se encontraron productos
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New client dialog */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input
                value={newClient.company}
                onChange={(e) =>
                  setNewClient({ ...newClient, company: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  value={newClient.email}
                  onChange={(e) =>
                    setNewClient({ ...newClient, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={newClient.phone}
                  onChange={(e) =>
                    setNewClient({ ...newClient, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>NIT</Label>
              <Input
                value={newClient.nit}
                onChange={(e) =>
                  setNewClient({ ...newClient, nit: e.target.value })
                }
              />
            </div>
            <Button onClick={handleCreateClient} className="w-full">
              Crear cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
