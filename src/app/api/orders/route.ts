import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderConfirmationEmail } from "@/lib/emails/orders";

// GET /api/orders — list all orders with client + quote info
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase
    .from("orders")
    .select("*, client:clients(id,name,company,email), quote:quotes(id,quote_number,total)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("current_status", status);
  if (search) {
    query = query.or(`order_number.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/orders — create new order from a quote
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  // Generate order number: PM-YYYY-XXXX
  const year = new Date().getFullYear();
  const { data: seqRow } = await supabase.rpc("nextval", { seq: "order_number_seq" }).single();
  // Fallback: count existing orders this year
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("order_number", `PM-${year}-%`);

  const seq = (count ?? 0) + 1;
  const orderNumber = `PM-${year}-${String(seq).padStart(4, "0")}`;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      quote_id: body.quote_id ?? null,
      client_id: body.client_id ?? null,
      order_date: body.order_date ?? new Date().toISOString().split("T")[0],
      estimated_delivery: body.estimated_delivery ?? null,
      total_billed: body.total_billed ?? 0,
      advance_payment: body.advance_payment ?? 0,
      client_notification_email: body.client_notification_email ?? null,
      current_status: "confirmado",
      notes: body.notes ?? null,
    })
    .select("*, client:clients(id,name,company,email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create initial status history entry
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: "confirmado",
    notes: "Pedido creado desde cotización",
    email_sent: false,
  });

  // Send confirmation email if we have a client email
  const emailAddress = body.client_notification_email ?? order.client?.email;
  if (emailAddress) {
    const emailResult = await sendOrderConfirmationEmail({
      orderNumber: order.order_number,
      clientName: order.client?.name ?? "Cliente",
      clientEmail: emailAddress,
      status: "confirmado",
      estimatedDelivery: order.estimated_delivery,
    });

    if (emailResult.success) {
      // Mark email as sent in history
      await supabase
        .from("order_status_history")
        .update({ email_sent: true })
        .eq("order_id", order.id)
        .eq("status", "confirmado");
    }
  }

  return NextResponse.json(order, { status: 201 });
}
