import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db, getBusiness } from "@/lib/db";
import { checkSession, cookieName } from "@/lib/auth";
import { hhmm, WD } from "@/lib/time";
import MediaUpload from "@/components/MediaUpload";
import AbrirAncora from "@/components/AbrirAncora";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = { salvo: "Salvo! Já aparece no seu site.", criado: "Serviço criado! Já aparece no seu site.", apagado: "Serviço apagado." };

export default async function MeuSite(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const biz = await getBusiness(slug);
  if (!biz) notFound();
  const jar = await cookies();
  if (!checkSession(biz.slug, biz.owner_password_hash, jar.get(cookieName(biz.slug))?.value)) redirect(`/${biz.slug}/painel/entrar`);
  const raw = jar.get(`aviso_${biz.slug}`)?.value;
  const aviso = raw ? (() => { const m = decodeURIComponent(raw); return AVISOS[m] || m; })() : "";

  const [{ data: sv }, { data: pv }] = await Promise.all([
    db().from("services").select("*").eq("business_id", biz.id).order("sort"),
    db().from("professionals").select("id,name,info,active").eq("business_id", biz.id).order("sort"),
  ]);
  const services = (sv || []) as (Service & { active: boolean })[];
  const pros = (pv || []) as { id: string; name: string; info: string; active: boolean }[];
  const car = biz.kind === "lavarapido";
  const api = `/api/${biz.slug}/site`;
  const reais = (n: number) => String(Number(n)).replace(".", ",");
  const fecha = biz.close_min >= 1440 ? "00:00" : hhmm(biz.close_min);

  const Servico = ({ s }: { s: Service & { active: boolean } }) => (
    <details className="edit serv" id={`s-${s.id}`}>
      <summary>
        {s.image_url ? <img className="thumb" src={s.image_url} alt="" /> : <span className="thumb vazio">sem foto</span>}
        <span className="grow"><b>{s.name}</b><small>R$ {reais(s.price)} · {s.duration_min} min{s.active ? "" : " · escondido do site"}</small></span>
        <span className="mini">Editar</span>
      </summary>
      <div className="midias">
        {s.image_url ? <img className="thumb" src={s.image_url} alt="" /> : <span className="thumb vazio">sem foto</span>}
        <span>
          <MediaUpload slug={biz.slug} alvo="servico-foto" id={s.id} label={s.image_url ? "Trocar foto" : "Colocar foto"} />
          {s.image_url && <form method="post" action={api}><input type="hidden" name="acao" value="servico-tirar-foto" /><input type="hidden" name="id" value={s.id} /><button className="mini" type="submit">Tirar foto</button></form>}
          <MediaUpload slug={biz.slug} alvo="servico-video" id={s.id} video label={s.video_url ? "Trocar vídeo" : "Colocar vídeo"} />
          {s.video_url && <form method="post" action={api}><input type="hidden" name="acao" value="servico-tirar-video" /><input type="hidden" name="id" value={s.id} /><button className="mini" type="submit">Tirar vídeo</button></form>}
        </span>
      </div>
      <form method="post" action={api}>
        <input type="hidden" name="acao" value="servico-salvar" /><input type="hidden" name="id" value={s.id} />
        <div className="field"><label>Nome</label><input name="nome" defaultValue={s.name} maxLength={80} required /></div>
        <div className="g3">
          <div className="field"><label>Preço (R$)</label><input name="preco" inputMode="decimal" defaultValue={reais(s.price)} required /></div>
          <div className="field"><label>Custo (R$)</label><input name="custo" inputMode="decimal" defaultValue={reais(s.cost)} /></div>
          <div className="field"><label>Tempo (min)</label><input name="minutos" inputMode="numeric" defaultValue={s.duration_min} required /></div>
        </div>
        <div className="field"><label>Descrição (opcional)</label><input name="info" defaultValue={s.info} maxLength={160} /></div>
        <div className="field"><label>Selo (opcional, ex.: Mais pedido)</label><input name="destaque" defaultValue={s.tag || ""} maxLength={30} /></div>
        <label className="chk"><input type="checkbox" name="ativo" defaultChecked={s.active} /> Aparece no site</label>
        <div className="acoes"><button className="btn" type="submit">Salvar</button></div>
      </form>
      <form method="post" action={api} className="apagar">
        <input type="hidden" name="acao" value="servico-apagar" /><input type="hidden" name="id" value={s.id} />
        <button className="mini perigo" type="submit">Apagar este serviço</button>
      </form>
    </details>
  );

  const Novo = ({ tipo, titulo }: { tipo: "principal" | "extra"; titulo: string }) => (
    <details className="edit novo"><summary>+ {titulo}</summary>
      <form method="post" action={api}>
        <input type="hidden" name="acao" value="servico-novo" /><input type="hidden" name="tipo" value={tipo} />
        <div className="field"><label>Nome</label><input name="nome" maxLength={80} required /></div>
        <div className="g3">
          <div className="field"><label>Preço (R$)</label><input name="preco" inputMode="decimal" required /></div>
          <div className="field"><label>Custo (R$)</label><input name="custo" inputMode="decimal" defaultValue="0" /></div>
          <div className="field"><label>Tempo (min)</label><input name="minutos" inputMode="numeric" defaultValue="30" required /></div>
        </div>
        <div className="field"><label>Descrição (opcional)</label><input name="info" maxLength={160} /></div>
        <button className="btn" type="submit">Criar</button>
        <p className="hint" style={{ marginTop: 8 }}>Depois de criar, você coloca a foto e o vídeo.</p>
      </form>
    </details>
  );

  return (
    <div data-style={biz.config.style || undefined} style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <AbrirAncora />
      <div className="wrap wide">
        <header className="top">
          <div><span className="tag">Área do dono</span><h1>Meu site</h1></div>
          <a className="btn ghost" href={`/${biz.slug}`} target="_blank" style={{ marginLeft: "auto" }}>Ver meu site</a>
        </header>
        <nav className="tabs" aria-label="Painel"><a href={`/${biz.slug}/painel`}>Agenda e faturamento</a><a href={`/${biz.slug}/painel/site`} aria-current="page">Meu site</a></nav>
        {aviso && <div className="notice" role="status">{aviso}</div>}
        <p className="hint">Tudo que você muda aqui aparece na hora no seu site. Os agendamentos que já existem não mudam de preço.</p>

        <nav className="tabs" aria-label="Partes">
          <a href="#dados">Nome e horário</a><a href="#servicos">{car ? "Lavagens" : "Cortes"} e preços</a>{!car && <a href="#equipe">Barbeiros</a>}<a href="#fotos">Vídeo e fotos</a>
        </nav>

        <div className="card" id="dados"><h3>Nome, endereço e horário</h3>
          <form method="post" action={api}>
            <input type="hidden" name="acao" value="dados" />
            <div className="field"><label>Nome do negócio</label><input name="nome" defaultValue={biz.name} maxLength={80} required /></div>
            <div className="field"><label>Endereço</label><input name="endereco" defaultValue={biz.address} maxLength={160} /></div>
            <div className="g3">
              <div className="field"><label>Abre</label><input name="abre" type="time" defaultValue={hhmm(biz.open_min)} required /></div>
              <div className="field"><label>Fecha</label><input name="fecha" type="time" defaultValue={fecha} required /></div>
              <div className="field"><label>Horários a cada (min)</label><input name="intervalo" inputMode="numeric" defaultValue={biz.step_min} required /></div>
            </div>
            <label>Dias fechado</label>
            <div className="dias">{WD.map((d, i) => <label key={i} className="chk"><input type="checkbox" name="fechado" value={i} defaultChecked={biz.closed_weekdays.includes(i)} /> {d}</label>)}</div>
            {car && <div className="g3">
              <div className="field"><label>Carros ao mesmo tempo</label><input name="boxes" inputMode="numeric" defaultValue={biz.capacity} /></div>
              <div className="field"><label>Leva e traz (R$, 0 = não tem)</label><input name="levaetraz" inputMode="decimal" defaultValue={reais(biz.config.pickupFee || 0)} /></div>
            </div>}
            <div className="field"><label>Cores do site</label>
              <select name="estilo" defaultValue={biz.config.style || "claro"}>
                <option value="noturno">Escuro com dourado</option><option value="agua">Azul</option><option value="claro">Claro com vinho</option>
                <option value="grafite">Papel com preto e laranja</option><option value="turbo">Azul-noite com verde-limão</option>
              </select></div>
            <div className="field"><label>Modelo da página</label>
              <select name="modelo" defaultValue={biz.config.layout || "classico"}>
                <option value="classico">Clássico (aplicativo, uma tela por vez)</option><option value="vitrine">Vitrine (página completa, estilo site)</option>
              </select></div>
            <button className="btn" type="submit">Salvar</button>
          </form>
        </div>

        <div className="card" id="servicos"><h3>{car ? "Lavagens" : "Cortes"}, preços e fotos</h3>
          {services.filter(s => s.kind === "principal").map(s => <Servico key={s.id} s={s} />)}
          <Novo tipo="principal" titulo={car ? "Nova lavagem" : "Novo corte"} />
          <h3 style={{ marginTop: 22 }}>Adicionais</h3>
          {services.filter(s => s.kind === "extra").map(s => <Servico key={s.id} s={s} />)}
          <Novo tipo="extra" titulo="Novo adicional" />
        </div>

        {!car && <div className="card" id="equipe"><h3>Barbeiros</h3>
          {pros.map(p => (
            <form key={p.id} method="post" action={api} className="edit">
              <input type="hidden" name="acao" value="pro-salvar" /><input type="hidden" name="id" value={p.id} />
              <div className="g2"><div className="field"><label>Nome</label><input name="nome" defaultValue={p.name} maxLength={60} required /></div>
                <div className="field"><label>Especialidade</label><input name="info" defaultValue={p.info} maxLength={120} /></div></div>
              <label className="chk"><input type="checkbox" name="ativo" defaultChecked={p.active} /> Atende (aparece para o cliente escolher)</label>
              <div className="acoes"><button className="btn" type="submit">Salvar</button></div>
            </form>))}
          <details className="edit novo"><summary>+ Novo barbeiro</summary>
            <form method="post" action={api}><input type="hidden" name="acao" value="pro-novo" />
              <div className="g2"><div className="field"><label>Nome</label><input name="nome" maxLength={60} required /></div>
                <div className="field"><label>Especialidade</label><input name="info" maxLength={120} /></div></div>
              <button className="btn" type="submit">Criar</button></form>
          </details>
        </div>}

        <div className="card" id="fotos"><h3>Vídeo de abertura</h3>
          {biz.trailer_video ? <video className="prev" src={biz.trailer_video} muted playsInline controls preload="metadata" /> : <p className="hint">Sem vídeo de abertura.</p>}
          <div className="acoes">
            <MediaUpload slug={biz.slug} alvo="trailer" video label={biz.trailer_video ? "Trocar vídeo" : "Colocar vídeo"} />
            {biz.trailer_video && <form method="post" action={api}><input type="hidden" name="acao" value="trailer-tirar" /><button className="mini" type="submit">Tirar vídeo</button></form>}
          </div>
          <h3 style={{ marginTop: 22 }}>Fotos do nosso trabalho</h3>
          <div className="galedit">{(biz.gallery || []).map(g => (
            <div key={g}><img src={g} alt="" loading="lazy" />
              <form method="post" action={api}><input type="hidden" name="acao" value="galeria-tirar" /><input type="hidden" name="url" value={g} /><button className="mini perigo" type="submit">Tirar</button></form></div>))}
          </div>
          <MediaUpload slug={biz.slug} alvo="galeria" label="+ Colocar foto" />
          <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>Foto: JPG ou PNG (o site diminui sozinho). Vídeo: MP4 de até 50 MB, de preferência curto e em pé.</p>
        </div>
      </div>
    </div>
  );
}
