import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/db";
import { verifyPassword, makeSession, cookieName } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const form = await req.formData();
  const pw = String(form.get("senha") || "");
  const biz = await getBusiness(params.slug);
  const back = new URL(`/${params.slug}/painel`, req.url);
  if (!biz || !verifyPassword(pw, biz.owner_password_hash)) {
    await new Promise(r => setTimeout(r, 600)); // dificulta tentativas em sequência
    return NextResponse.redirect(new URL(`/${params.slug}/painel/entrar?erro=1`, req.url), 303);
  }
  const res = NextResponse.redirect(back, 303);
  res.cookies.set(cookieName(params.slug), makeSession(params.slug), { httpOnly: true, secure: true, sameSite: "lax", path: `/`, maxAge: 30 * 86400 });
  return res;
}
