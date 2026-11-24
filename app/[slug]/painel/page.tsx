import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db, getBusiness } from "@/lib/db";
import { checkSession, cookieName, isInitialPassword } from "@/lib/auth";
import { addDays, dateToLocal, hhmm, localToDate, weekdayOf, WD, dateBR } from "@/lib/time";
import { brl } from "@/lib/pricing";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Faltou" };

export default async function Painel({ params, searchParams }: { params: { slug: string }; searchParams: { p?: string; msg?: string } }) {
  const biz = await getBusiness(params.slug);
  if (!biz) notFound();
  if (!checkSession(biz.slug, cookies().get(cookieName(biz.slug))?.value)) redirect(`/${biz.slug}/painel/entrar`);

  const p = ["hoje", "semana", "mes"].includes(searchParams.p || "") ? searchParams.p! : "semana";
  const today = dateToLocal(new Date(), biz.tz_offset).date;
  const from = p === "hoje" ? today : p === "semana" ? addDays(today, -6) : today.slice(0, 8) + "01";
  const tz = biz.tz_offset;
  const rangeStart = localToDate(from < addDays(today, -6) ? from : addDays(today, -6), 0, tz);
  const rangeEnd = localToDate(addDays(today, 8), 0, tz);
  const { data, error } = await db().from("bookings").select("*, professionals(name)").eq("business_id", biz.id)
    .gte("starts_at", rangeStart.toISOString()).lt("starts_at", rangeEnd.toISOString()).order("starts_at");
  if (error) throw error;
  const all = (data || []) as (Booking & { professionals: { name: string } | null })[];
  const loc = (b: Booking) => dateToLocal(new Date(b.starts_at), tz);

  const inPeriod = all.filter(b => { const d = loc(b).date; return d >= from && d <= today && b.status !== "cancelado"; });
  const fat = inPeriod.reduce((a, b) => a + Number(b.total), 0);
  const cost = inPeriod.reduce((a, b) => a + Number(b.cost), 0);
  const done = inPeriod.filter(b => b.status !== "faltou").length;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => ({ d, n: all.filter(b => loc(b).date === d && b.status !== "cancelado").length }));
  const max = Math.max(1, ...last7.map(x => x.n));
  const upcoming = all.filter(b => loc(b).date >= today);
  const counts: Record<string, number> = {};
  inPeriod.forEach(b => b.items.filter(i => i.name !== "Leva e traz").forEach(i => { counts[i.name] = (counts[i.name] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lbl = { hoje: "hoje", semana: "nos últimos 7 dias", mes: "neste mês" }[p];
  const unit = biz.kind === "lavarapido" ? "Carros lavados" : "Atendimentos";
  const msgs: Record<string, string> = { "zap-ok": "WhatsApp salvo.", "zap-erro": "Número inválido. Use DDD + número.", "senha-ok": "Senha trocada.", "senha-erro": "A senha precisa ter pelo menos 6 caracteres." };

  return (
    <div data-style={biz.config.style || undefined} style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="wrap wide">
        <header className="top">
          <div><span className="tag">Área do dono</span><h1>{biz.name}</h1></div>
          <form method="post" action={`/api/${biz.slug}/logout`} style={{ marginLeft: "auto" }}><button className="btn ghost" type="submit">Sair</button></form>
        </header>
        {searchParams.msg && msgs[searchParams.msg] && <div className="notice">{msgs[searchParams.msg]}</div>}
        {!biz.owner_whatsapp && <div className="notice"><b>Cadastre seu WhatsApp</b> lá embaixo para receber cada agendamento na hora.</div>}
        {isInitialPassword(biz.owner_password_hash) && <div className="notice"><b>Troque a senha inicial</b> lá embaixo.</div>}

        <nav className="tabs" aria-label="Período">
          {[["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"]].map(([k, t]) => <a key={k} href={`?p=${k}`} aria-current={p === k ? "page" : undefined}>{t}</a>)}
        </nav>
        <div className="kpis">
          <div className="kpi big"><small>Lucro {lbl}</small><b>{brl(fat - cost)}</b></div>
          <div className="kpi"><small>Faturamento</small><b>{brl(fat)}</b></div>
          <div className="kpi"><small>Custo de produtos</small><b>{brl(cost)}</b></div>
          <div className="kpi"><small>{unit}</small><b>{done}</b></div>
        </div>

        <div className="card"><h3>Agendamentos por dia</h3>
          <div className="bars">{last7.map(x => <div key={x.d}><b>{x.n}</b><i style={{ height: `${Math.round((x.n / max) * 90)}%` }} />{WD[weekdayOf(x.d)]}</div>)}</div></div>

        <div className="card"><h3>Agenda de hoje e próximos dias</h3>
          {!upcoming.length && <p className="hint" style={{ margin: 0 }}>Nenhum agendamento ainda. Envie o link <b>/{biz.slug}</b> para seus clientes.</p>}
          {upcoming.map(b => { const l = loc(b); return (
            <div className="appt" key={b.id}>
              <span className="t">{hhmm(l.minutes)}<small>{l.date === today ? "hoje" : dateBR(l.date)}</small></span>
              <span>{b.client_name} <span className={`chip ${b.status}`}>{STATUS[b.status]}</span>
                <small>{b.items.map(i => i.name).join(" + ")}{b.professionals ? ` · ${b.professionals.name}` : ""}{b.plate ? ` · ${b.plate}` : ""}{b.pickup_address ? ` · buscar: ${b.pickup_address}` : ""}</small>
                <small>+{b.client_phone} · {b.client_email}</small>
                {b.status === "confirmado" && <span>{[["concluido", "Concluir"], ["faltou", "Faltou"], ["cancelado", "Cancelar"]].map(([s, t]) => (
                  <form key={s} method="post" action={`/api/${biz.slug}/admin`}><input type="hidden" name="acao" value="status" /><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="p" value={p} /><button className="mini" type="submit">{t}</button></form>))}</span>}
              </span>
              <span className="price">{brl(Number(b.total))}</span>
            </div>); })}
        </div>

        <div className="card"><h3>Mais pedidos {lbl}</h3>
          {top.length ? <div className="rank">{top.flatMap(([n, c]) => [<span key={n}>{n}</span>, <b key={n + "#"}>{c}</b>])}</div> : <p className="hint" style={{ margin: 0 }}>Ainda sem dados.</p>}</div>

        <div className="card"><h3>Configurações</h3>
          <form method="post" action={`/api/${biz.slug}/admin`} className="row2" style={{ marginBottom: 14 }}>
            <input type="hidden" name="acao" value="whatsapp" />
            <div className="field"><label htmlFor="numero">WhatsApp que recebe os avisos</label><input id="numero" name="numero" inputMode="tel" defaultValue={biz.owner_whatsapp ? `+${biz.owner_whatsapp}` : ""} placeholder="(11) 98765-4321" /></div>
            <button className="btn" type="submit">Salvar</button>
          </form>
          <form method="post" action={`/api/${biz.slug}/admin`} className="row2">
            <input type="hidden" name="acao" value="senha" />
            <div className="field"><label htmlFor="nova">Nova senha do painel</label><input id="nova" name="nova" type="password" autoComplete="new-password" minLength={6} /></div>
            <button className="btn ghost" type="submit">Trocar</button>
          </form>
          <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>Link para seus clientes: <b>/{biz.slug}</b> no endereço do site.</p>
        </div>
      </div>
    </div>
  );
}
