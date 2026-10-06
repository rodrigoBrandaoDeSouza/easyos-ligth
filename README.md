# EasyOS Light

App de ordens de serviço para empresas de **controle de pragas**, vendido como
**assinatura nas lojas (App Store / Google Play)**. Cada dedetizadora cria sua conta,
convida os técnicos e trabalha com cadastro de clientes, agenda, atendimento em campo
e **certificado de execução em PDF** — tudo funcionando **offline**.

| Camada | Tecnologia |
|---|---|
| App (Android/iOS) | React Native + Expo (expo-router, TypeScript) |
| Banco no aparelho | SQLite (`expo-sqlite`) |
| Backend | **Um único** Supabase para todas as empresas (Postgres + Auth + RLS + Edge Functions) |
| Assinatura | RevenueCat (`react-native-purchases`) → App Store / Google Play |
| Certificado | HTML → PDF no próprio aparelho (`expo-print`) |

```
EasyOsLight/
├── supabase/
│   ├── migrations/   001 schema · 002 RLS · 003 sync · 004 cadastro de empresa/equipe
│   └── functions/    revenuecat-webhook · verificar-assinatura · excluir-conta
└── app/              aplicativo Expo
    ├── app/          telas (expo-router)
    └── src/          db local, sync, auth, assinatura, catálogo, certificado
```

---

## 1. Modelo SaaS (multi-empresa)

- **Um Supabase só.** Toda tabela tem `empresa_id` e o RLS garante que cada usuário
  só enxerga a própria empresa. O `empresa_id` é preenchido **pelo servidor** a partir
  do usuário logado; o app nunca o envia. Um trigger também impede que um registro
  aponte para dados de outra empresa (ex.: OS da empresa A com cliente da B).
- **Cadastro:**
  1. A pessoa cria a conta no app (e-mail + senha).
  2. **Dono:** "Sou o dono" → cria a empresa, vira **admin** e ganha **14 dias de teste**.
     A empresa já nasce com serviços e pragas comuns; os **produtos** são cadastrados
     pela empresa (eles vão para o certificado com o registro na ANVISA).
  3. **Técnico:** "Tenho um convite" → digita o **código de convite** que o admin
     compartilha (Ajustes → Equipe).
- **Papéis:** `admin` (tudo, equipe, assinatura) · `atendente` (agenda de todos,
  catálogos) · `tecnico` (só as próprias OS). O admin muda papéis e remove pessoas.
- Número da OS é **sequencial por empresa**.

## 2. Assinatura (RevenueCat)

- Quem assina é a **empresa**: no RevenueCat o *App User ID* é o **ID da empresa**,
  então uma assinatura libera todos os usuários dela. Só o admin vê os planos.
- Fluxo: compra no app → RevenueCat → **webhook** (`revenuecat-webhook`) atualiza
  `empresas.assinatura_expira_em`. Logo após a compra o app também chama
  `verificar-assinatura` para liberar na hora.
- **Bloqueio:** vencido o teste/assinatura, o servidor recusa gravações (3 dias de
  tolerância) e o app mostra a tela de assinatura. No aparelho a tolerância é de
  7 dias, porque o técnico pode estar offline sem saber da renovação — o que for
  feito nesse período fica pendente e sobe quando a assinatura for confirmada.
- Os dados nunca são apagados por falta de pagamento.

---

## 3. Configurar o Supabase

1. Crie o projeto em <https://supabase.com>.
2. Rode as migrations (SQL Editor, na ordem dos arquivos, ou `npx supabase db push`).
   > Se você já tinha rodado a versão anterior (empresa única), recrie o banco
   > (`npx supabase db reset` ou um projeto novo) — o schema mudou.
3. **Authentication → Providers → Email:** deixe o cadastro **ligado**. Recomendo
   manter "Confirm email" ligado (o app já trata esse caso).
4. Edge Functions:
   ```bash
   npx supabase secrets set REVENUECAT_SECRET_KEY=sk_xxx REVENUECAT_ENTITLEMENT=pro \
       REVENUECAT_WEBHOOK_SECRET=um-segredo-longo-qualquer
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase functions deploy verificar-assinatura
   npx supabase functions deploy excluir-conta
   ```

