import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { cliente, locaisDoCliente, osDoCliente } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { OSCard } from '@/components/OSCard';
import { Botao, Cartao, Carregando, Linha, Pendente, Tela, Titulo, Vazio } from '@/components/ui';
import { enderecoLinha } from '@/lib/format';
import { cores } from '@/lib/theme';

export default function ClienteDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados, carregando } = useConsulta(async () => {
    const [c, locais, ordens] = await Promise.all([cliente(id), locaisDoCliente(id), osDoCliente(id)]);
    return { c, locais, ordens };
  }, [id]);

  if (carregando) return <Carregando />;
  const c = dados?.c;
  if (!c) return <Vazio texto="Cliente não encontrado." />;

  const telefoneLimpo = c.telefone?.replace(/\D/g, '');

  return (
    <Tela>
      <Stack.Screen options={{ title: c.nome }} />
      <Cartao>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Titulo>{c.nome}</Titulo>
          <Pressable onPress={() => router.push(`/cliente/form?id=${c.id}`)}>
            <Text style={{ color: cores.primaria, fontWeight: '600' }}>Editar</Text>
          </Pressable>
        </View>
        <Linha rotulo={c.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'} valor={c.documento} />
        <Linha rotulo="Telefone" valor={c.telefone} />
        <Linha rotulo="E-mail" valor={c.email} />
        {c.contato ? <Linha rotulo="Contato" valor={c.contato} /> : null}
        {c.observacoes ? <Linha rotulo="Observações" valor={c.observacoes} /> : null}
        <Pendente status={c._status} />
        {telefoneLimpo ? (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <Pressable onPress={() => Linking.openURL(`tel:${telefoneLimpo}`)}>
              <Text style={{ color: cores.primaria }}>Ligar</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`https://wa.me/55${telefoneLimpo}`)}>
              <Text style={{ color: cores.primaria }}>WhatsApp</Text>
            </Pressable>
          </View>
        ) : null}
      </Cartao>

      <Cartao>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Titulo>Endereços</Titulo>
          <Pressable onPress={() => router.push(`/local/form?clienteId=${c.id}`)}>
            <Text style={{ color: cores.primaria, fontWeight: '600' }}>+ Adicionar</Text>
          </Pressable>
        </View>
        {dados.locais.length === 0 && <Text style={{ color: cores.textoSuave }}>Nenhum endereço.</Text>}
        {dados.locais.map((l) => (
          <Pressable key={l.id} onPress={() => router.push(`/local/form?clienteId=${c.id}&id=${l.id}`)}
            style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: cores.borda }}>
            <Text style={{ fontWeight: '600', color: cores.texto }}>{l.descricao}</Text>
            <Text style={{ color: cores.textoSuave }}>{enderecoLinha(l)}</Text>
          </Pressable>
        ))}
      </Cartao>

      <Botao titulo="Agendar ordem de serviço" onPress={() => router.push(`/os/form?clienteId=${c.id}`)} />

      <Titulo>Histórico de OS</Titulo>
      {dados.ordens.length === 0 && <Vazio texto="Nenhuma OS para este cliente." />}
      {dados.ordens.map((o) => (
        <OSCard key={o.id} os={o} mostrarData mostrarTecnico />
      ))}
    </Tela>
  );
}
