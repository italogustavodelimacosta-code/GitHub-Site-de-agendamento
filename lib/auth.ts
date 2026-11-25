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
/** A senha do seed ("trocar123") está no GitHub, que é público. Ela nunca vale para entrar. */
export const isInitialPassword = (stored: string) => !stored || stored.startsWith("sha256:");

/** Senha escolhida pelo dono na Vercel (PAINEL_SENHA). Vale só enquanto o banco ainda tem a senha inicial. */
export function initialPanelPassword(): string | null {
  const p = process.env.PAINEL_SENHA || "";
  return p.length >= 8 ? p : null;
}
export function samePassword(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

const WEAK = ["trocar123", "12345678", "123456789", "1234567890", "senha123", "password", "barbearia", "lavarapido", "abcd1234", "qwerty123"];
/** Explica o que está errado na nova senha, ou null se estiver boa. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "curta";
  if (pw.length > 200) return "longa";
  if (WEAK.includes(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return "fraca";
  return null;
}

// Usa SESSION_SECRET se existir; senão deriva uma chave da chave secreta do Supabase (nunca exposta).
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!k) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  return createHmac("sha256", k).update("painel-sessao").digest("hex");
};
export const cookieName = (slug: string) => `painel_${slug}`;
export const SESSION_DAYS = 14;
// A sessão fica presa à senha atual: trocar a senha derruba todos os aparelhos que estavam logados.
const sign = (slug: string, exp: string, pwHash: string) =>
  createHmac("sha256", secret()).update(`${slug}.${exp}.${createHash("sha256").update(pwHash || "").digest("hex")}`).digest("hex");
/** Token de sessão: slug.expira.assinatura */
export function makeSession(slug: string, pwHash: string, days = SESSION_DAYS): string {
  const exp = String(Date.now() + days * 86400000);
  return `${slug}.${exp}.${sign(slug, exp, pwHash)}`;
}
export function checkSession(slug: string, pwHash: string, token?: string): boolean {
  if (!token || isInitialPassword(pwHash)) return false;
  const [s, exp, sig] = token.split(".");
  if (s !== slug || !exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = sign(s, exp, pwHash);
  return want.length === sig.length && timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
