/**
 * Motor de sincronização offline-first.
 *
 *  1. PUSH: envia em uma única transação (RPC sync_push) tudo que está
 *     com _status = 'pending'. Só marca como 'synced' se o registro não foi
 *     alterado de novo durante o envio (_changed_at igual).
 *  2. PULL: busca no servidor (RPC sync_pull) tudo que mudou desde o último
 *     pull e grava localmente — sem sobrescrever registros ainda pendentes.
 *
 * Dispara automaticamente: ao voltar a internet, ao abrir o app, após cada
 * alteração local (com pequeno atraso) e a cada 5 minutos.
 */
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  db,
  consultar,
  gravarMeta,
  lerMeta,
  limparDadosEmpresa,
  notificarMudanca,
  registrarAoAlterarLocal,
  Row,
} from '@/db/database';
import { COLUNAS_TIMESTAMP, NomeTabela, TABELAS, TABELAS_ENVIO } from '@/db/schema';

export interface EstadoSync {
  online: boolean;
  sincronizando: boolean;
  pendentes: number;
  ultimaSync: string | null;
  erro: string | null;
}

let estado: EstadoSync = {
  online: false,
  sincronizando: false,
  pendentes: 0,
  ultimaSync: null,
  erro: null,
};
const ouvintes = new Set<() => void>();

function atualizar(parcial: Partial<EstadoSync>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((fn) => fn());
}
export function obterEstadoSync(): EstadoSync {
  return estado;
}
export function assinarEstadoSync(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

export async function contarPendentes(): Promise<number> {
  let total = 0;
  for (const t of TABELAS_ENVIO) {
    const r = await consultar<{ n: number }>(
      `select count(*) as n from ${t} where _status = 'pending'`
    );
    total += r[0]?.n ?? 0;
  }
  return total;
}

// ---------------------------------------------------------------------------
// PUSH
// ---------------------------------------------------------------------------
function paraServidor(tabela: NomeTabela, linha: Row): Row {
  const def = TABELAS[tabela];
  const r: Row = {};
  for (const c of def.colunas) {
    if (c === 'updated_at' || c === 'numero') continue; // controlados pelo servidor
    const v = linha[c];
    r[c] = def.booleanas.includes(c) ? v === 1 || v === true : v ?? null;
  }
  return r;
}

async function enviar(): Promise<void> {
  const payload: Record<string, Row[]> = {};
  const enviados: { tabela: NomeTabela; id: string; changedAt: string | null }[] = [];

  for (const t of TABELAS_ENVIO) {
    const linhas = await consultar(`select * from ${t} where _status = 'pending'`);
    if (!linhas.length) continue;
    payload[t] = linhas.map((l) => paraServidor(t, l));
    linhas.forEach((l) => enviados.push({ tabela: t, id: l.id, changedAt: l._changed_at }));
  }
  if (!enviados.length) return;

  const { error } = await supabase.rpc('sync_push', { p_alteracoes: payload });
  if (error) throw new Error(`Falha ao enviar: ${error.message}`);

  await db().withTransactionAsync(async () => {
    for (const e of enviados) {
      await db().runAsync(
        `update ${e.tabela} set _status = 'synced'
          where id = ? and _status = 'pending' and _changed_at is ?`,
        [e.id, e.changedAt]
      );
    }
  });
}

// ---------------------------------------------------------------------------
// PULL
// ---------------------------------------------------------------------------
function paraLocal(tabela: NomeTabela, col: string, v: unknown) {
  if (v === null || v === undefined) return null;
  if (TABELAS[tabela].booleanas.includes(col)) return v ? 1 : 0;
  if (COLUNAS_TIMESTAMP.has(col) && typeof v === 'string') return new Date(v).toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v as string | number;
}

async function receber(): Promise<void> {
  const desde = await lerMeta('ultimo_pull');
  const { data, error } = await supabase.rpc('sync_pull', { p_desde: desde });
  if (error) throw new Error(`Falha ao receber: ${error.message}`);

  const resposta = data as { servidor_em: string; alteracoes: Record<string, Row[]> };
  let houveMudanca = false;

  await db().withTransactionAsync(async () => {
    for (const tabela of Object.keys(TABELAS) as NomeTabela[]) {
      const linhas = resposta.alteracoes[tabela] ?? [];
      if (!linhas.length) continue;
      houveMudanca = true;
      const cols = TABELAS[tabela].colunas;
      const sql = `insert into ${tabela} (${cols.join(', ')}, _status, _changed_at)
        values (${cols.map(() => '?').join(', ')}, 'synced', null)
        on conflict(id) do update set ${cols
          .filter((c) => c !== 'id')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ')}
        where ${tabela}._status = 'synced'`; // não sobrescreve edição local pendente
      for (const linha of linhas) {
        await db().runAsync(
          sql,
          cols.map((c) => paraLocal(tabela, c, linha[c]))
        );
      }
    }
    await gravarMeta('ultimo_pull', resposta.servidor_em);
  });

  if (houveMudanca) notificarMudanca();
}

// ---------------------------------------------------------------------------
// Escopo: empresa e papel do usuário. Se mudarem, os dados locais são
// recarregados do zero (outra empresa, ou agora vê mais/menos OS).
// ---------------------------------------------------------------------------
async function verificarEscopo(usuarioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('perfis')
    .select('empresa_id, papel, ativo')
    .eq('id', usuarioId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const empresa = data?.ativo ? (data.empresa_id as string | null) : null;
  const papel = empresa ? (data!.papel as string) : null;
  const atual = `${empresa ?? '-'}|${papel ?? '-'}`;
  const anterior = await lerMeta('escopo');

  if (anterior !== null && anterior !== atual) {
    const empresaAnterior = anterior.split('|')[0];
    await limparDadosEmpresa(empresaAnterior !== (empresa ?? '-'));
  }
  await gravarMeta('escopo', atual);
  return !!empresa;
}

function traduzirErro(msg: string): string {
  if (msg.includes('ASSINATURA_INATIVA')) return 'Assinatura vencida: as alterações ficam no aparelho até a renovação.';
  if (msg.includes('SEM_EMPRESA')) return 'Seu usuário não está vinculado a uma empresa.';
  if (msg.includes('REFERENCIA_INVALIDA')) return 'Há registros que apontam para dados inválidos. Fale com o suporte.';
  if (/network|fetch/i.test(msg)) return 'Falha de conexão. Tentaremos de novo automaticamente.';
  return msg;
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------
let emAndamento: Promise<void> | null = null;

export function sincronizar(): Promise<void> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    try {
      const rede = await NetInfo.fetch();
      const online = !!rede.isConnected && rede.isInternetReachable !== false;
      atualizar({ online });
      if (!online) return;

      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      atualizar({ sincronizando: true, erro: null });
      const temEmpresa = await verificarEscopo(data.session.user.id);

      // envia primeiro; se falhar (ex.: assinatura vencida) ainda assim recebe,
      // para trazer uma renovação feita em outro aparelho
      let erroEnvio: string | null = null;
      if (temEmpresa) {
        try {
          await enviar();
        } catch (e: any) {
          erroEnvio = traduzirErro(e?.message ?? String(e));
        }
      }
      await receber();
      const agora = new Date().toISOString();
      await gravarMeta('ultima_sync', agora);
      atualizar({ ultimaSync: agora, erro: erroEnvio });
    } catch (e: any) {
      atualizar({ erro: traduzirErro(e?.message ?? String(e)) });
    } finally {
      atualizar({ sincronizando: false, pendentes: await contarPendentes().catch(() => 0) });
      emAndamento = null;
    }
  })();
  return emAndamento;
}

