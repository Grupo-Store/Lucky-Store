import { useState } from 'react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  badge?: string;
  borderAccent?: string;
  /** Quando fornecido, o card vira um botão clicável (com hover e foco). */
  onClick?: () => void;
}

export function KpiCard({ label, value, sub, accent, badge, borderAccent, onClick }: KpiCardProps) {
  const clickable = typeof onClick === 'function';
  const [hover, setHover] = useState(false);
  const lifted = clickable && hover;

  return (
    <div
      className={cn('relative', borderAccent)}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onMouseEnter={clickable ? () => setHover(true) : undefined}
      onMouseLeave={clickable ? () => setHover(false) : undefined}
      onFocus={clickable ? () => setHover(true) : undefined}
      onBlur={clickable ? () => setHover(false) : undefined}
      onKeyDown={
        clickable
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      style={{
        background: '#fff',
        border: `1px solid ${lifted ? '#2F6BFF' : '#E2E8F1'}`,
        borderRadius: 14,
        boxShadow: lifted
          ? '0 10px 26px -10px rgba(47,107,255,.35)'
          : '0 4px 16px -8px rgba(13,33,66,.10)',
        padding: '16px 18px',
        cursor: clickable ? 'pointer' : undefined,
        transform: lifted ? 'translateY(-2px)' : undefined,
        transition: 'box-shadow .15s ease, transform .15s ease, border-color .15s ease',
        outline: 'none',
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
