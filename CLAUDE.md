# EasyOS Light — contexto para o Claude

App de ordens de serviço para **empresas de controle de pragas**, vendido como
**assinatura nas lojas** (SaaS multi-empresa). Funciona **offline** e sincroniza quando
a internet volta. Idioma do produto, do código de domínio e dos commits: **português (pt-BR)**.

Leia também, em `.doc/`: `arquitetura.md` (visão completa, sync, segurança),
`dominios.md` (entidades e regras de negócio), `funcionalidades.md` (telas, papéis e o
que ainda falta) e `decisoes.md` (por que as coisas são como são).

## Stack

| Camada | Tecnologia |
|---|---|
| App Android/iOS | React Native + Expo, expo-router, TypeScript estrito |
| Banco no aparelho | SQLite (`expo-sqlite`) |
| Backend | Um único Supabase para todas as empresas: Postgres + Auth + RLS + Edge Functions (Deno) |
| Assinatura | RevenueCat (`react-native-purchases`) → App Store / Google Play |
| Certificado | HTML → PDF no aparelho (`expo-print`) |

## Estrutura

```
app/                    app Expo
  app/                  telas (rotas do expo-router)
  src/db/               schema local, acesso ao SQLite, consultas (repos.ts)
  src/sync/             motor de sincronização
  src/auth/             sessão, perfil, empresa, situação da assinatura
  src/assinatura/       RevenueCat e regra de bloqueio
  src/catalogo/         definição dos catálogos (produtos, serviços, pragas)
  src/certificado/      HTML/PDF do certificado
  src/components/       componentes de UI compartilhados (ui.tsx)
  src/lib/              supabase, formatação, tema, uuid
supabase/migrations/    SQL versionado
supabase/functions/     revenuecat-webhook, verificar-assinatura, excluir-conta
supabase/tests/         cenários SQL de isolamento (rodar.sh sobe um Postgres no Docker)
.doc/                   arquitetura, domínios, funcionalidades, decisões
```

## Comandos

```bash
# dentro de app/
npm run setup        # instala Expo e dependências nas versões compatíveis (1ª vez)
npm run typecheck    # tsc --noEmit — rodar antes de dar uma tarefa por concluída
npx expo-doctor      # confere dependências e plugins nativos
npm run build:dev    # development build (necessário para testar compras)
npm start            # abre no development build
npm run start:go     # Expo Go (tudo menos compras)
eas build -p android --profile preview         # APK na nuvem (variáveis vêm do EAS, não do .env)

# APK local: Android SDK + JDK 17 do Android Studio; android/ é gerada e fica fora do git
npx expo prebuild -p android                   # só quando mudar app.json ou lib nativa
cd android && ./gradlew.bat assembleRelease    # → android/app/build/outputs/apk/release/

# na raiz (Supabase CLI é devDependency do package.json da raiz; projeto já linkado)
bash supabase/tests/rodar.sh                           # migrations + testes SQL (precisa do Docker)
npx supabase migration list                            # compara migrations locais x Supabase
npx supabase db push --dry-run                         # mostra o que seria aplicado
npx supabase db push                                   # aplica migrations
npx supabase functions deploy <nome>                   # revenuecat-webhook usa --no-verify-jwt
```

Dependências novas no app: sempre `npx expo install <pacote>` (escolhe a versão
compatível com o SDK), nunca `npm install <pacote>` direto.

## Regras que não podem ser quebradas

### Multi-empresa
- Toda tabela de negócio tem `empresa_id` e RLS filtrando por `public.empresa_atual()`.
- `empresa_id` é preenchido **pelo servidor** (trigger `tg_set_empresa`). O app nunca
  envia nem guarda `empresa_id` (exceção: `perfis.empresa_id`, só leitura).
- Tabela nova de negócio precisa de: `empresa_id`, `created_at`, `updated_at`,
  `deleted`, triggers `a_set_updated_at` e `b_set_empresa`, políticas RLS e, se
  referenciar outra tabela, entrada em `tg_valida_referencias`.
- Escrita exige `public.pode_escrever()` (papel válido + assinatura em dia).
- Os campos de assinatura em `empresas` só são alterados pelas Edge Functions
  (service role). Nunca dar `update` neles ao papel `authenticated`.

### Offline e sincronização
- Telas **só leem e gravam no SQLite local**, via `consultar`/`primeiro` e `salvar`/
  `excluir` de `src/db/database.ts`. Nunca chamar o Supabase direto numa tela de
  operação (clientes, OS, atendimento, catálogos).
- Exceções que exigem internet, e por isso chamam o Supabase direto: login/cadastro,
  criar/entrar em empresa, equipe, dados da empresa, assinatura, excluir conta.
- IDs são UUID gerados no aparelho (`novoId()`).
- Exclusão é sempre lógica (`deleted = true`). Não existe `delete` via API.
- `updated_at` e `ordens_servico.numero` são do servidor; o app não os envia.
- Coluna nova numa tabela sincronizada precisa entrar em **dois** lugares: na migration
  e em `TABELAS` de `src/db/schema.ts` (o SQLite local adiciona a coluna sozinho).
  Se for data/hora, também em `COLUNAS_TIMESTAMP`; se for booleana, em `booleanas`.
