import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Verificação do webhook pela Meta.
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("proibido", { status: 403 });
}

// Quando o cliente responde ao robô, ele recebe uma resposta automática com o contato do estabelecimento.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = body?.entry?.flatMap((e: any) => e.changes?.flatMap((c: any) => c.value?.messages || []) || []) || [];
  for (const m of msgs) {
    const from = String(m.from || "");
    if (!from) continue;
    const { data } = await db().from("bookings").select("businesses(name,owner_whatsapp,slug)")
      .eq("client_phone", from).order("created_at", { ascending: false }).limit(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const biz = (data?.[0] as any)?.businesses as { name: string; owner_whatsapp: string; slug: string } | undefined;
    const site = process.env.SITE_URL || "";
    const text = biz
      ? `Olá! Esta é a mensagem automática da ${biz.name}. Para remarcar ou cancelar, fale direto com a gente no WhatsApp +${biz.owner_whatsapp}${site ? ` ou agende de novo em ${site}/${biz.slug}` : ""}.`
      : `Olá! Esta é uma mensagem automática. Para agendar, use o link que você recebeu do estabelecimento.`;
    await sendText(from, text);
  }
  return NextResponse.json({ ok: true });
}
