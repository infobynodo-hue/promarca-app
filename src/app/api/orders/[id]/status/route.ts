import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/emails/orders";

const VALID_STATUSES = [
  "confirmado",
  "en_almacen",
  "en_marcacion",
  "salida_marcacion",
  "en_camino",
  "entregado",
];

// POST /api/orders/[id]/status — advance order status
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();

  const { status, notes, send_email } = body;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  // Fetch current order + client
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, client:clients(name, email)")
    .eq("id", id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Update order status
  const { error: updateErr } = await supabase
    .from("orders")
    .update({ current_status: status })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Insert status history
  let emailSent = false;
  const emailTarget = order.client_notification_email ?? order.client?.email;

  if (send_email && emailTarget) {
    const emailResult = await sendOrderStatusEmail({
      orderNumber: order.order_number,
      clientName: order.client?.name ?? "Cliente",
      clientEmail: emailTarget,
      status,
      notes: notes ?? undefined,
      estimatedDelivery: order.estimated_delivery,
    });
    emailSent = emailResult.success;
  }

  await supabase.from("order_status_history").insert({
    order_id: id,
    status,
    notes: notes ?? null,
    email_sent: emailSent,
  });

  return NextResponse.json({
    success: true,
    new_status: status,
    email_sent: emailSent,
  });
}
