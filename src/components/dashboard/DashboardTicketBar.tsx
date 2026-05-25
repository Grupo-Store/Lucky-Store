import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface DashboardTicketBarProps {
  ticketCusto: number
  ticketVenda: number
  ticketLucro: number
}

export function DashboardTicketBar({ ticketCusto, ticketVenda, ticketLucro }: DashboardTicketBarProps) {
  const data = [
    { name: 'Custo', value: ticketCusto },
    { name: 'Venda', value: ticketVenda },
    { name: 'Lucro', value: ticketLucro },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-secondary">Ticket Médio — Comparativo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Bar dataKey="value" fill="hsl(192, 76%, 29%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
