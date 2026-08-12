import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { onlyDigits, isCpfCnpjComplete } from '@/lib/document';

export interface ClienteLookupResult {
  id: string;
  nome: string;
  empresa: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

/** Cache por sessão — evita refazer a mesma consulta ao reabrir o modal. */
const cache = new Map<string, ClienteLookupResult | null>();

export async function lookupCliente(cnpj: string): Promise<ClienteLookupResult | null> {
  const digits = onlyDigits(cnpj);
  if (!isCpfCnpjComplete(digits)) return null;
  if (cache.has(digits)) return cache.get(digits) ?? null;

  try {
    const { data } = await apiClient.get<ClienteLookupResult | null>(
      '/clientes/lookup',
      { params: { cnpj: digits } }
    );
    const result = data ?? null;
    cache.set(digits, result);
    return result;
  } catch {
    // Autocomplete é conveniência: falha silenciosa, o usuário segue digitando.
    return null;
  }
}

/** Limpa o cache de um documento — usar após salvar, para refletir a alteração. */
export function invalidateClienteLookup(cnpj?: string) {
  if (cnpj) cache.delete(onlyDigits(cnpj));
  else cache.clear();
}

interface Options {
  /** Chamado quando um cliente é encontrado para o documento digitado. */
  onFound: (cliente: ClienteLookupResult) => void;
  /** Desliga a busca (ex.: modal em modo somente leitura). */
  enabled?: boolean;
  /** Espera após a última tecla antes de consultar. */
  debounceMs?: number;
}

/**
 * Dispara a busca do cliente assim que o CPF/CNPJ fica completo (11 ou 14
 * dígitos) e chama `onFound` com os dados encontrados.
 *
 * Cada documento só dispara uma vez: se o usuário editar o que foi preenchido,
 * o hook não sobrescreve de novo enquanto o CPF/CNPJ não mudar.
 */
export function useClienteLookup(cnpj: string, { onFound, enabled = true, debounceMs = 400 }: Options) {
  const [loading, setLoading] = useState(false);
  const lastLookedUp = useRef<string | null>(null);

  // Mantém a callback fresca sem reiniciar o debounce a cada render.
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  const digits = onlyDigits(cnpj);
  const complete = isCpfCnpjComplete(digits);

  useEffect(() => {
    // Documento incompleto: rearma o gatilho, para que apagar e redigitar o
    // mesmo CPF/CNPJ volte a preencher os campos.
    if (!complete) {
      lastLookedUp.current = null;
      return;
    }
    if (!enabled || digits === lastLookedUp.current) return;

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      const cliente = await lookupCliente(digits);
      if (cancelled) return;
      lastLookedUp.current = digits;
      setLoading(false);
      if (cliente) onFoundRef.current(cliente);
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [digits, complete, enabled, debounceMs]);

  return { loading };
}
