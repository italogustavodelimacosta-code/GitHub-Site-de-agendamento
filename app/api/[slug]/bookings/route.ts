import { NextResponse } from "next/server";
import { createBooking, BookingError } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
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
