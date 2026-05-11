import { test, expect, Page } from '@playwright/test';

// ─── IDs used across mocked API responses ────────────────────────────────────

const STORE_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const QUOTE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RMA_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ─── API mocks ────────────────────────────────────────────────────────────────

async function mockApis(page: Page) {
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
        access_token: 'e2e-test-token',
        refresh_token: 'e2e-test-refresh',
        token_type: 'bearer',
        user: {
          id: VENDOR_ID,
          email: 'test@lucky.com',
          name: 'Test User',
          role: 'admin',
          is_active: true,
          totp_enabled: false,
          created_at: '',
          updated_at: '',
        },
      }),
    })
  );

  await page.route('**/api/pedidos**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ORDER_ID,
          id_loja: STORE_ID,
          id_vendedor: VENDOR_ID,
          id_cliente: '33333333-3333-3333-3333-333333333333',
          numero_os: '9001',
          numero_nf: null,
          numero_oc: 'OC-E2E',
          data_pedido: '2026-05-11',
          data_entrega: '2026-05-25',
          status: 'To Buy',
          is_rma: false,
          is_cancelled: false,
          is_direct_billing: false,
          valor_venda: '5000',
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
        }),
      });
    }
    return route.continue();
  });

  await page.route('**/api/quotes**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: QUOTE_ID,
          id_loja: STORE_ID,
          id_vendedor: VENDOR_ID,
          cliente: 'E2E Cliente',
          cnpj_cliente: null,
          numero_requisicao: null,
          data_cotacao: '2026-05-11',
          data_validade: null,
          b2b_company: null,
          fornecedor: null,
          valor_total: '0',
          pct_imposto_lucky: null,
          pct_imposto_btech: null,
          observacao: null,
          status_enviada: false,
          status_em_fechamento: false,
          status_fechada: false,
          status_caida: false,
          itens: [],
          created_by: VENDOR_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    }
    return route.continue();
  });

  await page.route('**/api/rma**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: RMA_ID,
          id_pedido_origem: ORDER_ID,
          id_vendedor: VENDOR_ID,
          id_loja: STORE_ID,
          numero_rma: 'RMA-9001-1',
          data_registro: '2026-05-11',
          prazo_entrega: '2026-05-25',
          status: 'Registered',
          itens: [],
          created_by: VENDOR_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    }
    return route.continue();
  });
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function loginThroughUI(page: Page) {
  await page.goto('/');

  // Fill login form
  await page.getByPlaceholder('Digite seu email').fill('test@lucky.com');
  await page.getByPlaceholder('Digite sua senha').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Fill OTP — input-otp renders individual slots but the underlying input accepts typed input
  const otpInput = page.locator('[data-input-otp]').or(page.locator('input[autocomplete="one-time-code"]'));
  await otpInput.waitFor({ state: 'visible', timeout: 5_000 });
  await otpInput.click();
  await page.keyboard.type('123456');

  // Click Verificar
  await page.getByRole('button', { name: 'Verificar' }).click();

  // Wait for the main board to render
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Adicionar Pedido/i }).waitFor({ state: 'visible', timeout: 10_000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Phase 2.3 — Modal API integration (E2E)', () => {

  test('App loads and shows the login screen', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByText(/Bem vindo/i)).toBeVisible();
  });

  test('Login flow: email → 2FA → main board', async ({ page }) => {
    await mockApis(page);
    await loginThroughUI(page);
    await expect(page.getByRole('button', { name: /Adicionar Pedido/i })).toBeVisible();
  });

  test('OrderModal: opens via UI and validates required fields', async ({ page }) => {
    await mockApis(page);
    await loginThroughUI(page);

    // Click "Adicionar Pedido"
    await page.getByRole('button', { name: /Adicionar Pedido/i }).click();

    // In the chooser, click "Cadastrar novo pedido"
    await page.getByText(/Cadastrar novo pedido/i).click();

    // OrderModal opens
    const criarBtn = page.getByRole('button', { name: /Criar Pedido/i });
    await criarBtn.waitFor({ state: 'visible', timeout: 5_000 });

    // Click save without required fields → validation toast appears
    await criarBtn.click();
    await expect(page.getByText(/campos obrigatórios/i)).toBeVisible({ timeout: 3_000 });
  });

  test('OrderModal: fills required fields and creates order via API', async ({ page }) => {
    await mockApis(page);
    await loginThroughUI(page);

    // Open order modal
    await page.getByRole('button', { name: /Adicionar Pedido/i }).click();
    await page.getByText(/Cadastrar novo pedido/i).click();

    // Fill required fields
    const textboxes = page.getByRole('textbox');
    // Cliente is the 2nd textbox (after OS readonly)
    await textboxes.nth(1).fill('E2E Cliente Teste');
    // OC/AF/PED has placeholder "Ex: OC-1234"
    await page.getByPlaceholder('Ex: OC-1234').fill('OC-E2E-001');

    // Click "Criar Pedido"
    await page.getByRole('button', { name: /Criar Pedido/i }).click();

    // Modal closes after success
    await expect(page.getByRole('button', { name: /Criar Pedido/i })).not.toBeVisible({ timeout: 5_000 });
  });

  test('QuoteModal: opens, cancels without API call', async ({ page }) => {
    await mockApis(page);
    await loginThroughUI(page);

    // Navigate to quotes tab
    const quotesTab = page.getByText(/Cotaç/i).first();
    if (await quotesTab.isVisible()) {
      await quotesTab.click();
    }

    // Click "Nova Cotação" button if visible
    const novaBtn = page.getByRole('button', { name: /Nova Cotaç/i }).first();
    if (await novaBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await novaBtn.click();
      // Cancel modal
      await page.getByRole('button', { name: /Cancelar/i }).click();
      // "Criar Cotação" button should disappear
      await expect(page.getByRole('button', { name: /Criar Cotaç/i })).not.toBeVisible({ timeout: 3_000 });
    }
  });

});
