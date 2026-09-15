import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, ChevronRight, FilePlus, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Quote, QUOTE_PHASE_LABELS, QUOTE_PHASE_COLORS } from '@/store/QuoteStore';
import type { DirectSupplyOrderItem, Order } from '@/store/OrderStore';
import { useVendedores } from '@/hooks/useVendedores';
import { apiClient } from '@/api/client';
import { LOJA_IDS, VENDEDOR_IDS } from '@/api/storeConfig';
import type { CotacaoResponse, PaginatedResponse } from '@/types/api';

const LOJA_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(LOJA_IDS).map(([name, id]) => [id, name])
);
const VENDEDOR_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(VENDEDOR_IDS).map(([name, id]) => [id, name])
);

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function toBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function getCotacaoPhase(c: CotacaoResponse) {
  if (c.status_caida) return 'dropped';
  if (c.status_fechada) return 'closed';
  if (c.status_em_fechamento) return 'forClosing';
  if (c.status_enviada) return 'sent';
  return null;
}

export interface OrderPrefill {
  /** Cotação de origem, quando o pedido é criado a partir de uma cotação */
  sourceQuoteId?: string;
  sourceQuoteNumber?: Order['sourceQuoteNumber'];
  quoteTerms?: Order['quoteTerms'];
  observations?: string;
  /** A EMPRESA. */
  customer: string;
  customerCompany?: string;
  /** A pessoa de contato dentro dela. */
  customerContact?: string;
  cnpj: string;
  company: Quote['company'];
  seller: Quote['seller'];
  salesValue: number;
  directBilling: boolean;
  /** `saleValue` é o preço do cliente (o `valor_fechamento` da cotação), e
   *  `projectedValue` é o custo. Sem levar o primeiro daqui, a OS criada por
   *  esta tela nascia sem preço de venda nenhum e o documento saía com
   *  travessão na coluna — mesmo buraco que a conversão no backend tinha. */
  items: { id: string; name: string; quantity: number; projectedValue: number; saleValue?: number }[];
  directSupplyItems: DirectSupplyOrderItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  quotes?: Quote[];
  onChooseNew: () => void;
  onChooseFromQuote: (prefill: OrderPrefill) => void;
}

type Step = 'choose' | 'pick-quote' | 'pick-items';
type ItemDraft = { quantity: string; cost: string; sale: string };

function parseAmount(value: string): number {
  const text = value.trim();
  // Aceita 1234.56, 1234,56 e 1.234,56 sem converter entradas inválidas em zero.
  const valid = text.includes(',')
    ? /^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)
    : /^\d+(?:\.\d{1,2})?$/.test(text);
  if (!valid) return NaN;
  return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
}

