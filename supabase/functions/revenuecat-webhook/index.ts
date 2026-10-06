/**
 * Webhook do RevenueCat -> atualiza a assinatura da empresa.
 *
 * Deploy SEM verificação de JWT (o RevenueCat não tem token do Supabase):
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 *
 * No painel do RevenueCat (Integrations > Webhooks), configure o
 * "Authorization header value" com:  Bearer <REVENUECAT_WEBHOOK_SECRET>
 */
import { json } from '../_shared/supabase.ts';
import { pareceIdEmpresa, sincronizarAssinatura } from '../_shared/assinatura.ts';

const SEGREDO = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'método não permitido' }, 405);
  if (req.headers.get('Authorization') !== `Bearer ${SEGREDO}`) {
    return json({ erro: 'não autorizado' }, 401);
  }

  const { event } = await req.json();
  if (!event) return json({ ok: true, ignorado: 'sem evento' });

  // Todos os IDs que podem ser a empresa (inclui transferências entre contas)
  const candidatos = new Set<string>(
    [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases ?? []),
      ...(event.transferred_from ?? []),
      ...(event.transferred_to ?? []),
    ].filter(pareceIdEmpresa)
  );

  try {
    const resultados = [];
    for (const id of candidatos) resultados.push(await sincronizarAssinatura(id));
    console.log('webhook', event.type, JSON.stringify(resultados));
    return json({ ok: true, resultados });
  } catch (e) {
    console.error('webhook erro', e);
    return json({ erro: String(e) }, 500); // RevenueCat tenta de novo
  }
});
