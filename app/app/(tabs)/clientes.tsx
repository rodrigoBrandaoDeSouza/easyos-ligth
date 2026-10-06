import React, { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { buscarClientes } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { SyncBanner } from '@/components/SyncBanner';
import { BotaoFlutuante, Pendente, s, Vazio } from '@/components/ui';
import { cores } from '@/lib/theme';

export default function Clientes() {
  const [busca, setBusca] = useState('');
  const { dados } = useConsulta(() => buscarClientes(busca), [busca]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <SyncBanner />
      <View style={{ padding: 12 }}>
        <TextInput
          style={s.input}
          placeholder="Buscar por nome, CPF/CNPJ ou telefone"
          placeholderTextColor={cores.textoSuave}
          value={busca}
          onChangeText={setBusca}
        />
      </View>
      <FlatList
        data={dados ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<Vazio texto={busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'} />}
        renderItem={({ item }) => (
          <Pressable style={s.itemLista} onPress={() => router.push(`/cliente/${item.id}`)}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: cores.texto }}>{item.nome}</Text>
            <Text style={{ color: cores.textoSuave }}>
              {[item.documento, item.telefone].filter(Boolean).join(' · ') || item.tipo_pessoa}
            </Text>
            <Pendente status={item._status} />
          </Pressable>
        )}
      />
      <BotaoFlutuante onPress={() => router.push('/cliente/form')} />
    </View>
  );
}
