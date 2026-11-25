import { NextResponse } from "next/server";
import { getBusiness, getCatalog, getBusy } from "@/lib/db";
import { computeSlots } from "@/lib/slots";
import { localToDate } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/<slug>/slots?date=2026-11-25&duration=45&pro=<id opcional>
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const params = await ctx.params;
  const u = new URL(req.url);
  const date = u.searchParams.get("date") || "";
  const duration = Math.max(10, Math.min(600, Number(u.searchParams.get("duration")) || 30));
  const pro = (u.searchParams.get("pro") || "").slice(0, 40) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "data inválida" }, { status: 400 });
  const biz = await getBusiness(params.slug);
  if (!biz) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const { professionals } = await getCatalog(biz.id);
  const busy = await getBusy(biz.id, localToDate(date, 0, biz.tz_offset), localToDate(date, 1440 + 600, biz.tz_offset));
  const slots = computeSlots({
    date, tz: biz.tz_offset, openMin: biz.open_min, closeMin: biz.close_min, stepMin: biz.step_min, durationMin: duration,
    capacity: biz.capacity, closedWeekdays: biz.closed_weekdays, professionalIds: professionals.map(p => p.id),
    chosenProfessional: pro && pro !== "any" ? pro : null, busy, now: new Date(),
  });
  const closed = biz.closed_weekdays.includes(new Date(date + "T12:00:00Z").getUTCDay());
  return NextResponse.json({ closed, slots: slots.map(s => ({ time: s.time, free: s.free })) });
}
