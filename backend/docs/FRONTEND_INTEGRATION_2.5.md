# Frontend Integration — Phase 2.5

**Documento:** Detalhamento técnico das fases de Auditoria e Conformidade  
**Fase:** 2.5 Audit & Compliance  
**Responsáveis:** Duda (2.5.1, 2.5.3), Gustavo (2.5.2), Peu (2.5.4)  
**Pré-requisito obrigatório:** Phases 2.3 e 2.4 concluídas (modais e listagens integradas com a API)  
**Atualizado em:** 12 de maio de 2026

---

## Contexto

Toda ação relevante no sistema — criação de pedidos, mudanças de status, atualizações de dados — já é registrada automaticamente no banco de dados desde a fase 2.2. O que falta é expor esses registros na interface: o usuário precisa conseguir ver quem fez o quê e quando, e o sistema precisa cumprir os requisitos da LGPD (exportação e exclusão de dados pessoais).

As tasks desta fase são majoritariamente de frontend. O backend está praticamente completo — os endpoints estão prontos e testados.

---

## Estado atual do backend

| Task | Endpoint | Status |
|---|---|---|
| 2.5.1 Status History | `GET /api/pedidos/{id}/history` | ✅ Pronto |
| 2.5.2 Audit Log Viewer | incluso em `GET /api/pedidos/{id}/history` | ✅ Pronto |
| 2.5.3 LGPD Data Export | `GET /api/users/{id}/data-export` | ✅ Pronto |
| 2.5.4 Data Deletion | `DELETE /api/users/{id}/delete-data` | ✅ Pronto |

**Observação sobre 2.5.2:** O backlog lista uma task de backend separada (`GET /api/orders/:id/audit`), mas esse endpoint já existe e retorna tanto `status_history` quanto `audit_logs` na mesma resposta de `GET /api/pedidos/{id}/history`. Não há necessidade de criar um endpoint adicional — o frontend deve consumir o que já existe.

---

## Versionamento

### Estratégia de branches

```
develop
  └── feature/status-history-ui       → Duda (2.5.1)
  └── feature/audit-log-viewer        → Gustavo (2.5.2)
  └── feature/lgpd-data-export        → Duda (2.5.3)
  └── feature/lgpd-data-deletion      → Peu (2.5.4)
```

- Branches criadas a partir de `develop`
- PRs abertos para `develop` ao finalizar
- 2.5.1 e 2.5.2 podem ser desenvolvidas em paralelo — consomem o mesmo endpoint, mas renderizam informações diferentes
- 2.5.3 e 2.5.4 são independentes e podem ser desenvolvidas em qualquer ordem

### Ordem de merge recomendada

1. `feature/status-history-ui` (Duda) → `develop`
2. `feature/audit-log-viewer` (Gustavo) → `develop`
3. `feature/lgpd-data-export` (Duda) → `develop`
4. `feature/lgpd-data-deletion` (Peu) → `develop`

---

## Phase 2.5.1 — Status History UI

**Responsável:** Duda  
**Onde adicionar:** painel de detalhes do pedido (dentro do OrderModal ou em uma aba lateral)

### O que a API retorna

```
GET /api/pedidos/{pedido_id}/history
Authorization: Bearer <token>
```

Resposta:

```json
{
  "order_id": "uuid",
  "status_history": [
    {
      "id": "uuid",
      "entity_type": "pedido",
      "entity_id": "uuid",
      "old_status": null,
      "new_status": "To Buy",
      "changed_by": "uuid-do-usuario",
      "changed_at": "2026-05-06T14:32:00Z",
      "reason": "Pedido criado"
    },
    {
      "id": "uuid",
      "entity_type": "pedido",
      "entity_id": "uuid",
      "old_status": "To Buy",
      "new_status": "Bought",
      "changed_by": "uuid-do-usuario",
      "changed_at": "2026-05-07T09:15:00Z",
      "reason": null
    }
  ],
  "audit_logs": [ ... ]
}
```

O array `status_history` já vem ordenado por `changed_at` ascendente (do mais antigo para o mais recente) — não é necessário ordenar no frontend.

### Como implementar

Criar um hook para buscar o histórico:

```tsx
function useOrderHistory(pedidoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['order-history', pedidoId],
    queryFn: () => apiClient.get(`/pedidos/${pedidoId}/history`).then(r => r.data),
    enabled: enabled && !!pedidoId,
    staleTime: 60_000,
  });
}
```

O `enabled` deve ser `true` somente quando o painel de histórico estiver visível — evita chamadas desnecessárias ao abrir qualquer pedido.

Estrutura do componente:

