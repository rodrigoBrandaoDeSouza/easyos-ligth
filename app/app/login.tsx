import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { Botao, Campo, Carregando, Tela } from '@/components/ui';
import { cores } from '@/lib/theme';

export default function Login() {
  const { session, carregando, entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (carregando) return <Carregando />;
  if (session) return <Redirect href="/" />;

  async function onEntrar() {
    if (!email || !senha) return Alert.alert('Informe e-mail e senha');
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (e: any) {
      Alert.alert('Não foi possível entrar', e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <View style={{ marginTop: 80, marginBottom: 32, alignItems: 'center' }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: cores.primaria }}>EasyOS Light</Text>
        <Text style={{ color: cores.textoSuave, marginTop: 6 }}>Ordens de serviço · Controle de pragas</Text>
      </View>
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none"
        keyboardType="email-address" autoComplete="email" />
      <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry />
      <Botao titulo="Entrar" onPress={onEntrar} carregando={enviando} />
      <Botao titulo="Criar conta" variante="secundario" onPress={() => router.push('/cadastro')} />
      <Text style={{ color: cores.textoSuave, textAlign: 'center', marginTop: 12, fontSize: 13 }}>
        O primeiro acesso precisa de internet. Depois o app funciona offline.
      </Text>
    </Tela>
  );
}
