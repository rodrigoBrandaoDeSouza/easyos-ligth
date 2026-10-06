import * as Crypto from 'expo-crypto';

/** UUID v4 gerado no aparelho — permite criar registros offline sem colisão. */
export function novoId(): string {
  return Crypto.randomUUID();
}
