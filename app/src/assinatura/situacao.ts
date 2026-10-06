import type { Empresa } from '@/db/repos';

const DIA = 24 * 60 * 60 * 1000;
/**
 * Tolerância no aparelho após o vencimento. É maior que a do servidor (3 dias)
 * porque o técnico pode estar sem internet e a renovação ainda não ter chegado.
 * O que for feito nesse período fica pendente até a assinatura ser confirmada.
 */
const TOLERANCIA_APARELHO = 7 * DIA;

export interface Situacao {
  liberado: boolean;
  tipo: 'teste' | 'ativa' | 'carencia' | 'vencida';
  /** data até quando vale (teste ou assinatura) */
  ate: string | null;
  diasRestantes: number | null;
}

export function situacaoAssinatura(e: Empresa | null | undefined, agora = Date.now()): Situacao {
  if (!e) return { liberado: true, tipo: 'teste', ate: null, diasRestantes: null }; // ainda carregando
  const trial = e.trial_ate ? Date.parse(e.trial_ate) : 0;
  const expira = e.assinatura_expira_em ? Date.parse(e.assinatura_expira_em) : 0;
  const dias = (t: number) => Math.max(0, Math.ceil((t - agora) / DIA));

  if (expira > agora) return { liberado: true, tipo: 'ativa', ate: e.assinatura_expira_em, diasRestantes: dias(expira) };
  if (trial > agora) return { liberado: true, tipo: 'teste', ate: e.trial_ate, diasRestantes: dias(trial) };
  if (expira && expira + TOLERANCIA_APARELHO > agora) {
    return { liberado: true, tipo: 'carencia', ate: e.assinatura_expira_em, diasRestantes: dias(expira + TOLERANCIA_APARELHO) };
  }
  return { liberado: false, tipo: 'vencida', ate: e.assinatura_expira_em ?? e.trial_ate, diasRestantes: 0 };
}
