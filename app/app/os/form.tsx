import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { salvar } from '@/db/database';
import {
  buscarClientes,
  locaisDoCliente,
  ordemServico,
  servicosAtivos,
  tecnicosAtivos,
} from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { DataHora } from '@/components/DataHora';
import { Botao, Campo, Selecao, Tela } from '@/components/ui';
import { enderecoLinha } from '@/lib/format';
import { cores } from '@/lib/theme';

function proximaHoraCheia(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export default function OSForm() {
  const params = useLocalSearchParams<{ id?: string; clienteId?: string }>();
  const { usuarioId, equipeInterna } = useAuth();
  const editando = !!params.id;

  const [clienteId, setClienteId] = useState<string | null>(params.clienteId ?? null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [tecnicoId, setTecnicoId] = useState<string | null>(usuarioId);
  const [quando, setQuando] = useState<Date>(proximaHoraCheia);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { dados: cat } = useConsulta(async () => {
    const [clientes, servicos, tecnicos] = await Promise.all([
      buscarClientes(''),
      servicosAtivos(),
      tecnicosAtivos(),
    ]);
    return { clientes, servicos, tecnicos };
  }, []);

  const { dados: locais } = useConsulta(
    async () => (clienteId ? locaisDoCliente(clienteId) : []),
    [clienteId]
  );

  // edição: carrega a OS
  useEffect(() => {
    if (!params.id) return;
    ordemServico(params.id).then((o) => {
      if (!o) return;
      setClienteId(o.cliente_id);
      setLocalId(o.local_id);
      setServicoId(o.servico_id);
      setTecnicoId(o.tecnico_id);
      setQuando(new Date(o.agendada_para));
      setObservacoes(o.observacoes ?? '');
    });
  }, [params.id]);

  // seleciona automaticamente o endereço quando o cliente só tem um
  useEffect(() => {
    if (!locais) return;
    if (localId && locais.some((l) => l.id === localId)) return;
    setLocalId(locais.length ? locais[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locais]);

  async function onSalvar() {
    if (!clienteId) return Alert.alert('Selecione o cliente');
    if (!servicoId) return Alert.alert('Selecione o serviço');
    if (!tecnicoId) return Alert.alert('Selecione o técnico');
    setSalvando(true);
    try {
      const id = await salvar('ordens_servico', {
        ...(params.id ? { id: params.id } : { status: 'agendada', created_by: usuarioId }),
        cliente_id: clienteId,
        local_id: localId,
        servico_id: servicoId,
        tecnico_id: tecnicoId,
        agendada_para: quando.toISOString(),
        observacoes: observacoes.trim() || null,
      });
      if (editando) router.back();
      else router.replace(`/os/${id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: editando ? 'Reagendar OS' : 'Agendar OS' }} />
      <Selecao
        rotulo="Cliente"
        obrigatorio
        valor={clienteId}
        onChange={setClienteId}
        desabilitado={editando}
        opcoes={(cat?.clientes ?? []).map((c) => ({
          valor: c.id,
          rotulo: c.nome,
          detalhe: [c.documento, c.telefone].filter(Boolean).join(' · '),
        }))}
      />
      {!editando && (
        <Text
          style={{ color: cores.primaria, marginTop: -6, marginBottom: 12 }}
          onPress={() => router.push('/cliente/form')}
        >
          + Cadastrar novo cliente
        </Text>
      )}
      <Selecao
        rotulo="Endereço do atendimento"
        valor={localId}
        onChange={setLocalId}
        placeholder={clienteId ? 'Selecione...' : 'Selecione o cliente primeiro'}
        desabilitado={!clienteId}
        opcoes={(locais ?? []).map((l) => ({
          valor: l.id,
          rotulo: l.descricao,
          detalhe: enderecoLinha(l),
        }))}
      />
      <Selecao
        rotulo="Serviço"
        obrigatorio
        valor={servicoId}
        onChange={setServicoId}
        opcoes={(cat?.servicos ?? []).map((s) => ({
          valor: s.id,
          rotulo: s.nome,
          detalhe: `Garantia: ${s.garantia_dias} dias`,
        }))}
      />
      <Selecao
        rotulo="Técnico responsável"
        obrigatorio
        valor={tecnicoId}
        onChange={setTecnicoId}
        desabilitado={!equipeInterna} // técnico só agenda para si mesmo
        opcoes={(cat?.tecnicos ?? []).map((t) => ({ valor: t.id, rotulo: t.nome, detalhe: t.email }))}
      />
      <DataHora rotulo="Data e hora" valor={quando} onChange={setQuando} />
      <Campo
        rotulo="Observações / pedido do cliente"
        value={observacoes}
        onChangeText={setObservacoes}
        multiline
      />
      <Botao titulo={editando ? 'Salvar alterações' : 'Agendar'} onPress={onSalvar} carregando={salvando} />
    </Tela>
  );
}
