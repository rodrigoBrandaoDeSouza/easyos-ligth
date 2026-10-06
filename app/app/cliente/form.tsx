import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { salvar } from '@/db/database';
import { cliente as lerCliente } from '@/db/repos';
import { Botao, Campo, Chip, Tela, Titulo } from '@/components/ui';
import { CamposEndereco, Endereco, enderecoParaBanco, enderecoVazio } from '@/components/CamposEndereco';
import { cores } from '@/lib/theme';

export default function ClienteForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { usuarioId } = useAuth();
  const editando = !!id;

  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF');
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [contato, setContato] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [endereco, setEndereco] = useState<Endereco>(enderecoVazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!id) return;
    lerCliente(id).then((c) => {
      if (!c) return;
      setTipo(c.tipo_pessoa);
      setNome(c.nome);
      setDocumento(c.documento ?? '');
      setTelefone(c.telefone ?? '');
      setEmail(c.email ?? '');
      setContato(c.contato ?? '');
      setObservacoes(c.observacoes ?? '');
    });
  }, [id]);

  async function onSalvar() {
    if (!nome.trim()) return Alert.alert('Informe o nome do cliente');
    setSalvando(true);
    try {
      const clienteId = await salvar('clientes', {
        ...(id ? { id } : { created_by: usuarioId }),
        tipo_pessoa: tipo,
        nome: nome.trim(),
        documento: documento.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        contato: contato.trim() || null,
        observacoes: observacoes.trim() || null,
      });
      if (!editando) {
        await salvar('locais', {
          cliente_id: clienteId,
          descricao: 'Principal',
          ...enderecoParaBanco(endereco),
        });
        router.replace(`/cliente/${clienteId}`);
      } else {
        router.back();
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: editando ? 'Editar cliente' : 'Novo cliente' }} />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Chip rotulo="Pessoa física" ativo={tipo === 'PF'} onPress={() => setTipo('PF')} />
        <Chip rotulo="Pessoa jurídica" ativo={tipo === 'PJ'} onPress={() => setTipo('PJ')} />
      </View>
      <Campo rotulo={tipo === 'PF' ? 'Nome' : 'Razão social / Nome fantasia'} obrigatorio value={nome} onChangeText={setNome} />
      <Campo rotulo={tipo === 'PF' ? 'CPF' : 'CNPJ'} value={documento} onChangeText={setDocumento} keyboardType="numeric" />
      <Campo rotulo="Telefone / WhatsApp" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {tipo === 'PJ' && <Campo rotulo="Pessoa de contato" value={contato} onChangeText={setContato} />}
      <Campo rotulo="Observações" value={observacoes} onChangeText={setObservacoes} multiline />

      {!editando && (
        <>
          <Titulo>Endereço do atendimento</Titulo>
          <Text style={{ color: cores.textoSuave, marginBottom: 10, fontSize: 13 }}>
            Outros endereços podem ser adicionados depois, na ficha do cliente.
          </Text>
          <CamposEndereco valor={endereco} onChange={setEndereco} />
        </>
      )}

      <Botao titulo="Salvar" onPress={onSalvar} carregando={salvando} />
    </Tela>
  );
}
