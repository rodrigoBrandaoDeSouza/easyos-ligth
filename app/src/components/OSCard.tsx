import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { OSResumo } from '@/db/repos';
import { dataBR, enderecoLinha, horaBR, numeroOS } from '@/lib/format';
import { cores } from '@/lib/theme';
import { Cartao, Pendente, StatusBadge } from './ui';

export function OSCard({ os, mostrarData, mostrarTecnico }: { os: OSResumo; mostrarData?: boolean; mostrarTecnico?: boolean }) {
  return (
    <Pressable onPress={() => router.push(`/os/${os.id}`)}>
      <Cartao>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: cores.primaria }}>
            {mostrarData ? `${dataBR(os.agendada_para)} ` : ''}
            {horaBR(os.agendada_para)}
          </Text>
          <StatusBadge status={os.status} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: cores.texto }}>{os.cliente_nome}</Text>
        <Text style={{ color: cores.textoSuave, marginTop: 2 }}>
          {enderecoLinha({ ...os, numero: os.local_numero })}
        </Text>
        <Text style={{ color: cores.texto, marginTop: 4 }}>
          {os.servico_nome ?? 'Serviço não definido'} · {numeroOS(os.numero)}
        </Text>
        {mostrarTecnico && os.tecnico_nome ? (
          <Text style={{ color: cores.textoSuave, marginTop: 2 }}>Técnico: {os.tecnico_nome}</Text>
        ) : null}
        <Pendente status={os._status} />
      </Cartao>
    </Pressable>
  );
}
