import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthProvider';
import { Text, View } from 'react-native';
import { Botao, Carregando } from '@/components/ui';
import { useEstadoSync } from '@/sync/useSync';
import { sincronizar } from '@/sync/sync';
import { cores } from '@/lib/theme';

/** Primeiro acesso: o perfil ainda não chegou do servidor. */
function AguardandoPerfil() {
  const sync = useEstadoSync();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: cores.fundo }}>
      {sync.sincronizando || sync.online ? <Carregando /> : null}
      <Text style={{ textAlign: 'center', color: cores.textoSuave, marginBottom: 16 }}>
        {sync.online
          ? 'Carregando seus dados...'
          : 'Sem internet. Conecte-se para concluir o primeiro acesso.'}
      </Text>
      {sync.erro ? <Text style={{ textAlign: 'center', color: cores.perigo, marginBottom: 16 }}>{sync.erro}</Text> : null}
      <Botao titulo="Tentar de novo" variante="secundario" onPress={() => void sincronizar()} />
    </View>
  );
}

export default function TabsLayout() {
  const { session, carregando, perfil, assinatura } = useAuth();
  if (carregando) return <Carregando />;
  if (!session) return <Redirect href="/login" />;
  if (!perfil) return <AguardandoPerfil />;
  if (!perfil.empresa_id || !perfil.ativo) return <Redirect href="/onboarding" />;
  if (!assinatura.liberado) return <Redirect href="/assinatura" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.primaria },
        headerTintColor: '#fff',
        tabBarActiveTintColor: cores.primaria,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
