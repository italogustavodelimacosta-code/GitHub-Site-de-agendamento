// Envio pela API oficial do WhatsApp (Meta Cloud API) usando modelos de mensagem aprovados.
// Os textos dos modelos estão no README. Se o token não estiver configurado, só registra no log.

const GRAPH = "https://graph.facebook.com/v21.0";

export type SendResult = { ok: boolean; skipped?: boolean; error?: string };

export async function sendTemplate(to: string, template: string, params: string[]): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.log(`[whatsapp:simulado] ${template} -> ${to}: ${params.join(" | ")}`);
    return { ok: false, skipped: true };
  }
  if (!to) return { ok: false, error: "número vazio" };
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: {
          name: template, language: { code: "pt_BR" },
          components: [{ type: "body", parameters: params.map(text => ({ type: "text", text: String(text).slice(0, 1000) })) }],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[whatsapp] falhou ${template} -> ${to}: ${res.status} ${body}`);
      return { ok: false, error: `${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[whatsapp] erro de rede", e);
    return { ok: false, error: "rede" };
  }
}

export async function sendText(to: string, text: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) { console.log(`[whatsapp:simulado] texto -> ${to}: ${text}`); return { ok: false, skipped: true }; }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  return res.ok ? { ok: true } : { ok: false, error: String(res.status) };
}
