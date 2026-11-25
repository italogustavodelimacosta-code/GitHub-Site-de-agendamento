import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, getBusiness } from "@/lib/db";
import { checkSession, cookieName, hashPassword, makeSession, passwordProblem, verifyPassword, SESSION_DAYS } from "@/lib/auth";
import { toWhatsApp } from "@/lib/phone";
import { sameOrigin } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ações do painel do dono (formulários): mudar status, salvar WhatsApp, trocar senha.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const params = await ctx.params;
  if (!sameOrigin(req)) return new Response("proibido", { status: 403 });
  const biz = await getBusiness(params.slug);
  if (!biz || !checkSession(biz.slug, biz.owner_password_hash, (await cookies()).get(cookieName(params.slug))?.value)) {
    return NextResponse.redirect(new URL(`/${params.slug}/painel/entrar`, req.url), 303);
  }
  const f = await req.formData();
  const action = String(f.get("acao") || "");
  let msg = "ok";
  let newHash: string | null = null;
  if (action === "status") {
    const status = String(f.get("status"));
    const id = String(f.get("id") || "");
    if (UUID.test(id) && ["confirmado", "concluido", "cancelado", "faltou"].includes(status)) {
      await db().from("bookings").update({ status }).eq("id", id).eq("business_id", biz.id);
    }
  } else if (action === "whatsapp") {
    const n = toWhatsApp(String(f.get("numero") || "").slice(0, 40));
    if (n) { await db().from("businesses").update({ owner_whatsapp: n }).eq("id", biz.id); msg = "zap-ok"; } else msg = "zap-erro";
  } else if (action === "senha") {
    const atual = String(f.get("atual") || "").slice(0, 200);
    const pw = String(f.get("nova") || "");
    const problem = passwordProblem(pw);
    if (!verifyPassword(atual, biz.owner_password_hash)) msg = "senha-atual";
    else if (problem) msg = `senha-${problem}`;
    else {
      newHash = hashPassword(pw);
      await db().from("businesses").update({ owner_password_hash: newHash }).eq("id", biz.id);
      msg = "senha-ok";
    }
  }
  const back = new URL(`/${params.slug}/painel`, req.url);
  const p = String(f.get("p") || "");
  if (["hoje", "semana", "mes"].includes(p)) back.searchParams.set("p", p);
  back.searchParams.set("msg", msg);
  const res = NextResponse.redirect(back, 303);
  // Senha nova derruba as outras sessões; este aparelho continua logado.
  if (newHash) res.cookies.set(cookieName(biz.slug), makeSession(biz.slug, newHash), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
  return res;
}
