import React from 'react';
import { View } from 'react-native';
import { Campo } from './ui';

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  tipo_imovel: string;
  area_m2: string;
}

export const enderecoVazio: Endereco = {
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '',
  cidade: '', uf: '', tipo_imovel: '', area_m2: '',
};

export function CamposEndereco({ valor, onChange }: { valor: Endereco; onChange: (e: Endereco) => void }) {
  const set = (campo: keyof Endereco) => (v: string) => onChange({ ...valor, [campo]: v });
  return (
    <View>
      <Campo rotulo="CEP" value={valor.cep} onChangeText={set('cep')} keyboardType="numeric" />
      <Campo rotulo="Logradouro" value={valor.logradouro} onChangeText={set('logradouro')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Campo rotulo="Número" value={valor.numero} onChangeText={set('numero')} /></View>
        <View style={{ flex: 2 }}><Campo rotulo="Complemento" value={valor.complemento} onChangeText={set('complemento')} /></View>
      </View>
      <Campo rotulo="Bairro" value={valor.bairro} onChangeText={set('bairro')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 3 }}><Campo rotulo="Cidade" value={valor.cidade} onChangeText={set('cidade')} /></View>
        <View style={{ flex: 1 }}>
          <Campo rotulo="UF" value={valor.uf} maxLength={2} autoCapitalize="characters"
            onChangeText={(v) => set('uf')(v.toUpperCase())} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 2 }}>
          <Campo rotulo="Tipo de imóvel" placeholder="Residencial, comercial..." value={valor.tipo_imovel} onChangeText={set('tipo_imovel')} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo="Área (m²)" value={valor.area_m2} onChangeText={set('area_m2')} keyboardType="decimal-pad" />
        </View>
      </View>
    </View>
  );
}

/** Converte os campos de texto para o formato do banco. */
export function enderecoParaBanco(e: Endereco) {
  const area = Number(e.area_m2.replace(',', '.'));
  return {
    cep: e.cep.trim() || null,
    logradouro: e.logradouro.trim() || null,
    numero: e.numero.trim() || null,
    complemento: e.complemento.trim() || null,
    bairro: e.bairro.trim() || null,
    cidade: e.cidade.trim() || null,
    uf: e.uf.trim().toUpperCase() || null,
    tipo_imovel: e.tipo_imovel.trim() || null,
    area_m2: e.area_m2.trim() && !Number.isNaN(area) ? area : null,
  };
}
