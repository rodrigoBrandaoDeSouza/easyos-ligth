import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CATALOGOS, TipoCatalogo } from '@/catalogo/config';
import { primeiro, salvar } from '@/db/database';
import { Botao, Campo, Tela } from '@/components/ui';
import { lerNumero } from '@/lib/format';
import { cores } from '@/lib/theme';

export default function FormCatalogo() {
  const { tipo, id } = useLocalSearchParams<{ tipo: TipoCatalogo; id?: string }>();
  const def = CATALOGOS[tipo];
  const [valores, setValores] = useState<Record<string, string>>(
    tipo === 'produtos' ? { unidade: 'mL' } : tipo === 'servicos' ? { garantia_dias: '90' } : {}
  );
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!id) return;
    primeiro<Record<string, any>>(`select * from ${tipo} where id = ?`, [id]).then((r) => {
      if (!r) return;
      const v: Record<string, string> = {};
      for (const c of def.campos) v[c.k] = r[c.k] == null ? '' : String(r[c.k]);
      setValores(v);
      setAtivo(r.ativo === 1);
    });
  }, [id, tipo]);

  async function onSalvar() {
    const dados: Record<string, unknown> = { ...(id ? { id } : {}), ativo };
    for (const c of def.campos) {
      const txt = (valores[c.k] ?? '').trim();
      if (c.obrigatorio && !txt) return Alert.alert(`Informe: ${c.rotulo}`);
      if (c.numero) {
        const n = lerNumero(txt);
        if (txt && (n === null || n < 0)) return Alert.alert(`Valor inválido: ${c.rotulo}`);
        dados[c.k] = n === null ? null : Math.round(n);
      } else {
        dados[c.k] = txt || null;
      }
    }
    await salvar(tipo, dados);
    router.back();
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: id ? `Editar ${def.singular}` : `Novo ${def.singular}` }} />
      {def.campos.map((c) => (
        <Campo
          key={c.k}
          rotulo={c.rotulo}
          obrigatorio={c.obrigatorio}
          placeholder={c.dica}
          keyboardType={c.numero ? 'number-pad' : 'default'}
          value={valores[c.k] ?? ''}
          onChangeText={(v) => setValores({ ...valores, [c.k]: v })}
        />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ color: cores.texto, fontSize: 15 }}>Ativo (aparece para seleção nas OS)</Text>
        <Switch value={ativo} onValueChange={setAtivo} trackColor={{ true: cores.primaria }} />
      </View>
      <Botao titulo="Salvar" onPress={() => void onSalvar()} />
    </Tela>
  );
}
