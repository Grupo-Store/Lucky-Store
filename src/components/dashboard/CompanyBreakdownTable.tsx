import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BreakdownItem } from '@/hooks/use-dashboard-query'

interface CompanyBreakdownTableProps {
  items: BreakdownItem[]
  loading: boolean
}

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT = (v: number) => `${(v * 100).toFixed(1)}%`
const COLS = 11

const COMPANY_DOT: Record<string, string> = {
  'Lucky Store': 'bg-green-500',
  'BTech':       'bg-blue-500',
  'AJJ':         'bg-amber-500',
}

export function CompanyBreakdownTable({ items, loading }: CompanyBreakdownTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Faturamento</TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>Lucro</TableHead>
            <TableHead>Margem</TableHead>
            <TableHead>Pedidos</TableHead>
            <TableHead>Canc.</TableHead>
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
            items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', COMPANY_DOT[item.nome] ?? 'bg-muted-foreground')} />
                    {item.nome}
                  </div>
                </TableCell>
                <TableCell>{BRL(item.receita)}</TableCell>
                <TableCell>{BRL(item.custo)}</TableCell>
                <TableCell className={cn(item.lucro >= 0 ? 'text-green-700' : 'text-red-600')}>
                  {BRL(item.lucro)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(item.margem * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{PCT(item.margem)}</span>
                  </div>
                </TableCell>
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
