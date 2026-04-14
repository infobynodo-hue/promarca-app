import { CampaignForm } from "../CampaignForm";

export const metadata = { title: "Nueva campaña B2C — ProMarca Admin" };

export default function NuevaCampanaPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Nueva campaña B2C</h1>
        <p className="text-sm text-zinc-500">
          Crea una landing page de venta directa al consumidor
        </p>
      </div>
      <CampaignForm />
    </>
  );
}
