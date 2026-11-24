import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formatos aceitos: "scrypt:<salt>:<hex>" (padrão) e "sha256:<salt>:<hex>" (senha inicial criada pelo seed).
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [kind, salt, hex] = (stored || "").split(":");
  if (!kind || !salt || !hex) return false;
  const got = kind === "scrypt" ? scryptSync(pw, salt, 32) : kind === "sha256" ? createHash("sha256").update(salt + pw).digest() : null;
  if (!got) return false;
  const want = Buffer.from(hex, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}
export const isInitialPassword = (stored: string) => stored.startsWith("sha256:");

// Usa SESSION_SECRET se existir; senão deriva uma chave da chave secreta do Supabase (nunca exposta).
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  return createHmac("sha256", k).update("painel-sessao").digest("hex");
};
export const cookieName = (slug: string) => `painel_${slug}`;
/** Token de sessão: slug.expira.assinatura */
export function makeSession(slug: string, days = 30): string {
  const exp = Date.now() + days * 86400000;
  const sig = createHmac("sha256", secret()).update(`${slug}.${exp}`).digest("hex");
  return `${slug}.${exp}.${sig}`;
}
export function checkSession(slug: string, token?: string): boolean {
  if (!token) return false;
  const [s, exp, sig] = token.split(".");
  if (s !== slug || !exp || !sig || Number(exp) < Date.now()) return false;
  const want = createHmac("sha256", secret()).update(`${s}.${exp}`).digest("hex");
  return want.length === sig.length && timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
