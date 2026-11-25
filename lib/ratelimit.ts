import { db } from "./db.ts";

// Limite de tentativas (login, agendamentos). Guarda no banco (tabela rate_limits) para valer em todos
// os servidores da Vercel. Se a tabela ainda não existir, usa a memória do servidor como reserva.
const mem = new Map<string, number[]>();
function memHit(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now(), since = now - windowSec * 1000;
  const list = (mem.get(key) || []).filter(t => t > since);
  list.push(now);
  mem.set(key, list);
  if (mem.size > 5000) for (const [k, v] of mem) if (!v.some(t => t > since)) mem.delete(k);
  return list.length <= limit;
}

/** Registra uma tentativa e diz se ainda está dentro do limite. */
export async function hit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const memOk = memHit(key, limit, windowSec);
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const ins = await db().from("rate_limits").insert({ key });
    if (ins.error) return memOk;
    const { count, error } = await db().from("rate_limits").select("key", { count: "exact", head: true }).eq("key", key).gt("at", since);
    if (error) return memOk;
    if (Math.random() < 0.02) await db().from("rate_limits").delete().lt("at", new Date(Date.now() - 2 * 86400000).toISOString());
    return (count || 0) <= limit && memOk;
  } catch {
    return memOk;
  }
}

/** Apaga as tentativas de uma chave (ex.: depois de um login certo). */
export async function clear(key: string) {
  mem.delete(key);
  try { await db().from("rate_limits").delete().eq("key", key); } catch { /* sem tabela, tudo bem */ }
}

/** IP de quem fez o pedido (a Vercel preenche esses cabeçalhos). */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
}

/** Bloqueia formulários enviados de outros sites (proteção contra CSRF). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // navegadores antigos não mandam; o cookie SameSite=Lax já protege
  try { return new URL(origin).host === (req.headers.get("x-forwarded-host") || req.headers.get("host")); } catch { return false; }
}
