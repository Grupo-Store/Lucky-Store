// ─── Shared ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  reason: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserResponse;
}

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export type PedidoStatus =
  | 'To Buy'
  | 'Bought'
  | 'Received'
  | 'To Invoice'
  | 'Invoiced'
  | 'To Pack'
  | 'Ready for Delivery'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Delayed'
  | 'Cancelled';

export interface FormaPagamento {
  id: string;
  forma: string;
}

export interface CustoPedido {
  id: string;
  id_pedido: string;
  custo_produto_inicial: string | null;
  custo_produto_final: string | null;
  custo_servico: string | null;
  pct_imposto_compra: string | null;
  imposto_compra: string | null;
  pct_imposto_venda: string | null;
  imposto_venda: string | null;
  pct_custo_credito: string | null;
  custo_credito: string | null;
}

export interface PedidoResponse {
  id: string;
  id_loja: string;
  id_vendedor: string;
  id_cliente: string;
  numero_os: string;
  numero_nf: string | null;
  numero_oc: string | null;
  data_pedido: string;
  data_entrega: string;
  status: PedidoStatus;
  is_rma: boolean;
  is_cancelled: boolean;
  is_direct_billing: boolean;
  valor_venda: string | null;
  parcelas: number | null;
  observacao: string | null;
  fornecedor_principal: string | null;
  nota_fiscal_fornecedor: string | null;
  economia: string | null;
  formas_pagamento: FormaPagamento[];
  custo: CustoPedido | null;
  status_history: StatusHistoryEntry[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePedidoPayload {
  id_loja: string;
  id_vendedor: string;
  nome_cliente: string;
  cpf_cnpj?: string;
  data_pedido: string;
  data_entrega: string;
  status: PedidoStatus;
  valor_venda?: string;
  observacao?: string;
  numero_nf?: string;
  nota_fiscal_fornecedor?: string;
  numero_oc?: string;
  is_direct_billing?: boolean;
  formas_pagamento?: { forma: string }[];
  custo?: Partial<Omit<CustoPedido, 'id' | 'id_pedido'>>;
}

export type UpdatePedidoPayload = Partial<Omit<CreatePedidoPayload, 'id_loja' | 'id_vendedor' | 'nome_cliente'>>;

export interface PedidoFilters {
  page?: number;
  limit?: number;
  status?: PedidoStatus;
  id_loja?: string;
  id_vendedor?: string;
  data_inicio?: string;
  data_fim?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

// ─── Cotações ─────────────────────────────────────────────────────────────────

export interface ItemCotacao {
  id: string;
  id_cotacao: string;
  descricao: string;
  quantidade: number;
  valor_unitario: string;
  valor_total: string;
  valor_fechamento: string | null;
  valor_total_fechamento: string | null;
  fornecedor: string | null;
}

export interface CotacaoResponse {
  id: string;
  id_loja: string;
  id_vendedor: string;
  cliente: string;
  cnpj_cliente: string | null;
  numero_requisicao: string | null;
  data_cotacao: string;
  data_validade: string | null;
  b2b_company: string | null;
  fornecedor: string | null;
  valor_total: string | null;
  pct_imposto_lucky: string | null;
  pct_imposto_btech: string | null;
  observacao: string | null;
  status_enviada: boolean;
  status_em_fechamento: boolean;
  status_fechada: boolean;
  status_caida: boolean;
  itens: ItemCotacao[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCotacaoPayload {
  id_loja: string;
  id_vendedor: string;
  cliente: string;
  data_cotacao: string;
  cnpj_cliente?: string;
  numero_requisicao?: string;
  data_validade?: string;
  b2b_company?: string;
  fornecedor?: string;
  valor_total?: string;
  pct_imposto_lucky?: string;
  pct_imposto_btech?: string;
  observacao?: string;
  itens?: {
    descricao: string;
    quantidade: number;
    valor_unitario: string;
    valor_fechamento?: string;
    fornecedor?: string;
  }[];
}

export type UpdateCotacaoPayload = Partial<Omit<CreateCotacaoPayload, 'id_loja' | 'id_vendedor' | 'itens'>>;

export interface UpdateCotacaoFasePayload {
  status_enviada?: boolean;
  data_envio?: string;
  status_em_fechamento?: boolean;
  data_prevista_fechamento?: string;
  status_fechada?: boolean;
  status_caida?: boolean;
}

export interface CotacaoFilters {
  page?: number;
  limit?: number;
  id_loja?: string;
  id_vendedor?: string;
  cliente?: string;
  data_inicio?: string;
  data_fim?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface ConversaoResponse {
  id_pedido: string;
  id_cotacao: string;
  message: string;
}

// ─── RMA ──────────────────────────────────────────────────────────────────────

export type RmaStatus =
  | 'Registered'
  | 'In Analysis'
  | 'Approved'
  | 'In Repair'
  | 'Repaired'
  | 'Ready'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Completed';

export type ItemRmaStatus =
  | 'Not Received'
  | 'Received'
  | 'In Repair'
  | 'Repaired'
  | 'Ready'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface ItemRma {
  id: string;
  id_rma: string;
  id_produto_origem: string | null;
  descricao: string;
  quantidade: number;
  status: ItemRmaStatus;
  consertado_por: string | null;
}

export interface RmaResponse {
  id: string;
  id_pedido_origem: string;
  id_vendedor: string;
  id_loja: string;
  numero_rma: string;
  data_registro: string;
  prazo_entrega: string | null;
  status: RmaStatus;
  itens: ItemRma[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRmaPayload {
  id_pedido_origem: string;
  prazo_entrega?: string;
  itens: {
    id_produto_origem?: string;
    descricao: string;
    quantidade: number;
  }[];
}

export interface RmaFilters {
  page?: number;
  limit?: number;
  status?: RmaStatus;
  id_loja?: string;
  id_vendedor?: string;
  id_pedido_origem?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}
