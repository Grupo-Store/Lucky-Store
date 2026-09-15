import { createPortal } from 'react-dom';
import { Order, OrderItem, SubPurchase, calcItemFinalValue } from '@/store/OrderStore';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (v?: string) => v ? v.slice(0, 10).split('-').reverse().join('/') : '—';
const statuses = { 'To Buy': 'A Comprar', Bought: 'Comprado', 'In Stock': 'Em Estoque' };

export function ProductPrintDocument({ order, item, subs, observations }: {
  order: Order; item: OrderItem; subs: SubPurchase[]; observations: string;
}) {
  return createPortal(<div id="product-print-root">
    <style>{`
      #product-print-root{display:none}
      @media print{
        @page{size:A4;margin:15mm}
        body>*:not(#product-print-root){display:none!important}
        body{overflow:visible!important;height:auto!important}
        #product-print-root{display:block!important;color:#16273f;font:10pt Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}
        #product-print-root header{border-top:6px solid #15807c;border-bottom:1px solid #cbd5e1;padding:20px 0;margin-bottom:24px;display:flex;justify-content:space-between;gap:20px}
        #product-print-root h1{font-size:24pt;margin:8px 0}
        #product-print-root h2{font-size:11pt;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px;color:#15807c}
        #product-print-root .meta{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}
        #product-print-root small{display:block;color:#64748b;margin-bottom:5px}
        #product-print-root table{width:100%;border-collapse:collapse;font-size:9pt}
        #product-print-root th{background:#edf5f4;text-align:left}
        #product-print-root th,#product-print-root td{padding:9px 6px;border-bottom:1px solid #dbe2e8;overflow-wrap:anywhere}
        #product-print-root thead{display:table-header-group}
        #product-print-root tr{break-inside:avoid}
        #product-print-root .summary{margin-top:20px;padding:14px;background:#edf5f4;break-inside:avoid}
        #product-print-root .notes{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
        #product-print-root footer{border-top:1px solid #cbd5e1;margin-top:30px;padding-top:10px;color:#64748b;font-size:8pt}
      }
    `}</style>
    <header><div><small>{order.company || 'Produtos'}</small><h1>Ficha de produto</h1><span>Controle de compras e entregas</span></div><div><small>Pedido de origem</small><strong>OS {order.os}</strong></div></header>
    <div className="meta">
      <div><small>Produto</small><strong>{item.name}</strong></div>
      <div><small>Quantidade solicitada</small>{item.quantity}</div>
      <div><small>Cliente</small>{order.customerCompany || order.customer || '—'}</div>
      <div><small>Vendedor</small>{order.seller || '—'}</div>
      <div><small>Data do pedido</small>{date(order.orderDate)}</div>
      <div><small>Entrega do pedido</small>{date(order.deliveryDate)}</div>
    </div>
    <h2>Detalhes das compras</h2>
    <table><thead><tr>{['Fornecedor / Comprador', 'Qtd.', 'Compra', 'Entrega', 'Status', 'Valor'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{subs.map(sub => <tr key={sub.id}>
        <td>{sub.supplier || '—'}<small>{sub.buyer}</small></td><td>{sub.selectedQuantity}</td><td>{date(sub.purchaseDate)}</td><td>{date(sub.productDeliveryDate)}</td><td>{statuses[sub.status]}</td><td>{money(sub.purchaseValue || 0)}</td>
      </tr>)}{subs.length === 0 && <tr><td colSpan={6}>Nenhuma compra registrada.</td></tr>}</tbody>
    </table>
    <div className="summary">Total de compras: <b>{money(calcItemFinalValue({ ...item, subPurchases: subs }))}</b></div>
    {observations.trim() && <section><h2>Observações</h2><div className="notes">{observations}</div></section>}
    <footer>{order.company || 'Produtos'} · Ficha de produto · OS {order.os}</footer>
  </div>, document.body);
}