- Tabela nova que o app envia: adicionar em `TABELAS_ENVIO` (app) **e** em `v_tabelas`
  de `sync_push` (SQL), respeitando a ordem das chaves estrangeiras.
- Conflito: a última gravação vence. Não introduzir outra estratégia sem registrar em
  `.doc/decisoes.md`.
- O pull só devolve o que o RLS deixa ver. Quando algo pode **sair** do alcance do
  usuário (ex.: OS reatribuída), o servidor avisa em `removidas` (`sync_pull`) e o app
  apaga localmente; itens filhos precisam ganhar `updated_at` novo para chegar a quem
  passou a ter acesso (ver `20261016120000_os_reatribuida.sql`).

### Migrations
- Depois do primeiro deploy em produção: **nunca editar** uma migration já aplicada;
  toda mudança é um arquivo novo `AAAAMMDDHHMMSS_descricao.sql`.
- Toda mudança em RLS, triggers ou RPCs de sync precisa de um cenário em
  `supabase/tests/` provando que uma empresa não lê nem grava dados de outra.
  Cenários são arquivos `NN_descricao.sql` usando `teste.como(usuario)` e
  `teste.confere(condição, mensagem)` (definidos em `00_ambiente_supabase.sql`).
- Ao mudar uma RPC existente (`create or replace`), copiar a função inteira da última
  versão para a migration nova.
- Nunca alterar o banco direto pelo painel do Supabase: tudo passa por migration no
  repositório (a `20261006000005` foi aplicada direto e teve de ser recuperada).
- Extensões ficam no schema `extensions` (padrão do Supabase): chamar com o schema
  completo, ex.: `extensions.gen_random_bytes`.

### Assinatura
- A assinatura é da **empresa**: o App User ID no RevenueCat é o `empresas.id`.
- Só o admin compra. Entitlement esperado: `pro`.
- Tolerância após o vencimento: 3 dias no servidor, 7 dias no aparelho
  (`src/assinatura/situacao.ts`). Dados nunca são apagados por falta de pagamento.

### Lojas
- Manter na tela de assinatura: restaurar compras, preço e período, texto de renovação
  automática, links de termos e privacidade.
- Manter "Excluir minha conta" dentro do app.

## Papéis

| Papel | Pode |
|---|---|
| `admin` | tudo: equipe, dados da empresa, assinatura, catálogos |
| `atendente` | clientes, agenda de todos os técnicos, catálogos |
| `tecnico` | cadastrar clientes; ver e atender só as próprias OS |

O papel nunca vem do cliente: usuário novo entra como `tecnico` e vira `admin` ao criar
a própria empresa (`criar_empresa`). Técnicos entram com código de convite
(`entrar_empresa`).

## Convenções de código

- Nomes de domínio em português (`ordens_servico`, `salvar`, `sincronizar`); termos
  técnicos de biblioteca ficam como são.
- Componentes de UI reaproveitados de `src/components/ui.tsx` (`Tela`, `Cartao`,
  `Campo`, `Botao`, `Selecao`, `Chip`). Cores só de `src/lib/theme.ts`.
- Consultas SQL locais ficam em `src/db/repos.ts`, com tipo de retorno declarado.
- Telas usam `useConsulta` para recarregar quando o banco muda ou a tela ganha foco.
- Datas: gravar em ISO UTC; exibir com as funções de `src/lib/format.ts`.
- Mensagens ao usuário em português claro, sem jargão técnico.
- Segredos só em `.env` (app) e `supabase secrets` (funções). No app, apenas chaves
  públicas (`EXPO_PUBLIC_*`); a `service_role` nunca entra no app.

## Como trabalhar neste repositório

- Antes de mudar o modelo de dados ou a sync, ler `.doc/arquitetura.md`.
- Mudança que afete banco **e** app vai no mesmo commit.
- Decisão de produto ou de arquitetura tomada numa conversa → uma linha em
  `.doc/decisoes.md` (data, decisão, motivo).
- Mudou tela, regra de negócio ou arquitetura → atualizar o arquivo correspondente
  em `.doc/`.
- Ao terminar: rodar `npm run typecheck` e `bash supabase/tests/rodar.sh`, e dizer com
  clareza o que foi testado e o que não foi (ex.: "não rodou em aparelho").
- Migration nova **não** é aplicada sozinha no Supabase de produção: avisar o usuário
  para rodar `npx supabase db push`. O app deve tolerar o servidor ainda sem ela.
- Converse com o usuário em português (pt-BR).
- O certificado segue a RDC 622/2022 da ANVISA; qualquer mudança nos campos dele deve
  ser sinalizada para conferência com um responsável técnico.

## Estado atual (atualizar a cada rodada)

- Banco: todas as migrations (até `20261016120000_os_reatribuida`) aplicadas no
  Supabase (`jpxypwupleureeynqodi`) e testadas em Postgres local.
- App: passa no typecheck e no expo-doctor; APK de teste gerado (EAS e local);
  **ainda não validado em aparelho**. Projeto EAS: `@rodrigobrandao/easyos-light`.
- Edge Functions: escritas, **não testadas** contra o RevenueCat real.
- Lojas e RevenueCat: ainda não configurados (compras não funcionam).
- Faltando: recuperação de senha, fotos do atendimento, GPS, painel web.
