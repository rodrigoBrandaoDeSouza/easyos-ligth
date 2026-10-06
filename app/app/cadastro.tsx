import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { Botao, Campo, Tela } from '@/components/ui';
import { cores } from '@/lib/theme';

export default function Cadastro() {
  const { session, cadastrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (session) return <Redirect href="/" />;

  async function onCadastrar() {
    if (!nome.trim() || !email.trim()) return Alert.alert('Preencha nome e e-mail');
    if (senha.length < 6) return Alert.alert('A senha precisa ter pelo menos 6 caracteres');
    if (senha !== confirma) return Alert.alert('As senhas não conferem');
    setEnviando(true);
    try {
      const precisaConfirmar = await cadastrar(nome, email, senha);
      if (precisaConfirmar) {
        Alert.alert(
          'Confirme seu e-mail',
          `Enviamos um link para ${email.trim()}. Depois de confirmar, volte e toque em "Entrar".`,
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      }
    } catch (e: any) {
      Alert.alert('Não foi possível cadastrar', e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <View style={{ marginTop: 48, marginBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: cores.primaria }}>Criar conta</Text>
        <Text style={{ color: cores.textoSuave, marginTop: 6 }}>
          Donos de empresa e técnicos usam a mesma conta. No próximo passo você cria sua empresa
          ou entra numa existente com o código de convite.
        </Text>
      </View>
      <Campo rotulo="Seu nome" obrigatorio value={nome} onChangeText={setNome} autoComplete="name" />
      <Campo rotulo="E-mail" obrigatorio value={email} onChangeText={setEmail} autoCapitalize="none"
        keyboardType="email-address" autoComplete="email" />
      <Campo rotulo="Senha" obrigatorio value={senha} onChangeText={setSenha} secureTextEntry
        autoComplete="new-password" />
      <Campo rotulo="Confirme a senha" obrigatorio value={confirma} onChangeText={setConfirma} secureTextEntry />
      <Botao titulo="Criar conta" onPress={onCadastrar} carregando={enviando} />
      <Botao titulo="Já tenho conta" variante="secundario" onPress={() => router.replace('/login')} />
    </Tela>
  );
}
