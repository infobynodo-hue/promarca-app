import { PhotoGenerator } from "@/components/PhotoGenerator/PhotoGenerator";

export default function FotosPage() {
  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fotos con IA</h1>
            <p className="text-sm text-zinc-500">
              Convierte fotos del proveedor en fotografía profesional de catálogo
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          {[
            { n: "1", title: "Sube la foto del proveedor", desc: "Cualquier foto, aunque sea de baja calidad o con fondo feo" },
            { n: "2", title: "Elige el estilo y describe el producto", desc: "Estudio oscuro, fondo blanco o vista explosionada" },
            { n: "3", title: "IA genera la foto profesional", desc: "En 20-40 segundos tenés una foto lista para el catálogo" },
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
      </div>

      <PhotoGenerator />
    </>
  );
}
