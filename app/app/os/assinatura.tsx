import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import SignatureScreen from 'react-native-signature-canvas';
import { salvar } from '@/db/database';

/** Captura a assinatura do cliente na tela (PNG em base64, salvo na própria OS). */
export default function Assinatura() {
  const { osId } = useLocalSearchParams<{ osId: string }>();

  async function onOK(assinatura: string) {
    await salvar('ordens_servico', { id: osId, assinatura_cliente: assinatura });
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SignatureScreen
        onOK={(sig: string) => void onOK(sig)}
        descriptionText="Assine dentro do quadro"
        clearText="Limpar"
        confirmText="Confirmar"
        imageType="image/png"
        autoClear={false}
        webStyle={`.m-signature-pad { box-shadow: none; border: 1px solid #D9E0DD; }
                   .m-signature-pad--footer .button { background-color: #1B6B4A; color: #fff; }`}
      />
    </View>
  );
}
