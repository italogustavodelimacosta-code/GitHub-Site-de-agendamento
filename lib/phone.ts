/** Deixa o número no formato do WhatsApp: 55 + DDD + número, só dígitos. */
export function toWhatsApp(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}
export const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e || "").trim());
