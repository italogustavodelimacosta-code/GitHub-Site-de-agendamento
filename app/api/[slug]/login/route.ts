import { NextResponse } from "next/server";
import { db, getBusiness } from "@/lib/db";
import { verifyPassword, makeSession, cookieName, isInitialPassword, initialPanelPassword, samePassword, hashPassword, SESSION_DAYS } from "@/lib/auth";
import { hit, clear, clientIp, sameOrigin } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const wait = () => new Promise(r => setTimeout(r, 600)); // dificulta tentativas em sequência

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const params = await ctx.params;
  const back = (erro: string) => NextResponse.redirect(new URL(`/${params.slug}/painel/entrar?erro=${erro}`, req.url), 303);
  if (!sameOrigin(req)) return new Response("proibido", { status: 403 });
  const biz = await getBusiness(params.slug);
  if (!biz) return back("1");

  // No máximo 5 tentativas por aparelho a cada 15 minutos, e 50 por hora no total para o negócio.
  const ipKey = `login:${biz.slug}:${clientIp(req)}`;
  const okIp = await hit(ipKey, 5, 15 * 60);
  const okBiz = await hit(`login:${biz.slug}`, 50, 60 * 60);
  if (!okIp || !okBiz) { await wait(); return back("muitas"); }

  const form = await req.formData();
  const pw = String(form.get("senha") || "").slice(0, 200);
  let hash = biz.owner_password_hash;

  if (isInitialPassword(hash)) {
    // A senha inicial do seed é pública (está no GitHub). Só entra quem colocou PAINEL_SENHA na Vercel.
    const initial = initialPanelPassword();
    if (!initial) { await wait(); return back("configurar"); }
    if (!samePassword(pw, initial)) { await wait(); return back("1"); }
    hash = hashPassword(pw);
    const { error } = await db().from("businesses").update({ owner_password_hash: hash }).eq("id", biz.id).eq("owner_password_hash", biz.owner_password_hash);
    if (error) throw error;
  } else if (!verifyPassword(pw, hash)) {
    await wait();
    return back("1");
  }

  await clear(ipKey);
  const res = NextResponse.redirect(new URL(`/${params.slug}/painel`, req.url), 303);
  res.cookies.set(cookieName(params.slug), makeSession(params.slug, hash), { httpOnly: true, secure: true, sameSite: "lax", path: `/`, maxAge: SESSION_DAYS * 86400 });
  return res;
}