```tsx
function StatusTimeline({ pedidoId }: { pedidoId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useOrderHistory(pedidoId, open);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Ver histórico
      </Button>
      {open && (
        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            data?.status_history.map((entry, i) => (
              <TimelineEntry key={entry.id} entry={entry} isFirst={i === 0} />
            ))
          )}
        </div>
      )}
    </>
  );
}
```

### O que exibir em cada entrada da timeline

| Campo | Como exibir |
|---|---|
| `old_status → new_status` | Seta: "A Comprar → Comprado" (usar `STATUS_LABELS` para traduzir) |
| `changed_at` | Data e hora formatadas: `07/05/2026 às 09:15` |
| `changed_by` | UUID do usuário — resolver para nome (ver seção abaixo) |
| `reason` | Se presente: exibir em itálico abaixo da mudança. Se `null`: não exibir nada |

**Como resolver o nome do usuário:**  
O `changed_by` é um UUID. Por enquanto, o endpoint não resolve o nome automaticamente. Duas opções:

1. **Opção simples:** Exibir os primeiros 8 caracteres do UUID como identificador — `changed by: a1b2c3d4`
2. **Opção completa:** Buscar o nome via `GET /api/users/{id}` (requer permissão de admin) — implementar somente se o painel de histórico for acessível apenas por admins

Para o MVP, a opção 1 é suficiente.

**Primeira entrada:**  
Quando `old_status === null`, exibir como "Pedido criado" em vez de `null → To Buy`.

### Por que fazer assim

O histórico é lazy-loaded (só busca quando o usuário clica em "Ver histórico") porque a maioria dos usuários abre um pedido para editar, não para ver o histórico. Carregar sempre aumentaria o tempo de abertura do modal sem necessidade.

---

## Phase 2.5.2 — Audit Log Viewer

**Responsável:** Gustavo  
**Onde adicionar:** painel administrativo — visível somente para admins

### O que a API retorna

O mesmo endpoint `GET /api/pedidos/{id}/history` retorna `audit_logs` junto com `status_history`:

```json
{
  "order_id": "uuid",
  "status_history": [ ... ],
  "audit_logs": [
    {
      "id": "uuid",
      "entity_type": "pedido",
      "entity_id": "uuid",
      "action": "UPDATE",
      "changed_by": "uuid-do-usuario",
      "changed_at": "2026-05-07T09:15:00Z",
      "old_values": {
        "status": "To Buy",
        "valor_venda": "1500.00"
      },
      "new_values": {
        "status": "Bought",
        "valor_venda": "1500.00"
      },
      "ip_address": "192.168.1.10",
      "user_agent": "Mozilla/5.0 ..."
    }
  ]
}
```

`action` pode ser `"CREATE"`, `"UPDATE"` ou `"DELETE"`.  
`old_values` e `new_values` são objetos JSON livres — os campos variam de acordo com o que foi alterado.

### Como exibir o diff de valores

A parte mais importante do audit log é mostrar **o que mudou**. A UI deve comparar `old_values` e `new_values` e destacar somente os campos que foram alterados:

```tsx
function AuditDiff({ oldValues, newValues }: { oldValues: Record<string, any>, newValues: Record<string, any> }) {
  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ]);

  const changed = [...allKeys].filter(
    k => JSON.stringify(oldValues?.[k]) !== JSON.stringify(newValues?.[k])
  );

  return (
    <div className="space-y-1 text-xs font-mono">
      {changed.map(key => (
        <div key={key} className="flex gap-2">
          <span className="text-muted-foreground w-32 shrink-0">{key}</span>
          <span className="line-through text-red-500">{String(oldValues?.[key] ?? '—')}</span>
          <span>→</span>
          <span className="text-green-600">{String(newValues?.[key] ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}
```

**Por que filtrar somente o que mudou:** Os `new_values` às vezes incluem campos que não foram alterados (para fins de snapshot). Exibir tudo criaria ruído. O diff focado em mudanças reais é mais claro.

### Estrutura do componente

