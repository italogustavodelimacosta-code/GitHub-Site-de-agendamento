import { NextResponse } from "next/server";
import { cookieName } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const res = NextResponse.redirect(new URL(`/${params.slug}/painel/entrar`, req.url), 303);
  res.cookies.delete(cookieName(params.slug));
  return res;
}
