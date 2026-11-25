// Aviso grátis por e-mail ao dono a cada agendamento, via FormSubmit (sem conta e sem chave).
// O e-mail fica na variável AVISO_EMAIL da Vercel (não no código, que é público).
// Na primeira vez, o FormSubmit manda um e-mail "Activate Form": o dono clica uma vez e pronto.
export async function emailOwner(subject: string, fields: Record<string, string>): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const to = (process.env.AVISO_EMAIL || "").trim();
  if (!to) return { ok: false, skipped: true };
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Referer: process.env.SITE_URL || "https://git-hub-site-de-agendamento.vercel.app" },
      body: JSON.stringify({ _subject: subject, _template: "table", _captcha: "false", ...fields }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    const ok = res.ok && String((j as { success?: unknown }).success) !== "false";
    if (!ok) console.error("[email] falhou", res.status, j);
    return ok ? { ok } : { ok, error: String((j as { message?: unknown }).message || res.status) };
  } catch (e) { console.error("[email] erro", e); return { ok: false, error: (e as Error).message }; }
}
