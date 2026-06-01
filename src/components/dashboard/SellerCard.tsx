import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SellerBreakdownItem } from '@/hooks/use-dashboard-query';

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface SellerCardProps {
  item: SellerBreakdownItem;
  metaDiaria?: number | null;
  gapMeta?: number | null;
  projecaoMes?: number;
  hasGoal?: boolean;
}

interface RowProps {
  label: string;
  value: React.ReactNode;
}

function StatRow({ label, value }: RowProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function SellerCard({
  item,
  metaDiaria = null,
  gapMeta = null,
  projecaoMes = 0,
  hasGoal = false,
}: SellerCardProps) {
  const gapColor =
    gapMeta == null ? 'text-orange-500' : gapMeta > 0 ? 'text-orange-500' : 'text-green-700';

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <h3 className="text-xl font-bold text-secondary mb-4">{item.nome}</h3>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
          <StatRow
            label="Lucro"
            value={
              <span className={cn(item.lucro >= 0 ? 'text-green-700' : 'text-red-600')}>
                {BRL(item.lucro)}
              </span>
            }
          />
          <StatRow label="Vendas" value={item.num_pedidos} />
          <StatRow label="Valor das Vendas" value={BRL(item.receita)} />
          <StatRow
            label="Meta Diária"
            value={
              metaDiaria != null ? (
                BRL(metaDiaria)
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <StatRow
            label="Gap p/ Meta"
            value={
              gapMeta != null ? (
                <span className={gapColor}>{BRL(gapMeta)}</span>
              ) : (
                <span className="text-orange-500">—</span>
              )
            }
          />
          <StatRow label="Projeção Mês" value={BRL(projecaoMes)} />
        </div>

        <div className="border-t pt-3 grid grid-cols-3 gap-3">
          <StatRow label="Méd. Custo" value={BRL(item.ticket_custo)} />
          <StatRow label="Méd. Venda" value={BRL(item.ticket_venda)} />
          <StatRow
            label="Méd. Lucro"
            value={
              <span className={cn(item.ticket_lucro >= 0 ? 'text-green-700' : 'text-red-600')}>
                {BRL(item.ticket_lucro)}
              </span>
            }
          />
        </div>

        {!hasGoal && (
          <p className="text-xs text-muted-foreground italic mt-3 text-center">
            Sem meta cadastrada para este vendedor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
