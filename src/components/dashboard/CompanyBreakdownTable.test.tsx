import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CompanyBreakdownTable } from './CompanyBreakdownTable'
import { BreakdownItem } from '@/hooks/use-dashboard-query'

const mockItems: BreakdownItem[] = [
  { nome: 'Empresa Alpha', receita: 10000, custo: 6000, lucro: 4000, margem: 0.4, num_pedidos: 50 },
  { nome: 'Empresa Beta', receita: 5000, custo: 6000, lucro: -1000, margem: -0.2, num_pedidos: 20 },
]

describe('CompanyBreakdownTable', () => {
  it('loading=true renders skeletons and not data rows', () => {
    render(<CompanyBreakdownTable items={[]} loading={true} />)
    expect(screen.queryByText('Nenhum dado para o período')).not.toBeInTheDocument()
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('items=[] with loading=false renders empty message', () => {
    render(<CompanyBreakdownTable items={[]} loading={false} />)
    expect(screen.getByText('Nenhum dado para o período')).toBeInTheDocument()
  })

  it('renders company name and formatted values', () => {
    render(<CompanyBreakdownTable items={mockItems} loading={false} />)
    expect(screen.getByText('Empresa Alpha')).toBeInTheDocument()
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument()
    expect(screen.getByText('40.0%')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('positive lucro cell has text-green-700 class', () => {
    render(<CompanyBreakdownTable items={[mockItems[0]]} loading={false} />)
    const cell = screen.getByText(/4[\.,]000/)
    expect(cell).toHaveClass('text-green-700')
  })

  it('negative lucro cell has text-red-600 class', () => {
    render(<CompanyBreakdownTable items={[mockItems[1]]} loading={false} />)
    const cell = screen.getByText(/-.*1[\.,]000/)
    expect(cell).toHaveClass('text-red-600')
  })
})
