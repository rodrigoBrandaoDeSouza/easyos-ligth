import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CATALOGOS, TipoCatalogo } from '@/catalogo/config';
import { itensCatalogo } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { BotaoFlutuante, Pendente, s, Vazio } from '@/components/ui';
import { cores } from '@/lib/theme';

export default function ListaCatalogo() {
  const { tipo } = useLocalSearchParams<{ tipo: TipoCatalogo }>();
  const def = CATALOGOS[tipo];
  const { dados } = useConsulta(() => itensCatalogo(tipo, def.ordem), [tipo]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Stack.Screen options={{ title: def.titulo }} />
      {def.aviso ? <Text style={{ padding: 12, color: cores.textoSuave }}>{def.aviso}</Text> : null}
      <FlatList
        data={dados ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<Vazio texto={`Nenhum ${def.singular} cadastrado.`} />}
        renderItem={({ item }) => (
          <Pressable style={[s.itemLista, !item.ativo && { opacity: 0.5 }]}
            onPress={() => router.push(`/catalogo/form?tipo=${tipo}&id=${item.id}`)}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: cores.texto }}>
              {item[def.principal]}{!item.ativo ? ' (inativo)' : ''}
            </Text>
            {def.detalhe(item) ? <Text style={{ color: cores.textoSuave }}>{def.detalhe(item)}</Text> : null}
            <Pendente status={item._status} />
          </Pressable>
        )}
      />
      <BotaoFlutuante onPress={() => router.push(`/catalogo/form?tipo=${tipo}`)} />
    </View>
  );
}
