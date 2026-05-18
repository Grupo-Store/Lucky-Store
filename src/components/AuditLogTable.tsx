import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { apiClient } from '@/api/client'
import { useUserName } from '@/api/hooks/useUsers'

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_at: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
}

function ActionBadge({ action }: { action: AuditLog['action'] }) {
  const config = {
    CREATE: { className: 'bg-green-100 text-green-800 hover:bg-green-100', label: 'Criado' },
    UPDATE: { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100', label: 'Atualizado' },
    DELETE: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Excluído' },
  }
  const { className, label } = config[action]
  return <Badge className={className}>{label}</Badge>
}

function AuditDiff({
  oldValues,
  newValues,
}: {
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
}) {
  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ])
  const changed = [...allKeys].filter(
    k => JSON.stringify(oldValues?.[k]) !== JSON.stringify(newValues?.[k])
  )
  if (changed.length === 0) return <span className="text-xs text-muted-foreground">Sem alterações</span>
  return (
    <div className="space-y-1 text-xs font-mono">
      {changed.map(key => (
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

function UserCell({ userId }: { userId: string }) {
  const name = useUserName(userId)
  return <TableCell className="text-sm">{name}</TableCell>
}

function AuditLogRow({ log }: { log: AuditLog }) {
  return (
    <TableRow>
      <TableCell><ActionBadge action={log.action} /></TableCell>
      <UserCell userId={log.changed_by} />
      <TableCell className="text-sm">
        {format(new Date(log.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </TableCell>
      <TableCell>
        {log.action === 'UPDATE' && (
          <AuditDiff oldValues={log.old_values} newValues={log.new_values} />
        )}
        {log.action === 'CREATE' && <span className="text-green-600 text-xs">Registro criado</span>}
        {log.action === 'DELETE' && <span className="text-red-500 text-xs">Registro removido</span>}
      </TableCell>
    </TableRow>
  )
}

interface AuditLogTableProps {
  historyUrl: string
  queryKey: string[]
}

export function AuditLogTable({ historyUrl, queryKey }: AuditLogTableProps) {
  const { data, isLoading, isError } = useQuery<{ audit_logs: AuditLog[] }>({
    queryKey,
    queryFn: () => apiClient.get(historyUrl).then(r => r.data),
  })

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
        {logs.map(log => <AuditLogRow key={log.id} log={log} />)}
      </TableBody>
    </Table>
  )
}
