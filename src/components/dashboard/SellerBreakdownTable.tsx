import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SellerBreakdownItem } from '@/hooks/use-dashboard-query'

interface SellerBreakdownTableProps {
  items: SellerBreakdownItem[]
  loading: boolean
}

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT = (v: number) => `${(v * 100).toFixed(1)}%`
const COLS = 11

export function SellerBreakdownTable({ items, loading }: SellerBreakdownTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendedor</TableHead>
            <TableHead>Faturamento</TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>Lucro</TableHead>
            <TableHead>Margem</TableHead>
            <TableHead>Pedidos</TableHead>
            <TableHead>Cancelamentos</TableHead>
            <TableHead>Perda (Canc.)</TableHead>
            <TableHead>Ticket Venda</TableHead>
            <TableHead>Ticket Custo</TableHead>
            <TableHead>Ticket Lucro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: COLS }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLS} className="text-center text-muted-foreground">
                Nenhum dado para o período
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id_vendedor}>
                <TableCell className="font-medium">{item.nome}</TableCell>
                <TableCell>{BRL(item.receita)}</TableCell>
                <TableCell>{BRL(item.custo)}</TableCell>
                <TableCell className={cn(item.lucro >= 0 ? 'text-green-700' : 'text-red-600')}>
                  {BRL(item.lucro)}
                </TableCell>
                <TableCell>{PCT(item.margem)}</TableCell>
                <TableCell>{item.num_pedidos}</TableCell>
                <TableCell className={cn(item.num_cancelamentos > 0 && 'text-red-600')}>
                  {item.num_cancelamentos}
                </TableCell>
                <TableCell className={cn(item.valor_cancelamentos > 0 && 'text-red-600')}>
                  {BRL(item.valor_cancelamentos)}
                </TableCell>
                <TableCell>{BRL(item.ticket_venda)}</TableCell>
                <TableCell>{BRL(item.ticket_custo)}</TableCell>
                <TableCell className={cn(item.ticket_lucro >= 0 ? 'text-green-700' : 'text-red-600')}>
                  {BRL(item.ticket_lucro)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
