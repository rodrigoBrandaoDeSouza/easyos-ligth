/**
 * Exclusão da conta pelo próprio usuário (exigência da Apple e do Google
 * para apps que permitem criar conta).
 *
 * - Técnico/atendente: a conta é apagada; as OS continuam na empresa.
 * - Único administrador de uma empresa com outros usuários ativos: bloqueado
 *   (precisa promover outro admin ou remover a equipe antes).
 * - Único usuário da empresa: a empresa é desativada junto.
 *
 * Obs.: cancelar a assinatura é feito pelo usuário na loja (Apple/Google).
 */
import { admin, json, usuarioDaRequisicao } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const usuario = await usuarioDaRequisicao(req);
  if (!usuario) return json({ erro: 'não autenticado' }, 401);

  const { data: perfil } = await admin
    .from('perfis')
    .select('empresa_id, papel, ativo')
    .eq('id', usuario.id)
    .maybeSingle();

  if (perfil?.empresa_id && perfil.ativo) {
    const { data: equipe } = await admin
      .from('perfis')
      .select('id, papel')
      .eq('empresa_id', perfil.empresa_id)
      .eq('ativo', true)
      .eq('deleted', false)
      .neq('id', usuario.id);

    const outros: { id: string; papel: string }[] = equipe ?? [];
    const outrosAdmins = outros.filter((p) => p.papel === 'admin');

    if (perfil.papel === 'admin' && outros.length > 0 && outrosAdmins.length === 0) {
      return json(
        { erro: 'Você é o único administrador. Promova outro usuário a administrador ou remova a equipe antes de excluir sua conta.' },
        409
      );
    }
    if (outros.length === 0) {
      await admin.from('empresas').update({ deleted: true }).eq('id', perfil.empresa_id);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(usuario.id);
  if (error) return json({ erro: error.message }, 500);
  return json({ ok: true });
});
