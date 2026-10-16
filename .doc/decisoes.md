# Decisões

Uma linha por decisão: data, o que foi decidido e por quê. As mais recentes ficam no topo.

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-16 | OS que sai do alcance do usuário vem em `removidas` no `sync_pull` e o app apaga a OS e os itens do aparelho, **inclusive alterações pendentes** | O pull só devolve o que o RLS deixa ver, então o técnico antigo ficava com a cópia velha. E uma alteração pendente nela era recusada no `sync_push`, travando toda a sync dele |
| 2026-10-16 | Trocar o técnico de uma OS dá `updated_at` novo aos itens (`os_pragas`, `os_produtos`) | Sem isso o técnico novo recebia a OS sem as pragas e os produtos já registrados |
| 2026-10-16 | Documentação do projeto fica em `.doc/` | Pedido do usuário |
| 2026-10-16 | Supabase CLI como devDependency na raiz (`npx supabase`), repositório linkado ao projeto; mudança no banco só por migration versionada | A migration `20261006000005_fix_codigo_convite` tinha sido aplicada direto no Supabase e não estava no repositório, o que bloqueava o `db push` |
| 2026-10-13 | Variáveis `EXPO_PUBLIC_*` cadastradas no EAS (development, preview, production) além do `.env` | O `.env` está no `.gitignore` e não sobe para o build na nuvem; sem as chaves do Supabase o app fecha ao abrir |
| 2026-10-13 | Perfil `preview` do EAS gera APK; build local via `expo prebuild` + Gradle com o JDK 17 do Android Studio | APK instalável direto para testes; o Java 22 da máquina é novo demais para o Gradle do React Native |
| 2026-09 | Um único Supabase para todas as empresas, isolado por `empresa_id` + RLS, com `empresa_id` preenchido pelo servidor | Custo e operação de um só backend; o app não consegue forjar a empresa |
| 2026-09 | Offline primeiro: telas só usam SQLite; IDs UUID gerados no aparelho; exclusão lógica | O técnico trabalha em locais sem sinal |
| 2026-09 | Conflito: a última gravação vence | Simples e suficiente: raramente duas pessoas editam a mesma OS ao mesmo tempo |
| 2026-09 | Número da OS sequencial por empresa, atribuído pelo servidor; push faz update + insert em vez de `ON CONFLICT` | Numeração sem buracos; `ON CONFLICT` consumiria números |
| 2026-09 | Assinatura pertence à empresa (App User ID do RevenueCat = `empresas.id`); só o admin compra | Uma assinatura libera toda a equipe |
| 2026-09 | Tolerância após vencer: 3 dias no servidor, 7 no aparelho; dados nunca apagados | O técnico pode estar offline sem saber da renovação |
| 2026-09 | Webhook do RevenueCat sempre consulta o estado atual na API, em vez de confiar no evento | Recomendação do RevenueCat; eventos podem chegar fora de ordem |
| 2026-09 | Certificado gerado no aparelho (HTML → PDF) com campos da RDC 622/2022 | Funciona offline; mudanças nos campos passam por um responsável técnico |
| 2026-09 | Produtos não vêm pré-cadastrados (serviços e pragas sim) | Cada empresa usa produtos próprios com registro na ANVISA, que saem no certificado |
