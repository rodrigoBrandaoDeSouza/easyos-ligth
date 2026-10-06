/** Consultas de leitura usadas pelas telas (todas no banco local). */
import { consultar, primeiro } from './database';

export interface Cliente {
  id: string;
  tipo_pessoa: 'PF' | 'PJ';
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  contato: string | null;
  observacoes: string | null;
  _status: string;
}

export interface Local {
  id: string;
  cliente_id: string;
  descricao: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_imovel: string | null;
  area_m2: number | null;
}

export interface OrdemServico {
  id: string;
  numero: number | null;
  cliente_id: string;
  local_id: string | null;
  servico_id: string | null;
  tecnico_id: string | null;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  agendada_para: string;
  iniciada_em: string | null;
  concluida_em: string | null;
  observacoes: string | null;
  relatorio: string | null;
  recomendacoes: string | null;
  responsavel_local_nome: string | null;
  responsavel_local_documento: string | null;
  assinatura_cliente: string | null;
  garantia_ate: string | null;
  certificado_codigo: string | null;
  _status: string;
}

export interface OSResumo extends OrdemServico {
  cliente_nome: string;
  servico_nome: string | null;
  tecnico_nome: string | null;
  logradouro: string | null;
  local_numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface OSDetalhe extends OSResumo {
  cliente_documento: string | null;
  cliente_telefone: string | null;
  complemento: string | null;
  local_descricao: string | null;
  garantia_dias: number | null;
}

export interface Perfil {
  id: string;
  empresa_id: string | null;
  nome: string;
  email: string | null;
  papel: 'admin' | 'atendente' | 'tecnico';
  ativo: number;
}

export interface Praga { id: string; nome: string; nome_cientifico: string | null }
export interface Servico { id: string; nome: string; descricao: string | null; garantia_dias: number }
export interface Produto {
  id: string;
  nome_comercial: string;
  principio_ativo: string;
  grupo_quimico: string | null;
  concentracao: string | null;
  registro_ms: string | null;
  unidade: string;
  antidoto: string | null;
}
export interface OSProduto extends Produto {
  id: string;           // id do item (os_produtos)
  produto_id: string;
  quantidade: number;
  unidade: string;
  diluicao: string | null;
  lote: string | null;
  area_aplicada: string | null;
}
export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  licenca_sanitaria: string | null;
  responsavel_tecnico: string | null;
  rt_registro: string | null;
  ciatox_telefone: string | null;
  codigo_convite: string;
  assinatura_status: 'trial' | 'ativa' | 'expirada';
  trial_ate: string | null;
  assinatura_expira_em: string | null;
  assinatura_produto: string | null;
  assinatura_renova: number | null;
}

const SELECT_OS = `
  select o.*, c.nome as cliente_nome, s.nome as servico_nome, p.nome as tecnico_nome,
         l.logradouro, l.numero as local_numero, l.bairro, l.cidade, l.uf
    from ordens_servico o
    join clientes c on c.id = o.cliente_id
    left join locais l on l.id = o.local_id
    left join servicos s on s.id = o.servico_id
    left join perfis p on p.id = o.tecnico_id`;

// ---------------------------------------------------------------- Agenda
export function osDoPeriodo(inicio: Date, fim: Date, tecnicoId: string | null) {
  const params: string[] = [inicio.toISOString(), fim.toISOString()];
  let filtro = '';
  if (tecnicoId) {
    filtro = 'and o.tecnico_id = ?';
    params.push(tecnicoId);
  }
  return consultar<OSResumo>(
    `${SELECT_OS}
      where o.deleted = 0 and o.agendada_para >= ? and o.agendada_para < ? ${filtro}
      order by o.agendada_para`,
    params
  );
}

export function osAtrasadas(antesDe: Date, tecnicoId: string | null) {
  const params: string[] = [antesDe.toISOString()];
  let filtro = '';
  if (tecnicoId) {
    filtro = 'and o.tecnico_id = ?';
    params.push(tecnicoId);
  }
  return consultar<OSResumo>(
    `${SELECT_OS}
      where o.deleted = 0 and o.status in ('agendada', 'em_andamento')
        and o.agendada_para < ? ${filtro}
      order by o.agendada_para`,
    params
  );
}

