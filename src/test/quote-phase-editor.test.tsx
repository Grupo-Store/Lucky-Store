import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuotePhaseEditor } from '@/components/QuotePhaseEditor';
import type { CotacaoResponse } from '@/types/api';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/api/hooks/useQuotes', () => ({ useUpdateQuotePhase: () => ({ mutateAsync: save, isPending: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const quote = { id: 'q1', numero: 102, status_enviada: true, status_em_fechamento: true, status_fechada: false, status_caida: false, data_envio: '2026-09-15', valor_fechamento: '123.45' } as CotacaoResponse;

describe('edição de fases na listagem', () => {
  it('salva a fase escolhida preservando fases anteriores e valores', async () => {
    save.mockResolvedValue({});
    render(<QuotePhaseEditor quote={quote} phase="forClosing" />);
    fireEvent.click(screen.getByRole('button', { name: /Editar status/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fechada' }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ status_enviada: true, status_em_fechamento: true, status_fechada: true, status_caida: false, data_envio: '2026-09-15', valor_fechamento: '123.45' })));
  });
  it('cancelar descarta as alterações', () => {
    render(<QuotePhaseEditor quote={quote} phase="forClosing" />);
    fireEvent.click(screen.getByRole('button', { name: /Editar status/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Caída' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Editar status/ }));
    expect(screen.getByRole('checkbox', { name: 'Caída' })).not.toBeChecked();
  });
});
