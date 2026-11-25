// Gera o SQL que cadastra um cliente novo (um negócio novo) no mesmo site e no mesmo banco.
// Cada cliente ganha o próprio link: https://SEU-SITE/<link>, com painel próprio em /<link>/painel.
import { randomBytes } from "node:crypto";
import { hashPassword, passwordProblem } from "./auth.ts";
import { toWhatsApp, okEmail } from "./phone.ts";

export type Ficha = {
  link: string;                       // parte do endereço: só letras minúsculas, números e hífen
  tipo: "barbearia" | "lavarapido";
  nome: string;
  endereco?: string;
  abre: string;                       // "09:00"
  fecha: string;                      // "20:00" ou "24:00"
  intervalo?: number;                 // minutos entre um horário e outro (padrão 30)
  fechado?: string[];                 // ["domingo", "segunda"]
  whatsapp?: string;                  // WhatsApp do dono
  email?: string;                     // e-mail que recebe o aviso de cada agendamento
  senha?: string;                     // senha do painel; em branco = o sistema cria uma
  estilo?: "noturno" | "agua" | "claro";
  boxes?: number;                     // lava-rápido: carros ao mesmo tempo
  levaETraz?: number;                 // lava-rápido: taxa do leva e traz (0 = não oferece)
  profissionais?: { nome: string; info?: string }[];
  servicos: Servico[];
  extras?: Servico[];
  fotos?: string[];                   // galeria (lava-rápido)
  video?: string;                     // vídeo de abertura
};
type Servico = { nome: string; preco: number; custo?: number; minutos: number; info?: string; foto?: string; video?: string; destaque?: string };

const DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const RESERVADOS = ["api", "painel", "_next", "media", "favicon.ico", "robots.txt", "barbearia", "lavarapido"];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const q = (v: string | null | undefined) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const txt = (v: string | null | undefined) => `'${String(v ?? "").replace(/'/g, "''")}'`;
const num = (v: unknown, nome: string) => { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error(`${nome}: número inválido`); return n; };
function minutos(h: string, nome: string) {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(h).trim().replace(/h$/i, ""));
  if (!m) throw new Error(`${nome}: use o formato 09:00`);
  const t = Number(m[1]) * 60 + Number(m[2] || 0);
  if (t > 1440) throw new Error(`${nome}: horário inválido`);
  return t;
}
const SIZES = [
  { id: "hatch", name: "Hatch", ex: "Onix, HB20, Gol", k: 1 }, { id: "sedan", name: "Sedã", ex: "Corolla, Virtus, Cruze", k: 1.15 },
  { id: "suv", name: "SUV", ex: "Compass, Creta, T-Cross", k: 1.35 }, { id: "picape", name: "Picape", ex: "Hilux, Strada, Toro", k: 1.5 },
];

export function gerarSenha() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), b => abc[b % abc.length]).join("");
}

