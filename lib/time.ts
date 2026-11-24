// Horário local do negócio usando um deslocamento fixo (Brasília é -03:00 o ano todo desde 2019).
export function offsetMinutes(tz: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(tz);
  if (!m) return -180;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -v : v;
}
/** "2026-11-25" + 570 min -> Date (UTC) */
export function localToDate(date: string, minutes: number, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, 0, minutes) - offsetMinutes(tz) * 60000;
  return new Date(utcMs);
}
/** Date -> { date: "YYYY-MM-DD", minutes, weekday } no fuso do negócio */
export function dateToLocal(dt: Date, tz: string) {
  const local = new Date(dt.getTime() + offsetMinutes(tz) * 60000);
  const date = local.toISOString().slice(0, 10);
  return { date, minutes: local.getUTCHours() * 60 + local.getUTCMinutes(), weekday: local.getUTCDay() };
}
export function weekdayOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function dateBR(date: string): string {
  const [, mo, d] = date.split("-");
  return `${WD[weekdayOf(date)]}, ${d}/${mo}`;
}
