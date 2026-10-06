-- =====================================================================
-- EasyOS Light - Schema principal (SaaS multi-empresa)
-- Controle de ordens de serviço para empresas de controle de pragas
--
-- Um único Supabase atende todas as empresas assinantes. Cada registro
-- pertence a uma empresa (empresa_id) e o RLS isola os dados.
--
-- Convenções para sincronização offline:
--   * id uuid gerado no próprio aparelho (permite criar registros offline)
--   * updated_at é SEMPRE definido pelo servidor (trigger) -> relógio único
--   * empresa_id é SEMPRE definido pelo servidor (empresa do usuário logado)
--   * exclusão é lógica (deleted = true) para que a exclusão também sincronize
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Empresas (tenants) + dados do certificado + assinatura
-- ---------------------------------------------------------------------
create table public.empresas (
  id                    uuid primary key default gen_random_uuid(),
  razao_social          text not null,
  nome_fantasia         text,
  cnpj                  text,
  endereco              text,
  telefone              text,
  email                 text,
  licenca_sanitaria     text,           -- nº da licença/alvará sanitário
  responsavel_tecnico   text,           -- nome do RT
  rt_registro           text,           -- ex.: CRQ-IV 04123456, CRBio 12345/01-D
  ciatox_telefone       text not null default '0800 722 6001', -- Disque-Intoxicação

  -- convite para técnicos entrarem na empresa
  codigo_convite        text not null unique,

  -- assinatura (atualizada pelas Edge Functions do RevenueCat)
  assinatura_status     text not null default 'trial'
                        check (assinatura_status in ('trial', 'ativa', 'expirada')),
  trial_ate             timestamptz not null default now() + interval '14 days',
  assinatura_expira_em  timestamptz,
  assinatura_produto    text,
  assinatura_renova     boolean,        -- false = cliente cancelou a renovação
  proximo_numero_os     bigint not null default 1,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted               boolean not null default false
);

-- ---------------------------------------------------------------------
-- Perfis de usuário (1:1 com auth.users)
-- empresa_id nulo = usuário cadastrado que ainda não criou/entrou numa empresa
-- ---------------------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  empresa_id  uuid references public.empresas (id),
  nome        text not null,
  email       text,
  telefone    text,
  papel       text not null default 'tecnico'
              check (papel in ('admin', 'atendente', 'tecnico')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);
create index perfis_empresa_idx on public.perfis (empresa_id);

-- Empresa do usuário logado (usada em defaults, triggers e RLS)
create or replace function public.empresa_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.perfis
   where id = auth.uid() and ativo and not deleted;
$$;

-- ---------------------------------------------------------------------
-- Catálogos (por empresa)
-- ---------------------------------------------------------------------
create table public.pragas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id),
  nome            text not null,
  nome_cientifico text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted         boolean not null default false
);

create table public.produtos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas (id),
  nome_comercial   text not null,
  principio_ativo  text not null,
  grupo_quimico    text,
  concentracao     text,            -- concentração do princípio ativo
  registro_ms      text,            -- registro no Ministério da Saúde/ANVISA
  unidade          text not null default 'mL',
  antidoto         text,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted          boolean not null default false
);

create table public.servicos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id),
  nome          text not null,         -- desinsetização, desratização...
  descricao     text,
  garantia_dias integer not null default 90 check (garantia_dias >= 0),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted       boolean not null default false
);

-- ---------------------------------------------------------------------
-- Clientes e locais de atendimento
-- ---------------------------------------------------------------------
create table public.clientes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id),
  tipo_pessoa  text not null default 'PF' check (tipo_pessoa in ('PF', 'PJ')),
  nome         text not null,
  documento    text,               -- CPF / CNPJ
  email        text,
  telefone     text,
  contato      text,               -- pessoa de contato (PJ)
  observacoes  text,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false
);

create table public.locais (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id),
  cliente_id   uuid not null references public.clientes (id),
  descricao    text not null default 'Principal',
  cep          text,
  logradouro   text,
  numero       text,
  complemento  text,
  bairro       text,
  cidade       text,
  uf           char(2),
  tipo_imovel  text,               -- residencial, comercial, industrial...
  area_m2      numeric(12, 2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false
);
create index locais_cliente_idx on public.locais (cliente_id);

