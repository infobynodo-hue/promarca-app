import { CanvasGenerator } from "@/components/PhotoGenerator/CanvasGenerator";

export default function FotosPage() {
  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fotos de catálogo</h1>
            <p className="text-sm text-zinc-500">
              Convierte fotos del proveedor en 3 fotos profesionales · 100% en el navegador · sin costos
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          {[
            { n: "1", title: "Subí la foto del proveedor", desc: "Cualquier foto, aunque sea con fondo feo o de baja calidad" },
            { n: "2", title: "El navegador la procesa", desc: "Elimina el fondo con IA local y genera 3 composiciones sobre fondo gris" },
            { n: "3", title: "Asignala al producto", desc: "Las 3 fotos se guardan directamente en el catálogo y aparecen para el cliente" },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-bold">
                {step.n}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">{step.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Output format info */}
        <div className="mt-3 flex items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-500">
          <span>📐 <strong>1200 × 1200 px</strong> cuadrado</span>
          <span>·</span>
          <span>🎨 Fondo degradado gris (igual a tus referencias)</span>
          <span>·</span>
          <span>📁 JPG 93% calidad</span>
          <span>·</span>
          <span>🆓 Sin costo por generación</span>
        </div>
      </div>

      <CanvasGenerator />
    </>
  );
}
