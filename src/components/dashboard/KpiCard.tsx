import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', accent || 'text-secondary')}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
