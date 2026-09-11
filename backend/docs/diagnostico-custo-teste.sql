-- Somente leitura. Execute no banco do sistema e envie os resultados.
-- Procura "teste" na cotacao, no cliente e na descricao dos produtos.
-- Nao filtra datas: data_pedido e loja permitem comparar com o dashboard.
WITH casos AS (
    SELECT q.id AS cotacao_id, q.numero AS indice_cotacao,
           q.cliente AS contato_cotacao, q.b2b_company AS empresa_cotacao,
           q.valor_total AS valor_cotacao,
           p.id AS pedido_id, p.numero_os, p.data_pedido,
           p.status AS status_pedido, p.is_rma, p.is_cancelled,
           p.deleted_at AS pedido_excluido_em, l.nome AS loja
    FROM cotacoes q
    FULL JOIN pedidos p ON p.id_cotacao = q.id
    LEFT JOIN clientes cl ON cl.id = p.id_cliente
    LEFT JOIN lojas l ON l.id = p.id_loja
    WHERE q.cliente ILIKE '%teste%'
       OR q.b2b_company ILIKE '%teste%'
       OR q.numero_requisicao ILIKE '%teste%'
       OR cl.nome ILIKE '%teste%'
       OR p.contato_cliente ILIKE '%teste%'
       OR EXISTS (SELECT 1 FROM item_cotacao i
                  WHERE i.id_cotacao = q.id AND i.descricao ILIKE '%teste%')
       OR EXISTS (SELECT 1 FROM produtos pr
                  WHERE pr.id_pedido = p.id AND pr.descricao ILIKE '%teste%')
)
SELECT c.*,
       k.id AS registro_custo_id,
       k.custo_produto_final AS custo_produtos_lido_pelo_dashboard,
       k.updated_at AS custo_atualizado_em,
       itens.total AS custo_calculado_dos_produtos,
       itens.total - COALESCE(k.custo_produto_final, 0) AS diferenca,
       itens.detalhes AS produtos_salvos
FROM casos c
LEFT JOIN custo_pedido k ON k.id_pedido = c.pedido_id
LEFT JOIN LATERAL (
    SELECT SUM(CASE WHEN pr.is_direct_supply
                    THEN COALESCE(pr.preco_custo, 0) * pr.quantidade
                    ELSE COALESCE(pr.valor_compra, 0) END) AS total,
           jsonb_agg(jsonb_build_object(
               'produto', pr.descricao, 'status', pr.status,
               'quantidade', pr.quantidade,
               'valor_compra', pr.valor_compra,
               'custo_projetado', pr.valor_projetado,
               'fornecimento_direto', pr.is_direct_supply,
               'preco_custo', pr.preco_custo,
               'sub_compras', pr.sub_compras,
               'atualizado_em', pr.updated_at
           ) ORDER BY pr.created_at) AS detalhes
    FROM produtos pr
    WHERE pr.id_pedido = c.pedido_id AND pr.deleted_at IS NULL
) itens ON TRUE
ORDER BY c.data_pedido DESC NULLS LAST, c.indice_cotacao DESC;