export function sqlNovoCliente(f: Ficha): { sql: string; senha: string; link: string } {
  const link = semAcento(f.link || "").replace(/[^a-z0-9-]/g, "");
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(link)) throw new Error("link: use de 3 a 40 letras minúsculas, números ou hífen (ex.: barbeariadojoao)");
  if (RESERVADOS.includes(link)) throw new Error(`link: "${link}" já é usado pelo sistema, escolha outro`);
  if (f.tipo !== "barbearia" && f.tipo !== "lavarapido") throw new Error('tipo: use "barbearia" ou "lavarapido"');
  if (!f.nome?.trim()) throw new Error("nome: obrigatório");
  const abre = minutos(f.abre, "abre"), fecha = minutos(f.fecha === "00:00" ? "24:00" : f.fecha, "fecha");
  if (fecha <= abre) throw new Error("fecha: precisa ser depois de abre");
  const fechado = (f.fechado || []).map(d => { const i = DIAS.indexOf(semAcento(d).replace("-feira", "")); if (i < 0) throw new Error(`fechado: dia "${d}" não existe`); return i; });
  const zap = f.whatsapp ? toWhatsApp(f.whatsapp) : "";
  if (zap === null) throw new Error("whatsapp: número inválido, use DDD + número");
  if (f.email && !okEmail(f.email)) throw new Error("email: endereço inválido");
  const senha = f.senha || gerarSenha();
  const prob = passwordProblem(senha);
  if (prob) throw new Error(`senha: ${prob} (mínimo 8 caracteres e não pode ser óbvia)`);
  if (!f.servicos?.length) throw new Error("servicos: coloque pelo menos um serviço");
  const car = f.tipo === "lavarapido";
  const config: Record<string, unknown> = { style: f.estilo || (car ? "agua" : "noturno"), cliente: true };
  if (f.email) config.aviso_email = f.email.trim();
  if (car) { config.sizes = SIZES; config.pickupFee = f.levaETraz ? num(f.levaETraz, "levaETraz") : 0; }
  const intervalo = f.intervalo ? num(f.intervalo, "intervalo") : car ? 60 : 30;
  const capacidade = car ? Math.max(1, Math.round(num(f.boxes || 1, "boxes"))) : 1;

  const linhaServico = (s: Servico, kind: "principal" | "extra", i: number) => {
    if (!s.nome?.trim()) throw new Error("serviço sem nome");
    return `('${kind}',${q(s.nome.trim())},${txt(s.info)},${num(s.preco, `${s.nome} preço`)},${num(s.custo || 0, `${s.nome} custo`)},${Math.max(5, Math.round(num(s.minutos, `${s.nome} minutos`)))},${q(s.foto)},${q(s.video)},${q(s.destaque)},${i + 1})`;
  };
  const servicos = [...f.servicos.map((s, i) => linhaServico(s, "principal", i)), ...(f.extras || []).map((s, i) => linhaServico(s, "extra", f.servicos.length + i))];
  const pros = (f.profissionais || []).filter(p => p.nome?.trim());
  const arr = (xs: string[]) => `array[${xs.map(q).join(",")}]::text[]`;

  const sql = `-- Cliente novo: ${f.nome.replace(/\n/g, " ")} (link /${link})
-- Cole tudo no Supabase > SQL Editor e clique em Run. Se o link já existir, nada é criado.
with b as (
  insert into businesses (slug, kind, name, address, open_min, close_min, step_min, capacity, closed_weekdays, owner_whatsapp, owner_password_hash, trailer_video, gallery, config)
  values (${q(link)}, '${f.tipo}', ${q(f.nome.trim())}, ${txt(f.endereco)}, ${abre}, ${fecha}, ${intervalo}, ${capacidade}, '{${fechado.join(",")}}', ${txt(zap)}, ${q(hashPassword(senha))}, ${q(f.video)}, ${arr(f.fotos || [])}, ${q(JSON.stringify(config))}::jsonb)
  returning id
)${pros.length ? `, p as (
  insert into professionals (business_id, name, info, sort)
  select b.id, x.name, x.info, x.sort from b, (values ${pros.map((p, i) => `(${q(p.nome.trim())},${txt(p.info)},${i + 1})`).join(",")}) as x(name, info, sort)
  returning 1
)` : ""}
insert into services (business_id, kind, name, info, price, cost, duration_min, image_url, video_url, tag, sort)
select b.id, x.kind, x.name, x.info, x.price, x.cost, x.dur, x.img, x.vid, x.tag, x.sort from b, (values
  ${servicos.join(",\n  ")}
) as x(kind, name, info, price, cost, dur, img, vid, tag, sort);

select slug as link_criado, name as nome from businesses where slug = ${q(link)};
`;
  return { sql, senha, link };
}

/** SQL para tirar um cliente do ar (apaga o negócio, os serviços e os agendamentos dele). */
export const sqlApagarCliente = (link: string) =>
  `-- ATENÇÃO: apaga o cliente /${link} e todos os agendamentos dele. Não tem volta.\ndelete from businesses where slug = ${q(link)} and config->>'cliente' = 'true';\n`;
