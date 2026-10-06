import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { sincronizar } from '@/sync/sync';
import { Botao, Campo, Tela, Titulo } from '@/components/ui';
import { cores } from '@/lib/theme';

const CAMPOS = [
  { k: 'razao_social', r: 'Razão social', obr: true },
  { k: 'nome_fantasia', r: 'Nome fantasia' },
  { k: 'cnpj', r: 'CNPJ', teclado: 'numeric' },
  { k: 'endereco', r: 'Endereço completo' },
  { k: 'telefone', r: 'Telefone', teclado: 'phone-pad' },
  { k: 'email', r: 'E-mail', teclado: 'email-address' },
  { k: 'licenca_sanitaria', r: 'Licença / alvará sanitário' },
  { k: 'responsavel_tecnico', r: 'Responsável técnico (RT)' },
  { k: 'rt_registro', r: 'Registro do RT no conselho (ex.: CRQ-IV 04123456)' },
  { k: 'ciatox_telefone', r: 'Telefone de emergência toxicológica' },
] as const;

type Chave = (typeof CAMPOS)[number]['k'];

/** Dados da empresa que saem no certificado (somente admin, precisa de internet). */
export default function EmpresaTela() {
  const { admin, empresa } = useAuth();
  const [valores, setValores] = useState<Partial<Record<Chave, string>>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!empresa) return;
    const v: Partial<Record<Chave, string>> = {};
    for (const c of CAMPOS) v[c.k] = (empresa as any)[c.k] ?? '';
    setValores(v);
  }, [empresa?.id]);

  if (!admin) return <Redirect href="/" />;

  async function onSalvar() {
    if (!valores.razao_social?.trim()) return Alert.alert('Informe a razão social');
    setSalvando(true);
    try {
      const dados: Record<string, string | null> = {};
      for (const c of CAMPOS) dados[c.k] = valores[c.k]?.trim() || null;
      const { error } = await supabase.from('empresas').update(dados).eq('id', empresa!.id);
      if (error) throw new Error(error.message);
      await sincronizar();
      router.back();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', /fetch|network/i.test(e.message) ? 'Esta tela precisa de internet.' : e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Titulo>Dados do certificado</Titulo>
      <Text style={{ color: cores.textoSuave, marginBottom: 12 }}>
        Estas informações aparecem no certificado entregue ao cliente. Confira com seu responsável técnico.
      </Text>
      {CAMPOS.map((c) => (
        <Campo
          key={c.k}
          rotulo={c.r}
          obrigatorio={'obr' in c}
          value={valores[c.k] ?? ''}
          keyboardType={'teclado' in c ? c.teclado : 'default'}
          autoCapitalize={c.k === 'email' ? 'none' : 'sentences'}
          onChangeText={(v) => setValores({ ...valores, [c.k]: v })}
        />
      ))}
      <Botao titulo="Salvar" onPress={() => void onSalvar()} carregando={salvando} />
    </Tela>
  );
}
