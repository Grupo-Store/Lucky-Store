import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashboardTicketBar } from './DashboardTicketBar'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}))

describe('DashboardTicketBar', () => {
  it('renderiza o título "Ticket Médio — Comparativo"', () => {
    render(<DashboardTicketBar ticketCusto={100} ticketVenda={200} ticketLucro={50} />)
    expect(screen.getByText('Ticket Médio — Comparativo')).toBeInTheDocument()
  })

  it('renderiza o data-testid="bar-chart"', () => {
    render(<DashboardTicketBar ticketCusto={100} ticketVenda={200} ticketLucro={50} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('não crasha com valores zero', () => {
    render(<DashboardTicketBar ticketCusto={0} ticketVenda={0} ticketLucro={0} />)
    expect(screen.getByText('Ticket Médio — Comparativo')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})
