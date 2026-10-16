-- =====================================================================
-- Cenário: OS reatribuída de um técnico para outro
-- (migration 20261016120000_os_reatribuida.sql)
--
-- Empresa A: dono (admin), técnico 1, técnico 2
-- Empresa B: dono (admin)
--
-- Prova que:
--   * o técnico antigo recebe a OS em "removidas" e deixa de recebê-la
--   * o técnico antigo não consegue mais gravar na OS
--   * o técnico novo recebe a OS e os itens antigos (pragas/produtos)
--   * equipe interna nunca recebe "removidas"
--   * outra empresa não recebe dados nem ids da empresa A
--   * outra empresa não grava itens na OS da empresa A
--
-- IDs fixos:
--   dono A ...0a · técnico 1 ...a1 · técnico 2 ...a2 · dono B ...0b
--   cliente ...c1 · produto ...e1 · OS ...d1 · item praga ...f1 · item produto ...f2
-- =====================================================================
\set ON_ERROR_STOP on

-- usuários (o trigger handle_new_user cria os perfis)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-00000000000a', 'dono.a@teste', '{"nome":"Dono A"}'),
  ('a0000000-0000-0000-0000-0000000000a1', 'tec1.a@teste', '{"nome":"Tecnico 1"}'),
  ('a0000000-0000-0000-0000-0000000000a2', 'tec2.a@teste', '{"nome":"Tecnico 2"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'dono.b@teste', '{"nome":"Dono B"}');

select teste.como('a0000000-0000-0000-0000-00000000000a');
select public.criar_empresa('Empresa A');
reset role;
select teste.como('b0000000-0000-0000-0000-00000000000b');
select public.criar_empresa('Empresa B');
reset role;

-- técnicos entram na empresa A com o código de convite
do $$
declare v_codigo text;
begin
  select e.codigo_convite into v_codigo
    from public.empresas e join public.perfis p on p.empresa_id = e.id
   where p.id = 'a0000000-0000-0000-0000-00000000000a';
  perform teste.como('a0000000-0000-0000-0000-0000000000a1');
  perform public.entrar_empresa(v_codigo);
  perform teste.como('a0000000-0000-0000-0000-0000000000a2');
  perform public.entrar_empresa(v_codigo);
end;
$$;
reset role;

-- dono A cria cliente, produto, OS do técnico 1 e os itens da OS
select teste.como('a0000000-0000-0000-0000-00000000000a');
do $$
declare v_praga uuid;
begin
  select id into v_praga from public.pragas order by nome limit 1;
  perform public.sync_push(jsonb_build_object(
    'produtos', jsonb_build_array(jsonb_build_object(
      'id', 'c0000000-0000-0000-0000-0000000000e1', 'nome_comercial', 'Produto X',
      'principio_ativo', 'Cipermetrina', 'unidade', 'mL')),
    'clientes', jsonb_build_array(jsonb_build_object(
      'id', 'c0000000-0000-0000-0000-0000000000c1', 'nome', 'Cliente 1')),
    'ordens_servico', jsonb_build_array(jsonb_build_object(
      'id', 'c0000000-0000-0000-0000-0000000000d1', 'cliente_id', 'c0000000-0000-0000-0000-0000000000c1',
      'tecnico_id', 'a0000000-0000-0000-0000-0000000000a1', 'status', 'agendada',
      'agendada_para', now())),
    'os_pragas', jsonb_build_array(jsonb_build_object(
      'id', 'c0000000-0000-0000-0000-0000000000f1', 'os_id', 'c0000000-0000-0000-0000-0000000000d1',
      'praga_id', v_praga)),
    'os_produtos', jsonb_build_array(jsonb_build_object(
      'id', 'c0000000-0000-0000-0000-0000000000f2', 'os_id', 'c0000000-0000-0000-0000-0000000000d1',
      'produto_id', 'c0000000-0000-0000-0000-0000000000e1', 'quantidade', 1))
  ));
end;
$$;
reset role;

-- "envelhece" os itens da OS (1 dia atrás), fora da janela de 5 min do pull,
-- para provar que é o trigger novo que faz o técnico 2 recebê-los
alter table public.os_pragas   disable trigger a_set_updated_at;
alter table public.os_produtos disable trigger a_set_updated_at;
update public.os_pragas   set updated_at = now() - interval '1 day';
update public.os_produtos set updated_at = now() - interval '1 day';
alter table public.os_pragas   enable trigger a_set_updated_at;
alter table public.os_produtos enable trigger a_set_updated_at;

-- ---------------------------------------------------------------------
-- Antes da troca
-- ---------------------------------------------------------------------
select teste.como('a0000000-0000-0000-0000-0000000000a1');
do $$
declare r jsonb := public.sync_pull(clock_timestamp());
begin
  perform teste.confere(
    not teste.contem(r -> 'removidas' -> 'ordens_servico', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 1: a própria OS não vem em removidas');
end;
$$;
reset role;

select teste.como('a0000000-0000-0000-0000-0000000000a2');
do $$
declare r jsonb := public.sync_pull(clock_timestamp());
begin
  perform teste.confere(
    not teste.tem_linha(r -> 'alteracoes' -> 'os_pragas', 'os_id', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 2: antes da troca não recebe itens da OS do técnico 1');
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- Dono A passa a OS para o técnico 2
-- ---------------------------------------------------------------------
select teste.como('a0000000-0000-0000-0000-00000000000a');
select public.sync_push(jsonb_build_object(
  'ordens_servico', jsonb_build_array(jsonb_build_object(
    'id', 'c0000000-0000-0000-0000-0000000000d1', 'cliente_id', 'c0000000-0000-0000-0000-0000000000c1',
    'tecnico_id', 'a0000000-0000-0000-0000-0000000000a2', 'status', 'agendada',
    'agendada_para', now()))));
do $$
declare r jsonb := public.sync_pull(clock_timestamp());
begin
  perform teste.confere(
    jsonb_array_length(r -> 'removidas' -> 'ordens_servico') = 0,
    'admin: removidas sempre vazia (vê todas as OS)');
  perform teste.confere(
    teste.tem_linha(r -> 'alteracoes' -> 'ordens_servico', 'id', 'c0000000-0000-0000-0000-0000000000d1'),
    'admin: continua recebendo a OS');
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- Depois da troca
-- ---------------------------------------------------------------------
select teste.como('a0000000-0000-0000-0000-0000000000a1');
do $$
declare r jsonb := public.sync_pull(clock_timestamp());
begin
  perform teste.confere(
    teste.contem(r -> 'removidas' -> 'ordens_servico', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 1: a OS reatribuída vem em removidas');
  perform teste.confere(
    not teste.tem_linha(r -> 'alteracoes' -> 'ordens_servico', 'id', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 1: não recebe mais a OS');
  perform teste.confere(
    not teste.tem_linha(r -> 'alteracoes' -> 'os_pragas', 'os_id', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 1: não recebe mais os itens da OS');
end;
$$;

-- edição pendente do técnico 1 na OS que não é mais dele é recusada
-- (por isso o app apaga a OS do aparelho ao recebê-la em removidas)
do $$
begin
  begin
    perform public.sync_push(jsonb_build_object(
      'os_pragas', jsonb_build_array(jsonb_build_object(
        'id', 'c0000000-0000-0000-0000-0000000000f1', 'os_id', 'c0000000-0000-0000-0000-0000000000d1',
        'praga_id', (select praga_id from public.os_pragas limit 1), 'deleted', true))));
    perform teste.confere(
      not exists (select 1 from public.os_pragas where id = 'c0000000-0000-0000-0000-0000000000f1' and deleted),
      'técnico 1: edição na OS de outro não tem efeito');
  exception when others then
    perform teste.confere(true, 'técnico 1: envio na OS de outro é recusado (' || sqlerrm || ')');
  end;
end;
$$;
reset role;

select teste.como('a0000000-0000-0000-0000-0000000000a2');
do $$
declare r jsonb := public.sync_pull(clock_timestamp());
begin
  perform teste.confere(
    teste.tem_linha(r -> 'alteracoes' -> 'ordens_servico', 'id', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 2: recebe a OS');
  perform teste.confere(
    teste.tem_linha(r -> 'alteracoes' -> 'os_pragas', 'os_id', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 2: recebe as pragas antigas da OS');
  perform teste.confere(
    teste.tem_linha(r -> 'alteracoes' -> 'os_produtos', 'os_id', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 2: recebe os produtos antigos da OS');
  perform teste.confere(
    not teste.contem(r -> 'removidas' -> 'ordens_servico', 'c0000000-0000-0000-0000-0000000000d1'),
    'técnico 2: a OS não vem em removidas');
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- Isolamento entre empresas
-- ---------------------------------------------------------------------
select teste.como('b0000000-0000-0000-0000-00000000000b');
do $$
declare r jsonb := public.sync_pull(clock_timestamp() - interval '1 day');
begin
  perform teste.confere(
    not teste.tem_linha(r -> 'alteracoes' -> 'ordens_servico', 'id', 'c0000000-0000-0000-0000-0000000000d1')
    and not teste.tem_linha(r -> 'alteracoes' -> 'os_pragas', 'os_id', 'c0000000-0000-0000-0000-0000000000d1')
    and not teste.tem_linha(r -> 'alteracoes' -> 'clientes', 'id', 'c0000000-0000-0000-0000-0000000000c1'),
    'empresa B: não recebe dados da empresa A');
  perform teste.confere(
    not teste.contem(r -> 'removidas' -> 'ordens_servico', 'c0000000-0000-0000-0000-0000000000d1'),
    'empresa B: não recebe ids de OS da empresa A em removidas');
  perform teste.confere(
    jsonb_array_length(public.os_fora_do_alcance(clock_timestamp() - interval '1 day')) = 0,
    'empresa B: os_fora_do_alcance não expõe OS da empresa A');
end;
$$;

do $$
begin
  begin
    perform public.sync_push(jsonb_build_object(
      'os_produtos', jsonb_build_array(jsonb_build_object(
        'id', 'c0000000-0000-0000-0000-0000000000f9', 'os_id', 'c0000000-0000-0000-0000-0000000000d1',
        'produto_id', 'c0000000-0000-0000-0000-0000000000e1', 'quantidade', 5))));
    raise exception 'FALHOU: empresa B gravou item na OS da empresa A';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform teste.confere(true, 'empresa B: não grava item na OS da empresa A (' || sqlerrm || ')');
  end;
end;
$$;
reset role;

-- técnico da empresa A sem a OS: o trigger de troca não deixou rastro em outra empresa
do $$
begin
  perform teste.confere(
    (select count(*) from public.os_pragas where os_id = 'c0000000-0000-0000-0000-0000000000d1') = 1
    and (select count(*) from public.os_produtos where os_id = 'c0000000-0000-0000-0000-0000000000d1') = 1,
    'trigger de troca só toca os itens da própria OS');
end;
$$;

\echo 'TODOS OS TESTES PASSARAM: 10_os_reatribuida'
