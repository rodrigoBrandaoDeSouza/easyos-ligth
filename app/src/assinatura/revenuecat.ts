/**
 * Compras dentro do app (App Store / Google Play) via RevenueCat.
 *
 * O "App User ID" no RevenueCat é o ID da EMPRESA: a assinatura pertence à
 * empresa e libera todos os usuários dela. Só o administrador compra.
 *
 * Importante: compras NÃO funcionam no Expo Go. Use um development build
 * (npx expo run:android / eas build --profile development).
 */
import { Platform } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';
import { sincronizar } from '@/sync/sync';

let empresaConfigurada: string | null = null;

export function revenueCatDisponivel(): boolean {
  return !!chaveApi();
}

function chaveApi(): string | undefined {
  return Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
}

export async function iniciarRevenueCat(empresaId: string): Promise<void> {
  const apiKey = chaveApi();
  if (!apiKey) throw new Error('Chave do RevenueCat não configurada no .env');
  if (empresaConfigurada === null) {
    Purchases.configure({ apiKey, appUserID: empresaId });
  } else if (empresaConfigurada !== empresaId) {
    await Purchases.logIn(empresaId);
  }
  empresaConfigurada = empresaId;
}

export async function planosDisponiveis(): Promise<PurchasesPackage[]> {
  const ofertas = await Purchases.getOfferings();
  return ofertas.current?.availablePackages ?? [];
}

/** Pede ao servidor para consultar o RevenueCat e atualizar a empresa. */
async function confirmarNoServidor(): Promise<void> {
  const { error } = await supabase.functions.invoke('verificar-assinatura', { body: {} });
  if (error) console.warn('verificar-assinatura', error.message);
  await sincronizar();
}

/** Retorna false se o usuário desistiu da compra. */
export async function comprar(pacote: PurchasesPackage): Promise<boolean> {
  try {
    await Purchases.purchasePackage(pacote);
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
  await confirmarNoServidor();
  return true;
}

export async function restaurarCompras(): Promise<void> {
  await Purchases.restorePurchases();
  await confirmarNoServidor();
}

/** Link da loja para o cliente gerenciar/cancelar a assinatura. */
export async function urlGerenciarAssinatura(): Promise<string> {
  try {
    const info = await Purchases.getCustomerInfo();
    if (info.managementURL) return info.managementURL;
  } catch {
    // sem RevenueCat configurado: usa o link padrão da loja
  }
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
