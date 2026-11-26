"use client";
import { useRef, useState } from "react";

/** Botão de enviar foto ou vídeo pelo painel. Reduz a foto no celular e envia direto para o Storage. */
export default function MediaUpload({ slug, alvo, id, label, video }: { slug: string; alvo: string; id?: string; label: string; video?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [st, setSt] = useState("");

  async function reduzir(f: File): Promise<Blob> {
    if (!f.type.startsWith("image/") || f.type === "image/gif") return f;
    try {
      const img = await createImageBitmap(f);
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      return await new Promise<Blob>((ok) => c.toBlob(b => ok(b || f), "image/jpeg", 0.85));
    } catch { return f; }
  }

  async function enviar(f: File) {
    try {
      setSt("Enviando…");
      const blob = await reduzir(f);
      const tipo = blob.type || f.type;
      const api = `/api/${slug}/site`;
      const r1 = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "envio", tipo, tamanho: blob.size }) });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.erro || "Não deu para enviar.");
      const r2 = await fetch(j1.signedUrl, { method: "PUT", headers: { "Content-Type": tipo, "x-upsert": "false", "cache-control": "max-age=31536000" }, body: blob });
      if (!r2.ok) throw new Error("O envio do arquivo falhou. Tente de novo.");
      const r3 = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "confirmar", alvo, id, path: j1.path }) });
      const j3 = await r3.json();
      if (!r3.ok) throw new Error(j3.erro || "Não deu para salvar.");
      setSt("Pronto!");
      location.reload();
    } catch (e) { setSt((e as Error).message); }
    if (ref.current) ref.current.value = "";
  }

  return (
    <span className="up">
      <button className="mini" type="button" onClick={() => ref.current?.click()}>{label}</button>
      <input ref={ref} type="file" hidden accept={video ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"}
        onChange={e => { const f = e.target.files?.[0]; if (f) enviar(f); }} />
      {st && <small aria-live="polite">{st}</small>}
    </span>
  );
}
