"use client";
import { useEffect, useState } from "react";

type Look = { img: string; name: string; price: number };

/** Abertura da barbearia: o mesmo quadro troca de corte em sequência, como nos vídeos de "antes e depois". */
export default function CutMorph({ looks, onPick }: { looks: Look[]; onPick?: (i: number) => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || looks.length < 2) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => setI(x => (x + 1) % looks.length), reduce ? 3500 : 1700);
    return () => clearInterval(t);
  }, [paused, looks.length]);
  if (!looks.length) return null;
  const cur = looks[i];
  return (
    <section className="morph" aria-label="Cortes da casa" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      {looks.map((l, k) => (
        <img key={l.img} src={l.img} alt={k === i ? l.name : ""} aria-hidden={k !== i} className={k === i ? "on" : ""} loading={k < 2 ? "eager" : "lazy"} />
      ))}
      <div className="flash" key={i} aria-hidden="true" />
      <span className="cap">Qual vai ser o seu?</span>
      <button className="label" type="button" onClick={() => onPick?.(i)}>
        <b>{cur.name}</b><span>R$ {cur.price.toFixed(2).replace(".", ",")} · escolher</span>
      </button>
      <div className="dots" aria-hidden="true">{looks.map((l, k) => <span key={l.img} className={k === i ? "on" : ""} />)}</div>
    </section>
  );
}
