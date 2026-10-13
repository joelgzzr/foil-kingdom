import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

// Only the seller prints the label. The mock provider has no hosted PDF, so the app renders a printable page.
export async function GET(_request: Request, ctx: RouteContext<"/api/orders/[id]/label">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .eq("seller_id", user.id)
    .in("status", ["label_ready", "in_transit", "delivered"])
    .maybeSingle();
  if (!order) return new NextResponse(null, { status: 404 });

  // Provider-internal fields (label_url) are not readable by clients, so use the admin client after the RLS check.
  const admin = createAdminClient();
  const [{ data: shipment }, { data: addresses }] = await Promise.all([
    admin.from("shipments").select("provider, carrier, service, tracking_number, label_url").eq("order_id", id).maybeSingle(),
    admin.from("order_addresses").select("*").eq("order_id", id),
  ]);
  if (!shipment) return new NextResponse(null, { status: 404 });

  if (shipment.label_url) {
    const target = new URL(shipment.label_url);
    if (target.protocol !== "https:") return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(target);
  }

  const card = (title: string, party: "origin" | "destination") => {
    const a = addresses?.find((row) => row.party === party);
    if (!a) return "";
    const lines = [
      a.recipient_name,
      `${a.street} ${a.exterior_number}${a.interior_number ? ` Int. ${a.interior_number}` : ""}`,
      `${a.neighborhood}, C.P. ${a.postal_code}`,
      `${a.municipality}, ${a.state}`,
      `Tel. ${a.phone}`,
      a.reference ?? "",
    ].filter(Boolean);
    return `<section><h2>${title}</h2>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>`;
  };

  const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Guía ${escapeHtml(shipment.tracking_number)}</title>
<style>body{font-family:sans-serif;margin:2rem;max-width:32rem}section{border:1px solid #000;padding:1rem;margin:1rem 0}h2{margin:0 0 .5rem;font-size:1rem}p{margin:.15rem 0}.t{font:bold 1.5rem monospace}</style></head>
<body><h1>${escapeHtml(shipment.carrier)} ${escapeHtml(shipment.service)}</h1><p class="t">${escapeHtml(shipment.tracking_number)}</p>
${card("Remitente", "origin")}${card("Destinatario", "destination")}<p>Guía de prueba (proveedor simulado).</p></body></html>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
