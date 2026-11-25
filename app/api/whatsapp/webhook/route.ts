import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Verificação do webhook pela Meta.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const want = process.env.WHATSAPP_VERIFY_TOKEN;
  if (want && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === want) {
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("proibido", { status: 403 });
}

// Quando o cliente responde ao robô, ele recebe uma resposta automática com o contato do estabelecimento.
// Confere a assinatura da Meta (cabeçalho X-Hub-Signature-256) com WHATSAPP_APP_SECRET.
// Sem isso, qualquer um poderia mandar mensagens falsas e fazer o robô responder.
function signed(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from("sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex"));
  const got = Buffer.from(header);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!signed(raw, req.headers.get("x-hub-signature-256"))) {
    if (!process.env.WHATSAPP_APP_SECRET) console.warn("[whatsapp] WHATSAPP_APP_SECRET não configurado: respostas automáticas desligadas.");
    return new Response("proibido", { status: 401 });
  }
  let body: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = JSON.parse(raw); } catch { /* corpo inválido */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = body?.entry?.flatMap((e: any) => e.changes?.flatMap((c: any) => c.value?.messages || []) || []) || [];
  for (const m of msgs) {
    const from = String(m.from || "");
    if (!/^\d{10,15}$/.test(from)) continue;
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
