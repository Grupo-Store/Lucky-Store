import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileDown, Search } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { CotacaoResponse, RmaResponse } from '@/types/api';
import type { PedidoListItem } from '@/hooks/use-orders-query';

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy');
}
function toBRL(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function cotacaoStatus(c: CotacaoResponse): string {
  if (c.status_caida) return 'Caída';
  if (c.status_fechada) return 'Fechada';
  if (c.status_em_fechamento) return 'Em Fechamento';
  if (c.status_enviada) return 'Enviada';
  return 'Sem fase';
}

// ─── Assembled record ─────────────────────────────────────────────────────────
interface HistoryRecord {
  pedido: PedidoListItem;
  cotacao: CotacaoResponse | null;
  rmas: RmaResponse[];
}

async function fetchRecord(numeroOs: string): Promise<HistoryRecord | 'notfound'> {
  const { data: pedData } = await apiClient.get('/pedidos', { params: { numero_os: numeroOs, limit: 1 } });
  const pedido: PedidoListItem | undefined = pedData?.items?.[0];
  if (!pedido) return 'notfound';

  // Cotação de origem: preferimos o vínculo direto (id_cotacao); audit log como fallback.
  let cotacao: CotacaoResponse | null = null;
  try {
    let cotacaoId: string | null | undefined = pedido.id_cotacao;
    if (!cotacaoId) {
      const { data: hist } = await apiClient.get(`/pedidos/${pedido.id}/history`);
      cotacaoId = (hist?.audit_logs ?? [])
        .map((l: { new_values?: { cotacao_id?: string } }) => l?.new_values?.cotacao_id)
        .find(Boolean);
    }
    if (cotacaoId) {
      const { data } = await apiClient.get(`/quotes/${cotacaoId}`);
      cotacao = data;
    }
  } catch { /* pedido sem cotação de origem */ }

  // RMAs vinculados a este pedido
  let rmas: RmaResponse[] = [];
  try {
    const { data } = await apiClient.get('/rma', { params: { id_pedido_origem: pedido.id, limit: 100 } });
    rmas = data?.items ?? [];
  } catch { /* sem rma */ }

  return { pedido, cotacao, rmas };
}

// ─── Report styling (shared: screen + print) ──────────────────────────────────
const HISTORY_REPORT_CSS = `
  .hr-doc{font-family:'Inter',system-ui,sans-serif;color:#1f2d3d;font-size:13px;line-height:1.5;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hr-title{font-size:18px;font-weight:800;color:#16273f;margin:0 0 16px;font-family:'Space Grotesk',sans-serif}
  .hr-sec{border:1px solid #e2e8f1;border-radius:12px;padding:16px 18px;margin-bottom:16px;background:#fff;break-inside:avoid}
  .hr-sec>h3{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2F6BFF;
    margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #eef2f8}
  .hr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px 24px}
  .hr-field{display:flex;flex-direction:column;border-bottom:1px solid #f1f4f8;padding-bottom:5px;min-width:0}
  .hr-k{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8a97a6}
  .hr-v{font-size:13px;font-weight:600;color:#1f2d3d;word-break:break-word}
  .hr-obs{margin:12px 0 0;font-size:12.5px;color:#3a4a5e;white-space:pre-wrap}
  .hr-table{width:100%;border-collapse:collapse;margin-top:12px}
  .hr-table th{background:#f4f7fb;color:#5b6b82;font-size:10px;text-transform:uppercase;letter-spacing:.04em;
    text-align:left;padding:7px 10px;border-bottom:1px solid #e2e8f1}
  .hr-table td{padding:7px 10px;border-bottom:1px solid #eef2f8;font-size:12px}
  .hr-table .r{text-align:right}
  .hr-table .c{text-align:center}
  .hr-sub{font-size:11px;color:#8a97a6;font-weight:500}
  .hr-rma{border:1px solid #eef2f8;border-radius:8px;padding:12px 14px;margin-top:12px;break-inside:avoid}
  .hr-rma+.hr-rma{margin-top:12px}
  .hr-empty{font-size:12.5px;color:#8a97a6;font-style:italic}
`;

const HISTORY_PRINT_CSS = `
  #history-print-root{display:none}
  @media print{
    @page{size:A4;margin:14mm}
    html,body{background:#fff !important}
    body>*{display:none !important}
    body>#history-print-root{display:block !important}
  }
`;

// ─── Presentation ──────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="hr-field">
      <span className="hr-k">{label}</span>
      <span className="hr-v">{value ?? '—'}</span>
    </div>
  );
}

