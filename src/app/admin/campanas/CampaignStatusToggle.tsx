"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  currentStatus: string;
}

export function CampaignStatusToggle({ id, currentStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    setLoading(true);
    const supabase = createClient();
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("b2c_campaigns")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      toast.error("Error al cambiar estado");
    } else {
      toast.success(newStatus === "published" ? "Campaña publicada" : "Campaña pausada");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={currentStatus === "published" ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
    >
      {currentStatus === "published" ? "Pausar" : "Publicar"}
    </Button>
  );
}
