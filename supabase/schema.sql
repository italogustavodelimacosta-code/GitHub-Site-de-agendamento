-- Rode este arquivo inteiro no Supabase > SQL Editor (uma vez só).

create extension if not exists pgcrypto;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- parte do link: seusite.com/<slug>
  kind text not null check (kind in ('barbearia','lavarapido')),
  name text not null,
  address text not null default '',
  open_min int not null,                     -- abertura em minutos desde 00:00 (9h = 540)
  close_min int not null,                    -- fechamento (meia-noite = 1440)
  step_min int not null default 30,          -- intervalo entre horários
  capacity int not null default 1,           -- atendimentos ao mesmo tempo (lava-rápido: nº de boxes)
  closed_weekdays int[] not null default '{0}', -- 0 = domingo ... 6 = sábado
  tz_offset text not null default '-03:00',  -- fuso de Brasília
  owner_whatsapp text not null default '',   -- número que recebe os avisos (só dígitos, com DDD)
  owner_password_hash text not null default '',
  config jsonb not null default '{}'::jsonb, -- tamanhos de carro, taxa do leva e traz, sinal etc.
  trailer_video text,
  trailer_poster text,
  gallery text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  info text not null default '',
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('principal','extra')),
  name text not null,
  info text not null default '',
  price numeric(10,2) not null,
  cost numeric(10,2) not null default 0,     -- custo de produtos (para calcular o lucro)
  duration_min int not null,
  image_url text,
  video_url text,
  tag text,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  professional_id uuid references professionals(id),
  client_name text not null,
  client_phone text not null,                -- 55 + DDD + número
  client_email text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  items jsonb not null,                      -- [{name, price, cost}]
  total numeric(10,2) not null,
  cost numeric(10,2) not null,
  vehicle_size text,
  plate text,
  pickup_address text,
  status text not null default 'confirmado' check (status in ('confirmado','concluido','cancelado','faltou')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bookings_business_start on bookings (business_id, starts_at);
create index if not exists bookings_reminder on bookings (starts_at) where reminder_sent_at is null and status = 'confirmado';

-- O site acessa o banco só pelo servidor (chave secreta). Bloqueia acesso direto do navegador.
alter table businesses enable row level security;
alter table professionals enable row level security;
alter table services enable row level security;
alter table bookings enable row level security;
