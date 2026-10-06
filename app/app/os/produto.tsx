import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { cores } from '@/lib/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { excluir, primeiro, salvar } from '@/db/database';
import { produtosAtivos } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { Botao, Campo, Linha, Selecao, Tela } from '@/components/ui';
import { lerNumero, numeroBR } from '@/lib/format';

export default function ProdutoAplicado() {
  const { osId, id } = useLocalSearchParams<{ osId: string; id?: string }>();
  const { dados: produtos } = useConsulta(() => produtosAtivos(), []);

  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [diluicao, setDiluicao] = useState('');
  const [lote, setLote] = useState('');
  const [area, setArea] = useState('');

  useEffect(() => {
    if (!id) return;
    primeiro<any>('select * from os_produtos where id = ?', [id]).then((p) => {
      if (!p) return;
      setProdutoId(p.produto_id);
      setQuantidade(numeroBR(p.quantidade));
      setDiluicao(p.diluicao ?? '');
      setLote(p.lote ?? '');
      setArea(p.area_aplicada ?? '');
    });
  }, [id]);

  const produto = produtos?.find((p) => p.id === produtoId);

  async function onSalvar() {
    const qtd = lerNumero(quantidade);
    if (!produtoId) return Alert.alert('Selecione o produto');
    if (!qtd || qtd <= 0) return Alert.alert('Informe a quantidade aplicada');
    await salvar('os_produtos', {
      ...(id ? { id } : {}),
      os_id: osId,
      produto_id: produtoId,
      quantidade: qtd,
      unidade: produto?.unidade ?? null,
      diluicao: diluicao.trim() || null,
      lote: lote.trim() || null,
      area_aplicada: area.trim() || null,
    });
    router.back();
  }

  async function onRemover() {
    await excluir('os_produtos', id!);
    router.back();
  }

  return (
    <Tela>
      {produtos && produtos.length === 0 ? (
        <Text style={{ color: cores.aviso, marginBottom: 12 }}>
          Nenhum produto cadastrado. O administrador cadastra em Ajustes → Produtos.
        </Text>
      ) : null}
      <Selecao
        rotulo="Produto"
        obrigatorio
        valor={produtoId}
        onChange={setProdutoId}
        opcoes={(produtos ?? []).map((p) => ({
          valor: p.id,
          rotulo: p.nome_comercial,
          detalhe: [p.principio_ativo, p.concentracao, p.grupo_quimico].filter(Boolean).join(' · '),
        }))}
      />
      {produto && (
        <Linha
          rotulo="Princípio ativo / grupo químico"
          valor={[produto.principio_ativo, produto.concentracao, produto.grupo_quimico].filter(Boolean).join(' · ')}
        />
      )}
      <Campo
        rotulo={`Quantidade aplicada${produto ? ` (${produto.unidade})` : ''}`}
        obrigatorio
        keyboardType="decimal-pad"
        value={quantidade}
        onChangeText={setQuantidade}
      />
      <Campo rotulo="Diluição" placeholder="Ex.: 10 mL por litro de água" value={diluicao} onChangeText={setDiluicao} />
      <Campo rotulo="Área aplicada" placeholder="Ex.: cozinha, área externa, forro" value={area} onChangeText={setArea} />
      <Campo rotulo="Lote" value={lote} onChangeText={setLote} />
      <Botao titulo="Salvar" onPress={onSalvar} />
      {id ? <Botao titulo="Remover produto" variante="secundario" onPress={() => void onRemover()} /> : null}
    </Tela>
  );
}
