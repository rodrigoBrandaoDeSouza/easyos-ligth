import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { iniciarBanco } from '@/db/database';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { iniciarSyncAutomatico } from '@/sync/sync';
import { Carregando } from '@/components/ui';
import { cores } from '@/lib/theme';

/** Liga a sincronização automática enquanto houver usuário logado. */
function SyncAutomatico() {
  const { usuarioId } = useAuth();
  useEffect(() => (usuarioId ? iniciarSyncAutomatico() : undefined), [usuarioId]);
  return null;
}

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    iniciarBanco()
      .then(() => setPronto(true))
      .catch((e) => setErro(String(e?.message ?? e)));
  }, []);

  if (erro) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Erro ao abrir o banco local: {erro}</Text>
      </View>
    );
  }
  if (!pronto) return <Carregando />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncAutomatico />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: cores.primaria },
            headerTintColor: '#fff',
            headerBackTitle: 'Voltar',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="cadastro" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="assinatura" options={{ title: 'Assinatura' }} />
          <Stack.Screen name="equipe" options={{ title: 'Equipe' }} />
          <Stack.Screen name="empresa" options={{ title: 'Dados da empresa' }} />
          <Stack.Screen name="catalogo/[tipo]" options={{ title: 'Catálogo' }} />
          <Stack.Screen name="catalogo/form" options={{ title: 'Catálogo' }} />
          <Stack.Screen name="cliente/form" options={{ title: 'Cliente' }} />
          <Stack.Screen name="cliente/[id]" options={{ title: 'Cliente' }} />
          <Stack.Screen name="local/form" options={{ title: 'Endereço' }} />
          <Stack.Screen name="os/form" options={{ title: 'Agendar OS' }} />
          <Stack.Screen name="os/[id]" options={{ title: 'Ordem de Serviço' }} />
          <Stack.Screen name="os/produto" options={{ title: 'Produto aplicado', presentation: 'modal' }} />
          <Stack.Screen name="os/assinatura" options={{ title: 'Assinatura do cliente', presentation: 'fullScreenModal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
