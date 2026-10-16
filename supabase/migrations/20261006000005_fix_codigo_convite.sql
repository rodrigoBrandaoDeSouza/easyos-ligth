-- =====================================================================
-- Correção: gen_random_bytes não encontrada ao criar empresa.
--
-- No Supabase o pgcrypto fica no schema "extensions". gerar_codigo_convite()
-- é chamada de dentro de funções com search_path = public, então precisa
-- referenciar a função com o schema completo.
--
-- (Aplicada direto no Supabase em 2026-10-06; trazida para o repositório em
-- 2026-10-16 com o mesmo conteúdo.)
-- =====================================================================

create or replace function public.gerar_codigo_convite()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes    bytea := extensions.gen_random_bytes(8);
  codigo   text := '';
begin
  for i in 0..7 loop
    codigo := codigo || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return codigo;
end;
$$;
