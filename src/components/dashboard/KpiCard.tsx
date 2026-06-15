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
    <div
      className={cn('relative', borderAccent)}
      style={{
        background: '#fff',
        border: '1px solid #E2E8F1',
        borderRadius: 14,
        boxShadow: '0 4px 16px -8px rgba(13,33,66,.10)',
        padding: '16px 18px',
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#5B6B82', margin: 0 }}>
        {label}
      </p>
      <p className={cn('text-2xl font-bold mt-1', accent || 'text-[#16273F]')}
         style={{ fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.2 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: '#8899AE', marginTop: 4 }}>{sub}</p>
      )}
      {badge && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: 10, color: '#5B6B82',
          background: '#F1F5FA', padding: '2px 7px', borderRadius: 6,
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}