let timerAlteracao: ReturnType<typeof setTimeout> | null = null;

/** Liga os gatilhos automáticos. Retorna função para desligar. */
export function iniciarSyncAutomatico(): () => void {
  registrarAoAlterarLocal(() => {
    contarPendentes().then((pendentes) => atualizar({ pendentes }));
    if (timerAlteracao) clearTimeout(timerAlteracao);
    timerAlteracao = setTimeout(() => void sincronizar(), 3000);
  });

  lerMeta('ultima_sync').then((ultimaSync) => atualizar({ ultimaSync }));

  let estavaOnline = false;
  const cancelarRede = NetInfo.addEventListener((s) => {
    const online = !!s.isConnected && s.isInternetReachable !== false;
    atualizar({ online });
    if (online && !estavaOnline) void sincronizar(); // sinal voltou
    estavaOnline = online;
  });

  const assinaturaApp = AppState.addEventListener('change', (s) => {
    if (s === 'active') void sincronizar();
  });
  const intervalo = setInterval(() => void sincronizar(), 5 * 60 * 1000);

  void sincronizar();

  return () => {
    cancelarRede();
    assinaturaApp.remove();
    clearInterval(intervalo);
    if (timerAlteracao) clearTimeout(timerAlteracao);
    registrarAoAlterarLocal(() => {});
  };
}
