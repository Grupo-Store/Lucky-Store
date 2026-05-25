import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SellerBreakdownTable } from './SellerBreakdownTable'
import { SellerBreakdownItem } from '@/hooks/use-dashboard-query'

const mockItems: SellerBreakdownItem[] = [
  {
    id_vendedor: 'v1',
    nome: 'João Silva',
    receita: 10000,
    custo: 6000,
    lucro: 4000,
    margem: 0.4,
    num_pedidos: 20,
  },
  {
    id_vendedor: 'v2',
    nome: 'Maria Souza',
    receita: 5000,
    custo: 6000,
    lucro: -1000,
    margem: -0.2,
    num_pedidos: 10,
  },
]

describe('SellerBreakdownTable', () => {
  it('loading=true does not render "Nenhum dado para o período"', () => {
    render(<SellerBreakdownTable items={[]} loading={true} />)
    expect(screen.queryByText('Nenhum dado para o período')).not.toBeInTheDocument()
  })

  it('items=[] with loading=false renders "Nenhum dado para o período"', () => {
    render(<SellerBreakdownTable items={[]} loading={false} />)
    expect(screen.getByText('Nenhum dado para o período')).toBeInTheDocument()
  })

  it('with populated items renders item.nome and BRL-formatted values', () => {
    render(<SellerBreakdownTable items={mockItems} loading={false} />)
    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText(/10\.000/)).toBeInTheDocument()
  })

  it('header has "Vendedor" and not "Empresa"', () => {
    render(<SellerBreakdownTable items={[]} loading={false} />)
    expect(screen.getByText('Vendedor')).toBeInTheDocument()
    expect(screen.queryByText('Empresa')).not.toBeInTheDocument()
  })

  it('negative lucro has class text-red-600', () => {
    render(<SellerBreakdownTable items={mockItems} loading={false} />)
    const negativeLucro = screen.getByText((content) => content.includes('-') && content.includes('1.000,00'))
    expect(negativeLucro).toHaveClass('text-red-600')
  })
})