-- ---------------------------------------------------------------------
-- Ordens de serviço
-- ---------------------------------------------------------------------
create table public.ordens_servico (
  id                          uuid primary key default gen_random_uuid(),
  empresa_id                  uuid not null references public.empresas (id),
  -- número sequencial por empresa; atribuído pelo servidor na 1ª sincronização
  numero                      bigint,
  cliente_id                  uuid not null references public.clientes (id),
  local_id                    uuid references public.locais (id),
  servico_id                  uuid references public.servicos (id),
  tecnico_id                  uuid references public.perfis (id) on delete set null,
  status                      text not null default 'agendada'
                              check (status in ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  agendada_para               timestamptz not null,
  iniciada_em                 timestamptz,
  concluida_em                timestamptz,
  observacoes                 text,          -- descrição / pedido do cliente
  relatorio                   text,          -- o que foi feito (técnico)
  recomendacoes               text,          -- recomendações pós-serviço
  responsavel_local_nome      text,          -- quem acompanhou / assinou
  responsavel_local_documento text,
  assinatura_cliente          text,          -- PNG em base64 (data URL)
  garantia_ate                date,
  certificado_codigo          text,          -- código de verificação do certificado
  created_by                  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted                     boolean not null default false,
  unique (empresa_id, numero)
);
create index os_tecnico_idx   on public.ordens_servico (tecnico_id, agendada_para);
create index os_cliente_idx   on public.ordens_servico (cliente_id);

create table public.os_pragas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id),
  os_id       uuid not null references public.ordens_servico (id),
  praga_id    uuid not null references public.pragas (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);
create index os_pragas_os_idx on public.os_pragas (os_id);

create table public.os_produtos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id),
  os_id          uuid not null references public.ordens_servico (id),
  produto_id     uuid not null references public.produtos (id),
  quantidade     numeric(12, 3) not null check (quantidade > 0),
  unidade        text,
  diluicao       text,               -- ex.: 10 mL / 1 L de água
  lote           text,
  area_aplicada  text,               -- ex.: cozinha, área externa
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted        boolean not null default false
);
create index os_produtos_os_idx on public.os_produtos (os_id);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- updated_at (relógio do servidor)
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at := clock_timestamp();
  end if;
  return new;
end;
$$;

-- empresa_id vem do usuário logado e não pode ser trocado depois
create or replace function public.tg_set_empresa()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.empresa_id := coalesce(new.empresa_id, public.empresa_atual());
  else
    new.empresa_id := old.empresa_id;
  end if;
  return new;
end;
$$;

-- número da OS sequencial por empresa (sem buracos em concorrência: trava a linha da empresa)
create or replace function public.tg_numero_os()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.empresas
       set proximo_numero_os = proximo_numero_os + 1
     where id = new.empresa_id
    returning proximo_numero_os - 1 into new.numero;
  else
    new.numero := old.numero;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'empresas', 'perfis', 'pragas', 'produtos', 'servicos',
    'clientes', 'locais', 'ordens_servico', 'os_pragas', 'os_produtos'
  ] loop
    execute format(
      'create trigger a_set_updated_at before insert or update on public.%I
         for each row execute function public.tg_set_updated_at()', t);
    execute format(
      'create index %I on public.%I (updated_at)', t || '_updated_at_idx', t);
  end loop;

  foreach t in array array[
    'pragas', 'produtos', 'servicos', 'clientes', 'locais',
    'ordens_servico', 'os_pragas', 'os_produtos'
  ] loop
    execute format(
      'create trigger b_set_empresa before insert or update on public.%I
         for each row execute function public.tg_set_empresa()', t);
    execute format(
      'create index %I on public.%I (empresa_id, updated_at)', t || '_empresa_idx', t);
  end loop;
end;
$$;

-- roda depois de b_set_empresa (triggers disparam em ordem alfabética)
create trigger c_numero_os before insert or update on public.ordens_servico
  for each row execute function public.tg_numero_os();

-- Impede referências cruzadas entre empresas (ex.: OS da empresa A
-- apontando para cliente da empresa B)
create or replace function public.tg_valida_referencias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean := true;
begin
  if tg_table_name = 'locais' then
    ok := exists (select 1 from clientes where id = new.cliente_id and empresa_id = new.empresa_id);
  elsif tg_table_name = 'ordens_servico' then
    ok := exists (select 1 from clientes where id = new.cliente_id and empresa_id = new.empresa_id)
      and (new.local_id is null
           or exists (select 1 from locais where id = new.local_id and empresa_id = new.empresa_id))
      and (new.servico_id is null
           or exists (select 1 from servicos where id = new.servico_id and empresa_id = new.empresa_id))
      and (new.tecnico_id is null
           or exists (select 1 from perfis where id = new.tecnico_id and empresa_id = new.empresa_id));
  elsif tg_table_name = 'os_pragas' then
    ok := exists (select 1 from ordens_servico where id = new.os_id and empresa_id = new.empresa_id)
      and exists (select 1 from pragas where id = new.praga_id and empresa_id = new.empresa_id);
  elsif tg_table_name = 'os_produtos' then
    ok := exists (select 1 from ordens_servico where id = new.os_id and empresa_id = new.empresa_id)
      and exists (select 1 from produtos where id = new.produto_id and empresa_id = new.empresa_id);
  end if;
  if not ok then
    raise exception 'REFERENCIA_INVALIDA: registro de % aponta para dados de outra empresa', tg_table_name;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['locais', 'ordens_servico', 'os_pragas', 'os_produtos'] loop
    execute format(
      'create trigger d_valida_referencias before insert or update on public.%I
         for each row execute function public.tg_valida_referencias()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfil criado automaticamente no cadastro (sem empresa ainda)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    'tecnico'  -- papel nunca vem do cliente; vira admin ao criar a própria empresa
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
