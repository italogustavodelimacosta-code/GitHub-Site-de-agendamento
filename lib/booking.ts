import { db, getBusiness, getCatalog, getBusy } from "./db.ts";
import { computeSlots } from "./slots.ts";
import { localToDate, dateBR, hhmm } from "./time.ts";
import { quote, brl } from "./pricing.ts";
import { toWhatsApp, okEmail } from "./phone.ts";
import { sendTemplate } from "./whatsapp.ts";
import type { Size } from "./types.ts";

export type BookingRequest = {
  date: string; time: number; serviceIds: string[]; professionalId?: string | null;
  name: string; phone: string; email: string;
  vehicleSize?: string | null; plate?: string | null; pickup?: boolean; pickupAddress?: string | null;
};

export class BookingError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

export async function createBooking(slug: string, r: BookingRequest) {
  const biz = await getBusiness(slug);
  if (!biz) throw new BookingError("Estabelecimento não encontrado.", 404);
  const name = (r.name || "").trim();
  if (name.length < 3) throw new BookingError("Digite o nome completo.");
  const phone = toWhatsApp(r.phone);
  if (!phone) throw new BookingError("Digite um WhatsApp válido, com DDD.");
  if (!okEmail(r.email)) throw new BookingError("Digite um e-mail válido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isInteger(r.time)) throw new BookingError("Escolha um dia e um horário.");

  const { services, professionals } = await getCatalog(biz.id);
  const chosen = services.filter(s => r.serviceIds.includes(s.id));
  if (!chosen.some(s => s.kind === "principal")) throw new BookingError("Escolha um serviço.");

  let size: Size | null = null;
  if (biz.kind === "lavarapido") {
    size = biz.config.sizes?.find(s => s.id === r.vehicleSize) || null;
    if (!size) throw new BookingError("Escolha o tipo do carro.");
  }
  const pickup = biz.kind === "lavarapido" && !!r.pickup;
  if (pickup && (r.pickupAddress || "").trim().length < 6) throw new BookingError("Digite o endereço para buscarmos o carro.");
  const q = quote(chosen, size, pickup ? biz.config.pickupFee || 0 : 0);

  // Confere de novo, no servidor, se o horário continua livre.
  const dayStart = localToDate(r.date, 0, biz.tz_offset), dayEnd = localToDate(r.date, 1440 + 600, biz.tz_offset);
  const busy = await getBusy(biz.id, dayStart, dayEnd);
  const proIds = professionals.map(p => p.id);
  const chosenPro = r.professionalId && proIds.includes(r.professionalId) ? r.professionalId : null;
  const slot = computeSlots({
    date: r.date, tz: biz.tz_offset, openMin: biz.open_min, closeMin: biz.close_min, stepMin: biz.step_min,
    durationMin: q.duration, capacity: biz.capacity, closedWeekdays: biz.closed_weekdays,
    professionalIds: proIds, chosenProfessional: chosenPro, busy, now: new Date(),
  }).find(s => s.time === r.time);
  if (!slot) throw new BookingError("Esse horário acabou de ser ocupado. Escolha outro.", 409);

  const starts = localToDate(r.date, r.time, biz.tz_offset);
  const ends = new Date(starts.getTime() + q.duration * 60000);
  const { data, error } = await db().from("bookings").insert({
    business_id: biz.id, professional_id: slot.professionalId, client_name: name, client_phone: phone,
    client_email: r.email.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    items: q.items, total: q.total, cost: q.cost, vehicle_size: size?.id || null,
    plate: (r.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || null,
    pickup_address: pickup ? (r.pickupAddress || "").trim() : null,
  }).select("id").single();
  if (error) throw error;

  const proName = professionals.find(p => p.id === slot.professionalId)?.name;
  const what = q.items.filter(i => i.name !== "Leva e traz").map(i => i.name).join(" + ") + (proName ? ` com ${proName}` : "") + (size ? ` (${size.name})` : "");
  const when = dateBR(r.date), at = hhmm(r.time);

  // WhatsApp: confirmação para o cliente e aviso para o dono. Falhas não cancelam o agendamento.
  const [toClient, toOwner] = await Promise.all([
    sendTemplate(phone, "agendamento_confirmado", [name.split(" ")[0], biz.name, what, when, at, brl(q.total), biz.address || "-"]),
    sendTemplate(toWhatsApp(biz.owner_whatsapp) || "", "novo_agendamento", [biz.name, name, `+${phone}`, what + (pickup ? ` · buscar em ${r.pickupAddress}` : ""), when, at, brl(q.total)]),
  ]);

  return { id: data.id as string, total: q.total, what, when, at, professional: proName || null, whatsapp: { client: toClient, owner: toOwner } };
}

/** Envia o lembrete de 30 minutos para quem ainda não recebeu. Chamado a cada 5 minutos. */
export async function sendDueReminders(now = new Date()) {
  const until = new Date(now.getTime() + 31 * 60000);
  const { data, error } = await db().from("bookings")
    .select("id,client_name,client_phone,starts_at,items,business_id,professional_id,businesses(name,tz_offset),professionals(name)")
    .eq("status", "confirmado").is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString()).lte("starts_at", until.toISOString());
  if (error) throw error;
  let sent = 0;
  for (const b of data || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const biz = (b as any).businesses as { name: string; tz_offset: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pro = (b as any).professionals as { name: string } | null;
    const { dateToLocal } = await import("./time.ts");
    const loc = dateToLocal(new Date(b.starts_at), biz.tz_offset);
    const what = (b.items as { name: string }[]).filter(i => i.name !== "Leva e traz").map(i => i.name).join(" + ") + (pro ? ` com ${pro.name}` : "");
    // Marca antes de enviar para nunca mandar duas vezes, mesmo se duas execuções se cruzarem.
    const { data: claimed } = await db().from("bookings").update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", b.id).is("reminder_sent_at", null).select("id");
    if (!claimed?.length) continue;
    await sendTemplate(b.client_phone, "lembrete_30min", [b.client_name.split(" ")[0], what, biz.name, dateBR(loc.date), hhmm(loc.minutes)]);
    sent++;
  }
  return { checked: data?.length || 0, sent };
}
