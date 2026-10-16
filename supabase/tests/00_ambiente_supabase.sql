-- =====================================================================
-- Simula o mínimo do Supabase num Postgres puro, para rodar as migrations
-- e os cenários de teste localmente (ver rodar.sh).
-- NÃO aplicar no Supabase de verdade.
-- =====================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- no Supabase, anon/authenticated recebem privilégios padrão no schema public;
-- as migrations então revogam o que não deve existir
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- no Supabase as extensões (pgcrypto etc.) ficam no schema "extensions"
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto schema extensions;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key,
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Utilitários dos testes
-- ---------------------------------------------------------------------
create schema teste;
grant usage on schema teste to anon, authenticated;

/** Passa a agir como o usuário informado (papel authenticated + JWT sub). */
create function teste.como(p_usuario uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', p_usuario::text, false);
end;
$$;

create function teste.confere(p_ok boolean, p_mensagem text)
returns void
language plpgsql
as $$
begin
  if p_ok is distinct from true then
    raise exception 'FALHOU: %', p_mensagem;
  end if;
  raise notice 'ok - %', p_mensagem;
end;
$$;

/** A lista de ids (jsonb) contém o id? */
create function teste.contem(p_lista jsonb, p_id uuid)
returns boolean
language sql
immutable
as $$
  select coalesce(p_lista, '[]'::jsonb) ? p_id::text;
$$;

/** Algum objeto do array tem campo = valor? */
create function teste.tem_linha(p_linhas jsonb, p_campo text, p_valor uuid)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) e
     where e ->> p_campo = p_valor::text
  );
$$;

grant execute on all functions in schema teste to anon, authenticated;
