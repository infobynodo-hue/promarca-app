/**
 * Order email notifications — ProMarca
 * TODO: Connect Resend tomorrow. Currently logs to console.
 *
 * Usage:
 *   import { sendOrderConfirmationEmail, sendOrderStatusEmail } from "@/lib/emails/orders";
 */

export const ORDER_STATUS_LABELS: Record<string, { label: string; description: string; emoji: string }> = {
  confirmado:       { label: "Pedido confirmado",         description: "Hemos recibido tu pedido y está siendo procesado.",              emoji: "✅" },
  en_almacen:       { label: "En almacén",                description: "Tu pedido está en nuestro almacén siendo preparado.",             emoji: "📦" },
  en_marcacion:     { label: "En proceso de marcación",   description: "Tu pedido está siendo marcado / personalizado.",                  emoji: "🎨" },
  salida_marcacion: { label: "Salida de marcación",       description: "Tu pedido ya terminó el proceso de marcación y está listo.",     emoji: "✔️" },
  en_camino:        { label: "En camino",                 description: "Tu pedido está en camino. Pronto lo recibirás.",                  emoji: "🚚" },
  entregado:        { label: "Entregado",                 description: "Tu pedido ha sido entregado exitosamente. ¡Gracias por confiar en ProMarca!", emoji: "🎉" },
};

interface OrderEmailData {
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  status: string;
  notes?: string;
  estimatedDelivery?: string | null;
}

/**
 * Send email when a new order is created from a confirmed quote.
 * TODO: Replace console.log with Resend API call
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<{ success: boolean; error?: string }> {
  const statusInfo = ORDER_STATUS_LABELS["confirmado"];

  console.log("📧 [EMAIL TODO] Order confirmation:", {
    to: data.clientEmail,
    subject: `${statusInfo.emoji} Tu pedido ${data.orderNumber} ha sido confirmado — ProMarca`,
    body: buildOrderEmailHtml({ ...data, status: "confirmado" }),
  });

  // TODO: Uncomment and configure when Resend is connected tomorrow
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // const { error } = await resend.emails.send({
  //   from: "ProMarca <pedidos@promarca.co>",
  //   to: data.clientEmail,
  //   subject: `${statusInfo.emoji} Tu pedido ${data.orderNumber} ha sido confirmado — ProMarca`,
  //   html: buildOrderEmailHtml({ ...data, status: "confirmado" }),
  // });
  // if (error) return { success: false, error: error.message };

  return { success: true };
}

/**
 * Send email when an order status is updated by admin.
 * TODO: Replace console.log with Resend API call
 */
export async function sendOrderStatusEmail(data: OrderEmailData): Promise<{ success: boolean; error?: string }> {
  const statusInfo = ORDER_STATUS_LABELS[data.status] ?? { label: data.status, description: "", emoji: "📋" };

  console.log("📧 [EMAIL TODO] Status update:", {
    to: data.clientEmail,
    subject: `${statusInfo.emoji} Actualización de tu pedido ${data.orderNumber} — ProMarca`,
    body: buildOrderEmailHtml(data),
  });

  // TODO: Uncomment and configure when Resend is connected tomorrow
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // const { error } = await resend.emails.send({
  //   from: "ProMarca <pedidos@promarca.co>",
  //   to: data.clientEmail,
  //   subject: `${statusInfo.emoji} Actualización de tu pedido ${data.orderNumber} — ProMarca`,
  //   html: buildOrderEmailHtml(data),
  // });
  // if (error) return { success: false, error: error.message };

  return { success: true };
}

// ─── HTML Email Template ──────────────────────────────────────────────────────
function buildOrderEmailHtml(data: OrderEmailData): string {
  const statusInfo = ORDER_STATUS_LABELS[data.status] ?? { label: data.status, description: "", emoji: "📋" };

  const steps = [
    "confirmado",
    "en_almacen",
    "en_marcacion",
    "salida_marcacion",
    "en_camino",
    "entregado",
  ];
  const currentIdx = steps.indexOf(data.status);

  const stepLabels: Record<string, string> = {
    confirmado:       "Confirmado",
    en_almacen:       "En almacén",
    en_marcacion:     "Marcación",
    salida_marcacion: "Listo",
    en_camino:        "En camino",
    entregado:        "Entregado",
  };

  const stepsHtml = steps
    .map((step, i) => {
      const done = i <= currentIdx;
      const color = done ? "#FF6B1A" : "#d1d5db";
      const textColor = done ? "#FF6B1A" : "#9ca3af";
      return `<td align="center" style="padding:0 4px;">
        <div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;font-size:12px;font-weight:bold;line-height:28px;text-align:center;">${done ? "✓" : i + 1}</div>
        <p style="margin:4px 0 0;font-size:10px;color:${textColor};font-family:Arial,sans-serif;">${stepLabels[step]}</p>
      </td>`;
    })
    .join('<td style="padding:0 2px;"><div style="height:2px;width:20px;background:#e5e7eb;margin-bottom:18px;"></div></td>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:#FF6B1A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">ProMarca</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Productos Promocionales</p>
        </td></tr>
        <!-- Status badge -->
        <tr><td style="padding:32px 40px 0;text-align:center;">
          <span style="font-size:40px;">${statusInfo.emoji}</span>
          <h2 style="margin:12px 0 8px;color:#111827;font-size:22px;font-weight:700;">${statusInfo.label}</h2>
          <p style="margin:0;color:#6b7280;font-size:15px;">${statusInfo.description}</p>
        </td></tr>
        <!-- Order info -->
        <tr><td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;">
            <tr>
              <td style="color:#6b7280;font-size:13px;">Hola,</td>
            </tr>
            <tr>
              <td style="color:#111827;font-size:16px;font-weight:600;padding-top:4px;">${data.clientName}</td>
            </tr>
            <tr><td style="padding-top:16px;">
              <span style="color:#6b7280;font-size:13px;">Número de pedido</span><br>
              <span style="color:#FF6B1A;font-size:20px;font-weight:800;font-family:monospace;">${data.orderNumber}</span>
            </td></tr>
            ${data.estimatedDelivery ? `<tr><td style="padding-top:12px;"><span style="color:#6b7280;font-size:13px;">Entrega estimada</span><br><span style="color:#111827;font-size:14px;font-weight:600;">${new Date(data.estimatedDelivery).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</span></td></tr>` : ""}
            ${data.notes ? `<tr><td style="padding-top:12px;border-top:1px solid #e5e7eb;margin-top:12px;"><span style="color:#6b7280;font-size:13px;">Nota</span><br><span style="color:#374151;font-size:14px;">${data.notes}</span></td></tr>` : ""}
          </table>
        </td></tr>
        <!-- Progress tracker -->
        <tr><td style="padding:0 40px 32px;">
          <p style="margin:0 0 16px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Estado del pedido</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>${stepsHtml}</tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">¿Tienes preguntas? Contáctanos en <a href="mailto:ventas@promarca.co" style="color:#FF6B1A;text-decoration:none;">ventas@promarca.co</a></p>
          <p style="margin:8px 0 0;color:#d1d5db;font-size:12px;">© 2026 ProMarca — Productos Promocionales</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
