# Agendamento online (barbearia e lava-rápido)

Um sistema só, com uma página de agendamento para cada negócio:

- `/barbearia`: catálogo de cortes com foto e vídeo, escolha do barbeiro, horários livres de verdade.
- `/lavarapido`: preço pelo tamanho do carro, leva e traz, horários das 6h à meia-noite com vagas por box.
- `/<negócio>/painel`: área do dono, com senha. Mostra a agenda, o faturamento, o custo, o lucro (dia, semana e mês) e os mais pedidos. Também é onde o dono cadastra o WhatsApp que recebe os avisos.

WhatsApp automático (API oficial da Meta):

1. O cliente agenda e recebe a confirmação na hora.
2. O dono recebe o aviso do novo agendamento no número cadastrado no painel.
3. 30 minutos antes, o cliente recebe o lembrete.
4. Se o cliente responder, o robô devolve uma resposta automática com o contato do estabelecimento.

Tecnologia: Next.js 14 (hospedado na Vercel), Supabase (banco de dados e agendador do lembrete) e WhatsApp Cloud API.

---

## Como colocar no ar

### 1. Supabase (banco de dados)
1. Em [supabase.com](https://supabase.com), clique em **New project**. Escolha a região **South America (São Paulo)** e anote a senha.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Faça o mesmo com `supabase/seed.sql`. Ele cria os dois negócios com os serviços e preços de exemplo.
4. Em **Project Settings > API**, copie a **Project URL** e a chave **service_role**. Elas vão para a Vercel no passo 2.

### 2. Vercel (site no ar)
1. Em [vercel.com/new](https://vercel.com/new), importe este repositório do GitHub.
2. Antes de clicar em Deploy, abra **Environment Variables** e preencha as variáveis listadas em `.env.example`:
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: os valores do passo 1.
   - `PAINEL_SENHA`: a senha do painel do dono (mínimo 8 caracteres). Sem ela, ninguém consegue entrar no painel.
   - `SESSION_SECRET` e `CRON_SECRET` são opcionais. Se ficarem em branco, o site gera as senhas sozinho.
   - Outra opção: em vez de copiar as chaves, adicione a integração **Supabase** da Vercel (Marketplace). Ela preenche `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sozinha.
   - `SITE_URL`: deixe em branco agora e preencha depois com o endereço que a Vercel der.
   - As variáveis `WHATSAPP_...` podem ficar em branco por enquanto. Sem elas, o site funciona e só não envia mensagens.
3. Clique em **Deploy**. Abra `https://SEU-SITE.vercel.app/barbearia` para testar.
4. Entre em `/barbearia/painel` com a senha que você colocou em `PAINEL_SENHA` e cadastre o WhatsApp do dono. Repita em `/lavarapido/painel`. A antiga senha `trocar123` não funciona mais, porque este repositório é público.

### 3. WhatsApp oficial (Meta)
1. Em [developers.facebook.com/apps](https://developers.facebook.com/apps), crie um app do tipo **Business** e adicione o produto **WhatsApp**.
2. Em **WhatsApp > API Setup**, adicione o número do robô. Ele não pode estar em uso no WhatsApp comum. Copie o **Phone number ID**.
3. Gere um token permanente em **Business Settings > System users**: crie um usuário, dê a ele acesso ao app e gere um token com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Na Vercel, preencha `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (uma palavra que você inventa) e `WHATSAPP_APP_SECRET` (em **App settings > Basic > App secret**) e faça um **Redeploy**.
5. Em **WhatsApp > Configuration > Webhook**, coloque a URL `https://SEU-SITE/api/whatsapp/webhook` e o mesmo verify token. Depois assine o campo **messages**.
6. Em **WhatsApp Manager > Message templates**, crie os 3 modelos abaixo com categoria **Utility** e idioma **Portuguese (BR)**. Os nomes precisam ser exatamente estes:

**agendamento_confirmado**
```
Olá, {{1}}! Seu horário na {{2}} está confirmado: {{3}}, {{4}} às {{5}}. Valor: {{6}}. Endereço: {{7}}. Para remarcar ou cancelar, responda esta mensagem.
```

**novo_agendamento** (vai para o dono)
```
Novo agendamento na {{1}}: {{2}} ({{3}}) marcou {{4}} para {{5}} às {{6}}. Valor: {{7}}.
```

**lembrete_30min**
```
Olá, {{1}}! Daqui a meia hora você tem {{2}} na {{3}}, {{4}} às {{5}}. Aguardamos você. Obrigado!
```

A aprovação costuma sair em minutos ou até 1 dia.

### 4. Lembrete de 30 minutos
1. No Supabase, vá em **Database > Extensions** e ative **pg_cron** e **pg_net**.
2. Abra `supabase/lembretes.sql`, troque `SEU-SITE` pelo endereço do site e rode o arquivo no SQL Editor. A senha interna do lembrete é criada sozinha.
   A partir daí, a cada 5 minutos o Supabase chama o site, que envia os lembretes de quem tem horário na próxima meia hora. Cada lembrete só é enviado uma vez.

---

## Segurança
- O banco só é acessado pelo servidor, com a chave secreta. Todas as tabelas têm RLS ligado e sem regras públicas, então a chave pública do Supabase não lê nada.
- A chave `service_role` fica só na Vercel. Nunca coloque no GitHub, no chat ou em código que roda no navegador.
- Painel do dono: senha com scrypt, no mínimo 8 caracteres, 5 tentativas a cada 15 minutos por aparelho. Trocar a senha desconecta todos os outros aparelhos. A sessão dura 14 dias.
- Agendamento: até 6 pedidos por hora por aparelho e até 3 horários futuros por WhatsApp.
- O lembrete automático só roda com a senha interna (`CRON_SECRET` ou a gerada no banco). O robô do WhatsApp só aceita mensagens assinadas pela Meta (`WHATSAPP_APP_SECRET`).
- Depois de atualizar o código, rode `supabase/seguranca.sql` uma vez no SQL Editor.

## Vender para um cliente novo
Todos os clientes usam o mesmo site e o mesmo banco. Não precisa criar outra conta na Vercel nem no Supabase, e não custa nada a mais.
Cada cliente ganha o próprio link (`https://SEU-SITE/<link>`) e o próprio painel (`/<link>/painel`), com senha só dele. Os clientes não aparecem na página inicial.

1. Copie `clientes/exemplo-barbearia.json` (ou `exemplo-lavarapido.json`) e troque pelos dados do cliente: link, nome, endereço, horários, dias fechados, WhatsApp, e-mail, profissionais, serviços, preços, custos e duração.
2. Rode `node --experimental-strip-types scripts/novo-cliente.ts clientes/<arquivo>.json`. Ele confere a ficha, mostra o SQL e a senha do painel. Se a ficha não tiver `senha`, ele cria uma.
3. Cole o SQL no Supabase > SQL Editor e clique em **Run**.
4. Mande para o cliente o link, o endereço do painel e a senha. No painel ele troca a senha e o WhatsApp quando quiser.

Fotos e vídeo do cliente: coloque em `public/media/<link>/` e use `/media/<link>/foto.jpg` nos campos `foto`, `fotos` e `video`.

Aviso por e-mail ao cliente: o e-mail fica na ficha (`email`). Enquanto o Resend usar o remetente de teste (`onboarding@resend.dev`), ele só entrega para o e-mail da conta Resend. Para chegar no e-mail de cada cliente, verifique um domínio próprio no Resend e preencha `AVISO_REMETENTE` na Vercel (ex.: `Agendamentos <avisos@seudominio.com.br>`). Sem isso, o cliente recebe pelo botão de WhatsApp e vê tudo no painel.

Para tirar um cliente do ar: `delete from businesses where slug = '<link>' and config->>'cliente' = 'true';` (apaga os agendamentos dele também).

## Ajustes do dia a dia
O próprio dono faz quase tudo pelo painel, em **/<link>/painel > Meu site**: nome, endereço, horário, dias fechados, cores, cortes e lavagens (preço, custo, tempo, descrição, selo, foto e vídeo), adicionais, barbeiros, vídeo de abertura e fotos da galeria. As fotos e vídeos vão para o Supabase Storage (pasta pública `midia`, criada sozinha no primeiro envio; plano grátis: 1 GB). O navegador envia o arquivo direto para o Storage, então vídeos de até 50 MB funcionam.

Pelo Supabase, se precisar:
- **Preços, custos, serviços, fotos e vídeos:** Supabase > Table Editor > `services`. A coluna `active` liga e desliga um serviço.
- **Barbeiros:** tabela `professionals`.
- **Horário de funcionamento:** tabela `businesses`, nas colunas `open_min` e `close_min`, em minutos desde a meia-noite (9h = 540, 20h = 1200, meia-noite = 1440). Os dias fechados ficam em `closed_weekdays` (0 = domingo).
- **Vagas do lava-rápido:** a coluna `capacity` guarda o número de boxes.
- **Fotos e vídeos novos:** coloque em `public/media/` e use o caminho `/media/arquivo.jpg`.

> As fotos e os vídeos de exemplo vieram de perfis de outras barbearias e lava-rápidos. Troque pelos seus antes de divulgar o link.

## Desenvolvimento
```
npm install
npm test        # testes dos horários, preços, telefone e senha
npm run dev     # precisa das variáveis do .env.example num arquivo .env.local
```
