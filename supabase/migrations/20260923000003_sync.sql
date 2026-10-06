-- =====================================================================
-- EasyOS Light - RPCs de sincronização offline
--
-- sync_pull(desde)      -> devolve tudo que mudou desde o último pull
-- sync_push(alteracoes) -> grava em lote (uma transação) o que o aparelho
--                          criou/alterou offline. Estratégia: last-write-wins.
--
-- Ambas são SECURITY INVOKER: o RLS continua valendo para o usuário logado,
-- então cada aparelho só recebe/grava dados da própria empresa.
-- =====================================================================

create or replace function public.sync_pull(p_desde timestamptz default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_agora  timestamptz := clock_timestamp();
  -- janela de sobreposição: cobre transações que gravaram antes mas
  -- confirmaram (commit) depois do último pull. O app faz upsert idempotente.
  v_desde  timestamptz := coalesce(p_desde - interval '5 minutes', '-infinity');
  v_result jsonb := '{}'::jsonb;
  v_rows   jsonb;
  t        text;
begin
  foreach t in array array[
    'empresas', 'perfis', 'pragas', 'produtos', 'servicos',
    'clientes', 'locais', 'ordens_servico', 'os_pragas', 'os_produtos'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)
         from public.%I x
        where x.updated_at > $1
          and ($2 or not x.deleted)', t)
      into v_rows
      using v_desde, p_desde is not null;  -- 1ª carga não traz excluídos
    v_result := v_result || jsonb_build_object(t, v_rows);
  end loop;

  return jsonb_build_object('servidor_em', v_agora, 'alteracoes', v_result);
end;
$$;

create or replace function public.sync_push(p_alteracoes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  -- ordem importa por causa das chaves estrangeiras
  v_tabelas   text[] := array['pragas', 'produtos', 'servicos', 'clientes', 'locais',
                              'ordens_servico', 'os_pragas', 'os_produtos'];
  -- colunas controladas pelo servidor: nunca aceitas do aparelho
  v_ignoradas text[] := array['updated_at', 'numero', 'empresa_id'];
  -- colunas preservadas quando o registro já existe
  v_imutaveis text[] := array['id', 'created_at', 'created_by'];
  t           text;
  v_linhas    jsonb;
  v_chaves    text[];
  v_cols      text[];
  v_lista     text;
  v_set       text;
  v_total     integer := 0;
  v_n         integer;
begin
  if public.papel_atual() is null then
    raise exception 'SEM_EMPRESA: usuário não pertence a uma empresa ativa';
  end if;
  if not public.assinatura_ok() then
    raise exception 'ASSINATURA_INATIVA: renove a assinatura para enviar alterações';
  end if;

  foreach t in array v_tabelas loop
    v_linhas := p_alteracoes -> t;
    continue when v_linhas is null or jsonb_typeof(v_linhas) <> 'array'
                  or jsonb_array_length(v_linhas) = 0;

    -- colunas enviadas pelo aparelho ∩ colunas reais da tabela
    select array_agg(distinct k) into v_chaves
      from jsonb_array_elements(v_linhas) e, jsonb_object_keys(e) k;

    select array_agg(c.column_name::text order by c.ordinal_position) into v_cols
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = t
       and c.column_name = any (v_chaves)
       and c.column_name <> all (v_ignoradas);

    if v_cols is null or not ('id' = any (v_cols)) then
      raise exception 'sync_push: tabela % sem coluna id no payload', t;
    end if;

    v_lista := (select string_agg(format('%I', c), ', ') from unnest(v_cols) c);
    v_set   := (select string_agg(format('%1$I = src.%1$I', c), ', ')
                  from unnest(v_cols) c where c <> all (v_imutaveis));

    -- 1) atualiza o que já existe (só linhas visíveis/permitidas pelo RLS)
    if v_set is not null then
      execute format(
        'update public.%1$I tgt set %2$s
           from jsonb_populate_recordset(null::public.%1$I, $1) src
          where tgt.id = src.id', t, v_set)
      using v_linhas;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    end if;

    -- 2) insere o que é novo (update + insert separados evitam queimar
    --    números de OS, o que aconteceria com INSERT ... ON CONFLICT)
    execute format(
      'insert into public.%1$I (%2$s)
       select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) src
        where not exists (select 1 from public.%1$I x where x.id = src.id)',
      t, v_lista)
    using v_linhas;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  return jsonb_build_object('gravados', v_total, 'servidor_em', clock_timestamp());
end;
$$;

revoke all on function public.sync_pull(timestamptz) from public, anon;
revoke all on function public.sync_push(jsonb)       from public, anon;
grant execute on function public.sync_pull(timestamptz) to authenticated;
grant execute on function public.sync_push(jsonb)       to authenticated;
