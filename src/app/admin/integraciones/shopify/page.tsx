"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plug, ShoppingBag, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export default function ShopifySettingsPage() {
  const supabase = createClient();

  const [storeDomain, setStoreDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["shopify_store_domain", "shopify_access_token"]);

      if (data && data.length > 0) {
        const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
        setStoreDomain(map["shopify_store_domain"] ?? "");
        setAccessToken(map["shopify_access_token"] ?? "");
        setIsConfigured(!!(map["shopify_store_domain"] && map["shopify_access_token"]));
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!storeDomain.trim() || !accessToken.trim()) {
      toast.error("Completa ambos campos para guardar");
      return;
    }

    setSaving(true);
    try {
      const upserts = [
        { key: "shopify_store_domain", value: storeDomain.trim() },
        { key: "shopify_access_token", value: accessToken.trim() },
      ];

      const { error } = await supabase
        .from("app_settings")
        .upsert(upserts, { onConflict: "key" });

      if (error) {
        toast.error("Error al guardar: " + error.message);
        return;
      }

      setIsConfigured(true);
      toast.success("Configuración de Shopify guardada");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    const toastId = toast.loading("Sincronizando productos con Shopify...");
    try {
      const res = await fetch("/api/shopify/sync-all", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Error al sincronizar", { id: toastId });
        return;
      }

      toast.success(
        `Sincronización completada: ${data.synced} exitosos, ${data.errors} errores`,
        { id: toastId }
      );
    } catch {
      toast.error("Error de red al sincronizar", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/10">
          <Plug className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integración con Shopify</h1>
          <p className="text-sm text-zinc-500">Sincroniza tu catálogo ProMarca con tu tienda Shopify</p>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-600">Estado de conexión:</span>
        {isConfigured ? (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Conectado</Badge>
        ) : (
          <Badge variant="secondary" className="text-zinc-500">Sin configurar</Badge>
        )}
      </div>

      {/* Settings form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciales de la API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              Dominio de tu tienda
            </label>
            <Input
              value={storeDomain}
              onChange={(e) => setStoreDomain(e.target.value)}
              placeholder="mi-tienda.myshopify.com"
              autoComplete="off"
            />
            <p className="text-xs text-zinc-400">Sin https:// ni barra al final</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              Access Token
            </label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="shpat_xxxx"
              autoComplete="off"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar configuración
          </Button>
        </CardContent>
      </Card>

      {/* Instructions accordion */}
      <Card>
        <button
          onClick={() => setShowInstructions((v) => !v)}
          className="flex w-full items-center justify-between p-6 text-left"
        >
          <span className="font-medium text-zinc-700">Cómo obtener el Access Token</span>
          {showInstructions ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </button>
        {showInstructions && (
          <CardContent className="pt-0">
            <ol className="space-y-2 text-sm text-zinc-600 list-decimal list-inside">
              <li>En tu panel de Shopify → <strong>Configuración</strong> → <strong>Apps y canales de ventas</strong></li>
              <li>Haz clic en <strong>Desarrollar apps</strong> → <strong>Crear app</strong></li>
              <li>
                Configura los permisos de la API Admin:{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs font-mono">write_products</code>,{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs font-mono">read_products</code>
              </li>
              <li>Haz clic en <strong>Instalar app</strong> → Copia el token de acceso</li>
            </ol>
          </CardContent>
        )}
      </Card>

      {/* Sync all button */}
      {isConfigured && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-800">Sincronizar catálogo completo</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Publica o actualiza todos los productos activos en Shopify
                </p>
              </div>
              <Button onClick={handleSyncAll} disabled={syncing} variant="outline">
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBag className="mr-2 h-4 w-4" />
                )}
                Sincronizar todos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
