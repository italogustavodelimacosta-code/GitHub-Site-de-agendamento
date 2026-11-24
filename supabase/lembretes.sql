-- Lembrete automático de 30 minutos. Rode no Supabase > SQL Editor.
-- Troque SEU-SITE pelo endereço do site na Vercel (ex.: github-site-de-agendamento.vercel.app). Só isso.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Se você rodou o schema.sql antes desta versão, esta parte cria a senha interna do lembrete.
create table if not exists app_settings (key text primary key, value text not null);
alter table app_settings enable row level security;
insert into app_settings (key, value) values ('cron_secret', encode(gen_random_bytes(24), 'hex')) on conflict (key) do nothing;

select cron.schedule(
  'lembretes-30min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-SITE/api/cron/lembretes',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_settings where key = 'cron_secret')),
    body := '{}'::jsonb
  );
  $$
);
-- Para conferir: select * from cron.job;  Para desligar: select cron.unschedule('lembretes-30min');
