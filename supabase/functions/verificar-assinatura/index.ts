/**
 * Chamada pelo app logo após uma compra/restauração, para liberar o acesso
 * na hora (sem esperar o webhook).  Usa o JWT do usuário logado.
 */
import { admin, json, usuarioDaRequisicao } from '../_shared/supabase.ts';
import { sincronizarAssinatura } from '../_shared/assinatura.ts';

Deno.serve(async (req) => {
  const usuario = await usuarioDaRequisicao(req);
  if (!usuario) return json({ erro: 'não autenticado' }, 401);

  const { data: perfil } = await admin
    .from('perfis')
    .select('empresa_id, ativo')
    .eq('id', usuario.id)
    .maybeSingle();
  if (!perfil?.empresa_id || !perfil.ativo) return json({ erro: 'usuário sem empresa' }, 400);

  try {
    return json(await sincronizarAssinatura(perfil.empresa_id));
  } catch (e) {
    console.error(e);
    return json({ erro: String(e) }, 502);
  }
});
