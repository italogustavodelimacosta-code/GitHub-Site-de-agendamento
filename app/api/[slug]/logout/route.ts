import { NextResponse } from "next/server";
import { cookieName } from "@/lib/auth";
import { sameOrigin } from "@/lib/ratelimit";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const params = await ctx.params;
  if (!sameOrigin(req)) return new Response("proibido", { status: 403 });
  const res = NextResponse.redirect(new URL(`/${params.slug}/painel/entrar`, req.url), 303);
  res.cookies.set(cookieName(params.slug), "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
