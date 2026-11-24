"use client";
import { useEffect } from "react";

export type LbItem = { type: "img" | "video"; src: string; title: string } | null;

export default function Lightbox({ item, onClose }: { item: LbItem; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [item, onClose]);
  if (!item) return null;
  return (
    <div className="lb" role="dialog" aria-label={item.title} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lbtop"><span>{item.title}</span><button className="lbx" type="button" onClick={onClose} autoFocus>Fechar ✕</button></div>
      <div className="lbmid" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        {item.type === "img" ? <img src={item.src} alt={item.title} /> : <video src={item.src} autoPlay loop playsInline controls muted />}
      </div>
    </div>
  );
}
