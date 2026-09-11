# Validação do faturamento direto

Caso de referência: OFFICE PRO PLUS 21, 3 unidades, custo unitário de R$ 304,50,
venda unitária de R$ 686,00, fornecedor TECHFORM, participação de 10% e frete do
fornecedor de R$ 20,00. Sem impostos, taxas ou brindes adicionais.

| Campo | Sem frete adicional da OS | Com frete da OS de R$ 20,00 |
| --- | ---: | ---: |
| Valor de venda | R$ 2.058,00 | R$ 2.058,00 |
| Custo inicial do produto | R$ 913,50 | R$ 913,50 |
| Custo final do produto | R$ 913,50 | R$ 913,50 |
| Custo de fornecimento direto | R$ 134,45 | R$ 134,45 |
| Frete da seção Frete | R$ 0,00 | R$ 20,00 |
| Custo total | R$ 1.047,95 | R$ 1.067,95 |
| Lucro do pedido | R$ 1.010,05 | R$ 990,05 |

O custo de fornecimento direto é `(686 - 304,50) × 3 × 10% + 20`.
O frete da seção Frete é um lançamento separado. Se representar o mesmo serviço
já informado como frete do fornecedor, o cadastro deve manter o valor em apenas
um lugar; a aplicação não consegue determinar isso pela igualdade dos valores.

## Cobertura

- A interface importa os itens selecionados da cotação e envia custo, venda,
  quantidade, participação e frete do fornecedor no salvamento da OS.
- A conversão alternativa no backend preserva os custos diretos e mantém os
  custos de compra ainda não informados dos itens normais vazios.
- O teste HTTP cria a OS em PostgreSQL, lê a listagem, salva novamente e verifica
  os valores e a ausência de duplicação de produtos e fretes.
- A resposta real dessa listagem alimenta o teste de reabertura do modal. Ele
  confere os campos financeiros, os totais, contato, cliente, OC, garantia,
  produto, fornecedor e impressão.
- O documento da OS inclui os itens diretos e seus totais, além do custo de
  fornecimento direto e imposto de venda na composição financeira.

## Executar o teste que liga API e interface

Use somente uma instância PostgreSQL local descartável. O fixture cria schemas
temporários e desfaz suas transações ao terminar. Na raiz do repositório:

```powershell
$env:TEST_MIGRATION_DATABASE_URL = 'postgresql+psycopg2://review@127.0.0.1:55439/postgres'
$env:DIRECT_SUPPLY_CONTRACT_DIR = Join-Path (Get-Location) '.cache.local/direct-supply-contract'
Push-Location backend
venv/Scripts/python.exe -m pytest tests/test_direct_supply_conversion_postgres.py -q
Pop-Location
npm test -- --run src/test/components/DirectSupplyFinancialRoundTrip.test.tsx src/test/os-a-partir-da-cotacao-leva-o-preco.test.tsx --maxWorkers=1
```

Sem `DIRECT_SUPPLY_CONTRACT_DIR`, os testes de reabertura que dependem das
respostas HTTP são ignorados. Os arquivos gerados contêm apenas dados fictícios
do teste e ficam no diretório local ignorado pelo Git.

## Pedidos antigos

A alteração não reescreve pedidos existentes nem exige migration. Na OS antiga
do exemplo, cujo valor de compra do item direto ficou zerado, é necessário
informar R$ 304,50 em “Val. Compra” e salvar. Novas importações já levam o custo
da cotação. As verificações locais não comprovam que a versão esteja publicada
no Railway.
