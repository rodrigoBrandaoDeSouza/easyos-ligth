import { useSyncExternalStore } from 'react';
import { assinarEstadoSync, obterEstadoSync } from './sync';

export function useEstadoSync() {
  return useSyncExternalStore(assinarEstadoSync, obterEstadoSync);
}
