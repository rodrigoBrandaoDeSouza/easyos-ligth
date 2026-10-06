import React, { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { equipe as lerEquipe, Perfil } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { supabase } from '@/lib/supabase';
import { sincronizar } from '@/sync/sync';
import { Botao, Cartao, Chip, Tela, Titulo } from '@/components/ui';
import { cores } from '@/lib/theme';

const PAPEIS: { valor: Perfil['papel']; rotulo: string }[] = [
  { valor: 'tecnico', rotulo: 'Técnico' },
  { valor: 'atendente', rotulo: 'Atendente' },
  { valor: 'admin', rotulo: 'Admin' },
];

/** Gestão da equipe (somente admin). Precisa de internet. */
export default function Equipe() {
  const { admin, empresa, usuarioId } = useAuth();
  const { dados: membros } = useConsulta(() => lerEquipe(), []);
  const [ocupado, setOcupado] = useState(false);

  if (!admin) return <Redirect href="/" />;

  const qtdAdmins = (membros ?? []).filter((m) => m.papel === 'admin').length;

  async function executar(acao: () => Promise<{ error: { message: string } | null }>) {
    setOcupado(true);
    try {
      const { error } = await acao();
      if (error) throw new Error(error.message);
      await sincronizar();
    } catch (e: any) {
      Alert.alert('Não foi possível concluir', /fetch|network/i.test(e.message) ? 'Sem conexão com a internet.' : e.message);
    } finally {
      setOcupado(false);
    }
  }

  function compartilharConvite() {
    if (!empresa) return;
    void Share.share({
      message:
        `Você foi convidado para a equipe da ${empresa.nome_fantasia || empresa.razao_social} no EasyOS Light.\n\n` +
        `1. Baixe o app EasyOS Light\n2. Crie sua conta\n3. Escolha "Tenho um convite" e digite o código: ${empresa.codigo_convite}`,
    });
  }

  function novoCodigo() {
    Alert.alert('Gerar novo código?', 'O código atual deixará de funcionar. Quem já entrou continua na equipe.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Gerar', onPress: () => void executar(async () => supabase.rpc('novo_codigo_convite')) },
    ]);
  }

  function mudarPapel(m: Perfil, papel: Perfil['papel']) {
    if (m.papel === papel) return;
    if (m.id === usuarioId && m.papel === 'admin' && qtdAdmins <= 1) {
      return Alert.alert('A empresa precisa de pelo menos um administrador.');
    }
    void executar(async () => supabase.from('perfis').update({ papel }).eq('id', m.id));
  }

  function remover(m: Perfil) {
    Alert.alert(`Remover ${m.nome}?`, 'A pessoa perde o acesso aos dados da empresa. As OS dela continuam registradas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => void executar(async () => supabase.rpc('remover_da_equipe', { p_usuario: m.id })),
      },
    ]);
  }

  return (
    <Tela>
      <Cartao>
        <Titulo>Convidar para a equipe</Titulo>
        <Text style={{ color: cores.textoSuave, marginBottom: 8 }}>
          A pessoa cria a conta no app e informa este código:
        </Text>
        <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: 6, textAlign: 'center', color: cores.primaria, marginVertical: 8 }}>
          {empresa?.codigo_convite ?? '...'}
        </Text>
        <Botao titulo="Compartilhar convite" onPress={compartilharConvite} />
        <Botao titulo="Gerar novo código" variante="secundario" onPress={novoCodigo} carregando={ocupado} />
      </Cartao>

      <Titulo>Membros ({membros?.length ?? 0})</Titulo>
      {(membros ?? []).map((m) => (
        <Cartao key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: cores.texto }}>
                {m.nome}{m.id === usuarioId ? ' (você)' : ''}
              </Text>
              <Text style={{ color: cores.textoSuave, marginBottom: 8 }}>{m.email}</Text>
            </View>
            {m.id !== usuarioId && (
              <Pressable onPress={() => remover(m)} disabled={ocupado}>
                <Text style={{ color: cores.perigo }}>Remover</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {PAPEIS.map((p) => (
              <Chip key={p.valor} rotulo={p.rotulo} ativo={m.papel === p.valor}
                onPress={ocupado ? undefined : () => mudarPapel(m, p.valor)} />
            ))}
          </View>
        </Cartao>
      ))}
      <Text style={{ color: cores.textoSuave, fontSize: 12 }}>
        Técnico: vê só as próprias OS. Atendente: agenda de todos e catálogos. Admin: tudo, inclusive equipe e assinatura.
      </Text>
    </Tela>
  );
}
