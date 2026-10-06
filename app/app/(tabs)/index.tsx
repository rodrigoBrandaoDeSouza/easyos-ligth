import React, { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthProvider';
import { osAtrasadas, osDoPeriodo, OSResumo } from '@/db/repos';
import { useConsulta } from '@/db/useConsulta';
import { OSCard } from '@/components/OSCard';
import { SyncBanner } from '@/components/SyncBanner';
import { BotaoFlutuante, Chip, Titulo, Vazio } from '@/components/ui';
import { dataBR, diaSemana, inicioDoDia, somarDias } from '@/lib/format';
import { cores } from '@/lib/theme';

export default function Agenda() {
  const { usuarioId, equipeInterna, admin, assinatura } = useAuth();
  const [dia, setDia] = useState(() => inicioDoDia(new Date()));
  const [somenteMinhas, setSomenteMinhas] = useState(true);

  const tecnico = equipeInterna && !somenteMinhas ? null : usuarioId;
  const hoje = inicioDoDia(new Date());
  const ehHoje = dia.getTime() === hoje.getTime();

  const { dados } = useConsulta(async () => {
    const doDia = await osDoPeriodo(dia, somarDias(dia, 1), tecnico);
    const atrasadas = ehHoje ? await osAtrasadas(hoje, tecnico) : [];
    return { doDia, atrasadas };
  }, [dia.getTime(), tecnico, ehHoje]);

  const itens: (OSResumo | { cabecalho: string })[] = [];
  if (dados?.atrasadas.length) {
    itens.push({ cabecalho: `Pendentes de dias anteriores (${dados.atrasadas.length})` });
    itens.push(...dados.atrasadas);
    itens.push({ cabecalho: 'Hoje' });
  }
  itens.push(...(dados?.doDia ?? []));

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <SyncBanner />
      {admin && (assinatura.tipo === 'carencia' || (assinatura.tipo === 'teste' && (assinatura.diasRestantes ?? 99) <= 5)) && (
        <Pressable onPress={() => router.push('/assinatura')} style={{ backgroundColor: cores.aviso, padding: 8 }}>
          <Text style={{ color: '#fff', fontSize: 13 }}>
            {assinatura.tipo === 'teste'
              ? `Seu teste grátis termina em ${assinatura.diasRestantes} dia(s). Toque para assinar.`
              : 'Assinatura vencida. Toque para renovar e não perder o acesso.'}
          </Text>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: cores.borda }}>
        <Pressable onPress={() => setDia(somarDias(dia, -1))} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={cores.primaria} />
        </Pressable>
        <Pressable onPress={() => setDia(hoje)} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>
            {ehHoje ? 'Hoje' : diaSemana(dia)}, {dataBR(dia.toISOString())}
          </Text>
          {!ehHoje && <Text style={{ color: cores.primaria, fontSize: 12 }}>voltar para hoje</Text>}
        </Pressable>
        <Pressable onPress={() => setDia(somarDias(dia, 1))} hitSlop={12}>
          <Ionicons name="chevron-forward" size={26} color={cores.primaria} />
        </Pressable>
      </View>

      {equipeInterna && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 }}>
          <Chip rotulo="Minhas OS" ativo={somenteMinhas} onPress={() => setSomenteMinhas(true)} />
          <Chip rotulo="Todos os técnicos" ativo={!somenteMinhas} onPress={() => setSomenteMinhas(false)} />
        </View>
      )}

      <FlatList
        data={itens}
        keyExtractor={(i, idx) => ('id' in i ? i.id : `h${idx}`)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={<Vazio texto="Nenhuma OS agendada para este dia." />}
        renderItem={({ item }) =>
          'cabecalho' in item ? (
            <Titulo>{item.cabecalho}</Titulo>
          ) : (
            <OSCard os={item} mostrarData={item.agendada_para < hoje.toISOString()} mostrarTecnico={!tecnico} />
          )
        }
      />
      <BotaoFlutuante onPress={() => router.push('/os/form')} />
    </View>
  );
}