export function AddOrderChooser({ open, onClose, onChooseNew, onChooseFromQuote }: Props) {
  const { data: vendedoresData } = useVendedores();
  const [step, setStep] = useState<Step>('choose');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<CotacaoResponse | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [quotePage, setQuotePage] = useState(1);
  const [buscaServidor, setBuscaServidor] = useState('');

  /* A busca vai para o SERVIDOR, igual à tela de Vendas.
   *
   * Filtrando no navegador ela só enxergava as 20 cotações da página aberta:
   * procurar o índice 23, ou um cliente com cotação antiga, não achava nada e
   * falhava em silêncio — parecia que a cotação não existia. O servidor procura
   * em índice (exato), Nº Req., cliente, empresa, loja e vendedor, na base
   * inteira.
   *
   * 350ms para não disparar uma requisição por tecla. Volta para a página 1
   * junto, senão a busca nova herdaria a página da anterior e viria vazia. */
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaServidor(search.trim());
      setQuotePage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: quotesData,
    isLoading: quotesLoading,
    isError: quotesError,
    refetch: quotesRefetch,
  } = useQuery<PaginatedResponse<CotacaoResponse>>({
    queryKey: ['quotes', 'list', 'chooser', quotePage, buscaServidor],
    queryFn: () =>
      apiClient.get('/quotes', {
        params: {
          page: quotePage, limit: 20, sort_by: 'data_cotacao', sort_dir: 'desc',
          eligible_for_order: true,
          busca: buscaServidor || undefined,
        },
      }).then(r => r.data),
    enabled: open && step === 'pick-quote',
    staleTime: 60_000,
  });

  /* O reset espera a animação de fechamento para o modal não piscar no passo 1
   * enquanto some. Guardado num ref porque, solto, ele continuava pendente
   * depois do componente sair da tela e voltava setando estado num componente
   * que não existe mais. */
  const timerDeReset = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timerDeReset.current), []);

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose();
      clearTimeout(timerDeReset.current);
      timerDeReset.current = setTimeout(() => {
        setStep('choose');
        setPicked(null);
        setSelectedItemIds(new Set());
        setItemDrafts({});
        setSearch('');
        setBuscaServidor('');
        setQuotePage(1);
      }, 200);
    }
  };

  // Quem filtra o texto é o servidor, pelo parâmetro `busca`. Refiltrar aqui
  // desfaria isso: o índice casa exato no servidor e não aparece em nenhum
  // campo de texto, então a linha certa sumiria logo depois de chegar.
  const eligibleQuotes = quotesData?.items ?? [];

  const pickQuote = (qt: CotacaoResponse) => {
    setPicked(qt);
    setSelectedItemIds(new Set((qt.itens ?? []).map(i => i.id)));
    setItemDrafts(Object.fromEntries((qt.itens ?? []).map(i => [i.id, {
      quantity: String(i.quantidade), cost: i.valor_unitario, sale: i.valor_fechamento ?? '',
    }])));
    setStep('pick-items');
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateDraft = (id: string, field: keyof ItemDraft, value: string) => {
    setItemDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const chosen = (picked?.itens ?? []).filter(i => selectedItemIds.has(i.id)).map(i => {
    const draft = itemDrafts[i.id];
    return {
      ...i,
      quantidade: Number(draft?.quantity),
      valor_unitario: String(parseAmount(draft?.cost ?? '')),
      valor_fechamento: draft?.sale.trim() ? String(parseAmount(draft.sale)) : null,
    };
  });
  const invalidSelection = chosen.some(i => !Number.isSafeInteger(i.quantidade) || i.quantidade <= 0
    || !Number.isFinite(Number(i.valor_unitario))
    || (i.valor_fechamento !== null && !Number.isFinite(Number(i.valor_fechamento))));
  const selectedTotal = chosen.reduce((sum, i) => sum + Number(i.valor_fechamento ?? 0) * i.quantidade, 0);

  const confirmFromQuote = () => {
    if (!picked || !chosen.length || invalidSelection) return;
    const regularItems = chosen.filter(i => !i.is_direct_supply);
    const dsItems = chosen.filter(i => i.is_direct_supply);
    const hasDirect = dsItems.length > 0;
    const prefill: OrderPrefill = {
      sourceQuoteId: picked.id,
      sourceQuoteNumber: picked.numero,
      quoteTerms: {
        deliveryForecast: picked.previsao_entrega,
        paymentMethod: picked.forma_pagamento,
        paymentDetails: picked.detalhes_pagamento,
        warranty: picked.garantia,
      },
      observations: picked.observacao ?? '',
      // Empresa e pessoa vao separadas. Antes eram fundidas aqui — escolhia a
      // empresa se existisse, senao o contato — e o pedido nascia sem saber
      // qual das duas coisas tinha recebido.
      customer: (picked.b2b_company?.trim()) ? picked.b2b_company : picked.cliente,
      customerContact: picked.cliente ?? '',
      cnpj: picked.cnpj_cliente ?? '',
      company: (LOJA_BY_ID[picked.id_loja] ?? '') as Quote['company'],
      seller: (vendedoresData?.items.find(v => v.id === picked.id_vendedor)?.nome
        ?? VENDEDOR_BY_ID[picked.id_vendedor] ?? '') as Quote['seller'],
      salesValue: chosen.reduce((sum, i) => sum + (parseFloat(i.valor_fechamento ?? '0') || 0) * i.quantidade, 0),
      directBilling: hasDirect,
      items: regularItems.map(i => ({
        id: crypto.randomUUID(),
        name: i.descricao,
        quantity: i.quantidade,
        projectedValue: parseFloat(i.valor_unitario) || 0,
        saleValue: i.valor_fechamento != null ? (parseFloat(i.valor_fechamento) || 0) : undefined,
      })),
      directSupplyItems: dsItems.map(i => {
        const closingVal = parseFloat(i.valor_fechamento ?? '0') || 0;
        return {
          id: crypto.randomUUID(),
          name: i.descricao,
          quantity: i.quantidade,
          projectedValue: parseFloat(i.valor_unitario) || 0,
          // No fornecimento direto, o custo negociado acompanha a venda.
          purchaseValue: parseFloat(i.valor_unitario) || 0,
          closingValue: closingVal,
          supplier: i.fornecedor || '',
          supplierPct: parseFloat(i.porcentagem_fornecedor ?? '0') || 0,
          supplierFreight: parseFloat(i.frete_fornecedor ?? '0') || 0,
          supplierInvoice: '',
        };
      }),
    };
    onChooseFromQuote(prefill);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl flex items-center gap-2">
            {step !== 'choose' && (
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setStep(step === 'pick-items' ? 'pick-quote' : 'choose')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'choose' && 'Adicionar Pedido'}
            {step === 'pick-quote' && 'Selecionar Cotação'}
            {step === 'pick-items' && `Selecionar Itens — ${picked?.b2b_company?.trim() || picked?.cliente}`}
          </DialogTitle>
        </DialogHeader>

        {step === 'choose' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
            <button
              onClick={() => setStep('pick-quote')}
              className="border-2 border-secondary/30 hover:border-secondary hover:bg-secondary/5 rounded-xl p-6 text-left transition-all group"
            >
              <FileText className="h-8 w-8 text-secondary mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-secondary uppercase text-sm tracking-wide">Cadastrar a partir de cotação</h3>
              <p className="text-sm text-muted-foreground mt-2">Pré-preencha o pedido com dados de uma cotação fechada.</p>
            </button>
            <button
              onClick={() => { onChooseNew(); handleOpenChange(false); }}
              className="border-2 border-secondary/30 hover:border-secondary hover:bg-secondary/5 rounded-xl p-6 text-left transition-all group"
            >
              <FilePlus className="h-8 w-8 text-secondary mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-secondary uppercase text-sm tracking-wide">Cadastrar novo pedido</h3>
              <p className="text-sm text-muted-foreground mt-2">Abrir um pedido em branco e preencher manualmente.</p>
            </button>
          </div>
        )}

        {step === 'pick-quote' && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Índice, Cliente, Req, Empresa, Vendedor ou ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="pl-9 bg-white"
                autoFocus
              />
            </div>
            {quotesError && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between">
                  <span>Falha ao carregar cotações.</span>
                  <Button variant="outline" size="sm" onClick={() => quotesRefetch()}>Tentar novamente</Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead>Índice</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : eligibleQuotes.map(qt => {
                    const phase = getCotacaoPhase(qt);
                    return (
                      <TableRow key={qt.id} className="cursor-pointer hover:bg-muted/50" onClick={() => pickQuote(qt)}>
                        <TableCell className="font-semibold">{qt.numero ?? '—'}</TableCell>
                        <TableCell className="font-medium">{qt.b2b_company?.trim() || qt.cliente}</TableCell>
                        <TableCell>{LOJA_BY_ID[qt.id_loja] || '—'}</TableCell>
                        <TableCell>{fmtDate(qt.data_cotacao)}</TableCell>
                        <TableCell>
                          {phase && (
                            <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border',
                              QUOTE_PHASE_COLORS[phase as keyof typeof QUOTE_PHASE_COLORS])}>
                              {QUOTE_PHASE_LABELS[phase as keyof typeof QUOTE_PHASE_LABELS]}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {qt.valor_total ? toBRL(parseFloat(qt.valor_total)) : '—'}
                        </TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                  {!quotesLoading && eligibleQuotes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma cotação fechada encontrada para esta busca.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {(quotesData?.pages ?? 1) > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                <span>{quotesData?.total ?? 0} cotações</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={quotePage <= 1}
                    onClick={() => setQuotePage(p => p - 1)}>Anterior</Button>
                  <span>Página {quotePage} de {quotesData?.pages ?? 1}</span>
                  <Button variant="outline" size="sm" disabled={quotePage >= (quotesData?.pages ?? 1)}
                    onClick={() => setQuotePage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'pick-items' && picked && (
          <>
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{picked.b2b_company?.trim() || picked.cliente}</span>
              {' · '}CPF/CNPJ: <span className="font-medium text-foreground">{picked.cnpj_cliente || '—'}</span>
              {' · '}Empresa: <span className="font-medium text-foreground">{LOJA_BY_ID[picked.id_loja] || '—'}</span>
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead className="text-right">Custo unitário (R$)</TableHead>
                    <TableHead className="text-right">Venda unitária (R$)</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(picked.itens ?? []).map(it => (
                    <TableRow key={it.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleItem(it.id)}>
                      <TableCell onClick={e => e.stopPropagation()}><Checkbox aria-label={`Incluir ${it.descricao}`} checked={selectedItemIds.has(it.id)} onCheckedChange={() => toggleItem(it.id)} /></TableCell>
                      <TableCell>{it.descricao}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Input aria-label={`Quantidade de ${it.descricao}`} inputMode="numeric" className="min-w-16"
                          disabled={!selectedItemIds.has(it.id)} value={itemDrafts[it.id]?.quantity ?? ''}
                          onChange={e => updateDraft(it.id, 'quantity', e.target.value)} />
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Input aria-label={`Custo unitário de ${it.descricao}`} inputMode="decimal" className="min-w-28 text-right"
                          disabled={!selectedItemIds.has(it.id)} value={itemDrafts[it.id]?.cost ?? ''}
                          onChange={e => updateDraft(it.id, 'cost', e.target.value)} />
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Input aria-label={`Venda unitária de ${it.descricao}`} inputMode="decimal" className="min-w-28 text-right"
                          disabled={!selectedItemIds.has(it.id)} value={itemDrafts[it.id]?.sale ?? ''}
                          placeholder="Não informado" onChange={e => updateDraft(it.id, 'sale', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        {it.is_direct_supply && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium border border-amber-400 bg-amber-50 text-amber-700">
                            Forn. Direto
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(picked.itens ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        Esta cotação não possui itens. Cadastre os itens na cotação antes de criar o pedido.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">Selecione os itens e ajuste os valores para este pedido. A cotação original será mantida.</p>
            {invalidSelection ? (
              <Alert variant="destructive"><AlertDescription>Informe uma quantidade inteira maior que zero e valores válidos, sem negativos e com até duas casas decimais, nos itens selecionados.</AlertDescription></Alert>
            ) : (
              <p className="text-right font-semibold">Total selecionado: {toBRL(Math.round(selectedTotal * 100) / 100)}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirmFromQuote} disabled={!chosen.length || invalidSelection} className="bg-secondary hover:bg-secondary/90">
                Criar Pedido ({selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'itens'})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
