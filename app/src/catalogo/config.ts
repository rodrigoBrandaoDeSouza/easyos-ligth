/** Definição dos catálogos editáveis pelo admin/atendente (funcionam offline). */
export type TipoCatalogo = 'produtos' | 'servicos' | 'pragas';

export interface CampoCatalogo {
  k: string;
  rotulo: string;
  obrigatorio?: boolean;
  numero?: boolean;
  dica?: string;
}

export interface DefCatalogo {
  titulo: string;
  singular: string;
  ordem: string;
  principal: string;
  detalhe: (r: Record<string, any>) => string;
  campos: CampoCatalogo[];
  aviso?: string;
}

export const CATALOGOS: Record<TipoCatalogo, DefCatalogo> = {
  produtos: {
    titulo: 'Produtos',
    singular: 'produto',
    ordem: 'nome_comercial',
    principal: 'nome_comercial',
    detalhe: (r) => [r.principio_ativo, r.concentracao, r.registro_ms && `MS ${r.registro_ms}`].filter(Boolean).join(' · '),
    aviso: 'Estes dados saem no certificado. Use as informações do rótulo e o registro na ANVISA.',
    campos: [
      { k: 'nome_comercial', rotulo: 'Nome comercial', obrigatorio: true },
      { k: 'principio_ativo', rotulo: 'Princípio ativo', obrigatorio: true },
      { k: 'concentracao', rotulo: 'Concentração', dica: 'Ex.: 25 g/L, 0,05%' },
      { k: 'grupo_quimico', rotulo: 'Grupo químico', dica: 'Ex.: Piretroide' },
      { k: 'registro_ms', rotulo: 'Registro MS/ANVISA' },
      { k: 'unidade', rotulo: 'Unidade de medida', obrigatorio: true, dica: 'mL, L, g, kg, un' },
      { k: 'antidoto', rotulo: 'Antídoto / tratamento' },
    ],
  },
  servicos: {
    titulo: 'Serviços',
    singular: 'serviço',
    ordem: 'nome',
    principal: 'nome',
    detalhe: (r) => `Garantia: ${r.garantia_dias ?? 0} dias`,
    campos: [
      { k: 'nome', rotulo: 'Nome', obrigatorio: true },
      { k: 'descricao', rotulo: 'Descrição' },
      { k: 'garantia_dias', rotulo: 'Garantia (dias)', obrigatorio: true, numero: true },
    ],
  },
  pragas: {
    titulo: 'Pragas',
    singular: 'praga',
    ordem: 'nome',
    principal: 'nome',
    detalhe: (r) => r.nome_cientifico ?? '',
    campos: [
      { k: 'nome', rotulo: 'Nome popular', obrigatorio: true },
      { k: 'nome_cientifico', rotulo: 'Nome científico' },
    ],
  },
};
