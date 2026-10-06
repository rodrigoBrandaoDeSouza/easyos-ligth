import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cores, statusOS } from '@/lib/theme';

// ------------------------------------------------------------------ Layout
export function Tela({ children, rolar = true }: { children: React.ReactNode; rolar?: boolean }) {
  if (!rolar) return <View style={s.tela}>{children}</View>;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={s.tela}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Cartao({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.cartao, style]}>{children}</View>;
}

export function Titulo({ children }: { children: React.ReactNode }) {
  return <Text style={s.titulo}>{children}</Text>;
}

export function Linha({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor || '-'}</Text>
    </View>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return <Text style={s.vazio}>{texto}</Text>;
}

export function Carregando() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <ActivityIndicator color={cores.primaria} />
    </View>
  );
}

// ------------------------------------------------------------------ Botões
type Variante = 'primario' | 'secundario' | 'perigo';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  desabilitado,
  style,
}: {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  carregando?: boolean;
  desabilitado?: boolean;
  style?: ViewStyle;
}) {
  const fundo =
    variante === 'primario' ? cores.primaria : variante === 'perigo' ? cores.perigo : cores.cartao;
  const cor = variante === 'secundario' ? cores.primaria : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado || carregando}
      style={({ pressed }) => [
        s.botao,
        { backgroundColor: fundo, opacity: desabilitado ? 0.5 : pressed ? 0.8 : 1 },
        variante === 'secundario' && { borderWidth: 1, borderColor: cores.primaria },
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={cor} />
      ) : (
        <Text style={[s.botaoTexto, { color: cor }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function BotaoFlutuante({ onPress, titulo = '+' }: { onPress: () => void; titulo?: string }) {
  return (
    <Pressable style={s.fab} onPress={onPress}>
      <Text style={{ color: '#fff', fontSize: titulo === '+' ? 28 : 15, fontWeight: '600' }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ Campos
export function Campo({
  rotulo,
  obrigatorio,
  ...props
}: TextInputProps & { rotulo: string; obrigatorio?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.rotulo}>
        {rotulo}
        {obrigatorio ? ' *' : ''}
      </Text>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        {...props}
        style={[s.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]}
      />
    </View>
  );
}

export interface Opcao {
  valor: string;
  rotulo: string;
  detalhe?: string | null;
}

/** Campo de seleção com busca em modal (funciona bem com listas grandes). */
export function Selecao({
  rotulo,
  valor,
  opcoes,
  onChange,
  obrigatorio,
  placeholder = 'Selecione...',
  desabilitado,
}: {
  rotulo: string;
  valor: string | null | undefined;
  opcoes: Opcao[];
  onChange: (valor: string) => void;
  obrigatorio?: boolean;
  placeholder?: string;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const atual = opcoes.find((o) => o.valor === valor);
  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return b
      ? opcoes.filter((o) => `${o.rotulo} ${o.detalhe ?? ''}`.toLowerCase().includes(b))
      : opcoes;
  }, [busca, opcoes]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.rotulo}>
        {rotulo}
        {obrigatorio ? ' *' : ''}
      </Text>
      <Pressable
        style={[s.input, { justifyContent: 'center', opacity: desabilitado ? 0.6 : 1 }]}
        onPress={() => !desabilitado && setAberto(true)}
      >
        <Text style={{ color: atual ? cores.texto : cores.textoSuave }}>
          {atual ? atual.rotulo : placeholder}
        </Text>
      </Pressable>
      <Modal visible={aberto} animationType="slide" onRequestClose={() => setAberto(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Buscar..."
              value={busca}
              onChangeText={setBusca}
              autoFocus
            />
            <Pressable onPress={() => setAberto(false)} style={{ padding: 8 }}>
              <Text style={{ color: cores.primaria, fontWeight: '600' }}>Fechar</Text>
            </Pressable>
          </View>
          <FlatList
            data={filtradas}
            keyExtractor={(o) => o.valor}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Vazio texto="Nada encontrado" />}
            renderItem={({ item }) => (
              <Pressable
                style={s.itemLista}
                onPress={() => {
                  onChange(item.valor);
                  setAberto(false);
                  setBusca('');
                }}
              >
                <Text style={{ fontSize: 16, color: cores.texto }}>{item.rotulo}</Text>
                {item.detalhe ? <Text style={s.rotulo}>{item.detalhe}</Text> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ------------------------------------------------------------------ Status
export function StatusBadge({ status }: { status: string }) {
  const st = statusOS[status] ?? { rotulo: status, cor: cores.textoSuave };
  return (
    <View style={[s.badge, { backgroundColor: st.cor }]}>
      <Text style={s.badgeTexto}>{st.rotulo}</Text>
    </View>
  );
}

export function Pendente({ status }: { status?: string }) {
  if (status !== 'pending') return null;
  return <Text style={{ color: cores.aviso, fontSize: 12 }}>● aguardando envio</Text>;
}

export function Chip({
  rotulo,
  ativo,
  onPress,
}: {
  rotulo: string;
  ativo: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[s.chip, ativo && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}
    >
      <Text style={{ color: ativo ? '#fff' : cores.texto, fontSize: 14 }}>{rotulo}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  titulo: { fontSize: 17, fontWeight: '700', color: cores.texto, marginBottom: 10 },
  rotulo: { fontSize: 13, color: cores.textoSuave, marginBottom: 4 },
  valor: { fontSize: 15, color: cores.texto },
  vazio: { textAlign: 'center', color: cores.textoSuave, padding: 24 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    minHeight: 46,
    fontSize: 16,
    color: cores.texto,
  },
  botao: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  botaoTexto: { fontSize: 16, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    minWidth: 58,
    height: 58,
    paddingHorizontal: 18,
    borderRadius: 29,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  itemLista: {
    backgroundColor: cores.cartao,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  chip: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
});
