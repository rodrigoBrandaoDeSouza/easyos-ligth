import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthProvider';
import { sairComConfirmacao } from '@/auth/sairComConfirmacao';
import { useEstadoSync } from '@/sync/useSync';
import { sincronizar } from '@/sync/sync';
import { supabase } from '@/lib/supabase';
import { limparBancoLocal } from '@/db/database';
import { Botao, Cartao, Linha, Tela, Titulo } from '@/components/ui';
import { dataBR, dataHoraBR } from '@/lib/format';
import { cores } from '@/lib/theme';

const PAPEIS: Record<string, string> = { admin: 'Administrador', atendente: 'Atendente', tecnico: 'Técnico' };

function Item({ icone, titulo, detalhe, onPress }: { icone: string; titulo: string; detalhe?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: cores.borda }}>
      <Ionicons name={icone} size={22} color={cores.primaria} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: cores.texto }}>{titulo}</Text>
        {detalhe ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{detalhe}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}

export default function Ajustes() {
  const { perfil, session, empresa, admin, equipeInterna, assinatura, sair } = useAuth();
  const sync = useEstadoSync();
  const [excluindo, setExcluindo] = useState(false);

  const textoAssinatura =
    assinatura.tipo === 'ativa' ? `Ativa até ${dataBR(assinatura.ate)}`
      : assinatura.tipo === 'teste' ? `Teste grátis: ${assinatura.diasRestantes} dia(s) restante(s)`
        : 'Vencida';

  async function excluirConta() {
    setExcluindo(true);
    try {
      const { error } = await supabase.functions.invoke('excluir-conta', { body: {} });
      if (error) {
        let msg = error.message;
        try {
          msg = (await (error as any).context.json()).erro ?? msg;
        } catch {
          // mantém a mensagem original
        }
        throw new Error(msg);
      }
      await supabase.auth.signOut({ scope: 'local' });
      await limparBancoLocal();
    } catch (e: any) {
      Alert.alert('Não foi possível excluir a conta', e.message);
    } finally {
      setExcluindo(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert(
      'Excluir minha conta?',
      'Sua conta e seu acesso serão apagados permanentemente. As OS que você registrou continuam na empresa.' +
        (admin ? '\n\nSe houver assinatura ativa, cancele-a também na loja (Apple/Google).' : ''),
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir conta', style: 'destructive', onPress: () => void excluirConta() },
      ]
    );
  }

  return (
    <Tela>
      <Cartao>
        <Titulo>{empresa?.nome_fantasia || empresa?.razao_social || 'Empresa'}</Titulo>
        <Linha rotulo="Usuário" valor={`${perfil?.nome ?? ''} · ${perfil ? PAPEIS[perfil.papel] : ''}`} />
        <Linha rotulo="E-mail" valor={session?.user.email} />
        {admin && (
          <>
            <Item icone="card" titulo="Assinatura" detalhe={textoAssinatura} onPress={() => router.push('/assinatura')} />
            <Item icone="business" titulo="Dados da empresa" detalhe="Aparecem no certificado" onPress={() => router.push('/empresa')} />
            <Item icone="people" titulo="Equipe" detalhe="Convidar técnicos e definir permissões" onPress={() => router.push('/equipe')} />
          </>
        )}
        {equipeInterna && (
          <>
            <Item icone="flask" titulo="Produtos" onPress={() => router.push('/catalogo/produtos')} />
            <Item icone="construct" titulo="Serviços" onPress={() => router.push('/catalogo/servicos')} />
            <Item icone="bug" titulo="Pragas" onPress={() => router.push('/catalogo/pragas')} />
          </>
        )}
      </Cartao>

      <Cartao>
        <Titulo>Sincronização</Titulo>
        <Linha rotulo="Conexão" valor={sync.online ? 'Online' : 'Offline'} />
        <Linha rotulo="Alterações aguardando envio" valor={String(sync.pendentes)} />
        <Linha rotulo="Última sincronização" valor={dataHoraBR(sync.ultimaSync)} />
        {sync.erro ? <Text style={{ color: cores.perigo, marginBottom: 8 }}>{sync.erro}</Text> : null}
        <Botao titulo="Sincronizar agora" variante="secundario" carregando={sync.sincronizando}
          onPress={() => void sincronizar()} />
      </Cartao>

      <Botao titulo="Sair" variante="secundario" onPress={() => void sairComConfirmacao(sair)} />
      <Botao titulo="Excluir minha conta" variante="perigo" carregando={excluindo} onPress={confirmarExclusao} />
    </Tela>
  );
}
