import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useEstadoSync } from '@/sync/useSync';
import { sincronizar } from '@/sync/sync';
import { cores } from '@/lib/theme';

/** Faixa de status da conexão/sincronização exibida no topo das listas. */
export function SyncBanner() {
  const e = useEstadoSync();

  let texto: string;
  let cor: string;
  if (!e.online) {
    texto = `Sem internet — trabalhando offline${e.pendentes ? ` · ${e.pendentes} pendente(s)` : ''}`;
    cor = cores.textoSuave;
  } else if (e.sincronizando) {
    texto = 'Sincronizando...';
    cor = cores.info;
  } else if (e.erro) {
    texto = 'Erro ao sincronizar — toque para tentar de novo';
    cor = cores.perigo;
  } else if (e.pendentes) {
    texto = `${e.pendentes} alteração(ões) aguardando envio — toque para enviar`;
    cor = cores.aviso;
  } else {
    return null;
  }

  return (
    <Pressable
      onPress={() => void sincronizar()}
      style={{ backgroundColor: cor, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      {e.sincronizando && <ActivityIndicator size="small" color="#fff" />}
      <Text style={{ color: '#fff', fontSize: 13 }}>{texto}</Text>
    </Pressable>
  );
}
