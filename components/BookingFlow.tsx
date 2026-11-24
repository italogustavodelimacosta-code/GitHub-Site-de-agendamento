"use client";
import CutMorph from "./CutMorph";
import { useEffect, useMemo, useState } from "react";
import type { PublicBusiness, Professional, Service, Size } from "@/lib/types";
import { quote, brl, priceOf } from "@/lib/pricing";
import { addDays, dateBR, hhmm, weekdayOf, WD } from "@/lib/time";
import { okEmail } from "@/lib/phone";
import Lightbox, { type LbItem } from "./Lightbox";

type Props = { biz: PublicBusiness; services: Service[]; professionals: Professional[]; today: string };
type Done = { total: number; what: string; when: string; at: string };

const fmtPhone = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  return n.length > 6 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length > 2 ? `(${n.slice(0, 2)}) ${n.slice(2)}` : n;
};
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`);

export default function BookingFlow({ biz, services, professionals, today }: Props) {
  const car = biz.kind === "lavarapido";
  const STEPS = car ? ["carro", "servico", "retirada", "quando", "dados"] : ["servico", "pro", "quando", "dados"];
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [pro, setPro] = useState<string | null>(professionals.length ? null : "none");
  const [size, setSize] = useState<Size | null>(null);
  const [plate, setPlate] = useState("");
  const [pickup, setPickup] = useState(false);
  const [addr, setAddr] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState<number | null>(null);
  const [slots, setSlots] = useState<{ time: number; free: number }[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState<Done | null>(null);
  const [lb, setLb] = useState<LbItem>(null);

  const chosen = services.filter(s => sel.includes(s.id));
  const q = quote(chosen, size, pickup ? biz.config.pickupFee || 0 : 0);
  const principal = services.filter(s => s.kind === "principal"), extras = services.filter(s => s.kind === "extra");
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const cur = STEPS[step];

  useEffect(() => {
    if (cur !== "quando" || !q.duration) return;
    setSlots(null);
    const p = pro && pro !== "none" ? `&pro=${pro}` : "";
    fetch(`/api/${biz.slug}/slots?date=${date}&duration=${q.duration}${p}`).then(r => r.json())
      .then(d => { setSlots(d.slots || []); setClosed(!!d.closed); })
      .catch(() => { setSlots([]); setError("Não foi possível carregar os horários."); });
  }, [cur, date, pro, q.duration, biz.slug]);

  const pickPrincipal = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s.filter(x => services.find(y => y.id === x)?.kind !== "principal"), id]));
  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const can = (() => {
    switch (cur) {
      case "carro": return !!size;
      case "servico": return chosen.some(s => s.kind === "principal");
      case "pro": return !!pro;
      case "retirada": return !pickup || addr.trim().length > 5;
      case "quando": return time !== null;
      case "dados": return name.trim().length >= 3 && phone.replace(/\D/g, "").length >= 10 && okEmail(email);
    }
    return false;
  })();

  async function submit() {
    setSending(true); setError("");
    try {
      const r = await fetch(`/api/${biz.slug}/bookings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, serviceIds: sel, professionalId: pro && pro !== "any" && pro !== "none" ? pro : null, name, phone, email, vehicleSize: size?.id, plate, pickup, pickupAddress: addr }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Não deu para agendar."); if (r.status === 409) { setTime(null); setStep(STEPS.indexOf("quando")); } return; }
      setDone(d); window.scrollTo(0, 0);
    } catch { setError("Sem conexão. Tente de novo."); } finally { setSending(false); }
  }
  const next = () => { if (!can) return; if (cur === "dados") submit(); else { setStep(step + 1); setError(""); window.scrollTo(0, 0); } };

  const header = (
    <header className="top">
      <div className="logo" aria-hidden="true">{biz.name.split(" ").filter(w => w.length > 2).slice(-2).map(w => w[0]).join("").toUpperCase()}</div>
      <div><h1>{biz.name}</h1><div className="sub">{biz.address} · {hhmm(biz.open_min)} às {biz.close_min >= 1440 ? "00:00" : hhmm(biz.close_min)}</div></div>
      <a className="own" href={`/${biz.slug}/painel`}>Área do dono</a>
    </header>
  );

  if (done) return (
    <div className="wrap">
      {header}
      <div className="done"><div className="check" aria-hidden="true">✓</div>
        <h2>Horário marcado, {name.split(" ")[0]}!</h2>
        <p className="hint">{done.what}<br />{done.when} às {done.at} · {brl(done.total)}</p></div>
      <div className="summary"><b>Você vai receber a confirmação no WhatsApp.</b><span className="sub">Meia hora antes, mandamos um lembrete. Para remarcar ou cancelar, responda a mensagem.</span></div>
      <button className="btn ghost block" type="button" onClick={() => { setDone(null); setStep(0); setSel([]); setTime(null); }}>Fazer outro agendamento</button>
    </div>
  );

  return (
    <div className="wrap">
      {header}
      <div className="steps" aria-hidden="true">{STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} />)}</div>

      {step === 0 && (
        <>
          {biz.kind === "barbearia" && (() => {
            const looks = principal.filter(s => s.image_url);
            return <CutMorph looks={looks.map(s => ({ img: s.image_url!, name: s.name, price: Number(s.price) }))}
              onPick={k => { if (!sel.includes(looks[k].id)) pickPrincipal(looks[k].id); document.querySelector(".list")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />;
          })()}
          {biz.trailer_video && (
            <section className="media" aria-label="Vídeo">
              <video src={biz.trailer_video} poster={biz.trailer_poster || undefined} autoPlay muted loop playsInline />
              <span className="cap">Veja o trabalho antes de agendar</span>
              <button className="zoom" type="button" onClick={() => setLb({ type: "video", src: biz.trailer_video!, title: biz.name })}>Tela cheia ⤢</button>
            </section>
          )}
          {!!biz.config.clips?.length && (
            <div className="reel">{biz.config.clips.map(c => (
              <div className="clip" key={c.src}><video src={c.src} poster={c.poster} autoPlay muted loop playsInline /><span className="cap">{c.cap}</span>
                <button className="zoom" type="button" onClick={() => setLb({ type: "video", src: c.src, title: c.cap })}>⤢</button></div>))}</div>
          )}
          {!!biz.gallery?.length && (<><span className="tag">Nosso trabalho · toque para ampliar</span>
            <div className="gal">{biz.gallery.map((g, i) => <button key={g} type="button" onClick={() => setLb({ type: "img", src: g, title: `Foto ${i + 1}` })}><img src={g} alt={`Foto ${i + 1} do nosso trabalho`} loading="lazy" /></button>)}</div></>)}
        </>
      )}

      {cur === "carro" && biz.config.sizes && (<>
        <h2>Qual é o seu carro?</h2><p className="hint">O preço e o tempo se ajustam ao tamanho do veículo.</p>
        <div className="grid2">{biz.config.sizes.map(s => (
          <button key={s.id} className="opt col" type="button" aria-pressed={size?.id === s.id} onClick={() => setSize(s)}><b>{s.name}</b><small>{s.ex}</small></button>))}</div>
        <div className="field" style={{ marginTop: 16 }}><label htmlFor="placa">Placa (opcional)</label>
          <input id="placa" value={plate} maxLength={7} placeholder="ABC1D23" onChange={e => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></div>
      </>)}

      {cur === "servico" && (<>
        <h2>{car ? "Escolha a lavagem" : "Escolha o seu corte"}</h2>
        <p className="hint">{car && size ? `Preços para ${size.name}. ` : ""}Preço fechado, sem "a partir de".</p>
        {car ? (
          <div className="list">{principal.map(s => (
            <button key={s.id} className="opt" type="button" aria-pressed={sel.includes(s.id)} onClick={() => pickPrincipal(s.id)}>
              {s.image_url && <img className="thumb" src={s.image_url} alt="" />}
              <div className="grow"><b>{s.name}</b><small>{[s.info, dur(s.duration_min), s.tag].filter(Boolean).join(" · ")}</small></div>
              <span className="price">{brl(priceOf(s, size))}</span></button>))}</div>
        ) : (
          <div className="cuts">{principal.map(s => (
            <div key={s.id} className={`cut ${sel.includes(s.id) ? "sel" : ""}`}>
              <button className="pick" type="button" aria-pressed={sel.includes(s.id)} onClick={() => pickPrincipal(s.id)}>
                {s.image_url && <img src={s.image_url} alt={s.name} loading="lazy" />}
                <span className="cn">{s.name}</span><span className="cp">{brl(Number(s.price))} · {s.duration_min} min{s.tag ? ` · ${s.tag}` : ""}</span>
              </button>
              <div className="links">
                {s.image_url && <button className="lnk" type="button" onClick={() => setLb({ type: "img", src: s.image_url!, title: s.name })}>⤢ Ampliar foto</button>}
                {s.video_url && <button className="lnk" type="button" onClick={() => setLb({ type: "video", src: s.video_url!, title: s.name })}>▶ Ver vídeo</button>}
              </div>
            </div>))}</div>
        )}
        {!!extras.length && (<><h3>Quer adicionar?</h3>
          <div className="list">{extras.map(s => (
            <button key={s.id} className="opt" type="button" aria-pressed={sel.includes(s.id)} onClick={() => toggle(s.id)}>
              <div className="grow"><b>{s.name}</b><small>+{dur(s.duration_min)}</small></div><span className="price">+{brl(priceOf(s, size))}</span></button>))}</div></>)}
      </>)}

      {cur === "pro" && (<>
        <h2>Com quem?</h2><p className="hint">Escolha um profissional ou deixe o sistema escolher.</p>
        <div className="list">
          <button className="opt" type="button" aria-pressed={pro === "any"} onClick={() => { setPro("any"); setTime(null); }}>
            <div className="avatar" aria-hidden="true">?</div><div className="grow"><b>Qualquer um disponível</b><small>Mostra mais horários</small></div></button>
          {professionals.map(p => (
            <button key={p.id} className="opt" type="button" aria-pressed={pro === p.id} onClick={() => { setPro(p.id); setTime(null); }}>
              <div className="avatar" aria-hidden="true">{p.name[0]}</div><div className="grow"><b>{p.name}</b><small>{p.info}</small></div></button>))}
        </div>
      </>)}

      {cur === "retirada" && (<>
        <h2>Como o carro chega?</h2><p className="hint">Você não precisa ficar esperando.</p>
        <div className="list">
          <button className="opt" type="button" aria-pressed={!pickup} onClick={() => setPickup(false)}><div className="grow"><b>Eu levo e busco</b><small>Avisamos quando estiver pronto</small></div><span className="price">Grátis</span></button>
          {!!biz.config.pickupFee && <button className="opt" type="button" aria-pressed={pickup} onClick={() => setPickup(true)}><div className="grow"><b>Leva e traz</b><small>Buscamos e devolvemos</small></div><span className="price">+{brl(biz.config.pickupFee)}</span></button>}
        </div>
        {pickup && <div className="field" style={{ marginTop: 16 }}><label htmlFor="end">Endereço para buscar</label><input id="end" value={addr} autoComplete="street-address" placeholder="Rua, número e bairro" onChange={e => setAddr(e.target.value)} /></div>}
      </>)}

      {cur === "quando" && (<>
        <h2>Quando?</h2><p className="hint">Serviço de {dur(q.duration)}. Só aparecem os horários livres.</p>
        <div className="days" role="group" aria-label="Dia">{days.map((d, i) => (
          <button key={d} className="day" type="button" aria-pressed={date === d} onClick={() => { setDate(d); setTime(null); }}>
            <small>{i === 0 ? "hoje" : WD[weekdayOf(d)]}</small><b>{Number(d.slice(8))}</b></button>))}</div>
        {slots === null ? <p className="hint">Carregando horários…</p>
          : closed ? <div className="empty"><b>Fechado neste dia.</b><p className="hint" style={{ margin: 0 }}>Escolha outro dia.</p></div>
          : !slots.length ? <div className="empty"><b>Sem horários livres neste dia.</b><p className="hint" style={{ margin: 0 }}>Escolha outro dia.</p></div>
          : <div className="slots">{slots.map(s => (
              <button key={s.time} className="slot" type="button" aria-pressed={time === s.time} onClick={() => setTime(s.time)}>
                {hhmm(s.time)}{car && <small>{s.free === 1 ? "última vaga" : `${s.free} vagas`}</small>}</button>))}</div>}
      </>)}

      {cur === "dados" && (<>
        <h2>Seus dados</h2><p className="hint">Sem cadastro e sem senha. A confirmação chega no seu WhatsApp.</p>
        <div className="summary">
          {q.items.map(i => <div className="row" key={i.name}><span>{i.name}</span><span>{brl(i.price)}</span></div>)}
          <div className="row"><span>Quando</span><span>{dateBR(date)} às {time !== null ? hhmm(time) : ""}</span></div>
          <div className="row total"><span>Total</span><span>{brl(q.total)}</span></div>
        </div>
        <form onSubmit={e => { e.preventDefault(); next(); }} noValidate>
          <div className="field"><label htmlFor="nome">Nome completo</label><input id="nome" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome e sobrenome" /></div>
          <div className="field"><label htmlFor="fone">WhatsApp</label><input id="fone" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="(11) 98765-4321" /></div>
          <div className="field"><label htmlFor="mail">E-mail</label><input id="mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seunome@gmail.com" />
            {email && !okEmail(email) && <div className="err">Confira o e-mail. Exemplo: seunome@gmail.com</div>}</div>
        </form>
      </>)}

      {error && <p className="err" role="alert">{error}</p>}

      <div className="bar"><div className="in">
        <div className="total">{chosen.length ? <>{dur(q.duration)}<b>{brl(q.total)}</b></> : car && size ? `${size.name} escolhido` : car ? "Escolha o carro" : "Escolha um serviço"}</div>
        {step > 0 && <button className="btn ghost" type="button" onClick={() => { setStep(step - 1); setError(""); }}>Voltar</button>}
        <button className="btn" type="button" disabled={!can || sending} onClick={next}>{cur === "dados" ? (sending ? "Marcando…" : "Marcar horário") : "Continuar"}</button>
      </div></div>
      <Lightbox item={lb} onClose={() => setLb(null)} />
    </div>
  );
}
