import { localToDate, dateToLocal, weekdayOf } from "./time.ts";

export type Busy = { start: Date; end: Date; professional_id: string | null };
export type SlotInput = {
  date: string; tz: string; openMin: number; closeMin: number; stepMin: number; durationMin: number;
  capacity: number; closedWeekdays: number[]; professionalIds: string[]; chosenProfessional: string | null;
  busy: Busy[]; now: Date; leadMin?: number;
};
export type Slot = { time: number; free: number; professionalId: string | null };

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** Calcula os horários livres de um dia. Função pura, sem banco, para poder ser testada. */
export function computeSlots(i: SlotInput): Slot[] {
  if (i.closedWeekdays.includes(weekdayOf(i.date))) return [];
  const lead = i.leadMin ?? 15;
  const nowLocal = dateToLocal(i.now, i.tz);
  const out: Slot[] = [];
  for (let t = i.openMin; t + i.durationMin <= i.closeMin; t += i.stepMin) {
    const s = localToDate(i.date, t, i.tz).getTime();
    const e = s + i.durationMin * 60000;
    if (s < i.now.getTime() + lead * 60000) continue;
    const clash = i.busy.filter(b => overlaps(s, e, b.start.getTime(), b.end.getTime()));
    if (i.professionalIds.length > 0) {
      const candidates = i.chosenProfessional ? [i.chosenProfessional] : i.professionalIds;
      const freePros = candidates.filter(p => !clash.some(b => b.professional_id === p));
      if (freePros.length) out.push({ time: t, free: freePros.length, professionalId: freePros[0] });
    } else {
      const free = i.capacity - clash.length;
      if (free > 0) out.push({ time: t, free, professionalId: null });
    }
  }
  void nowLocal;
  return out;
}
