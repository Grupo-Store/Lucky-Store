import { render, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { UpdateNotifier } from './UpdateNotifier';

vi.mock('sonner', () => ({ toast: vi.fn() }));
import { toast } from 'sonner';

function mockVersionResponse(buildId: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve({ buildId }),
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('UpdateNotifier', () => {
  it('não avisa quando o build do servidor é o mesmo desta aba', async () => {
    vi.stubGlobal('fetch', mockVersionResponse('test-build-id'));
    render(<UpdateNotifier />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it('avisa com um toast quando o servidor tem um build diferente', async () => {
    vi.stubGlobal('fetch', mockVersionResponse('novo-build-id'));
    render(<UpdateNotifier />);

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const [message, opts] = (toast as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toMatch(/nova versão/i);
    expect(opts.action.label).toMatch(/atualizar/i);
  });

  it('o botão de ação recarrega a página', async () => {
    vi.stubGlobal('fetch', mockVersionResponse('novo-build-id'));
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    render(<UpdateNotifier />);

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const opts = (toast as ReturnType<typeof vi.fn>).mock.calls[0][1];
    opts.action.onClick();
    expect(reload).toHaveBeenCalled();
  });

  it('ignora falha de rede sem avisar e sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<UpdateNotifier />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it('ignora resposta não-ok (ex.: 404 no dev server) sem avisar', async () => {
    vi.stubGlobal('fetch', mockVersionResponse('novo-build-id', false));
    render(<UpdateNotifier />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it('só avisa uma vez mesmo com múltiplas checagens', async () => {
    vi.stubGlobal('fetch', mockVersionResponse('novo-build-id'));
    render(<UpdateNotifier />);

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
