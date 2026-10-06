-- =====================================================================
-- EasyOS Light - Segurança (Row Level Security) multi-empresa
--
-- Regra de ouro: um usuário só enxerga dados da SUA empresa.
-- Escrita exige, além do papel, assinatura em dia (ou período de teste).
--
-- Papéis (dentro da empresa):
--   admin     -> tudo, inclusive catálogos, dados da empresa e equipe
--   atendente -> clientes, agenda de todos os técnicos e catálogos
--   tecnico   -> clientes (cadastro em campo) e apenas as SUAS OS
-- =====================================================================

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.perfis
   where id = auth.uid() and ativo and not deleted and empresa_id is not null;
$$;

create or replace function public.eh_equipe_interna()
returns boolean
language sql
stable
as $$
  select coalesce(public.papel_atual() in ('admin', 'atendente'), false);
$$;

-- Assinatura em dia? 3 dias de tolerância para atraso na renovação da loja.
create or replace function public.assinatura_ok(p_empresa uuid default public.empresa_atual())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select e.trial_ate > now()
        or coalesce(e.assinatura_expira_em, '-infinity') > now() - interval '3 days'
      from public.empresas e
     where e.id = p_empresa and not e.deleted
  ), false);
$$;

create or replace function public.pode_escrever()
returns boolean
language sql
stable
as $$
  select public.papel_atual() is not null and public.assinatura_ok();
$$;

create or replace function public.pode_acessar_os(p_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ordens_servico o
     where o.id = p_os_id
       and o.empresa_id = public.empresa_atual()
       and (public.eh_equipe_interna() or o.tecnico_id = auth.uid())
  );
$$;

alter table public.empresas       enable row level security;
alter table public.perfis         enable row level security;
alter table public.pragas         enable row level security;
alter table public.produtos       enable row level security;
alter table public.servicos       enable row level security;
alter table public.clientes       enable row level security;
alter table public.locais         enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.os_pragas      enable row level security;
alter table public.os_produtos    enable row level security;

-- Nada para usuários anônimos
revoke all on all tables in schema public from anon;

-- Empresas ---------------------------------------------------------------
-- Criação só pela RPC criar_empresa. Assinatura só pelas Edge Functions.
create policy empresas_select on public.empresas for select to authenticated
  using (id = public.empresa_atual());
create policy empresas_update on public.empresas for update to authenticated
  using (id = public.empresa_atual() and public.papel_atual() = 'admin')
  with check (id = public.empresa_atual() and public.papel_atual() = 'admin');

revoke insert, update, delete on public.empresas from authenticated;
grant update (razao_social, nome_fantasia, cnpj, endereco, telefone, email,
              licenca_sanitaria, responsavel_tecnico, rt_registro, ciatox_telefone)
  on public.empresas to authenticated;

-- Perfis -----------------------------------------------------------------
create policy perfis_select on public.perfis for select to authenticated
  using (id = auth.uid() or empresa_id = public.empresa_atual());
create policy perfis_admin on public.perfis for update to authenticated
  using (empresa_id = public.empresa_atual() and public.papel_atual() = 'admin')
  with check (empresa_id = public.empresa_atual() and public.papel_atual() = 'admin');

revoke insert, update, delete on public.perfis from authenticated;
grant update (nome, telefone, papel, ativo) on public.perfis to authenticated;

-- Catálogos -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pragas', 'produtos', 'servicos'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (empresa_id = public.empresa_atual())', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (empresa_id = public.empresa_atual()
                     and public.eh_equipe_interna() and public.pode_escrever())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (empresa_id = public.empresa_atual() and public.eh_equipe_interna())
         with check (empresa_id = public.empresa_atual()
                     and public.eh_equipe_interna() and public.pode_escrever())',
      t || '_update', t);
  end loop;
end;
$$;

-- Clientes e locais (todos os usuários ativos da empresa) --------------------
do $$
declare t text;
begin
  foreach t in array array['clientes', 'locais'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (empresa_id = public.empresa_atual())', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (empresa_id = public.empresa_atual() and public.pode_escrever())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (empresa_id = public.empresa_atual())
         with check (empresa_id = public.empresa_atual() and public.pode_escrever())',
      t || '_update', t);
  end loop;
end;
$$;

-- Ordens de serviço -------------------------------------------------------
create policy os_select on public.ordens_servico for select to authenticated
  using (empresa_id = public.empresa_atual()
         and (public.eh_equipe_interna() or tecnico_id = auth.uid()));
create policy os_insert on public.ordens_servico for insert to authenticated
  with check (empresa_id = public.empresa_atual() and public.pode_escrever()
              and (public.eh_equipe_interna() or tecnico_id = auth.uid()));
create policy os_update on public.ordens_servico for update to authenticated
  using (empresa_id = public.empresa_atual()
         and (public.eh_equipe_interna() or tecnico_id = auth.uid()))
  with check (empresa_id = public.empresa_atual() and public.pode_escrever()
              and (public.eh_equipe_interna() or tecnico_id = auth.uid()));

-- Itens da OS (herdam o acesso da OS) --------------------------------------
do $$
declare t text;
begin
  foreach t in array array['os_pragas', 'os_produtos'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.pode_acessar_os(os_id))', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.pode_acessar_os(os_id) and public.pode_escrever())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.pode_acessar_os(os_id))
         with check (public.pode_acessar_os(os_id) and public.pode_escrever())',
      t || '_update', t);
  end loop;
end;
$$;

-- Sem DELETE físico via API: exclusão é lógica (deleted = true).
revoke delete on all tables in schema public from authenticated;
