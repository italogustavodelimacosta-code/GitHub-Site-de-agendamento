// Aviso grátis por e-mail ao dono a cada agendamento, via Resend (plano grátis: 100 e-mails/dia).
// Variáveis na Vercel: RESEND_API_KEY (secreta) e AVISO_EMAIL (o e-mail da conta Resend, que recebe os avisos).
// Cada cliente pode ter o próprio e-mail (config.aviso_email do negócio). Sem domínio próprio verificado no Resend,
// o remetente onboarding@resend.dev só entrega para o e-mail da conta Resend. Com domínio, preencha AVISO_REMETENTE
// (ex.: "Agendamentos <avisos@seudominio.com.br>") e os avisos chegam no e-mail de cada cliente.
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function emailOwner(to: string, subject: string, fields: Record<string, string>): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  to = (to || "").trim(); const key = process.env.RESEND_API_KEY;
  if (!to || !key) return { ok: false, skipped: true };
  const rows = Object.entries(fields).map(([k, v]) => `<tr><td style="padding:6px 12px;color:#666">${esc(k)}</td><td style="padding:6px 12px"><b>${esc(v)}</b></td></tr>`).join("");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: (process.env.AVISO_REMETENTE || "").trim() || "Agendamentos <onboarding@resend.dev>", to: [to], subject,
        html: `<h2 style="font-family:sans-serif">${esc(subject)}</h2><table style="font-family:sans-serif;border-collapse:collapse">${rows}</table>`,
        text: Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n"),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { const t = await res.text(); console.error("[email] falhou", res.status, t.slice(0, 300)); return { ok: false, error: String(res.status) }; }
    return { ok: true };
  } catch (e) { console.error("[email] erro", e); return { ok: false, error: (e as Error).message }; }
}

/** Para onde vai o aviso: o e-mail do cliente (se cadastrado). Os negócios de demonstração usam AVISO_EMAIL. */
export const avisoPara = (config: { aviso_email?: string; cliente?: boolean }) =>
  (config?.aviso_email || (config?.cliente ? "" : process.env.AVISO_EMAIL || "")).trim();
