import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Redirect, router, Stack } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '@/auth/AuthProvider';
import {
  comprar,
  iniciarRevenueCat,
  planosDisponiveis,
  restaurarCompras,
  revenueCatDisponivel,
  urlGerenciarAssinatura,
} from '@/assinatura/revenuecat';
import { sincronizar } from '@/sync/sync';
import { sairComConfirmacao } from '@/auth/sairComConfirmacao';
import { Botao, Cartao, Carregando, Tela, Titulo } from '@/components/ui';
import { dataBR } from '@/lib/format';
import { cores } from '@/lib/theme';

const URL_TERMOS = process.env.EXPO_PUBLIC_URL_TERMOS;
const URL_PRIVACIDADE = process.env.EXPO_PUBLIC_URL_PRIVACIDADE;

const PERIODO: Record<string, string> = {
  MONTHLY: 'por mês',
  ANNUAL: 'por ano',
  SIX_MONTH: 'a cada 6 meses',
  THREE_MONTH: 'a cada 3 meses',
  WEEKLY: 'por semana',
};

/**
 * Tela de assinatura.
 * - Com assinatura vencida, o app redireciona para cá (bloqueio).
 * - Com assinatura ativa, serve para ver a situação e gerenciar.
 */
export default function Assinatura() {
  const { session, empresa, admin, assinatura, sair } = useAuth();
  const [planos, setPlanos] = useState<PurchasesPackage[] | null>(null);
  const [erroPlanos, setErroPlanos] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    if (!admin || !empresa || !revenueCatDisponivel()) return;
    (async () => {
      try {
        await iniciarRevenueCat(empresa.id);
        setPlanos(await planosDisponiveis());
      } catch (e: any) {
        setErroPlanos(e.message);
      }
    })();
  }, [admin, empresa?.id]);

  if (!session) return <Redirect href="/login" />;
  if (!empresa) return <Carregando />;

  async function onComprar(p: PurchasesPackage) {
    setProcessando(p.identifier);
    try {
      if (await comprar(p)) {
        Alert.alert('Assinatura confirmada', 'Obrigado! Todos os usuários da empresa já estão liberados.');
        router.replace('/');
      }
    } catch (e: any) {
      Alert.alert('Não foi possível concluir a compra', e.message);
    } finally {
      setProcessando(null);
    }
  }

  async function onRestaurar() {
    setProcessando('restaurar');
    try {
      await restaurarCompras();
      Alert.alert('Pronto', 'Compras restauradas. Se havia assinatura ativa, o acesso foi liberado.');
    } catch (e: any) {
      Alert.alert('Não foi possível restaurar', e.message);
    } finally {
      setProcessando(null);
    }
  }

  const bloqueado = !assinatura.liberado;
  const descricao =
    assinatura.tipo === 'ativa'
      ? `Assinatura ativa até ${dataBR(assinatura.ate)}${empresa.assinatura_renova === 0 ? ' (renovação cancelada)' : ''}.`
      : assinatura.tipo === 'teste'
        ? `Período de teste: ${assinatura.diasRestantes} dia(s) restante(s).`
        : assinatura.tipo === 'carencia'
          ? 'Sua assinatura venceu. O acesso será bloqueado em breve.'
          : 'O período de teste ou a assinatura terminou.';

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Assinatura', headerShown: !bloqueado }} />
      {bloqueado && <View style={{ height: 48 }} />}

      <Cartao>
        <Titulo>{empresa.nome_fantasia || empresa.razao_social}</Titulo>
        <Text style={{ color: bloqueado ? cores.perigo : cores.texto, fontSize: 15 }}>{descricao}</Text>
        {bloqueado && (
          <Text style={{ color: cores.textoSuave, marginTop: 8 }}>
            Seus dados estão guardados. Assine para voltar a usar o app. O que foi registrado offline
            será enviado assim que a assinatura for confirmada.
          </Text>
        )}
      </Cartao>

      {!admin ? (
        <Cartao>
          <Text style={{ color: cores.texto }}>
            A assinatura é feita pelo administrador da empresa. Peça a ele para assinar pelo app,
            em Ajustes → Assinatura.
          </Text>
        </Cartao>
      ) : !revenueCatDisponivel() ? (
        <Cartao>
          <Text style={{ color: cores.textoSuave }}>
            Compras não configuradas neste build (defina as chaves do RevenueCat no .env).
          </Text>
        </Cartao>
      ) : (
        <>
          <Titulo>Planos</Titulo>
          {erroPlanos ? <Text style={{ color: cores.perigo, marginBottom: 12 }}>{erroPlanos}</Text> : null}
          {!planos && !erroPlanos ? <ActivityIndicator color={cores.primaria} style={{ margin: 16 }} /> : null}
          {planos?.length === 0 ? (
            <Text style={{ color: cores.textoSuave, marginBottom: 12 }}>Nenhum plano disponível no momento.</Text>
          ) : null}
          {planos?.map((p) => (
            <Pressable key={p.identifier} onPress={() => void onComprar(p)} disabled={!!processando}>
              <Cartao style={{ borderColor: cores.primaria, borderWidth: 2 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>{p.product.title}</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: cores.primaria, marginVertical: 4 }}>
                  {p.product.priceString}{' '}
                  <Text style={{ fontSize: 14, fontWeight: '400', color: cores.textoSuave }}>
                    {PERIODO[p.packageType] ?? ''}
                  </Text>
                </Text>
                {p.product.description ? (
                  <Text style={{ color: cores.textoSuave }}>{p.product.description}</Text>
                ) : null}
                {processando === p.identifier ? <ActivityIndicator color={cores.primaria} /> : null}
              </Cartao>
            </Pressable>
          ))}

          <Text style={{ color: cores.textoSuave, fontSize: 12, marginBottom: 12 }}>
            A assinatura é cobrada na sua conta {Platform.OS === 'ios' ? 'Apple' : 'Google Play'} e
            renova automaticamente, a menos que seja cancelada pelo menos 24 horas antes do fim do
            período. Gerencie ou cancele nas configurações da loja. Vale para todos os usuários da empresa.
          </Text>

          <Botao
            titulo="Restaurar compras"
            variante="secundario"
            carregando={processando === 'restaurar'}
            onPress={() => void onRestaurar()}
          />
          {!bloqueado && (
            <Botao
              titulo="Gerenciar / cancelar na loja"
              variante="secundario"
              onPress={async () => Linking.openURL(await urlGerenciarAssinatura())}
            />
          )}
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 8 }}>
        {URL_TERMOS ? (
          <Text style={{ color: cores.info }} onPress={() => Linking.openURL(URL_TERMOS)}>Termos de uso</Text>
        ) : null}
        {URL_PRIVACIDADE ? (
          <Text style={{ color: cores.info }} onPress={() => Linking.openURL(URL_PRIVACIDADE)}>Privacidade</Text>
        ) : null}
      </View>

      {bloqueado && (
        <>
          <Botao titulo="Já assinei — verificar de novo" variante="secundario" onPress={() => void sincronizar()} />
          <Botao titulo="Sair" variante="secundario" onPress={() => void sairComConfirmacao(sair)} />
        </>
      )}
    </Tela>
  );
}
