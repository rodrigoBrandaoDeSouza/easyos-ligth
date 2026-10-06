import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !chave) {
  throw new Error(
    'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY no arquivo .env (veja .env.example)'
  );
}

export const supabase = createClient(url, chave, {
  auth: {
    storage: AsyncStorage, // sessão fica salva: o app abre logado mesmo sem internet
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Só tenta renovar o token com o app em primeiro plano
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
