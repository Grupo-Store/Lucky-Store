import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  badge?: string;
  borderAccent?: string;
}

export function KpiCard({ label, value, sub, accent, badge, borderAccent }: KpiCardProps) {
  return (
    <Card className={cn('relative', borderAccent)}>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', accent || 'text-secondary')}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
      {badge && (
        <span className="absolute top-2.5 right-2.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </Card>
  );
}
