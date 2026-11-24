import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, getBusiness } from "@/lib/db";
import { checkSession, cookieName, hashPassword } from "@/lib/auth";
import { toWhatsApp } from "@/lib/phone";

// Ações do painel do dono (formulários): mudar status, salvar WhatsApp, trocar senha.
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!checkSession(params.slug, cookies().get(cookieName(params.slug))?.value)) {
    return NextResponse.redirect(new URL(`/${params.slug}/painel/entrar`, req.url), 303);
  }
  const biz = await getBusiness(params.slug);
  if (!biz) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const f = await req.formData();
  const action = String(f.get("acao") || "");
  let msg = "ok";
  if (action === "status") {
    const status = String(f.get("status"));
    if (["confirmado", "concluido", "cancelado", "faltou"].includes(status)) {
      await db().from("bookings").update({ status }).eq("id", String(f.get("id"))).eq("business_id", biz.id);
    }
  } else if (action === "whatsapp") {
    const n = toWhatsApp(String(f.get("numero") || ""));
    if (n) { await db().from("businesses").update({ owner_whatsapp: n }).eq("id", biz.id); msg = "zap-ok"; } else msg = "zap-erro";
  } else if (action === "senha") {
    const pw = String(f.get("nova") || "");
    if (pw.length >= 6) { await db().from("businesses").update({ owner_password_hash: hashPassword(pw) }).eq("id", biz.id); msg = "senha-ok"; } else msg = "senha-erro";
  }
  const back = new URL(`/${params.slug}/painel`, req.url);
  const p = String(f.get("p") || ""); if (p) back.searchParams.set("p", p);
  back.searchParams.set("msg", msg);
  return NextResponse.redirect(back, 303);
}
