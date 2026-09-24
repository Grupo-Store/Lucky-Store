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
            // Mesmo azul escuro do botão "Entrar" da tela de login (T.accentDark em LoginScreen.tsx).
            // Precisa ficar aqui no nível do toast(), não dentro de `action` — é onde o sonner lê o estilo.
            actionButtonStyle: {
              background: '#1E4FD8',
              color: '#fff',
            },
            // Maior e com botão em linha própria: cliente relatou dificuldade de notar
            // avisos discretos. Não alargar o card — o container do sonner tem largura
            // fixa e um card mais largo vaza pra fora da tela.
            classNames: {
              toast: '!p-5 !gap-3 !flex-col !items-stretch',
              title: '!text-base !font-semibold',
              description: '!text-sm !mt-0.5',
              actionButton: '!w-full !mx-0 !mt-2 !h-auto !py-3 !text-sm !font-semibold',
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
