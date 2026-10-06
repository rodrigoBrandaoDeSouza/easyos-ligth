import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { excluir, salvar } from '@/db/database';
import { local as lerLocal } from '@/db/repos';
import { Botao, Campo, Tela } from '@/components/ui';
import { CamposEndereco, Endereco, enderecoParaBanco, enderecoVazio } from '@/components/CamposEndereco';

export default function LocalForm() {
  const { clienteId, id } = useLocalSearchParams<{ clienteId: string; id?: string }>();
  const [descricao, setDescricao] = useState(id ? '' : 'Principal');
  const [endereco, setEndereco] = useState<Endereco>(enderecoVazio);

  useEffect(() => {
    if (!id) return;
    lerLocal(id).then((l) => {
      if (!l) return;
      setDescricao(l.descricao);
      setEndereco({
        cep: l.cep ?? '', logradouro: l.logradouro ?? '', numero: l.numero ?? '',
        complemento: l.complemento ?? '', bairro: l.bairro ?? '', cidade: l.cidade ?? '',
        uf: l.uf ?? '', tipo_imovel: l.tipo_imovel ?? '',
        area_m2: l.area_m2 != null ? String(l.area_m2).replace('.', ',') : '',
      });
    });
  }, [id]);

  async function onSalvar() {
    if (!descricao.trim()) return Alert.alert('Informe uma descrição (ex.: Matriz, Depósito)');
    await salvar('locais', {
      ...(id ? { id } : {}),
      cliente_id: clienteId,
      descricao: descricao.trim(),
      ...enderecoParaBanco(endereco),
    });
    router.back();
  }

  function onExcluir() {
    Alert.alert('Excluir endereço?', 'OS antigas continuam com o endereço registrado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await excluir('locais', id!); router.back(); } },
    ]);
  }

  return (
    <Tela>
      <Campo rotulo="Descrição" obrigatorio value={descricao} onChangeText={setDescricao} placeholder="Matriz, Filial, Casa de praia..." />
      <CamposEndereco valor={endereco} onChange={setEndereco} />
      <Botao titulo="Salvar" onPress={onSalvar} />
      {id ? <Botao titulo="Excluir endereço" variante="secundario" onPress={onExcluir} /> : null}
    </Tela>
  );
}
