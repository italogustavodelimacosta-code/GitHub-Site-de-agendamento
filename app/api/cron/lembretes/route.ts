import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/booking";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Chamado a cada 5 minutos pelo Supabase (supabase/lembretes.sql).
// A senha vem de CRON_SECRET ou, se não existir, da tabela app_settings (criada no schema.sql).
async function expected(): Promise<string | null> {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const { data } = await db().from("app_settings").select("value").eq("key", "cron_secret").maybeSingle();
  return (data?.value as string) || null;
}
async function run(req: Request) {
  const want = await expected();
  const got = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const ok = !!want && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  return NextResponse.json(await sendDueReminders());
}
export const POST = run;
export const GET = run;