export function osDoCliente(clienteId: string) {
  return consultar<OSResumo>(
    `${SELECT_OS} where o.deleted = 0 and o.cliente_id = ? order by o.agendada_para desc`,
    [clienteId]
  );
}

export function osDetalhe(id: string) {
  return primeiro<OSDetalhe>(
    `select o.*, c.nome as cliente_nome, c.documento as cliente_documento,
            c.telefone as cliente_telefone, s.nome as servico_nome, s.garantia_dias,
            p.nome as tecnico_nome, l.descricao as local_descricao, l.logradouro,
            l.numero as local_numero, l.complemento, l.bairro, l.cidade, l.uf
       from ordens_servico o
       join clientes c on c.id = o.cliente_id
       left join locais l on l.id = o.local_id
       left join servicos s on s.id = o.servico_id
       left join perfis p on p.id = o.tecnico_id
      where o.id = ?`,
    [id]
  );
}

export function pragasDaOS(osId: string) {
  return consultar<Praga & { item_id: string }>(
    `select p.id, p.nome, p.nome_cientifico, op.id as item_id from os_pragas op join pragas p on p.id = op.praga_id
      where op.os_id = ? and op.deleted = 0 order by p.nome`,
    [osId]
  );
}

export function produtosDaOS(osId: string) {
  return consultar<OSProduto>(
    `select op.id, pr.nome_comercial, pr.principio_ativo, pr.grupo_quimico, pr.concentracao,
            pr.registro_ms, pr.antidoto, op.produto_id, op.quantidade,
            coalesce(op.unidade, pr.unidade) as unidade,
            op.diluicao, op.lote, op.area_aplicada
       from os_produtos op join produtos pr on pr.id = op.produto_id
      where op.os_id = ? and op.deleted = 0 order by op.created_at`,
    [osId]
  );
}

// ---------------------------------------------------------------- Clientes
export function buscarClientes(texto: string) {
  const t = `%${texto.trim()}%`;
  return consultar<Cliente>(
    `select * from clientes
      where deleted = 0 and (nome like ? or ifnull(documento,'') like ? or ifnull(telefone,'') like ?)
      order by nome collate nocase limit 300`,
    [t, t, t]
  );
}

export function cliente(id: string) {
  return primeiro<Cliente>('select * from clientes where id = ?', [id]);
}

export function locaisDoCliente(clienteId: string) {
  return consultar<Local>(
    'select * from locais where cliente_id = ? and deleted = 0 order by created_at',
    [clienteId]
  );
}

export function local(id: string) {
  return primeiro<Local>('select * from locais where id = ?', [id]);
}

export function ordemServico(id: string) {
  return primeiro<OrdemServico>('select * from ordens_servico where id = ?', [id]);
}

// ---------------------------------------------------------------- Catálogos
export const servicosAtivos = () =>
  consultar<Servico>('select * from servicos where ativo = 1 and deleted = 0 order by nome');
export const pragasAtivas = () =>
  consultar<Praga>('select * from pragas where ativo = 1 and deleted = 0 order by nome');
export const produtosAtivos = () =>
  consultar<Produto>(
    'select * from produtos where ativo = 1 and deleted = 0 order by nome_comercial'
  );
export const tecnicosAtivos = () =>
  consultar<Perfil>(
    `select p.* from perfis p
      where p.ativo = 1 and p.deleted = 0
        and p.empresa_id = (select empresa_id from perfis where id = (select valor from meta where chave = 'usuario_id'))
      order by p.nome collate nocase`
  );
export const equipe = tecnicosAtivos;
export const perfil = (id: string) =>
  primeiro<Perfil>('select * from perfis where id = ?', [id]);
/** A empresa do usuário (o aparelho só recebe a própria empresa). */
export const empresa = () =>
  primeiro<Empresa>('select * from empresas where deleted = 0 order by created_at limit 1');

/** Itens de um catálogo, inclusive inativos (tela de manutenção). */
export function itensCatalogo(tabela: 'pragas' | 'produtos' | 'servicos', ordem: string) {
  return consultar<Record<string, any>>(
    `select * from ${tabela} where deleted = 0 order by ativo desc, ${ordem} collate nocase`
  );
}
