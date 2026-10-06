import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { aoMudarBanco } from './database';

/**
 * Executa uma consulta local e a refaz sempre que o banco muda
 * (edição local ou dados recebidos na sincronização) ou a tela ganha foco.
 */
export function useConsulta<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const recarregar = useCallback(async () => {
    try {
      setDados(await fnRef.current());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => aoMudarBanco(() => void recarregar()), [recarregar]);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar])
  );

  return { dados, carregando, recarregar };
}
