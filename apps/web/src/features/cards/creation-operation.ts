import { useRef, useState } from 'react';
import { ApiRequestError } from '@/lib/api';

/** Un modulo = un ID. Dopo un esito ambiguo si ritentano ESATTAMENTE ID e payload originali. */
export function useCreationOperation<T extends { id?: string | undefined }>() {
  const [id, setId] = useState(() => crypto.randomUUID());
  const snapshot = useRef<T | null>(null);
  const [locked, setLocked] = useState(false);
  const [conflict, setConflict] = useState(false);
  return {
    id,
    locked,
    conflict,
    capture(input: T): T {
      snapshot.current ??= structuredClone(input);
      setLocked(true);
      return snapshot.current;
    },
    failed(error: unknown) {
      if (error instanceof ApiRequestError && error.status === 400) {
        snapshot.current = null; // validazione: il server non ha scritto
        setLocked(false);
      }
      setConflict(error instanceof ApiRequestError && error.status === 409);
    },
    restart() {
      snapshot.current = null;
      setId(crypto.randomUUID());
      setLocked(false);
      setConflict(false);
    },
  };
}
