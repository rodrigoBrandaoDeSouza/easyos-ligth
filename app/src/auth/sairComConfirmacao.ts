import { Alert } from 'react-native';
import { contarPendentes } from '@/sync/sync';

/** Sai da conta avisando se há alterações que ainda não foram enviadas. */
export async function sairComConfirmacao(sair: (forcar?: boolean) => Promise<void>) {
  const pendentes = await contarPendentes();
  if (!pendentes) return sair(true);
  Alert.alert(
    'Há dados não enviados',
    `Existem ${pendentes} alteração(ões) que ainda não foram enviadas ao servidor. Se sair agora elas serão PERDIDAS.`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair e descartar', style: 'destructive', onPress: () => void sair(true) },
    ]
  );
}
