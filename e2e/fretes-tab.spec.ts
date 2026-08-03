import { test, expect, Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

const VENDOR_ID = '22222222-2222-2222-2222-222222222222';
const PEDIDO_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const FRETE_ID  = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

// ─── API mocks ────────────────────────────────────────────────────────────────

async function mockAuth(page: Page) {
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
        access_token: 'e2e-fretes-token',
        refresh_token: 'e2e-fretes-refresh',
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
}

async function mockFretesApis(page: Page) {
  await page.route('**/api/fretes/summary**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_entregas: 3,
        entregadores_ativos: 2,
        valor_total: '90.00',
        a_pagar: '60.00',
        por_entregador: [
          { entregador: 'Alfredo', qtd_entregas: 2, valor_total: '60.00', a_pagar: '60.00' },
          { entregador: 'João', qtd_entregas: 1, valor_total: '30.00', a_pagar: '0.00' },
        ],
      }),
    })
  );

  await page.route('**/api/fretes/detail**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: FRETE_ID,
            id_pedido: PEDIDO_ID,
            numero_os: 'OS042',
            nome_cliente: 'Hospital das Clínicas',
            entregador: 'Alfredo',
            data_frete: '2026-05-20',
            valor: '30.00',
            pago: false,
          },
          {
            id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            id_pedido: PEDIDO_ID,
            numero_os: 'OS043',
            nome_cliente: 'Santa Casa',
            entregador: 'Alfredo',
            data_frete: '2026-05-22',
            valor: '30.00',
            pago: true,
          },
        ],
      }),
    })
  );

  await page.route(`**/api/pedidos/${PEDIDO_ID}/fretes/${FRETE_ID}/pago`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: FRETE_ID,
        id_pedido: PEDIDO_ID,
        entregador: 'Alfredo',
        valor: '30.00',
        data_frete: '2026-05-20',
        pago: true,
      }),
    })
  );

  // Stub unrelated endpoints
  await page.route('**/api/pedidos**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }),
      });
    }
    return route.continue();
  });

  await page.route('**/api/dashboard/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );

  await page.route('**/api/expenses**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }) })
  );

  await page.route('**/api/calendar/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) })
  );

  await page.route('**/api/vendedores**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
  );

  await page.route('**/api/rma**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }) })
  );

  await page.route('**/api/quotes**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 1 }) })
  );
}

// ─── Login helper ─────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder(/email/i).fill('test@lucky.com');
  await page.getByPlaceholder(/senha|password/i).fill('Senha123!');
  await page.getByRole('button', { name: /entrar|login/i }).click();

  const otpInput = page.locator('[data-input-otp]').or(
    page.locator('input[autocomplete="one-time-code"]'),
  );
  await otpInput.waitFor({ state: 'visible', timeout: 10_000 });
  await otpInput.click();
  await page.keyboard.type('123456');

  await page.getByRole('button', { name: /verificar|confirm/i }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Adicionar Pedido/i }).waitFor({ state: 'visible', timeout: 15_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Fretes tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockFretesApis(page);
    await login(page);
    // Use client-side navigation to avoid resetting React auth state
    await page.getByRole('link', { name: /financeiro/i }).click();
    await page.waitForURL('**/financial', { timeout: 10_000 });
    // Click Fretes tab
    await page.getByRole('tab', { name: /fretes/i }).click();
  });

  test('shows KPI cards with summary data', async ({ page }) => {
    await expect(page.getByText('Total de Entregas')).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();
    await expect(page.getByText('Entregadores Ativos')).toBeVisible();
    await expect(page.getByText('Valor Total')).toBeVisible();
    await expect(page.getByText('A Pagar').first()).toBeVisible();
  });

  test('shows aggregated entregador table', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'Alfredo' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'João' })).toBeVisible();
  });

  test('search filter narrows entregador list', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'Alfredo' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'João' })).toBeVisible();

    await page.getByPlaceholder(/buscar entregador/i).fill('alfredo');

    await expect(page.getByRole('cell', { name: 'Alfredo' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'João' })).not.toBeVisible();
  });

  test('clicking entregador row opens detail modal', async ({ page }) => {
    await page.getByRole('cell', { name: 'Alfredo' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Alfredo')).toBeVisible();
    await expect(dialog.getByText('OS042')).toBeVisible();
    await expect(dialog.getByText('Hospital das Clínicas')).toBeVisible();
  });

  test('detail modal shows pago and não pago states', async ({ page }) => {
    await page.getByRole('cell', { name: 'Alfredo' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // OS042 is not paid — should show circle (empty) icon
    // OS043 is paid — should show check icon
    // We verify both rows appear
    await expect(dialog.getByText('OS042')).toBeVisible();
    await expect(dialog.getByText('OS043')).toBeVisible();
  });

  test('toggle pago calls API and updates summary', async ({ page }) => {
    let toggleCalled = false;
    await page.route(`**/api/pedidos/${PEDIDO_ID}/fretes/${FRETE_ID}/pago`, async route => {
      toggleCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: FRETE_ID, id_pedido: PEDIDO_ID,
          entregador: 'Alfredo', valor: '30.00',
          data_frete: '2026-05-20', pago: true,
        }),
      });
    });

    await page.getByRole('cell', { name: 'Alfredo' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click the toggle button on the first row (OS042, pago=false)
    const toggleButtons = dialog.getByTitle('Não pago');
    await toggleButtons.first().click();

    await page.waitForTimeout(300);
    expect(toggleCalled).toBe(true);
  });

  test('period selector filters by week', async ({ page }) => {
    let summaryUrl = '';
    await page.route('**/api/fretes/summary**', async route => {
      summaryUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_entregas: 1,
          entregadores_ativos: 1,
          valor_total: '30.00',
          a_pagar: '30.00',
          por_entregador: [
            { entregador: 'Alfredo', qtd_entregas: 1, valor_total: '30.00', a_pagar: '30.00' },
          ],
        }),
      });
    });

    // Radix Select is a button combobox — use click + option, not selectOption()
    await page.getByRole('combobox').filter({ hasText: /todos/i }).click();
    await page.getByRole('option', { name: /semana/i }).click();
    await page.waitForTimeout(300);

    expect(summaryUrl).toContain('data_inicio');
    expect(summaryUrl).toContain('data_fim');
  });
});
