import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, getBusiness } from "@/lib/db";
import { checkSession, cookieName } from "@/lib/auth";
import { sameOrigin, hit } from "@/lib/ratelimit";
import { minutos } from "@/lib/novoCliente";
import { apagarArquivo, enderecoPublico, linkDeEnvio } from "@/lib/media";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTILOS = ["noturno", "agua", "claro", "grafite", "turbo"];
const MODELOS = ["classico", "vitrine"];
class Erro extends Error {}

const txt = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
function numero(v: unknown, nome: string, min: number, max: number) {
  const n = Number(String(v ?? "").replace(/\s|R\$/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new Erro(`${nome}: valor inválido`);
  return Math.round(n * 100) / 100;
}
function hora(v: unknown, nome: string) {
  try { return minutos(String(v || ""), nome); } catch { throw new Erro(`${nome}: use o formato 09:00`); }
}
async function servicoDoNegocio(biz: Business, id: string) {
  if (!UUID.test(id)) throw new Erro("Serviço não encontrado.");
  const { data } = await db().from("services").select("id,image_url,video_url").eq("id", id).eq("business_id", biz.id).maybeSingle();
  if (!data) throw new Erro("Serviço não encontrado.");
  return data as { id: string; image_url: string | null; video_url: string | null };
}
function camposServico(f: FormData) {
  const nome = txt(f.get("nome"), 80);
  if (!nome) throw new Erro("Coloque o nome do serviço.");
  return {
    name: nome, info: txt(f.get("info"), 160), tag: txt(f.get("destaque"), 30) || null,
    price: numero(f.get("preco"), "Preço", 0, 100000), cost: numero(f.get("custo") || 0, "Custo", 0, 100000),
    duration_min: Math.round(numero(f.get("minutos"), "Tempo", 5, 720)),
  };
}

async function sessao(slug: string) {
  const biz = await getBusiness(slug);
  if (!biz || !checkSession(biz.slug, biz.owner_password_hash, (await cookies()).get(cookieName(slug))?.value)) return null;
  return biz;
}

// Edição do site pelo próprio dono: dados, horários, serviços, preços, profissionais, fotos e vídeos.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return new Response("proibido", { status: 403 });
  const biz = await sessao(slug);
  const json = (req.headers.get("content-type") || "").includes("application/json");
  if (!biz) return json ? NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 })
    : NextResponse.redirect(new URL(`/${slug}/painel/entrar`, req.url), 303);

  // Envio de foto ou vídeo (o navegador manda o arquivo direto para o Storage).
  if (json) {
    try {
      const b = await req.json();
      if (b.acao === "envio") {
        if (!(await hit(`envio:${biz.slug}`, 60, 3600))) throw new Erro("Muitos envios. Espere um pouco.");
        const r = await linkDeEnvio(biz.slug, String(b.tipo || ""), Number(b.tamanho));
        if ("erro" in r) throw new Erro(r.erro);
        return NextResponse.json(r);
      }
      if (b.acao === "confirmar") {
        const url = enderecoPublico(biz.slug, String(b.path || ""));
        if (!url) throw new Erro("Arquivo inválido.");
        const video = /\.(mp4|webm|mov)$/.test(url);
        const alvo = String(b.alvo || "");
        if (alvo === "servico-foto" || alvo === "servico-video") {
          if (video !== (alvo === "servico-video")) throw new Erro(video ? "Escolha uma foto." : "Escolha um vídeo.");
          const s = await servicoDoNegocio(biz, String(b.id || ""));
          const campo = alvo === "servico-foto" ? "image_url" : "video_url";
          await db().from("services").update({ [campo]: url }).eq("id", s.id);
          await apagarArquivo(biz.slug, s[campo]);
        } else if (alvo === "trailer") {
          if (!video) throw new Erro("Escolha um vídeo.");
          await db().from("businesses").update({ trailer_video: url, trailer_poster: null }).eq("id", biz.id);
          await apagarArquivo(biz.slug, biz.trailer_video);
        } else if (alvo === "galeria") {
          if (video) throw new Erro("Escolha uma foto.");
          if ((biz.gallery || []).length >= 30) throw new Erro("A galeria já tem 30 fotos. Tire alguma antes.");
          await db().from("businesses").update({ gallery: [...(biz.gallery || []), url] }).eq("id", biz.id);
        } else throw new Erro("Destino inválido.");
        return NextResponse.json({ ok: true });
      }
      throw new Erro("Ação inválida.");
    } catch (e) {
      if (e instanceof Erro) return NextResponse.json({ erro: e.message }, { status: 400 });
      console.error("[site] envio", e);
      return NextResponse.json({ erro: "Não deu certo agora. Tente de novo." }, { status: 500 });
    }
  }

  const f = await req.formData();
  const acao = String(f.get("acao") || "");
  let msg = "salvo", ancora = "";
  try {
    if (acao === "dados") {
      const nome = txt(f.get("nome"), 80);
      if (!nome) throw new Erro("Coloque o nome do negócio.");
      const abre = hora(f.get("abre"), "Abre"), fecha = hora(f.get("fecha") === "00:00" ? "24:00" : f.get("fecha"), "Fecha");
      if (fecha <= abre) throw new Erro("O horário de fechar precisa ser depois do de abrir.");
      const fechado = f.getAll("fechado").map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
      const estilo = String(f.get("estilo") || "");
      const modelo = String(f.get("modelo") || "");
      const config = { ...biz.config, style: ESTILOS.includes(estilo) ? estilo : biz.config.style, layout: MODELOS.includes(modelo) ? modelo : biz.config.layout };
      const up: Record<string, unknown> = {
        name: nome, address: txt(f.get("endereco"), 160), open_min: abre, close_min: fecha,
        step_min: Math.round(numero(f.get("intervalo"), "Intervalo", 5, 240)), closed_weekdays: [...new Set(fechado)].sort(), config,
      };
      if (biz.kind === "lavarapido") {
        up.capacity = Math.round(numero(f.get("boxes"), "Carros ao mesmo tempo", 1, 50));
        config.pickupFee = numero(f.get("levaetraz") || 0, "Leva e traz", 0, 10000);
      }
      await db().from("businesses").update(up).eq("id", biz.id);
      ancora = "dados";
    } else if (acao === "servico-salvar") {
      const s = await servicoDoNegocio(biz, String(f.get("id")));
      await db().from("services").update({ ...camposServico(f), active: f.get("ativo") === "on" }).eq("id", s.id);
      ancora = `s-${s.id}`;
    } else if (acao === "servico-novo") {
      const kind = f.get("tipo") === "extra" ? "extra" : "principal";
      const { count } = await db().from("services").select("id", { count: "exact", head: true }).eq("business_id", biz.id);
      if ((count || 0) >= 80) throw new Erro("Limite de 80 serviços.");
      const { data } = await db().from("services").insert({ business_id: biz.id, kind, ...camposServico(f), sort: (count || 0) + 1 }).select("id").single();
      ancora = data ? `s-${data.id}` : "servicos"; msg = "criado";
    } else if (acao === "servico-apagar") {
      const s = await servicoDoNegocio(biz, String(f.get("id")));
      await db().from("services").delete().eq("id", s.id);
      await Promise.all([apagarArquivo(biz.slug, s.image_url), apagarArquivo(biz.slug, s.video_url)]);
      ancora = "servicos"; msg = "apagado";
    } else if (acao === "servico-tirar-foto" || acao === "servico-tirar-video") {
      const s = await servicoDoNegocio(biz, String(f.get("id")));
      const campo = acao === "servico-tirar-foto" ? "image_url" : "video_url";
      await db().from("services").update({ [campo]: null }).eq("id", s.id);
      await apagarArquivo(biz.slug, s[campo]);
      ancora = `s-${s.id}`;
    } else if (acao === "pro-novo" || acao === "pro-salvar") {
      const nome = txt(f.get("nome"), 60);
      if (!nome) throw new Erro("Coloque o nome.");
      const campos = { name: nome, info: txt(f.get("info"), 120) };
      if (acao === "pro-novo") await db().from("professionals").insert({ business_id: biz.id, ...campos, sort: 99 });
      else {
        const id = String(f.get("id"));
        if (!UUID.test(id)) throw new Erro("Profissional não encontrado.");
        await db().from("professionals").update({ ...campos, active: f.get("ativo") === "on" }).eq("id", id).eq("business_id", biz.id);
      }
      ancora = "equipe";
    } else if (acao === "trailer-tirar") {
      await db().from("businesses").update({ trailer_video: null, trailer_poster: null }).eq("id", biz.id);
      await apagarArquivo(biz.slug, biz.trailer_video);
      ancora = "fotos";
    } else if (acao === "galeria-tirar") {
      const url = String(f.get("url") || "");
      if ((biz.gallery || []).includes(url)) {
        await db().from("businesses").update({ gallery: biz.gallery.filter(g => g !== url) }).eq("id", biz.id);
        await apagarArquivo(biz.slug, url);
      }
      ancora = "fotos";
    } else throw new Erro("Ação inválida.");
  } catch (e) {
    if (!(e instanceof Erro)) { console.error("[site]", e); msg = "Não deu certo agora. Tente de novo."; } else msg = e.message;
  }
  const back = new URL(`/${slug}/painel/site`, req.url);
  if (ancora) back.hash = ancora;
  const res = NextResponse.redirect(back, 303);
  // O aviso vai num cookie de poucos segundos, para ninguém montar um link com texto falso.
  res.cookies.set(`aviso_${slug}`, encodeURIComponent(msg), { httpOnly: true, secure: true, sameSite: "lax", path: `/${slug}/painel`, maxAge: 15 });
  return res;
}