```tsx
function AuditLogTable({ pedidoId }: { pedidoId: string }) {
  const { data } = useOrderHistory(pedidoId, true);

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
        {data?.audit_logs.map(log => (
          <TableRow key={log.id}>
            <TableCell>
              <ActionBadge action={log.action} />
            </TableCell>
            <TableCell className="font-mono text-xs">
              {log.changed_by.slice(0, 8)}
            </TableCell>
            <TableCell>
              {format(new Date(log.changed_at), "dd/MM/yyyy 'às' HH:mm")}
            </TableCell>
            <TableCell>
              {log.action === 'UPDATE' && (
                <AuditDiff oldValues={log.old_values} newValues={log.new_values} />
              )}
              {log.action === 'CREATE' && (
                <span className="text-green-600 text-xs">Criado</span>
              )}
              {log.action === 'DELETE' && (
                <span className="text-red-500 text-xs">Removido</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Restrição de acesso

O audit log é sensível — mostra endereços IP e user agents. Envolver o componente em uma verificação de role antes de renderizar:

```tsx
const { user } = useAuth();
if (user?.role !== 'admin') return null;
```

### Por que fazer assim

Audit logs são para conformidade e investigação de incidentes, não para uso diário. Restringir a admins evita que vendedores vejam ações de outros usuários — o que não seria adequado do ponto de vista de privacidade.

---

## Phase 2.5.3 — LGPD Data Export

**Responsável:** Duda  
**Onde adicionar:** configurações de conta do usuário ou painel de admin

### O que a API retorna

```
GET /api/users/{user_id}/data-export
Authorization: Bearer <token>
```

Resposta:

```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome do Usuário",
    "role": "seller",
    "is_active": true,
    "totp_enabled": false,
    "created_at": "2026-01-10T10:00:00Z",
    "updated_at": "2026-05-07T09:00:00Z"
  },
  "audit_logs": [
    {
      "entity_type": "pedido",
      "entity_id": "uuid",
      "action": "CREATE",
      "changed_at": "2026-05-06T14:32:00Z",
      "new_values": { ... }
    },
    ...
  ]
}
```

O campo `audit_logs` contém todas as ações realizadas pelo usuário no sistema — criações, edições e exclusões de qualquer entidade onde o `changed_by` é o `user_id` solicitado.

### Como implementar o download de arquivo

O endpoint retorna JSON — para disponibilizar como download, o frontend precisa converter a resposta em arquivo sem redirecionar para outra página:

```tsx
const handleExport = async () => {
  try {
    const response = await apiClient.get(`/users/${userId}/data-export`);
    const blob = new Blob(
      [JSON.stringify(response.data, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dados_usuario_${userId.slice(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Dados exportados com sucesso');
  } catch (err) {
    toast.error(getApiError(err));
  }
};
```

**Por que criar um blob no frontend em vez de fazer o backend retornar um arquivo:**  
O endpoint de export foi desenhado como JSON puro para simplificar a implementação backend. A conversão para download acontece no cliente, o que é uma prática comum e não requer mudanças no backend.

### UI do botão

```tsx
function DataExportButton({ userId }: { userId: string }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // ... código acima
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exportando...</>
      ) : (
        <><Download className="h-4 w-4 mr-2" /> Exportar meus dados</>
      )}
    </Button>
  );
}
```

### Quem pode exportar

O endpoint aceita qualquer usuário autenticado (`get_current_user`), mas retorna somente os dados do `user_id` especificado na URL. Na prática:

- Um usuário pode exportar seus próprios dados: `GET /api/users/{meu-id}/data-export`
- Para exportar dados de outro usuário, é necessária permissão de admin (controlar no frontend ocultando o botão para não-admins)

Se o frontend usa o ID do usuário logado (`user.id` do contexto de auth), o caso de uso normal (exportação própria) funciona para qualquer role.

---

## Phase 2.5.4 — Data Deletion

**Responsável:** Peu  
**Onde adicionar:** painel administrativo — somente admins

### O que a API faz

```
DELETE /api/users/{user_id}/delete-data
Authorization: Bearer <token>  (admin required)
```

Resposta de sucesso:

```json
{
  "deleted": true,
  "user_id": "uuid-do-usuario"
}
```

Resposta quando usuário não encontrado:

```json
{
  "deleted": false,
  "reason": "User not found"
}
```

**O que o backend faz internamente:**
- Anonimiza o e-mail: `deleted_a1b2c3d4@anonimizado.invalid`
- Substitui o nome por `"Usuário Removido"`
- Apaga o hash de senha
- Desabilita o 2FA
- Marca o usuário como inativo (`is_active = false`)
- Registra a exclusão no audit log (trilha de auditoria preservada)
- NÃO exclui fisicamente o registro — apenas soft-delete + anonimização (conformidade com LGPD)

**Restrição crítica:** O endpoint exige `require_admin`. Qualquer chamada sem token de admin recebe `403 Forbidden`. O botão de exclusão deve ser renderizado somente para admins — nunca para usuários comuns.

### Como implementar

Criar um hook de mutation:

```tsx
function useDeleteUserData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/users/${userId}/delete-data`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### UI com confirmação em duas etapas

Esta ação é irreversível. A UI deve exigir confirmação explícita — um único clique acidental não pode disparar a exclusão:

```tsx
function DeleteUserDataButton({ userId, userName }: { userId: string; userName: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: deleteData, isPending } = useDeleteUserData();

  const handleConfirm = () => {
    deleteData(userId, {
      onSuccess: (data) => {
        if (data.deleted) {
          toast.success('Dados do usuário excluídos com sucesso');
          setConfirmOpen(false);
        } else {
          toast.error(data.reason ?? 'Falha na exclusão');
        }
      },
      onError: (err) => toast.error(getApiError(err)),
    });
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
      >
        Excluir dados do usuário
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir dados de {userName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O e-mail, nome e senha do usuário serão
              anonimizados. O histórico de auditoria será preservado conforme a LGPD.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending ? 'Excluindo...' : 'Confirmar exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Por que duas etapas de confirmação

A exclusão anonimiza dados permanentemente. Um `AlertDialog` com descrição explícita do que vai acontecer reduz erros acidentais e documenta visualmente para o admin que a ação tem consequências reais — não é um soft-toggle reversível.

### Onde não colocar

Não adicionar este botão em nenhuma área acessível por vendedores. Proteger com verificação de role tanto no componente quanto — idealmente — em uma rota de admin com guarda de autenticação:

```tsx
const { user } = useAuth();
if (user?.role !== 'admin') return <Navigate to="/" />;
```

---

## Padrões técnicos comuns

### Formatação de datas

Todas as datas da API vêm em ISO 8601 (`"2026-05-07T09:15:00Z"`). Para exibição consistente:

```tsx
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Timeline de histórico
format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

// Nome de arquivo de export
format(new Date(), 'yyyy-MM-dd');
```

### Tratamento de erros da API

Todos os erros seguem o formato `{ "detail": "mensagem" }`. Usar o helper já existente:

```tsx
import { getApiError } from '@/api/client';
// ...
onError: (err) => toast.error(getApiError(err)),
```

### Autenticação

O `apiClient` já envia o `Authorization: Bearer <token>` automaticamente via interceptor. Não é necessário passar o token manualmente em nenhuma das chamadas desta fase.

### Verificação de role

Todos os componentes desta fase envolvem dados sensíveis. Centralizar a verificação de permissão no contexto de auth:

```tsx
const { user } = useAuth();
const isAdmin = user?.role === 'admin';
```

Usar `isAdmin` para condicionar a renderização de botões e seções administrativas.

---

## Critérios de conclusão

### 2.5.1 — Status History UI

- [x] Timeline de status visível dentro do modal do pedido
- [x] Cada entrada mostra: status anterior → novo status, data/hora e responsável
- [x] Primeira entrada (`old_status: null`) exibida como "Pedido criado"
- [x] Razão (`reason`) exibida quando presente
- [x] Skeleton de carregamento enquanto a API responde
- [x] Timeline carregada lazy (somente quando o usuário abre a seção)

### 2.5.2 — Audit Log Viewer

- [x] Tabela de audit logs visível no painel admin
- [x] Coluna de ação: CREATE / UPDATE / DELETE com badges distintos
- [x] Diff de valores exibido para ações UPDATE (somente campos alterados)
- [x] Data e hora formatadas
- [x] Componente não renderizado para usuários não-admin

### 2.5.3 — LGPD Data Export

- [x] Botão "Exportar meus dados" disponível nas configurações de conta
- [x] Clique dispara chamada ao `GET /api/users/{id}/data-export`
- [x] Download do arquivo `.json` iniciado automaticamente no navegador
- [x] Nome do arquivo inclui ID parcial do usuário e data atual
- [x] Estado de carregamento visível durante a requisição
- [x] Toast de sucesso após download iniciado
- [x] Toast de erro se a API falhar

### 2.5.4 — Data Deletion

- [x] Botão "Deletar minha conta" disponível na página Minha Conta (self-service — qualquer usuário pode deletar a própria conta)
- [ ] Botão de exclusão de outro usuário disponível somente no painel admin (não implementado)
- [x] Dialog de confirmação exibido ao clicar (checkbox + confirmação de senha)
- [x] Descrição clara do que será apagado no dialog
- [x] Mutation chamada somente após confirmação explícita
- [x] Feedback de sucesso após exclusão (step de sucesso + logout automático)
- [x] Toast de erro se a API falhar ou retornar `deleted: false`
- [ ] Lista de usuários atualizada automaticamente após exclusão (não aplicável — usuário é deslogado após deletar a própria conta)
