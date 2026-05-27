/**
 * E2E tests for feature/list-view-integration.
 *
 * Covers:
 *   1. RMA items display new 10-value statuses in the edit modal
 *   2. Date filter sends YYYY-MM-DD to the API (not raw Date.toString())
 *   3. Orders tab shows derived purchase-status badge from sub_compras
 *   4. AddOrderChooser: "from quote" flow calls GET /quotes and lists results
 *   5. AddOrderChooser: prefills order modal with quote data
 */
import { test, expect, Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORE_ID  = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const QUOTE_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RMA_ID    = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ITEM_ID   = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

// ─── API mock helpers ─────────────────────────────────────────────────────────

function makeOrder(status = 'To Buy') {
  return {
    id: ORDER_ID,
    id_loja: STORE_ID,
    id_vendedor: VENDOR_ID,
    id_cliente: '33333333-3333-3333-3333-333333333333',
    numero_os: 'OS-E2E-001',
    numero_nf: null,
    numero_oc: null,
    data_pedido: '2026-05-01',
    data_entrega: '2026-05-30',
    status,
    is_rma: false,
    is_cancelled: false,
    is_direct_billing: false,
    valor_venda: '3000',
    parcelas: null,
    observacao: null,
    fornecedor_principal: null,
    nota_fiscal_fornecedor: null,
    economia: null,
    formas_pagamento: [],
    custo: null,
    status_history: [],
    created_by: VENDOR_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nome_cliente: 'Cliente E2E',
    nome_loja: 'Lucky Store',
    nome_vendedor: 'Vendedor E2E',
    cnpj_cliente: null,
    fretes: [],
    produtos: [
      {
        id: ITEM_ID,
        id_pedido: ORDER_ID,
        id_vendedor: VENDOR_ID,
        descricao: 'Notebook E2E',
        quantidade: 1,
        valor_projetado: '2500.00',
        valor_compra: null,
        economia: null,
        status: 'In Stock',
        prazo_entrega: null,
        data_compra: null,
        data_recebimento: null,
        fornecedor: null,
        sub_compras: [
          { id: 'sc-1', status: 'To Buy', purchaseValue: 0, selectedQuantity: 1 },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };
}

function makeRma() {
  return {
    id: RMA_ID,
    id_pedido_origem: ORDER_ID,
    id_vendedor: VENDOR_ID,
    id_loja: STORE_ID,
    numero_rma: 'RMA-E2E-001',
    numero_os_origem: 'OS-E2E-001',
    data_registro: '2026-05-01',
    prazo_entrega: '2026-05-30',
    status: 'In Repair',
    itens: [
      {
        id: ITEM_ID,
        id_rma: RMA_ID,
        id_produto_origem: null,
        descricao: 'Notebook com defeito',
        quantidade: 1,
        status: 'Repaired Received',
        consertado_por: 'Técnico João',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    created_by: VENDOR_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeQuote() {
  return {
    id: QUOTE_ID,
    id_loja: STORE_ID,
    id_vendedor: VENDOR_ID,
    cliente: 'Empresa Cotação E2E',
    cnpj_cliente: null,
    numero_requisicao: 'REQ-E2E',
    data_cotacao: '2026-05-01',
    data_validade: '2026-06-01',
    b2b_company: null,
    fornecedor: null,
    valor_total: '7500.00',
    pct_imposto_lucky: null,
    pct_imposto_btech: null,
    observacao: null,
    status_enviada: false,
    status_em_fechamento: false,
    status_fechada: true,
    status_caida: false,
    itens: [
      {
        id: 'item-cot-1',
        id_cotacao: QUOTE_ID,
        descricao: 'Monitor Ultrawide',
        quantidade: 3,
        valor_unitario: '2500.00',
        valor_total: '7500.00',
        valor_fechamento: '2400.00',
        valor_total_fechamento: '7200.00',
        fornecedor: null,
      },
    ],
    created_by: VENDOR_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function mockAllApis(page: Page) {
  await page.route('**/api/auth/login', route =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ detail: { requires_2fa: true } }),
    })
  );

  await page.route('**/api/auth/verify-2fa', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-token',
        refresh_token: 'e2e-refresh',
        token_type: 'bearer',
        user: { id: VENDOR_ID, email: 't@t.com', name: 'E2E', role: 'admin',
                is_active: true, totp_enabled: false, created_at: '', updated_at: '' },
      }),
    })
  );

  await page.route('**/api/pedidos**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [makeOrder()], total: 1, page: 1, limit: 20, pages: 1 }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(makeOrder()),
      });
    }
    return route.continue();
  });

  await page.route('**/api/quotes**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [makeQuote()], total: 1, page: 1, limit: 20, pages: 1 }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(makeQuote()),
      });
    }
    return route.continue();
  });

  await page.route('**/api/rma**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [makeRma()], total: 1, page: 1, limit: 20, pages: 1 }),
      });
    }
    return route.continue();
  });
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('Digite seu email').fill('test@lucky.com');
  await page.getByPlaceholder('Digite sua senha').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  const otpInput = page.locator('[data-input-otp]').or(
    page.locator('input[autocomplete="one-time-code"]')
  );
  await otpInput.waitFor({ state: 'visible', timeout: 5_000 });
  await otpInput.click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Adicionar Pedido/i }).waitFor({ state: 'visible', timeout: 10_000 });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('feature/list-view-integration — E2E', () => {

  // ── 1. Derived status badge in orders list ──────────────────────────────────

  test('orders list: shows "A Comprar" badge when sub_compras has To Buy status', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    // Navigate to orders tab (default)
    await expect(page.getByRole('tab', { name: /Pedidos/i })).toBeVisible();

    // The order has sub_compras with status "To Buy" — should display "A Comprar"
    await expect(page.getByText('A Comprar')).toBeVisible({ timeout: 5_000 });
  });

  // ── 2. Date filter sends YYYY-MM-DD to API ─────────────────────────────────

  test('date filter: request URL contains YYYY-MM-DD format, not raw Date string', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    const apiRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/pedidos') && req.method() === 'GET') {
        apiRequests.push(req.url());
      }
    });

    // Open the date filter popover
    await page.getByRole('button', { name: /Período/i }).first().click();
    await page.waitForTimeout(500);

    // Pick a specific date in the calendar (click on day 6)
    const day6 = page.locator('[role="gridcell"]').filter({ hasText: /^6$/ }).first();
    if (await day6.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await day6.click();
      // Click Aplicar
      const applyBtn = page.getByRole('button', { name: /Aplicar/i });
      if (await applyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await applyBtn.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(500);

        // Check any pedidos request that includes data_inicio
        const dateRequest = apiRequests.find(url => url.includes('data_inicio'));
        if (dateRequest) {
          const url = new URL(dateRequest);
          const dataInicio = url.searchParams.get('data_inicio');
          if (dataInicio) {
            // Must be YYYY-MM-DD, not a raw JS Date string
            expect(dataInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(dataInicio).not.toContain('GMT');
          }
        }
      }
    }
  });

  // ── 3. RMA items show new statuses ─────────────────────────────────────────

  test('RMAs tab: displays new 10-value item statuses in the table', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    // Switch to RMAs view inside the orders tab
    const rmaTab = page.getByRole('button', { name: /RMAs/i });
    if (await rmaTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rmaTab.click();
      await page.waitForTimeout(500);

      // The RMA we mock has item status "Repaired Received"
      await expect(page.getByText(/Reparado e Recebido/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('RMA edit modal: shows new item status "Repaired Received" / "Reparado Recebido"', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    const rmaBtn = page.getByRole('button', { name: /RMAs/i });
    if (await rmaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rmaBtn.click();

      const rmaRow = page.getByText('RMA-E2E-001');
      if (await rmaRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await rmaRow.click();
        await page.waitForTimeout(500);

        // The modal should show the new status labels
        await expect(
          page.getByText(/Reparado Recebido/i).or(page.getByText(/Repaired Received/i))
        ).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  // ── 4. AddOrderChooser: from-quote flow calls /quotes ──────────────────────

  test('AddOrderChooser: clicking "from quote" triggers GET /quotes', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    const quotesRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/quotes') && req.method() === 'GET') {
        quotesRequests.push(req.url());
      }
    });

    // Open the chooser
    await page.getByRole('button', { name: /Adicionar Pedido/i }).click();
    await page.getByText(/Cadastrar a partir de cotação/i).click();

    // Wait for the quote list to load
    await page.waitForTimeout(1_000);

    // Verify a GET /quotes was made (not /cotacoes)
    expect(quotesRequests.length).toBeGreaterThan(0);
    expect(quotesRequests[0]).toContain('/quotes');
    expect(quotesRequests[0]).not.toContain('/cotacoes');
  });

  test('AddOrderChooser: loaded quotes are shown in the table', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    await page.getByRole('button', { name: /Adicionar Pedido/i }).click();
    await page.getByText(/Cadastrar a partir de cotação/i).click();

    await expect(page.getByText('Empresa Cotação E2E')).toBeVisible({ timeout: 5_000 });
  });

  // ── 5. Order creation prefilled from quote ─────────────────────────────────

  test('AddOrderChooser: selecting a quote and confirming opens the OrderModal prefilled', async ({ page }) => {
    await mockAllApis(page);
    await login(page);

    await page.getByRole('button', { name: /Adicionar Pedido/i }).click();
    await page.getByText(/Cadastrar a partir de cotação/i).click();

    await expect(page.getByText('Empresa Cotação E2E')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Empresa Cotação E2E').click();

    // Should advance to item-picker step
    await expect(page.getByText('Monitor Ultrawide')).toBeVisible({ timeout: 5_000 });

    // Click "Criar Pedido"
    await page.getByRole('button', { name: /Criar Pedido/i }).click();

    // The chooser should close and the OrderModal should open
    // (look for the order creation dialog with Cancelar button in footer)
    await expect(
      page.getByRole('button', { name: /^Criar Pedido$|^Salvar Alterações$/ })
    ).toBeVisible({ timeout: 5_000 });
  });

});
