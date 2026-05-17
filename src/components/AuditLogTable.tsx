import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useOrderHistory, type AuditLog } from '@/hooks/useOrderHistory'

// --- ActionBadge ---
// Props: action — o tipo da ação ('CREATE', 'UPDATE' ou 'DELETE')
// Retorna um Badge colorido conforme o tipo
function ActionBadge({ action }: { action: AuditLog['action'] }) {
  const config = {
    CREATE: { className: 'bg-green-100 text-green-800 hover:bg-green-100', label: 'Criado' },
    UPDATE: { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100', label: 'Atualizado' },
    DELETE: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Excluído' },
  }
  const { className, label } = config[action]
  return <Badge className={className}>{label}</Badge>
}

// --- AuditDiff ---
// Mostra apenas os campos que mudaram entre old_values e new_values
// Record<string, unknown> = objeto com chaves string; unknown = tipo não sabemos ainda
function AuditDiff({
  oldValues,
  newValues,
}: {
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
}) {
  // Set é uma coleção sem duplicatas — une as chaves dos dois objetos
  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ])

  // Filtra somente os campos cujos valores são diferentes
  // JSON.stringify converte objetos aninhados em string para comparação
  const changed = [...allKeys].filter(
    k => JSON.stringify(oldValues?.[k]) !== JSON.stringify(newValues?.[k])
  )

  if (changed.length === 0) return <span className="text-xs text-muted-foreground">Sem alterações</span>

  return (
    <div className="space-y-1 text-xs font-mono">
      {changed.map(key => (
        // key={key} é obrigatório em listas para o React rastrear cada item
        <div key={key} className="flex gap-2 flex-wrap">
          <span className="text-muted-foreground w-32 shrink-0">{key}</span>
          <span className="line-through text-red-500">{String(oldValues?.[key] ?? '—')}</span>
          <span>→</span>
          <span className="text-green-600">{String(newValues?.[key] ?? '—')}</span>
        </div>
      ))}
    </div>
  )
}

// --- AuditLogTable ---
// Componente principal exportado — recebe o ID do pedido e renderiza a tabela completa
// Props: pedidoId — string com o UUID do pedido
export function AuditLogTable({ pedidoId }: { pedidoId: string }) {
  // useOrderHistory busca os dados da API; data, isLoading, isError vêm do React Query
  const { data, isLoading, isError } = useOrderHistory(pedidoId, true)

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">Erro ao carregar histórico de auditoria.</p>
  }

  const logs = data?.audit_logs ?? []

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ação</TableHead>
          <TableHead>Quem</TableHead>
          <TableHead>Quando</TableHead>
          <TableHead>Alterações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map(log => (
          <TableRow key={log.id}>
            <TableCell>
              <ActionBadge action={log.action} />
            </TableCell>
            {/* .slice(0, 8) pega os primeiros 8 caracteres do UUID — só pra exibição */}
            <TableCell className="font-mono text-xs">{log.changed_by.slice(0, 8)}…</TableCell>
            <TableCell className="text-sm">
              {format(new Date(log.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </TableCell>
            <TableCell>
              {log.action === 'UPDATE' && (
                <AuditDiff oldValues={log.old_values} newValues={log.new_values} />
              )}
              {log.action === 'CREATE' && (
                <span className="text-green-600 text-xs">Registro criado</span>
              )}
              {log.action === 'DELETE' && (
                <span className="text-red-500 text-xs">Registro removido</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
