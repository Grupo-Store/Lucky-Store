import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const CHECK_INTERVAL_MS = 10 * 60_000;

/** Avisa quando ha um deploy mais novo que o bundle rodando nesta aba.
 *
 *  Sem isto, uma aba aberta antes de um deploy continua rodando o JS antigo
 *  ate ser recarregada manualmente — foi assim que uma cotacao saiu impressa
 *  com o layout do dia anterior (logo grande, linha de assinatura) num
 *  navegador que ja tinha a correcao publicada, so nao tinha dado F5. */
export function UpdateNotifier() {
  const notified = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (notified.current || cancelled) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.buildId && data.buildId !== __BUILD_ID__) {
          notified.current = true;
          toast('Nova versão disponível', {
            description: 'Esta aba está com uma versão desatualizada do sistema.',
            duration: Infinity,
            action: {
              label: 'Atualizar',
              onClick: () => window.location.reload(),
            },
          });
        }
      } catch {
        // offline ou dev server sem version.json — ignora e tenta na proxima
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
