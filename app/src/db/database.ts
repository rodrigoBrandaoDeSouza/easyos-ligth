import * as SQLite from 'expo-sqlite';
import { ddl, NomeTabela, TABELAS } from './schema';
import { novoId } from '@/lib/uuid';

export type Row = Record<string, any>;

let _db: SQLite.SQLiteDatabase | null = null;

export function db(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Banco local ainda não foi inicializado');
  return _db;
}

/** Abre o banco e cria/atualiza as tabelas locais. */
export async function iniciarBanco(): Promise<void> {
  if (_db) return;
  const conn = await SQLite.openDatabaseAsync('easyos.db');
  await conn.execAsync(ddl());

  // "migração" simples: adiciona colunas novas que ainda não existem no aparelho
  for (const nome of Object.keys(TABELAS) as NomeTabela[]) {
    const existentes = await conn.getAllAsync<{ name: string }>(`pragma table_info(${nome})`);
    const set = new Set(existentes.map((c) => c.name));
    for (const col of TABELAS[nome].colunas) {
      if (!set.has(col)) await conn.execAsync(`alter table ${nome} add column ${col}`);
    }
  }
  _db = conn;
}

// ---------------------------------------------------------------------------
// Eventos: telas se inscrevem para recarregar quando o banco muda
// ---------------------------------------------------------------------------
type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let aoAlterarLocal: (() => void) | null = null;

export function aoMudarBanco(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}
export function notificarMudanca(): void {
  ouvintes.forEach((fn) => fn());
}
/** O módulo de sync registra aqui para ser avisado de alterações locais. */
export function registrarAoAlterarLocal(fn: () => void): void {
  aoAlterarLocal = fn;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function consultar<T = Row>(sql: string, params: SQLite.SQLiteBindValue[] = []) {
  return db().getAllAsync<T>(sql, params);
}
export function primeiro<T = Row>(sql: string, params: SQLite.SQLiteBindValue[] = []) {
  return db().getFirstAsync<T>(sql, params);
}

export async function lerMeta(chave: string): Promise<string | null> {
  const r = await primeiro<{ valor: string | null }>('select valor from meta where chave = ?', [chave]);
  return r?.valor ?? null;
}
export async function gravarMeta(chave: string, valor: string | null): Promise<void> {
  await db().runAsync(
    'insert into meta (chave, valor) values (?, ?) on conflict(chave) do update set valor = excluded.valor',
    [chave, valor]
  );
}

// ---------------------------------------------------------------------------
// Escrita local (sempre offline-first): grava e marca como pendente de envio
// ---------------------------------------------------------------------------
function paraSqlite(v: unknown): SQLite.SQLiteBindValue {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as SQLite.SQLiteBindValue;
}

/**
 * Cria (sem id) ou atualiza (com id existente) um registro local.
 * Retorna o id do registro.
 */
export async function salvar(tabela: NomeTabela, dados: Row): Promise<string> {
  const def = TABELAS[tabela];
  const agora = new Date().toISOString();
  const cols = Object.keys(dados).filter((c) => def.colunas.includes(c) && c !== 'id');

  const existe = dados.id
    ? await primeiro(`select id from ${tabela} where id = ?`, [dados.id])
    : null;

  let id: string;
  if (existe) {
    id = dados.id;
    const sets = [...cols.map((c) => `${c} = ?`), `_status = 'pending'`, '_changed_at = ?'];
    await db().runAsync(`update ${tabela} set ${sets.join(', ')} where id = ?`, [
      ...cols.map((c) => paraSqlite(dados[c])),
      agora,
      id,
    ]);
  } else {
    id = dados.id ?? novoId();
    const registro: Row = { created_at: agora, updated_at: agora, deleted: 0, ...dados, id };
    const todas = Object.keys(registro).filter((c) => def.colunas.includes(c));
    await db().runAsync(
      `insert into ${tabela} (${todas.join(', ')}, _status, _changed_at)
       values (${todas.map(() => '?').join(', ')}, 'pending', ?)`,
      [...todas.map((c) => paraSqlite(registro[c])), agora]
    );
  }

  notificarMudanca();
  aoAlterarLocal?.();
  return id;
}

/** Exclusão lógica (sincroniza com o servidor como deleted = true). */
export function excluir(tabela: NomeTabela, id: string): Promise<string> {
  return salvar(tabela, { id, deleted: 1 });
}

/** Apaga todos os dados locais (troca de usuário / sair). */
export async function limparBancoLocal(): Promise<void> {
  const nomes = Object.keys(TABELAS) as NomeTabela[];
  await db().withTransactionAsync(async () => {
    for (const n of nomes) await db().runAsync(`delete from ${n}`);
    await db().runAsync('delete from meta');
  });
  notificarMudanca();
}

/**
 * Apaga os dados de negócio mas mantém o usuário logado; o próximo pull traz
 * tudo de novo, já com o escopo certo.
 *  - trocou de empresa / foi removido: apaga TUDO, inclusive pendentes
 *    (eles pertencem à empresa antiga e não podem ir para a nova)
 *  - só mudou de papel na mesma empresa: preserva o que está pendente
 */
export async function limparDadosEmpresa(inclusivePendentes: boolean): Promise<void> {
  const filtro = inclusivePendentes ? '' : " where _status = 'synced'";
  await db().withTransactionAsync(async () => {
    for (const n of Object.keys(TABELAS) as NomeTabela[]) {
      await db().runAsync(`delete from ${n}${filtro}`);
    }
    await db().runAsync(`delete from meta where chave = 'ultimo_pull'`);
  });
  notificarMudanca();
}
