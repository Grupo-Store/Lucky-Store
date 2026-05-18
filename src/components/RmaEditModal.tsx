import { useState, useEffect, KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { apiClient, getApiError } from '@/api/client';
import { RmaStatusTimeline } from '@/components/StatusTimeline';
import { rmaKeys } from '@/api/hooks/useRma';
import type { RmaResponse, ItemRmaStatus } from '@/types/api';

const ITEM_STATUS_OPTIONS: { value: ItemRmaStatus; label: string; color: string }[] = [
  { value: 'Not Received',          label: 'Não Recebido',          color: 'bg-slate-50 text-slate-600 border-slate-300' },
  { value: 'Received',              label: 'Recebido',              color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'Sent for Repair',       label: 'Enviado para Reparo',   color: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { value: 'In Repair',             label: 'Em Reparo',             color: 'bg-orange-50 text-orange-700 border-orange-300' },
  { value: 'Repaired Not Received', label: 'Reparado Não Recebido', color: 'bg-purple-50 text-purple-700 border-purple-300' },
  { value: 'Repaired Received',     label: 'Reparado Recebido',     color: 'bg-teal-50 text-teal-700 border-teal-300' },
  { value: 'To Pack',               label: 'A Embalar',             color: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  { value: 'Ready for Delivery',    label: 'Pronto p/ Entrega',     color: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  { value: 'Out for Delivery',      label: 'Em Entrega',            color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'Delivered',             label: 'Entregue',              color: 'bg-green-100 text-green-800 border-green-400' },
];

const itemStatusColor = (s: string) =>
  ITEM_STATUS_OPTIONS.find(o => o.value === s)?.color ?? 'bg-muted text-muted-foreground border-border';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
}

interface LocalItem {
  id: string;
  descricao: string;
  quantidade: number;
  status: ItemRmaStatus;
  consertado_por: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  rma: RmaResponse | null;
}

export function RmaEditModal({ open, onClose, rma }: Props) {
  const qc = useQueryClient();
  const [localPrazo, setLocalPrazo] = useState<string>('');
  const [prazoOpen, setPrazoOpen] = useState(false);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rma && open) {
      setLocalPrazo(rma.prazo_entrega ?? '');
      setLocalItems(rma.itens.map(i => ({
        id: i.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        status: i.status,
        consertado_por: i.consertado_por ?? '',
      })));
    }
  }, [rma, open]);

  if (!rma) return null;

  const updateItem = (id: string, field: keyof LocalItem, value: string) =>
    setLocalItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (localPrazo !== (rma.prazo_entrega ?? '')) {
        await apiClient.patch(`/rma/${rma.id}`, { prazo_entrega: localPrazo || undefined });
      }

      for (const item of localItems) {
        const orig = rma.itens.find(i => i.id === item.id);
        if (orig && (item.status !== orig.status || item.consertado_por !== (orig.consertado_por ?? ''))) {
          await apiClient.patch(`/rma/${rma.id}/items/${item.id}/status`, {
            new_status: item.status,
            consertado_por: item.consertado_por || undefined,
          });
        }
      }

      qc.invalidateQueries({ queryKey: rmaKeys.lists() });
      qc.invalidateQueries({ queryKey: rmaKeys.history(rma.id) });
      toast.success('RMA atualizado com sucesso!');
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl">
            RMA: {rma.numero_rma}
          </DialogTitle>
        </DialogHeader>

        {/* ===== Informações Gerais ===== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Nº RMA</Label>
              <Input readOnly value={rma.numero_rma} className="bg-muted border-border font-semibold" />
            </div>
            <div>
              <Label>Pedido Origem</Label>
              <Input readOnly value={rma.numero_os_origem ?? rma.id_pedido_origem} className="bg-muted border-border" />
            </div>
            <div>
              <Label>Data de Registro</Label>
              <Input readOnly value={fmtDate(rma.data_registro)} className="bg-muted border-border" />
            </div>
            <div>
              <Label>Prazo de Entrega</Label>
              <Popover open={prazoOpen} onOpenChange={setPrazoOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localPrazo ? fmtDate(localPrazo) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={localPrazo ? new Date(localPrazo + 'T12:00:00') : undefined}
                    onSelect={d => { setLocalPrazo(d ? format(d, 'yyyy-MM-dd') : ''); setPrazoOpen(false); }}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </section>

        {/* ===== Itens ===== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">
            Itens do RMA <span className="text-xs text-muted-foreground font-normal normal-case">({localItems.length})</span>
          </h3>
          <div className="space-y-3">
            {localItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item neste RMA</p>
            )}
            {localItems.map((item, idx) => (
              <div key={item.id} className="border rounded-md p-3 bg-muted/20">
                <span className="text-xs font-bold uppercase text-secondary mb-2 block">Item #{idx + 1}</span>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="md:col-span-2">
                    <Label>Produto</Label>
                    <Input readOnly value={item.descricao} className="bg-muted border-border" />
                  </div>
                  <div>
                    <Label>Quantidade</Label>
                    <Input readOnly value={item.quantidade} className="bg-muted border-border" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={item.status} onValueChange={v => updateItem(item.id, 'status', v)}>
                      <SelectTrigger className={cn('border', itemStatusColor(item.status))}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', opt.color)}>{opt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Reparado por</Label>
                    <Input
                      className="bg-white border-border"
                      value={item.consertado_por}
                      onChange={e => updateItem(item.id, 'consertado_por', e.target.value)}
                      onKeyDown={handleEnterBlur}
                      placeholder="Fornecedor / técnico"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <RmaStatusTimeline rmaId={rma.id} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-secondary hover:bg-secondary/90">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
