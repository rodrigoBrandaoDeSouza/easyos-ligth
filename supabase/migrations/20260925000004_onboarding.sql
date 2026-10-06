-- =====================================================================
-- EasyOS Light - Cadastro de empresas e equipe (onboarding)
--
-- Fluxo:
--   1. Pessoa cria conta (Supabase Auth)   -> perfil sem empresa
--   2a. Dono:    criar_empresa(...)        -> vira admin, ganha 14 dias de teste
--   2b. Técnico: entrar_empresa(código)    -> entra na empresa como técnico
-- =====================================================================

-- Código de convite curto, sem caracteres ambíguos (0/O, 1/I)
create or replace function public.gerar_codigo_convite()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes    bytea := gen_random_bytes(8);
  codigo   text := '';
begin
  for i in 0..7 loop
    codigo := codigo || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return codigo;
end;
$$;

-- Catálogo inicial de cada empresa nova (serviços e pragas mais comuns).
-- Produtos NÃO são pré-cadastrados: cada empresa cadastra os seus, com o
-- registro na ANVISA, pois eles saem no certificado.
create or replace function public.copiar_catalogo_padrao(p_empresa uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.servicos (empresa_id, nome, descricao, garantia_dias) values
    (p_empresa, 'Desinsetização', 'Controle de insetos rasteiros e voadores', 90),
    (p_empresa, 'Desratização', 'Controle de roedores com iscas e armadilhas', 90),
    (p_empresa, 'Descupinização', 'Tratamento contra cupins de solo e madeira', 365),
    (p_empresa, 'Controle de pombos', 'Manejo e exclusão de aves', 90),
    (p_empresa, 'Sanitização', 'Desinfecção de ambientes', 30);

  insert into public.pragas (empresa_id, nome, nome_cientifico) values
    (p_empresa, 'Barata-alemã', 'Blattella germanica'),
    (p_empresa, 'Barata-americana', 'Periplaneta americana'),
    (p_empresa, 'Formigas', 'Formicidae'),
    (p_empresa, 'Cupim de solo', 'Coptotermes gestroi'),
    (p_empresa, 'Cupim de madeira seca', 'Cryptotermes brevis'),
    (p_empresa, 'Rato de telhado', 'Rattus rattus'),
    (p_empresa, 'Ratazana', 'Rattus norvegicus'),
    (p_empresa, 'Camundongo', 'Mus musculus'),
    (p_empresa, 'Mosquitos', 'Culicidae'),
    (p_empresa, 'Moscas', 'Musca domestica'),
    (p_empresa, 'Escorpião', 'Tityus serrulatus'),
    (p_empresa, 'Aranhas', 'Araneae'),
    (p_empresa, 'Pulgas', 'Siphonaptera'),
    (p_empresa, 'Carrapatos', 'Ixodida'),
    (p_empresa, 'Traças', 'Lepisma saccharina'),
    (p_empresa, 'Pombos', 'Columba livia');
$$;

-- ---------------------------------------------------------------------
-- 2a. Dono cria a empresa
-- ---------------------------------------------------------------------
create or replace function public.criar_empresa(
  p_razao_social  text,
  p_nome_fantasia text default null,
  p_cnpj          text default null,
  p_telefone      text default null,
  p_nome_usuario  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil  public.perfis;
  v_empresa uuid;
begin
  select * into v_perfil from public.perfis where id = auth.uid() for update;
  if v_perfil.id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if v_perfil.empresa_id is not null and v_perfil.ativo then
    raise exception 'JA_POSSUI_EMPRESA: este usuário já pertence a uma empresa';
  end if;
  if coalesce(trim(p_razao_social), '') = '' then
    raise exception 'Informe o nome da empresa';
  end if;

  insert into public.empresas (razao_social, nome_fantasia, cnpj, telefone, email, codigo_convite)
  values (trim(p_razao_social), nullif(trim(p_nome_fantasia), ''), nullif(trim(p_cnpj), ''),
          nullif(trim(p_telefone), ''), v_perfil.email, public.gerar_codigo_convite())
  returning id into v_empresa;

  update public.perfis
     set empresa_id = v_empresa,
         papel = 'admin',
         ativo = true,
         nome = coalesce(nullif(trim(p_nome_usuario), ''), nome)
   where id = v_perfil.id;

  perform public.copiar_catalogo_padrao(v_empresa);
  return v_empresa;
end;
$$;

-- ---------------------------------------------------------------------
-- 2b. Técnico/atendente entra com o código de convite
-- ---------------------------------------------------------------------
create or replace function public.entrar_empresa(p_codigo text, p_nome_usuario text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil  public.perfis;
  v_empresa uuid;
begin
  select * into v_perfil from public.perfis where id = auth.uid() for update;
  if v_perfil.id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if v_perfil.empresa_id is not null and v_perfil.ativo then
    raise exception 'JA_POSSUI_EMPRESA: este usuário já pertence a uma empresa';
  end if;

  select id into v_empresa from public.empresas
   where codigo_convite = upper(trim(p_codigo)) and not deleted;
  if v_empresa is null then
    raise exception 'CODIGO_INVALIDO: código de convite não encontrado';
  end if;

  update public.perfis
     set empresa_id = v_empresa,
         papel = 'tecnico',
         ativo = true,
         nome = coalesce(nullif(trim(p_nome_usuario), ''), nome)
   where id = v_perfil.id;
  return v_empresa;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin gera um novo código (invalida o anterior)
-- ---------------------------------------------------------------------
create or replace function public.novo_codigo_convite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := public.gerar_codigo_convite();
begin
  if public.papel_atual() is distinct from 'admin' then
    raise exception 'Apenas o administrador pode gerar convites';
  end if;
  update public.empresas set codigo_convite = v_codigo where id = public.empresa_atual();
  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin remove alguém da equipe (o usuário volta a ficar "sem empresa")
-- ---------------------------------------------------------------------
create or replace function public.remover_da_equipe(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.papel_atual() is distinct from 'admin' then
    raise exception 'Apenas o administrador pode remover usuários';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode remover a si mesmo';
  end if;
  update public.perfis
     set ativo = false
   where id = p_usuario and empresa_id = public.empresa_atual();
end;
$$;

revoke all on function public.gerar_codigo_convite()          from public, anon, authenticated;
revoke all on function public.copiar_catalogo_padrao(uuid)    from public, anon, authenticated;
revoke all on function public.criar_empresa(text, text, text, text, text) from public, anon;
revoke all on function public.entrar_empresa(text, text)      from public, anon;
revoke all on function public.novo_codigo_convite()           from public, anon;
revoke all on function public.remover_da_equipe(uuid)         from public, anon;
grant execute on function public.criar_empresa(text, text, text, text, text) to authenticated;
grant execute on function public.entrar_empresa(text, text)   to authenticated;
grant execute on function public.novo_codigo_convite()        to authenticated;
grant execute on function public.remover_da_equipe(uuid)      to authenticated;
