/**
 * Consulta o RevenueCat e grava a situação da assinatura na empresa.
 *
 * No app, o "App User ID" do RevenueCat é o ID DA EMPRESA (Purchases.logIn),
 * então a assinatura pertence à empresa e vale para todos os usuários dela.
 *
 * Em vez de confiar no conteúdo de cada evento, sempre buscamos o estado atual
 * do assinante na API do RevenueCat (recomendação da própria RevenueCat).
 */
import { admin } from './supabase.ts';

const RC_SECRET = Deno.env.get('REVENUECAT_SECRET_KEY')!;
const ENTITLEMENT = Deno.env.get('REVENUECAT_ENTITLEMENT') ?? 'pro';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const pareceIdEmpresa = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

export async function sincronizarAssinatura(empresaId: string) {
  const { data: empresa } = await admin
    .from('empresas')
    .select('id')
    .eq('id', empresaId)
    .maybeSingle();
  if (!empresa) return null; // não é uma empresa nossa (ex.: ID anônimo do RevenueCat)

  const r = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(empresaId)}`,
    { headers: { Authorization: `Bearer ${RC_SECRET}`, 'Content-Type': 'application/json' } }
  );
  if (!r.ok) throw new Error(`RevenueCat respondeu ${r.status}: ${await r.text()}`);
  const { subscriber } = await r.json();

  const ent = subscriber?.entitlements?.[ENTITLEMENT];
  if (!ent) return { empresaId, status: 'sem_assinatura' }; // continua no teste / expirada

  // expires_date nulo = compra vitalícia
  const expira = ent.expires_date ? new Date(ent.expires_date) : new Date('2999-12-31');
  const produto: string | null = ent.product_identifier ?? null;
  const sub = produto ? subscriber?.subscriptions?.[produto] : null;
  const renova = sub ? !sub.unsubscribe_detected_at : null;
  const status = expira > new Date() ? 'ativa' : 'expirada';

  const { error } = await admin
    .from('empresas')
    .update({
      assinatura_status: status,
      assinatura_expira_em: expira.toISOString(),
      assinatura_produto: produto,
      assinatura_renova: renova,
    })
    .eq('id', empresaId);
  if (error) throw error;

  return { empresaId, status, expira: expira.toISOString(), produto, renova };
}
