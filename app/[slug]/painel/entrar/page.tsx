import { notFound } from "next/navigation";
import { getBusiness } from "@/lib/db";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  "1": "Senha incorreta.",
  muitas: "Muitas tentativas. Espere 15 minutos e tente de novo.",
  configurar: "O painel ainda não tem senha. Coloque a variável PAINEL_SENHA na Vercel e faça um Redeploy.",
};

export default async function Entrar(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }> }) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const biz = await getBusiness(params.slug);
  if (!biz) notFound();
  return (
    <div data-style={biz.config.style || undefined} style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="wrap" style={{ maxWidth: 360, paddingTop: 60 }}>
        <span className="tag">Área do dono</span>
        <h1>{biz.name}</h1>
        <p className="hint">Só quem tem a senha entra aqui.</p>
        <form method="post" action={`/api/${biz.slug}/login`}>
          <div className="field"><label htmlFor="senha">Senha</label><input id="senha" name="senha" type="password" autoComplete="current-password" required /></div>
          {searchParams.erro && <p className="err">{ERROS[searchParams.erro] || ERROS["1"]}</p>}
          <button className="btn block" type="submit">Entrar</button>
        </form>
        <p className="hint" style={{ marginTop: 16 }}><a href={`/${biz.slug}`} style={{ color: "var(--accent)" }}>Voltar para a página de agendamento</a></p>
      </div>
    </div>
  );
}
