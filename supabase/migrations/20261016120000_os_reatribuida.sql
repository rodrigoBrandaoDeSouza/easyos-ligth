-- =====================================================================
-- EasyOS Light - OS reatribuída a outro técnico
--
-- Problema: o pull só devolve o que o RLS deixa ver. Quando uma OS passa
-- do técnico A para o B:
--   * A nunca fica sabendo (a OS some do RLS dele) e mantém uma cópia velha;
--     se ele tinha alteração pendente nela, o sync_push falha e trava a sync.
--   * B recebe a OS, mas não os itens (os_pragas/os_produtos), porque o
--     updated_at deles é antigo.
--
-- Solução:
--   1. Ao trocar o técnico, os itens da OS são "tocados" (updated_at novo),
--      para que o novo técnico os receba no próximo pull.
--   2. sync_pull passa a devolver "removidas": ids de OS da empresa que
--      mudaram desde o último pull e que o usuário NÃO pode mais ver. O app
--      apaga essas OS (e seus itens) do aparelho.
-- =====================================================================

-- 1) Troca de técnico -> itens da OS ganham updated_at novo
create or replace function public.tg_os_tecnico_trocado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.os_pragas   set deleted = deleted where os_id = new.id;
  update public.os_produtos set deleted = deleted where os_id = new.id;
  return null;
end;
$$;

create trigger e_os_tecnico_trocado
  after update of tecnico_id on public.ordens_servico
  for each row
  when (old.tecnico_id is distinct from new.tecnico_id)
  execute function public.tg_os_tecnico_trocado();

-- 2) OS da empresa que mudaram e saíram do alcance do usuário.
-- Devolve só ids (uuid) da própria empresa; equipe interna vê tudo, então
-- para ela a lista é sempre vazia.
create or replace function public.os_fora_do_alcance(p_desde timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(o.id), '[]'::jsonb)
    from public.ordens_servico o
   where p_desde is not null
     and o.empresa_id = public.empresa_atual()
     and o.updated_at > p_desde - interval '5 minutes'
     and not public.eh_equipe_interna()
     and o.tecnico_id is distinct from auth.uid();
$$;

revoke all on function public.os_fora_do_alcance(timestamptz) from public, anon;
grant execute on function public.os_fora_do_alcance(timestamptz) to authenticated;

-- sync_pull igual ao da migration 003, acrescentando "removidas"
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

  return jsonb_build_object(
    'servidor_em', v_agora,
    'alteracoes', v_result,
    'removidas', jsonb_build_object('ordens_servico', public.os_fora_do_alcance(p_desde))
  );
end;
$$;
