-- Proteções extras. Rode no Supabase > SQL Editor (pode rodar mais de uma vez sem problema).

-- 1. Tabela que conta tentativas de login e de agendamento (bloqueia quem tenta adivinhar a senha).
create table if not exists rate_limits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_limits_key_at on rate_limits (key, at);
alter table rate_limits enable row level security;

-- 2. Garante que nenhuma tabela pode ser lida ou alterada direto pelo navegador (chave pública "anon").
--    O site só acessa o banco pelo servidor, com a chave secreta.
alter table businesses enable row level security;
alter table professionals enable row level security;
alter table services enable row level security;
alter table bookings enable row level security;
alter table app_settings enable row level security;
revoke all on businesses, professionals, services, bookings, app_settings, rate_limits from anon, authenticated;

-- 3. A senha inicial "trocar123" está no GitHub (público) e não vale mais para entrar.
--    O painel agora usa a senha que você colocar em PAINEL_SENHA na Vercel no primeiro acesso.
