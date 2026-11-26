"use client";
import { useState } from "react";
import BookingFlow from "./BookingFlow";
import Lightbox, { type LbItem } from "./Lightbox";
import type { PublicBusiness, Professional, Service } from "@/lib/types";
import { brl } from "@/lib/pricing";
import { hhmm, WD } from "@/lib/time";

type Props = { biz: PublicBusiness; services: Service[]; professionals: Professional[]; today: string };

const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`);
const iniciais = (n: string) => n.split(" ").filter(w => w.length > 2).slice(-2).map(w => w[0]).join("").toUpperCase();

/** Modelo "Vitrine": página completa estilo site (capa grande, serviços, trabalhos, equipe, onde fica) com o agendamento no fim. */
export default function Vitrine({ biz, services, professionals, today }: Props) {
  const car = biz.kind === "lavarapido";
  const [inicial, setInicial] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);
  const [lb, setLb] = useState<LbItem>(null);
  const principal = services.filter(s => s.kind === "principal");
  const extras = services.filter(s => s.kind === "extra");
  const fecha = biz.close_min >= 1440 ? "00:00" : hhmm(biz.close_min);
  const abertos = WD.map((d, i) => ({ d, i })).filter(x => !biz.closed_weekdays.includes(x.i));
  const fotos = [...(biz.gallery || []), ...principal.map(s => s.image_url).filter((x): x is string => !!x && !(biz.gallery || []).includes(x))].slice(0, 9);
  const capa = biz.trailer_poster || fotos[0] || undefined;
  const menor = principal.length ? Math.min(...principal.map(s => Number(s.price))) : 0;

  const agendar = (id?: string) => {
    if (!car && id) { setInicial(id); setRodada(r => r + 1); }
    document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="vt">
      <nav className="vt-nav">
        <a className="vt-marca" href="#topo"><span className="vt-logo" aria-hidden="true">{iniciais(biz.name)}</span>{biz.name}</a>
        <div className="vt-links"><a href="#servicos">{car ? "Lavagens" : "Serviços"}</a><a href="#trabalhos">Trabalhos</a><a href="#onde">Onde fica</a></div>
        <a className="vt-cta" href="#agendar">Agendar</a>
      </nav>

      <header className="vt-hero" id="topo">
        {biz.trailer_video
          ? <video className="vt-bg" src={biz.trailer_video} poster={capa} autoPlay muted loop playsInline aria-hidden="true" />
          : capa && <img className="vt-bg" src={capa} alt="" />}
        <div className="vt-veu" aria-hidden="true" />
        <div className="vt-hero-in">
          <span className="vt-kicker">{car ? "Lava-rápido · estética automotiva" : "Barbearia · cortes masculinos"}</span>
          <h1>{biz.name}</h1>
          <p>{car ? "Seu carro brilhando sem você perder tempo. Escolha a lavagem, o horário e pronto." : "Corte na hora marcada, sem fila e sem espera. Escolha o estilo e o horário em menos de um minuto."}</p>
          <div className="vt-acoes">
            <button className="btn" type="button" onClick={() => agendar()}>Agendar horário</button>
            <a className="btn ghost" href="#servicos">Ver preços</a>
          </div>
          <ul className="vt-fatos">
            <li><b>{hhmm(biz.open_min)}–{fecha}</b><span>{abertos.length === 7 ? "todos os dias" : `${abertos[0]?.d} a ${abertos[abertos.length - 1]?.d}`}</span></li>
            {!!menor && <li><b>a partir de {brl(menor)}</b><span>preço fechado</span></li>}
            <li><b>{car ? (biz.config.pickupFee ? "Leva e traz" : `${biz.capacity} box${biz.capacity > 1 ? "es" : ""}`) : `${professionals.length || 1} profissiona${(professionals.length || 1) > 1 ? "is" : "l"}`}</b><span>{car ? (biz.config.pickupFee ? `+${brl(biz.config.pickupFee)}` : "ao mesmo tempo") : "na equipe"}</span></li>
          </ul>
        </div>
      </header>

      <section className="vt-sec" id="servicos">
        <div className="vt-titulo"><span className="vt-num">01</span><h2>{car ? "Lavagens" : "Serviços e preços"}</h2>
          <p>{car ? "Preço para carro pequeno (hatch). Sedã, SUV e picape ajustam no agendamento." : "Toque em um corte para já ir para o agendamento com ele escolhido."}</p></div>
        <div className="vt-cards">{principal.map(s => (
          <article className="vt-card" key={s.id}>
            {s.image_url && <button className="vt-foto" type="button" onClick={() => setLb({ type: "img", src: s.image_url!, title: s.name })}><img src={s.image_url} alt={s.name} loading="lazy" /></button>}
            {s.tag && <span className="vt-selo">{s.tag}</span>}
            <div className="vt-card-in">
              <h3>{s.name}</h3>
              {s.info && <p>{s.info}</p>}
              <div className="vt-preco"><b>{brl(Number(s.price))}</b><span>{dur(s.duration_min)}</span></div>
              <div className="vt-card-acoes">
                <button className="btn" type="button" onClick={() => agendar(s.id)}>Agendar</button>
                {s.video_url && <button className="lnk" type="button" onClick={() => setLb({ type: "video", src: s.video_url!, title: s.name })}>▶ Vídeo</button>}
              </div>
            </div>
          </article>))}</div>
        {!!extras.length && <div className="vt-extras"><b>Adicionais:</b>{extras.map(e => <span key={e.id}>{e.name} <i>+{brl(Number(e.price))}</i></span>)}</div>}
      </section>

      {(!!fotos.length || !!biz.config.clips?.length) && (
        <section className="vt-sec vt-escuro" id="trabalhos">
          <div className="vt-titulo"><span className="vt-num">02</span><h2>Nosso trabalho</h2><p>Toque para ampliar.</p></div>
          {!!biz.config.clips?.length && <div className="vt-clips">{biz.config.clips.map(c => (
            <button key={c.src} type="button" className="vt-clip" onClick={() => setLb({ type: "video", src: c.src, title: c.cap })}>
              <video src={c.src} poster={c.poster} autoPlay muted loop playsInline /><span>{c.cap}</span></button>))}</div>}
          <div className="vt-mosaico">{fotos.map((g, i) => (
            <button key={g} type="button" onClick={() => setLb({ type: "img", src: g, title: `Foto ${i + 1}` })}><img src={g} alt={`Trabalho ${i + 1}`} loading="lazy" /></button>))}</div>
        </section>
      )}

      {!car && !!professionals.length && (
        <section className="vt-sec" id="equipe">
          <div className="vt-titulo"><span className="vt-num">03</span><h2>Equipe</h2><p>Escolha com quem cortar na hora de agendar.</p></div>
          <div className="vt-equipe">{professionals.map(p => (
            <div className="vt-pro" key={p.id}><span className="vt-av" aria-hidden="true">{p.name[0]}</span><b>{p.name}</b><small>{p.info}</small></div>))}</div>
        </section>
      )}

      <section className="vt-sec" id="como">
        <div className="vt-titulo"><span className="vt-num">{car || !professionals.length ? "03" : "04"}</span><h2>Como funciona</h2></div>
        <ol className="vt-passos">
          <li><b>Escolha</b><span>{car ? "o tamanho do carro e a lavagem" : "o corte e o profissional"}</span></li>
          <li><b>Marque</b><span>o dia e um horário livre</span></li>
          <li><b>Pronto</b><span>sem cadastro e sem senha, só nome e WhatsApp</span></li>
        </ol>
      </section>

      <section className="vt-agendar" id="agendar">
        <div className="vt-titulo"><span className="vt-num">✓</span><h2>Agende agora</h2><p>Leva menos de um minuto.</p></div>
        <div className="vt-flow">
          <BookingFlow key={rodada} biz={biz} services={services} professionals={professionals} today={today} embutido inicial={inicial} />
        </div>
      </section>

      <footer className="vt-rodape" id="onde">
        <div><h2>{biz.name}</h2><p>{biz.address}</p>
          {biz.address && <a className="lnk" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`} target="_blank" rel="noopener noreferrer">Abrir no mapa ↗</a>}</div>
        <div><h3>Horário</h3><ul>{WD.map((d, i) => <li key={i}><span>{d}</span><span>{biz.closed_weekdays.includes(i) ? "fechado" : `${hhmm(biz.open_min)}–${fecha}`}</span></li>)}</ul></div>
        <a className="vt-dono" href={`/${biz.slug}/painel`}>Área do dono</a>
      </footer>
      <Lightbox item={lb} onClose={() => setLb(null)} />
    </div>
  );
}
