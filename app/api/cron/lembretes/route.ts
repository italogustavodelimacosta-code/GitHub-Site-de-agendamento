import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Chamado a cada 5 minutos pelo Supabase (supabase/lembretes.sql).
async function run(req: Request) {
  const want = process.env.CRON_SECRET;
  if (!want || req.headers.get("authorization") !== `Bearer ${want}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  return NextResponse.json(await sendDueReminders());
}
export const POST = run;
export const GET = run;
