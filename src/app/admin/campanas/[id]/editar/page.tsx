import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CampaignForm } from "../../CampaignForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Editar campaña B2C — ProMarca Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarCampanaPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("b2c_campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const initialData = {
    id: campaign.id,
    product_id: campaign.product_id ?? null,
    slug: campaign.slug ?? "",
    brand_name: campaign.brand_name ?? "",
    brand_logo_url: campaign.brand_logo_url ?? "",
    headline: campaign.headline ?? "",
    subheadline: campaign.subheadline ?? "",
    compare_price: campaign.compare_price != null ? String(campaign.compare_price) : "",
    price_override: campaign.price_override != null ? String(campaign.price_override) : "",
    benefits: Array.isArray(campaign.benefits) ? campaign.benefits : [],
    fomo_text: campaign.fomo_text ?? "🔥 7 personas viendo este producto ahora",
    whatsapp_number: campaign.whatsapp_number ?? "",
    shopify_url: campaign.shopify_url ?? "",
    primary_color: campaign.primary_color ?? "#FF6B2C",
    status: (campaign.status ?? "draft") as "draft" | "published",
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/campanas"
          className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a campañas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Editar campaña: {campaign.brand_name ?? campaign.headline ?? "Sin título"}
        </h1>
        <p className="text-sm text-zinc-500">
          Slug: <span className="font-mono text-zinc-700">/tienda/{campaign.slug}</span>
        </p>
      </div>
      <CampaignForm initialData={initialData} />
    </>
  );
}
