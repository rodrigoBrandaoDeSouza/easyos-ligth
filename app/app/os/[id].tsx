import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { excluir, salvar } from '@/db/database';
import { osDetalhe, pragasAtivas, pragasDaOS, produtosDaOS } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { compartilharCertificado } from '@/certificado/certificado';
import {
  Botao,
  Cartao,
  Campo,
  Carregando,
  Chip,
  Linha,
  Pendente,
  StatusBadge,
  Tela,
  Titulo,
  Vazio,
} from '@/components/ui';
import {
  codigoCertificado,
  dataBR,
  dataHoraBR,
  dataISOLocal,
  enderecoLinha,
  numeroBR,
  numeroOS,
  somarDias,
} from '@/lib/format';
import { cores } from '@/lib/theme';

type CampoTexto = 'relatorio' | 'recomendacoes' | 'responsavel_local_nome' | 'responsavel_local_documento';

export default function OSDetalheTela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { equipeInterna, usuarioId } = useAuth();
  const [gerando, setGerando] = useState(false);

  const { dados, carregando } = useConsulta(async () => {
    const [os, pragasSel, produtos, pragas] = await Promise.all([
      osDetalhe(id),
      pragasDaOS(id),
      produtosDaOS(id),
      pragasAtivas(),
    ]);
    return { os, pragasSel, produtos, pragas };
  }, [id]);

  // campos de texto editáveis: estado local, gravados ao sair do campo
  const [texto, setTexto] = useState<Record<CampoTexto, string>>({
    relatorio: '',
    recomendacoes: '',
    responsavel_local_nome: '',
    responsavel_local_documento: '',
  });
  const osCarregada = dados?.os?.id;
  useEffect(() => {
    const os = dados?.os;
    if (!os) return;
    setTexto({
      relatorio: os.relatorio ?? '',
      recomendacoes: os.recomendacoes ?? '',
      responsavel_local_nome: os.responsavel_local_nome ?? '',
      responsavel_local_documento: os.responsavel_local_documento ?? '',
    });
    // só ao abrir a OS, para não sobrescrever o que o técnico está digitando
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osCarregada]);

  if (carregando) return <Carregando />;
  const os = dados?.os;
  if (!os) return <Vazio texto="OS não encontrada. Ela pode ter sido reatribuída a outro técnico." />;

  const emAtendimento = os.status === 'em_andamento';
  const podeEditar = equipeInterna || os.tecnico_id === usuarioId;
  const endereco = enderecoLinha({ ...os, numero: os.local_numero });
  const selecionadas = new Map(dados.pragasSel.map((p) => [p.id, p.item_id]));

  const gravarTexto = (campo: CampoTexto) =>
    salvar('ordens_servico', { id: os.id, [campo]: texto[campo].trim() || null });

  async function iniciar() {
    await salvar('ordens_servico', {
      id: os!.id,
      status: 'em_andamento',
      iniciada_em: new Date().toISOString(),
    });
  }

  function cancelar() {
    Alert.alert('Cancelar OS?', 'A OS ficará marcada como cancelada.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar OS',
        style: 'destructive',
        onPress: () => void salvar('ordens_servico', { id: os!.id, status: 'cancelada' }),
      },
    ]);
  }

  async function alternarPraga(pragaId: string) {
    const itemId = selecionadas.get(pragaId);
    if (itemId) await excluir('os_pragas', itemId);
    else await salvar('os_pragas', { os_id: os!.id, praga_id: pragaId });
  }

  async function concluir() {
    if (!dados) return;
    const faltando: string[] = [];
    if (!dados.pragasSel.length) faltando.push('• selecione ao menos uma praga alvo');
    if (!texto.responsavel_local_nome.trim()) faltando.push('• informe o responsável no local');
    if (!os!.assinatura_cliente) faltando.push('• colete a assinatura do cliente');
    if (faltando.length) return Alert.alert('Falta pouco', faltando.join('\n'));

    const finalizar = async () => {
      const agora = new Date();
      await salvar('ordens_servico', {
        id: os!.id,
        ...Object.fromEntries(
          (Object.keys(texto) as CampoTexto[]).map((k) => [k, texto[k].trim() || null])
        ),
        status: 'concluida',
        concluida_em: agora.toISOString(),
        garantia_ate: dataISOLocal(somarDias(agora, os!.garantia_dias ?? 0)),
        certificado_codigo: os!.certificado_codigo ?? codigoCertificado(os!.id),
      });
      Alert.alert('Atendimento concluído', 'Deseja enviar o certificado ao cliente agora?', [
        { text: 'Depois', style: 'cancel' },
        { text: 'Enviar certificado', onPress: () => void gerarCertificado() },
      ]);
    };

    if (!dados.produtos.length) {
      Alert.alert('Nenhum produto aplicado', 'Concluir mesmo assim?', [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Concluir', onPress: () => void finalizar() },
      ]);
    } else {
      await finalizar();
    }
  }

  async function gerarCertificado() {
    setGerando(true);
    try {
      await compartilharCertificado(os!.id);
    } catch (e: any) {
      Alert.alert('Erro ao gerar certificado', e.message);
    } finally {
      setGerando(false);
    }
  }

  const abrirMapa = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`);

  return (
    <Tela>
      <Stack.Screen options={{ title: numeroOS(os.numero) }} />

      {/* ---------------------------------------------------------- Dados */}
      <Cartao>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: cores.primaria }}>
            {dataHoraBR(os.agendada_para)}
          </Text>
          <StatusBadge status={os.status} />
        </View>
        <Pressable onPress={() => router.push(`/cliente/${os.cliente_id}`)}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>{os.cliente_nome}</Text>
        </Pressable>
        <Pressable onPress={abrirMapa}>
          <Text style={{ color: cores.info, marginVertical: 4 }}>{endereco} ↗</Text>
        </Pressable>
        <Linha rotulo="Serviço" valor={os.servico_nome} />
        <Linha rotulo="Técnico" valor={os.tecnico_nome} />
        {os.cliente_telefone ? <Linha rotulo="Telefone" valor={os.cliente_telefone} /> : null}
        {os.observacoes ? <Linha rotulo="Observações" valor={os.observacoes} /> : null}
        {os.iniciada_em ? <Linha rotulo="Início do atendimento" valor={dataHoraBR(os.iniciada_em)} /> : null}
        {os.concluida_em ? <Linha rotulo="Conclusão" valor={dataHoraBR(os.concluida_em)} /> : null}
        {os.garantia_ate ? <Linha rotulo="Garantia até" valor={dataBR(os.garantia_ate)} /> : null}
        <Pendente status={os._status} />
      </Cartao>

      {/* ---------------------------------------------------------- Ações */}
      {podeEditar && os.status === 'agendada' && (
        <>
          <Botao titulo="Iniciar atendimento" onPress={iniciar} />
          <Botao titulo="Reagendar / editar" variante="secundario" onPress={() => router.push(`/os/form?id=${os.id}`)} />
          <Botao titulo="Cancelar OS" variante="secundario" onPress={cancelar} />
        </>
      )}

      {(emAtendimento || os.status === 'concluida') && (
        <>
          {/* ------------------------------------------------ Pragas alvo */}
          <Cartao>
            <Titulo>Pragas alvo</Titulo>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(emAtendimento ? dados.pragas : dados.pragasSel).map((p) => (
                <Chip
                  key={p.id}
                  rotulo={p.nome}
                  ativo={selecionadas.has(p.id)}
                  onPress={emAtendimento ? () => void alternarPraga(p.id) : undefined}
                />
              ))}
            </View>
          </Cartao>

          {/* ------------------------------------------------ Produtos */}
          <Cartao>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Titulo>Produtos aplicados</Titulo>
              {emAtendimento && (
                <Pressable onPress={() => router.push(`/os/produto?osId=${os.id}`)}>
                  <Text style={{ color: cores.primaria, fontWeight: '600' }}>+ Adicionar</Text>
                </Pressable>
              )}
            </View>
            {dados.produtos.length === 0 && <Text style={{ color: cores.textoSuave }}>Nenhum produto registrado.</Text>}
            {dados.produtos.map((p) => (
              <Pressable
                key={p.id}
                disabled={!emAtendimento}
                onPress={() => router.push(`/os/produto?osId=${os.id}&id=${p.id}`)}
                style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: cores.borda }}
              >
                <Text style={{ fontWeight: '600', color: cores.texto }}>
                  {p.nome_comercial} — {numeroBR(p.quantidade)} {p.unidade}
                </Text>
                <Text style={{ color: cores.textoSuave }}>
                  {[p.principio_ativo, p.diluicao && `diluição ${p.diluicao}`, p.area_aplicada, p.lote && `lote ${p.lote}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
            ))}
          </Cartao>

          {/* ------------------------------------------------ Relatório */}
          <Cartao>
            <Titulo>Relatório e recomendações</Titulo>
            <Campo
              rotulo="O que foi feito"
              multiline
              editable={emAtendimento}
              value={texto.relatorio}
              onChangeText={(v) => setTexto({ ...texto, relatorio: v })}
              onBlur={() => void gravarTexto('relatorio')}
            />
            <Campo
              rotulo="Recomendações ao cliente"
              multiline
              editable={emAtendimento}
              placeholder="Ex.: manter o ambiente fechado por 2 horas..."
              value={texto.recomendacoes}
              onChangeText={(v) => setTexto({ ...texto, recomendacoes: v })}
              onBlur={() => void gravarTexto('recomendacoes')}
            />
          </Cartao>

          {/* ------------------------------------------------ Assinatura */}
          <Cartao>
            <Titulo>Responsável no local</Titulo>
            <Campo
              rotulo="Nome"
              obrigatorio
              editable={emAtendimento}
              value={texto.responsavel_local_nome}
              onChangeText={(v) => setTexto({ ...texto, responsavel_local_nome: v })}
              onBlur={() => void gravarTexto('responsavel_local_nome')}
            />
            <Campo
              rotulo="Documento (opcional)"
              editable={emAtendimento}
              value={texto.responsavel_local_documento}
              onChangeText={(v) => setTexto({ ...texto, responsavel_local_documento: v })}
              onBlur={() => void gravarTexto('responsavel_local_documento')}
            />
            {os.assinatura_cliente ? (
              <Image
                source={{ uri: os.assinatura_cliente }}
                style={{ height: 120, backgroundColor: '#fff', borderWidth: 1, borderColor: cores.borda, borderRadius: 8, marginBottom: 10 }}
                resizeMode="contain"
              />
            ) : null}
            {emAtendimento && (
              <Botao
                titulo={os.assinatura_cliente ? 'Refazer assinatura' : 'Coletar assinatura'}
                variante="secundario"
                onPress={() => router.push(`/os/assinatura?osId=${os.id}`)}
              />
            )}
          </Cartao>

          {emAtendimento && podeEditar && (
            <Botao titulo="Concluir atendimento" onPress={() => void concluir()} />
          )}
          {os.status === 'concluida' && (
            <>
              <Botao titulo="Gerar / enviar certificado (PDF)" onPress={() => void gerarCertificado()} carregando={gerando} />
              <Text style={{ color: cores.textoSuave, textAlign: 'center', fontSize: 12 }}>
                Código do certificado: {os.certificado_codigo ?? codigoCertificado(os.id)}
              </Text>
            </>
          )}
        </>
      )}
    </Tela>
  );
}
