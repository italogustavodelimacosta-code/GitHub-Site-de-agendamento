// Uso: node --experimental-strip-types scripts/novo-cliente.ts clientes/<arquivo>.json
// Mostra o SQL para colar no Supabase > SQL Editor e a senha do painel do cliente.
import { readFileSync } from "node:fs";
import { sqlNovoCliente } from "../lib/novoCliente.ts";

const arq = process.argv[2];
if (!arq) { console.error("Informe a ficha: clientes/<arquivo>.json"); process.exit(1); }
try {
  const { sql, senha, link } = sqlNovoCliente(JSON.parse(readFileSync(arq, "utf8")));
  console.log(sql);
  console.error(`\nLink do cliente: /${link}\nPainel: /${link}/painel\nSenha do painel: ${senha}`);
} catch (e) { console.error("Erro na ficha:", (e as Error).message); process.exit(1); }
