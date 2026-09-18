import { useEffect, useRef } from 'react';

interface UsePollingOptions {
  /** Intervalo entre revalidações silenciosas, em ms. */
  intervalMs: number;
  /** false pausa o polling (ex.: enquanto uma janela de drill-down está aberta). */
  enabled?: boolean;
}

/**
 * Chama `callback` periodicamente e sempre que a aba volta a ficar visível,
 * para manter dados em tela atualizados sem exigir um F5. Não faz o fetch
 * inicial — cada hook que usa isto já busca os dados sozinho ao montar.
 */
export function usePolling(callback: () => void, { intervalMs, enabled = true }: UsePollingOptions) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => callbackRef.current(), intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') callbackRef.current();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
