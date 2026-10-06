import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { sincronizar } from '@/sync/sync';
import { sairComConfirmacao } from '@/auth/sairComConfirmacao';
import { Botao, Campo, Cartao, Carregando, Chip, Tela, Titulo } from '@/components/ui';
import { cores } from '@/lib/theme';

function mensagemErro(msg: string): string {
  if (msg.includes('CODIGO_INVALIDO')) return 'Código de convite não encontrado. Confira com o administrador.';
  if (msg.includes('JA_POSSUI_EMPRESA')) return 'Seu usuário já pertence a uma empresa.';
  if (/network|fetch/i.test(msg)) return 'Sem conexão. Esta etapa precisa de internet.';
  return msg;
}

/** Depois de criar a conta: criar a própria empresa ou entrar com convite. */
export default function Onboarding() {
  const { session, perfil, carregando, sair } = useAuth();
  const [modo, setModo] = useState<'criar' | 'convite'>('criar');
  const [razao, setRazao] = useState('');
  const [fantasia, setFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (carregando) return <Carregando />;
  if (!session) return <Redirect href="/login" />;
  if (perfil?.empresa_id && perfil.ativo) return <Redirect href="/" />;

  const removido = !!perfil?.empresa_id && !perfil.ativo;

  async function executar(acao: () => Promise<{ error: { message: string } | null }>) {
    setEnviando(true);
    try {
      const { error } = await acao();
      if (error) throw new Error(error.message);
      await sincronizar(); // detecta a nova empresa e baixa tudo
    } catch (e: any) {
      Alert.alert('Não foi possível continuar', mensagemErro(e.message));
    } finally {
      setEnviando(false);
    }
  }

  const criarEmpresa = () => {
    if (!razao.trim()) return Alert.alert('Informe o nome da empresa');
    void executar(async () =>
      supabase.rpc('criar_empresa', {
        p_razao_social: razao,
        p_nome_fantasia: fantasia || null,
        p_cnpj: cnpj || null,
        p_telefone: telefone || null,
      })
    );
  };

  const entrarComConvite = () => {
    if (codigo.trim().length < 6) return Alert.alert('Informe o código de convite');
    void executar(async () => supabase.rpc('entrar_empresa', { p_codigo: codigo }));
  };

  return (
    <Tela>
      <View style={{ marginTop: 40, marginBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: cores.primaria }}>
          Olá{perfil?.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}!
        </Text>
        <Text style={{ color: cores.textoSuave, marginTop: 6 }}>
          {removido
            ? 'Você não faz mais parte da equipe anterior. Crie sua empresa ou entre em outra.'
            : 'Para começar, crie sua empresa ou entre na equipe de uma empresa existente.'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Chip rotulo="Sou o dono" ativo={modo === 'criar'} onPress={() => setModo('criar')} />
        <Chip rotulo="Tenho um convite" ativo={modo === 'convite'} onPress={() => setModo('convite')} />
      </View>

      {modo === 'criar' ? (
        <Cartao>
          <Titulo>Criar minha empresa</Titulo>
          <Text style={{ color: cores.textoSuave, marginBottom: 12 }}>
            Você será o administrador e terá 14 dias grátis para testar.
          </Text>
          <Campo rotulo="Razão social ou nome da empresa" obrigatorio value={razao} onChangeText={setRazao} />
          <Campo rotulo="Nome fantasia" value={fantasia} onChangeText={setFantasia} />
          <Campo rotulo="CNPJ" value={cnpj} onChangeText={setCnpj} keyboardType="numeric" />
          <Campo rotulo="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
          <Botao titulo="Criar empresa" onPress={criarEmpresa} carregando={enviando} />
        </Cartao>
      ) : (
        <Cartao>
          <Titulo>Entrar com código de convite</Titulo>
          <Text style={{ color: cores.textoSuave, marginBottom: 12 }}>
            Peça o código ao administrador da empresa (ele encontra em Ajustes → Equipe).
          </Text>
          <Campo
            rotulo="Código"
            obrigatorio
            value={codigo}
            onChangeText={(v) => setCodigo(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
            style={{ fontSize: 22, letterSpacing: 4, textAlign: 'center' }}
          />
          <Botao titulo="Entrar na equipe" onPress={entrarComConvite} carregando={enviando} />
        </Cartao>
      )}

      <Botao titulo="Sair" variante="secundario" onPress={() => void sairComConfirmacao(sair)} />
    </Tela>
  );
}
