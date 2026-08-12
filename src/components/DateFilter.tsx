import { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export type DateRange = { from?: Date; to?: Date };

interface Props {
  field: string;
  onFieldChange: (v: string) => void;
  fieldOptions: { value: string; label: string }[];
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}

/**
 * Combined date filter: parameter selector lives INSIDE the popover,
 * not next to the calendar trigger.
 */
export const DateFilter = memo(({ field, onFieldChange, fieldOptions, range, onRangeChange }: Props) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const hasRange = !!range.from;
  const fieldLabel = fieldOptions.find(o => o.value === field)?.label || '';
  const label = hasRange
    ? `${fieldLabel}: ${range.to && range.to.getTime() !== range.from!.getTime()
        ? `${format(range.from!, 'dd/MM/yy')} → ${format(range.to, 'dd/MM/yy')}`
        : format(range.from!, 'dd/MM/yyyy')}`
    : 'Período';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2 bg-white', hasRange && 'text-secondary border-secondary')}>
          <CalendarIcon className="h-4 w-4" />{label}
        </Button>
      </PopoverTrigger>
      {/*
        Em telas baixas (notebook 768px de altura) o popover inteiro não cabe e
        o calendário ficava cortado, sem acesso a "Aplicar". A altura é limitada
        ao espaço que o Radix calcula até a borda da janela e só o calendário
        rola — cabeçalho e botões ficam sempre visíveis.
      */}
      <PopoverContent
        className="w-auto p-0 flex flex-col max-h-[var(--radix-popover-content-available-height)] max-w-[var(--radix-popover-content-available-width)]"
        align="end"
        collisionPadding={12}
      >
        <div className="p-3 border-b bg-muted/30 shrink-0">
          <Label className="text-xs font-bold uppercase text-secondary mb-2 block">Filtrar Por</Label>
          <RadioGroup value={field} onValueChange={onFieldChange} className="gap-1">
            {fieldOptions.map(o => (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                <RadioGroupItem value={o.value} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <Calendar
            mode="range"
            selected={range as any}
            onSelect={(r: any) => onRangeChange(r || {})}
            locale={ptBR}
            numberOfMonths={isMobile ? 1 : 2}
            className="p-3 pointer-events-auto"
          />
        </div>
        <div className="p-2 border-t flex justify-between shrink-0">
          <Button size="sm" variant="ghost" onClick={() => { onRangeChange({}); }}>Limpar</Button>
          <Button size="sm" onClick={() => setOpen(false)} className="bg-secondary hover:bg-secondary/90">Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
DateFilter.displayName = 'DateFilter';