function HistoryReport({ record }: { record: HistoryRecord }) {
  const { pedido, cotacao, rmas } = record;
  const produtos = pedido.produtos ?? [];

  return (
    <div className="hr-doc">
      <style>{HISTORY_REPORT_CSS}</style>
      <h1 className="hr-title">Histórico do Pedido {pedido.numero_os}</h1>

      {/* 1 ── Cotação de origem */}
      {cotacao && (
        <section className="hr-sec">
          <h3>1. Cotação de Origem{cotacao.numero != null ? ` — Nº ${cotacao.numero}` : ''}</h3>
          <div className="hr-grid">
            <Field label="Nº Requisição" value={cotacao.numero_requisicao || '—'} />
            <Field label="Empresa" value={cotacao.b2b_company || '—'} />
            <Field label="Cliente" value={cotacao.cliente || '—'} />
            <Field label="CNPJ" value={cotacao.cnpj_cliente || '—'} />
            <Field label="Data da Cotação" value={fmtDate(cotacao.data_cotacao)} />
            <Field label="Validade" value={fmtDate(cotacao.data_validade)} />
            <Field label="Status" value={cotacaoStatus(cotacao)} />
            <Field label="Valor Total" value={toBRL(cotacao.valor_total)} />
            <Field label="Faturamento Direto" value={cotacao.is_direct_billing ? 'Sim' : 'Não'} />
            <Field label="Fornecedor" value={cotacao.fornecedor || '—'} />
            <Field label="Forma de Pagamento" value={cotacao.forma_pagamento || '—'} />
            <Field label="Prazo de Pagamento" value={fmtDate(cotacao.prazo_pagamento)} />
            <Field label="Entrega" value={fmtDate(cotacao.data_entrega)} />
            <Field label="Garantia" value={cotacao.garantia || '—'} />
          </div>
          {cotacao.observacao && <p className="hr-obs"><b>Observação:</b> {cotacao.observacao}</p>}
          {(cotacao.itens?.length ?? 0) > 0 && (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Item</th><th className="c">Qtd</th><th className="r">Vlr. Unitário</th>
                  <th className="r">Vlr. Fechamento</th><th>Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {cotacao.itens.map(it => (
                  <tr key={it.id}>
                    <td>{it.descricao || '—'}</td>
                    <td className="c">{it.quantidade}</td>
                    <td className="r">{toBRL(it.valor_unitario)}</td>
                    <td className="r">{it.valor_fechamento ? toBRL(it.valor_fechamento) : '—'}</td>
                    <td>{it.fornecedor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* 2 ── Pedido */}
      <section className="hr-sec">
        <h3>{cotacao ? '2. ' : ''}Pedido {pedido.numero_os}</h3>
        <div className="hr-grid">
          <Field label="Nº OS" value={pedido.numero_os} />
          <Field label="Status" value={pedido.status} />
          <Field label="Cliente" value={pedido.nome_cliente || '—'} />
          <Field label="CNPJ" value={pedido.cnpj_cliente || '—'} />
          <Field label="Loja" value={pedido.nome_loja || '—'} />
          <Field label="Vendedor" value={pedido.nome_vendedor || '—'} />
          <Field label="Data do Pedido" value={fmtDate(pedido.data_pedido)} />
          <Field label="Data de Entrega" value={fmtDate(pedido.data_entrega)} />
          <Field label="Valor de Venda" value={toBRL(pedido.valor_venda)} />
          <Field label="Parcelas" value={pedido.parcelas ?? '—'} />
          <Field label="Faturamento Direto" value={pedido.is_direct_billing ? 'Sim' : 'Não'} />
          <Field label="Fornecedor" value={pedido.fornecedor_principal || '—'} />
          <Field label="Nota Fiscal" value={pedido.numero_nf || '—'} />
          <Field label="OC / AF" value={pedido.numero_oc || '—'} />
          <Field label="Data de Pagamento" value={fmtDate(pedido.data_pagamento)} />
          <Field label="Multa" value={pedido.multa ? toBRL(pedido.multa) : '—'} />
          <Field label="Juros" value={pedido.juros ? toBRL(pedido.juros) : '—'} />
          <Field label="Forma de Pagamento" value={pedido.forma_pagamento_efetiva || (pedido.formas_pagamento ?? []).map(f => f.forma).join(', ') || '—'} />
        </div>
        {pedido.observacao && <p className="hr-obs"><b>Observação:</b> {pedido.observacao}</p>}
      </section>

      {/* 3 ── Produtos */}
      <section className="hr-sec">
        <h3>{cotacao ? '3. ' : ''}Produtos <span className="hr-sub">({produtos.length})</span></h3>
        {produtos.length === 0 ? (
          <p className="hr-empty">Nenhum produto associado a este pedido.</p>
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Produto</th><th className="c">Qtd</th><th className="r">Vlr. Projetado</th>
                <th className="r">Vlr. Compra</th><th>Fornecedor</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => (
                <tr key={p.id}>
                  <td>{p.descricao || '—'}</td>
                  <td className="c">{p.quantidade}</td>
                  <td className="r">{toBRL(p.valor_projetado)}</td>
                  <td className="r">{p.valor_compra ? toBRL(p.valor_compra) : '—'}</td>
                  <td>{p.fornecedor || '—'}</td>
                  <td>{p.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 4 ── RMAs */}
      {rmas.length > 0 && (
        <section className="hr-sec">
          <h3>{cotacao ? '4. ' : ''}RMAs <span className="hr-sub">({rmas.length})</span></h3>
          {rmas.map(rma => (
            <div key={rma.id} className="hr-rma">
              <div className="hr-grid">
                <Field label="Nº RMA" value={rma.numero_rma} />
                <Field label="Status" value={rma.status} />
                <Field label="Data de Registro" value={fmtDate(rma.data_registro)} />
                <Field label="Prazo de Entrega" value={fmtDate(rma.prazo_entrega)} />
              </div>
              {(rma.itens?.length ?? 0) > 0 && (
                <table className="hr-table">
                  <thead>
                    <tr><th>Item</th><th className="c">Qtd</th><th>Status</th><th>Consertado por</th></tr>
                  </thead>
                  <tbody>
                    {rma.itens.map(it => (
                      <tr key={it.id}>
                        <td>{it.descricao || '—'}</td>
                        <td className="c">{it.quantidade}</td>
                        <td>{it.status || '—'}</td>
                        <td>{it.consertado_por || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function History() {
  const [input, setInput] = useState('');
  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'notfound' | 'error'>('idle');

  async function handleSearch() {
    const os = input.trim();
    if (!os) return;
    setState('loading');
    setRecord(null);
    try {
      const res = await fetchRecord(os);
      if (res === 'notfound') {
        setState('notfound');
      } else {
        setRecord(res);
        setState('idle');
      }
    } catch {
      setState('error');
    }
  }

  function handleExport() {
    (document.activeElement as HTMLElement | null)?.blur();
    setTimeout(() => window.print(), 60);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-secondary">Histórico</h1>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label>Número da OS</Label>
              <Input
                placeholder="Ex: OS-001"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!input.trim() || state === 'loading'}
              className="bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white"
            >
              <Search className="h-4 w-4 mr-1.5" />
              {state === 'loading' ? 'Buscando…' : 'Buscar'}
            </Button>
            {record && (
              <Button variant="outline" onClick={handleExport} title="Exportar histórico em PDF">
                <FileDown className="h-4 w-4 mr-1.5" /> Exportar PDF
              </Button>
            )}
          </div>

          {state === 'notfound' && (
            <p className="text-sm text-muted-foreground mt-3">
              Nenhum pedido encontrado para "{input.trim()}".
            </p>
          )}
          {state === 'error' && (
            <p className="text-sm text-destructive mt-3">Erro ao carregar o histórico. Tente novamente.</p>
          )}
        </CardContent>
      </Card>

      {record && <HistoryReport record={record} />}

      {/* Documento só para impressão (isolado no <body>) */}
      {record && createPortal(
        <div id="history-print-root">
          <style>{HISTORY_PRINT_CSS}</style>
          <HistoryReport record={record} />
        </div>,
        document.body,
      )}
    </div>
  );
}
