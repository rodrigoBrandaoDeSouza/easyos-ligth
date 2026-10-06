/**
 * Espelho local (SQLite) das tabelas do Supabase.
 * O aparelho só guarda dados da empresa do usuário logado, por isso as
 * tabelas locais não têm empresa_id (o servidor preenche no envio).
 *
 * Toda tabela local tem duas colunas de controle:
 *   _status      'synced' | 'pending'  -> pending = alterado offline, falta enviar
 *   _changed_at  quando foi alterado localmente (usado para não "perder" uma
 *                edição feita durante o envio)
 */

export type NomeTabela =
  | 'empresas'
  | 'perfis'
  | 'pragas'
  | 'produtos'
  | 'servicos'
  | 'clientes'
  | 'locais'
  | 'ordens_servico'
  | 'os_pragas'
  | 'os_produtos';

interface DefTabela {
  colunas: readonly string[];
  /** colunas booleanas (SQLite guarda 0/1, Postgres espera true/false) */
  booleanas: readonly string[];
  /** o app envia alterações desta tabela para o servidor? */
  envia: boolean;
}

const base = ['id', 'created_at', 'updated_at', 'deleted'] as const;

export const TABELAS: Record<NomeTabela, DefTabela> = {
  empresas: {
    colunas: [...base, 'razao_social', 'nome_fantasia', 'cnpj', 'endereco', 'telefone', 'email',
      'licenca_sanitaria', 'responsavel_tecnico', 'rt_registro', 'ciatox_telefone',
      'codigo_convite', 'assinatura_status', 'trial_ate', 'assinatura_expira_em',
      'assinatura_produto', 'assinatura_renova'],
    booleanas: ['deleted', 'assinatura_renova'],
    envia: false, // editada online pelo admin (tela Empresa); assinatura só pelo servidor
  },
  perfis: {
    colunas: [...base, 'empresa_id', 'nome', 'email', 'telefone', 'papel', 'ativo'],
    booleanas: ['deleted', 'ativo'],
    envia: false,
  },
  pragas: {
    colunas: [...base, 'nome', 'nome_cientifico', 'ativo'],
    booleanas: ['deleted', 'ativo'],
    envia: true,
  },
  produtos: {
    colunas: [...base, 'nome_comercial', 'principio_ativo', 'grupo_quimico', 'concentracao',
      'registro_ms', 'unidade', 'antidoto', 'ativo'],
    booleanas: ['deleted', 'ativo'],
    envia: true,
  },
  servicos: {
    colunas: [...base, 'nome', 'descricao', 'garantia_dias', 'ativo'],
    booleanas: ['deleted', 'ativo'],
    envia: true,
  },
  clientes: {
    colunas: [...base, 'tipo_pessoa', 'nome', 'documento', 'email', 'telefone', 'contato',
      'observacoes', 'created_by'],
    booleanas: ['deleted'],
    envia: true,
  },
  locais: {
    colunas: [...base, 'cliente_id', 'descricao', 'cep', 'logradouro', 'numero', 'complemento',
      'bairro', 'cidade', 'uf', 'tipo_imovel', 'area_m2'],
    booleanas: ['deleted'],
    envia: true,
  },
  ordens_servico: {
    colunas: [...base, 'numero', 'cliente_id', 'local_id', 'servico_id', 'tecnico_id', 'status',
      'agendada_para', 'iniciada_em', 'concluida_em', 'observacoes', 'relatorio', 'recomendacoes',
      'responsavel_local_nome', 'responsavel_local_documento', 'assinatura_cliente', 'garantia_ate',
      'certificado_codigo', 'created_by'],
    booleanas: ['deleted'],
    envia: true,
  },
  os_pragas: {
    colunas: [...base, 'os_id', 'praga_id'],
    booleanas: ['deleted'],
    envia: true,
  },
  os_produtos: {
    colunas: [...base, 'os_id', 'produto_id', 'quantidade', 'unidade', 'diluicao', 'lote',
      'area_aplicada'],
    booleanas: ['deleted'],
    envia: true,
  },
};

/** Ordem de envio (respeita chaves estrangeiras) */
export const TABELAS_ENVIO: NomeTabela[] = [
  'pragas',
  'produtos',
  'servicos',
  'clientes',
  'locais',
  'ordens_servico',
  'os_pragas',
  'os_produtos',
];

/** Colunas de data/hora: normalizadas para ISO UTC ("...Z") para comparar como texto */
export const COLUNAS_TIMESTAMP = new Set([
  'created_at',
  'updated_at',
  'agendada_para',
  'iniciada_em',
  'concluida_em',
  'trial_ate',
  'assinatura_expira_em',
]);

const INDICES = [
  'create index if not exists ix_locais_cliente on locais (cliente_id)',
  'create index if not exists ix_os_agenda on ordens_servico (agendada_para)',
  'create index if not exists ix_os_cliente on ordens_servico (cliente_id)',
  'create index if not exists ix_os_pragas_os on os_pragas (os_id)',
  'create index if not exists ix_os_produtos_os on os_produtos (os_id)',
  'create index if not exists ix_clientes_nome on clientes (nome)',
];

export function ddl(): string {
  const tabelas = (Object.keys(TABELAS) as NomeTabela[]).map((nome) => {
    const cols = TABELAS[nome].colunas
      .map((c) => (c === 'id' ? 'id text primary key not null' : c))
      .join(',\n  ');
    return `create table if not exists ${nome} (
  ${cols},
  _status text not null default 'synced',
  _changed_at text
);
create index if not exists ix_${nome}_status on ${nome} (_status);`;
  });

  return [
    'pragma journal_mode = wal;',
    'create table if not exists meta (chave text primary key not null, valor text);',
    ...tabelas,
    ...INDICES.map((i) => i + ';'),
  ].join('\n');
}