## 4. Configurar lojas e RevenueCat

1. Contas de desenvolvedor: **Apple Developer Program** e **Google Play Console**.
2. Crie o app nas duas lojas com o bundle/pacote `br.com.easyoslight.app`
   (troque em `app/app.json` se quiser outro).
3. Cadastre as **assinaturas** (ex.: mensal e anual) no App Store Connect e no Play Console.
4. No **RevenueCat**: crie o projeto, conecte os dois apps, importe os produtos, crie o
   **entitlement `pro`** com esses produtos e uma **offering** (ex.: `default`) com os
   pacotes mensal/anual.
5. RevenueCat → Integrations → **Webhooks**: URL
   `https://SEU-PROJETO.supabase.co/functions/v1/revenuecat-webhook` e
   *Authorization header* = `Bearer <REVENUECAT_WEBHOOK_SECRET>`.
6. Publique páginas de **Termos de uso** e **Política de privacidade** (obrigatórias
   na tela de assinatura) e coloque os links no `.env`.

## 5. Rodar o app

Pré-requisito: [Node.js LTS](https://nodejs.org) e uma conta no [Expo](https://expo.dev).

```bash
cd app
npm run setup          # instala Expo + dependências nas versões certas (1ª vez)
cp .env.example .env   # no Windows: copy .env.example .env  → preencha as chaves
npm run build:dev      # gera o "development build" (1ª vez / quando mudar lib nativa)
npm start              # abre o app no development build instalado
```

> **Compras não funcionam no Expo Go** — por isso o development build. Para testar
> só o resto do app sem compras, `npm run start:go` ainda funciona no Expo Go.

Publicação: `npm run build:prod` e `npx eas submit`.

---

## 6. Como funciona o offline

- Toda leitura/escrita das telas é no **SQLite local**; o app nunca espera a rede.
- IDs são **UUID gerados no aparelho**; alterações ficam `pending` até serem enviadas.
- A sync (`src/sync/sync.ts`) confere a empresa/papel do usuário, **envia** o que está
  pendente (`sync_push`, uma transação) e **recebe** o que mudou (`sync_pull`).
  Se a empresa ou o papel mudarem, os dados locais são recarregados do zero.
- Dispara quando a internet volta, ao abrir o app, 3 s após cada alteração e a cada
  5 min. `updated_at` é sempre do relógio do servidor; exclusões são lógicas.
- Conflitos: a última gravação vence.
- Precisam de internet: login/cadastro, criar/entrar em empresa, equipe, dados da
  empresa e compra da assinatura. Todo o resto funciona offline.

## 7. Fluxo do técnico

Agenda do dia → **Iniciar atendimento** → pragas alvo, produtos aplicados, relatório e
recomendações → nome e **assinatura** do responsável → **Concluir** → certificado em
PDF para WhatsApp/e-mail.

> **Certificado:** segue o que a ANVISA pede no comprovante de execução
> (RDC 622/2022). Confira com um responsável técnico antes de lançar.

## 8. Exigências das lojas já atendidas

- Compra de assinatura digital pelo sistema da loja (via RevenueCat)
- Botão **Restaurar compras**, preço/período visíveis, texto de renovação automática,
  links de termos e privacidade, link para gerenciar/cancelar
- **Excluir conta** dentro do app (Ajustes)

## 9. Próximos passos sugeridos

- [ ] Fotos do atendimento (fila de upload para o Supabase Storage)
- [ ] Check-in com GPS ao iniciar o atendimento
- [ ] Painel web para o escritório (agenda em calendário, relatórios)
- [ ] Página pública de verificação do certificado (+ QR code no PDF)
- [ ] Planos por número de técnicos (hoje: plano único por empresa)
- [ ] Recuperação de senha ("esqueci minha senha")
- [ ] OS recorrentes / contratos mensais; mapa de iscas para clientes PJ
