import { NextResponse } from "next/server";
import { createBooking, BookingError } from "@/lib/booking";
import { hit, clientIp, sameOrigin } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const params = await ctx.params;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Pedido inválido." }, { status: 403 });
  // No máximo 6 agendamentos por aparelho a cada hora (evita robôs lotando a agenda e gastando o WhatsApp).
  if (!(await hit(`booking:${clientIp(req)}`, 6, 60 * 60))) {
    return NextResponse.json({ error: "Muitos agendamentos seguidos. Espere um pouco ou fale com o estabelecimento." }, { status: 429 });
  }
  if (Number(req.headers.get("content-length") || 0) > 10000) return NextResponse.json({ error: "Pedido inválido." }, { status: 413 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  try {
    const r = await createBooking(params.slug, body as Parameters<typeof createBooking>[1]);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Não deu para agendar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
