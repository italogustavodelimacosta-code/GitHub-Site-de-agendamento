-- Lembrete automático de 30 minutos.
-- 1) Supabase > Database > Extensions: ative "pg_cron" e "pg_net".
-- 2) Troque os dois valores abaixo e rode no SQL Editor:
--    SEU-SITE  = o endereço do site na Vercel (ex.: agendamento-xyz.vercel.app)
--    SEU-CRON-SECRET = o mesmo valor que você colocou em CRON_SECRET na Vercel
select cron.schedule(
  'lembretes-30min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-SITE/api/cron/lembretes',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU-CRON-SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
-- Para conferir: select * from cron.job;  Para desligar: select cron.unschedule('lembretes-30min');
